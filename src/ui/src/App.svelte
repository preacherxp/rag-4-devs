<script lang="ts">
  import { onMount } from "svelte";
  import { chat, docs, ui, quiz } from "./lib/state.svelte";
  import {
    fetchStatus,
    fetchModels,
    fetchSessions,
    fetchLatestSession,
    fetchSession,
    fetchDocuments,
    createSession,
    deleteSession,
    deleteDocument as apiDeleteDoc,
    patchSessionModel,
    streamChat,
    fetchQuizzes,
    fetchQuiz,
    deleteQuizApi,
  } from "./lib/api";
  import type { Source } from "./lib/types";
  import Sidebar from "./components/Sidebar.svelte";
  import ChatArea from "./components/ChatArea.svelte";
  import InputArea from "./components/InputArea.svelte";
  import PreviewPanel from "./components/PreviewPanel.svelte";
  import Lightbox from "./components/Lightbox.svelte";
  import QuizSetup from "./components/QuizSetup.svelte";
  import QuizView from "./components/QuizView.svelte";

  let streamingContent = $state("");
  let streamingSources = $state<Source[]>([]);
  let showTyping = $state(false);
  let inputArea: InputArea | undefined = $state();

  type View = "chat" | "quiz-setup" | "quiz" | "quiz-results";

  interface Route {
    view: View;
    sessionId: string | null;
    documentId: number | null;
    fullscreen: boolean;
    quizId: string | null;
  }

  let currentView = $state<View>("chat");

  function parseHash(): Route {
    const hash = location.hash.replace(/^#\/?/, "");

    // Quiz routes
    if (hash === "quiz/new") {
      return { view: "quiz-setup", sessionId: null, documentId: null, fullscreen: false, quizId: null };
    }
    const quizResults = hash.match(/^quiz\/([^/]+)\/results$/);
    if (quizResults) {
      return { view: "quiz-results", sessionId: null, documentId: null, fullscreen: false, quizId: quizResults[1]! };
    }
    const quizMatch = hash.match(/^quiz\/([^/]+)$/);
    if (quizMatch) {
      return { view: "quiz", sessionId: null, documentId: null, fullscreen: false, quizId: quizMatch[1]! };
    }

    // #/session/{id}/document/{docId}(/full)
    const full = hash.match(/^session\/([^/]+)\/document\/([^/]+)(\/full)?$/);
    if (full) return { view: "chat", sessionId: full[1], documentId: Number(full[2]), fullscreen: !!full[3], quizId: null };

    // #/session/{id}
    const sess = hash.match(/^session\/([^/]+)$/);
    if (sess) return { view: "chat", sessionId: sess[1], documentId: null, fullscreen: false, quizId: null };

    // Legacy: #/document/{id}(/full)
    const doc = hash.match(/^document\/([^/]+)(\/full)?$/);
    if (doc) return { view: "chat", sessionId: null, documentId: Number(doc[1]), fullscreen: !!doc[2], quizId: null };

    return { view: "chat", sessionId: null, documentId: null, fullscreen: false, quizId: null };
  }

  function buildHash(
    sessionId: string | null,
    documentId: number | null,
    fullscreen: boolean,
  ): string {
    if (!sessionId && !documentId) return "#/";
    let h = "#/";
    if (sessionId) h += `session/${sessionId}`;
    if (documentId) h += `${sessionId ? "/" : ""}document/${documentId}`;
    if (fullscreen) h += "/full";
    return h;
  }

  function pushHash(sessionId: string | null, documentId: number | null, fullscreen: boolean) {
    history.pushState(null, "", buildHash(sessionId, documentId, fullscreen));
  }

  async function handleRoute() {
    const route = parseHash();
    currentView = route.view;

    // Handle quiz routes
    if (route.view === "quiz-setup") {
      quiz.activeId = null;
      quiz.activeQuiz = null;
      return;
    }
    if (route.view === "quiz" || route.view === "quiz-results") {
      if (route.quizId && route.quizId !== quiz.activeId) {
        try {
          quiz.activeQuiz = await fetchQuiz(route.quizId);
          quiz.activeId = route.quizId;
          quiz.currentQuestionIndex = 0;
        } catch { /* ignore */ }
      }
      return;
    }

    // Handle session navigation
    if (route.sessionId && route.sessionId !== chat.sessionId && !chat.isStreaming) {
      await handleSwitchSession(route.sessionId, false);
    }

    // Handle document preview
    if (route.documentId) {
      ui.previewFullscreen = route.fullscreen;
      if (route.documentId !== docs.selectedId) {
        docs.selectedId = route.documentId;
        ui.previewOpen = true;
      }
    } else {
      ui.previewOpen = false;
      ui.previewFullscreen = false;
      docs.selectedId = null;
    }
  }

  function parseModelValue(value: string) {
    const idx = value.indexOf(":");
    if (idx === -1) return { provider: "lmstudio", model: value };
    return { provider: value.slice(0, idx), model: value.slice(idx + 1) };
  }

  // ── Actions ──

  async function handleModelChange(value: string) {
    if (!chat.sessionId || !value || chat.isStreaming) return;
    const selected = parseModelValue(value);
    const prev = { model: chat.model, provider: chat.provider };

    chat.model = selected.model;
    chat.provider = selected.provider;

    try {
      const session = await patchSessionModel(chat.sessionId, selected.model, selected.provider);
      chat.model = session.model;
      chat.provider = session.provider || "lmstudio";
    } catch (e) {
      chat.model = prev.model;
      chat.provider = prev.provider;
    }
  }

  async function handleNewChat() {
    if (chat.isStreaming) return;
    const selected = parseModelValue(
      `${chat.provider}:${chat.model || chat.defaultModel}`,
    );
    const session = await createSession(selected.model, selected.provider);
    chat.sessionId = session.id;
    chat.model = session.model;
    chat.provider = session.provider || "lmstudio";
    chat.messages = session.messages || [];
    chat.sessions = await fetchSessions();
    pushHash(session.id, null, false);
    inputArea?.focus();
  }

  async function handleSwitchSession(id: string, updateHash = true) {
    if (chat.isStreaming || id === chat.sessionId) return;
    try {
      const session = await fetchSession(id);
      chat.sessionId = session.id;
      chat.model = session.model;
      chat.provider = session.provider || "lmstudio";
      chat.messages = session.messages || [];
      if (updateHash) pushHash(session.id, docs.selectedId, ui.previewFullscreen);
    } catch {
      /* ignore */
    }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm("Delete this conversation?")) return;
    try {
      await deleteSession(id);
      chat.sessions = chat.sessions.filter((s) => s.id !== id);
      if (id === chat.sessionId) {
        if (chat.sessions.length > 0) {
          await handleSwitchSession(chat.sessions[0].id);
        } else {
          await handleNewChat();
        }
      }
    } catch {
      /* ignore */
    }
  }

  function handleSelectDoc(id: number) {
    docs.selectedId = id;
    ui.previewOpen = true;
    pushHash(chat.sessionId || null, id, ui.previewFullscreen);
  }

  function handleFocusDoc(id: number) {
    docs.focusedId = docs.focusedId === id ? null : id;
  }

  async function handleDeleteDoc(id: number) {
    if (!confirm("Remove this document from the index?")) return;
    try {
      await apiDeleteDoc(id);
      docs.list = docs.list.filter((d) => d.id !== id);
      if (id === docs.selectedId) {
        docs.selectedId = null;
        ui.previewOpen = false;
      }
      if (id === docs.focusedId) docs.focusedId = null;
      // Refresh status
      try {
        const status = await fetchStatus();
        ui.status = status;
        ui.statusError = false;
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }

  // ── Quiz Actions ──

  function handleNewQuiz() {
    history.pushState(null, "", "#/quiz/new");
    handleRoute();
  }

  async function handleSelectQuiz(id: string) {
    history.pushState(null, "", `#/quiz/${id}`);
    await handleRoute();
  }

  async function handleDeleteQuiz(id: string) {
    if (!confirm("Delete this quiz?")) return;
    try {
      await deleteQuizApi(id);
      quiz.list = quiz.list.filter((q) => q.id !== id);
      if (id === quiz.activeId) {
        quiz.activeId = null;
        quiz.activeQuiz = null;
        history.pushState(null, "", "#/");
        await handleRoute();
      }
    } catch { /* ignore */ }
  }

  function handleQuizCreated(id: string) {
    fetchQuizzes().then((list) => { quiz.list = list; }).catch(() => {});
    history.pushState(null, "", `#/quiz/${id}`);
    handleRoute();
  }

  async function handleSend(text: string) {
    if (!chat.sessionId || chat.isStreaming) return;

    // Add user message to local state
    chat.messages = [
      ...chat.messages,
      {
        role: "user" as const,
        content: text,
        sequence: chat.messages.length + 1,
        createdAt: new Date().toISOString(),
      },
    ];

    chat.isStreaming = true;
    showTyping = true;
    streamingContent = "";
    streamingSources = [];

    try {
      for await (const event of streamChat(
        chat.sessionId,
        text,
        docs.focusedId ?? undefined,
      )) {
        if (event.type === "token") {
          if (showTyping) {
            showTyping = false;
          }
          streamingContent += event.data;
        } else if (event.type === "sources") {
          streamingSources = event.data;
        } else if (event.type === "error") {
          showTyping = false;
          streamingContent = "";
          chat.messages = [
            ...chat.messages,
            {
              role: "assistant" as const,
              content: event.data,
              sequence: chat.messages.length + 1,
              createdAt: new Date().toISOString(),
            },
          ];
        }
      }

      // Finalize: move streaming content into messages
      showTyping = false;
      if (streamingContent) {
        chat.messages = [
          ...chat.messages,
          {
            role: "assistant" as const,
            content: streamingContent,
            sequence: chat.messages.length + 1,
            createdAt: new Date().toISOString(),
          },
        ];
      }
      streamingContent = "";
      streamingSources = [];

      // Refresh session meta and session list
      try {
        const session = await fetchSession(chat.sessionId);
        chat.model = session.model;
        chat.provider = session.provider || "lmstudio";
        chat.sessions = await fetchSessions();
      } catch {
        /* ignore */
      }
    } catch (e) {
      showTyping = false;
      streamingContent = "";
      const msg = e instanceof Error ? e.message : "Unknown error";
      chat.messages = [
        ...chat.messages,
        {
          role: "assistant" as const,
          content: `Connection error: ${msg}`,
          sequence: chat.messages.length + 1,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    chat.isStreaming = false;
    inputArea?.focus();
  }

  // ── Boot ──

  onMount(() => {
    boot();
    window.addEventListener("hashchange", handleRoute);
    return () => window.removeEventListener("hashchange", handleRoute);
  });

  async function boot() {
    try {
      const [status, modelsPayload, sessions, latestSession, documents, quizzes] =
        await Promise.all([
          fetchStatus().catch(() => null),
          fetchModels().catch(() => null),
          fetchSessions().catch(() => []),
          fetchLatestSession(),
          fetchDocuments().catch(() => []),
          fetchQuizzes().catch(() => []),
        ]);

      if (status) {
        ui.status = status;
        ui.statusError = false;
      } else {
        ui.statusError = true;
      }

      if (modelsPayload) {
        chat.models = modelsPayload.models;
        chat.defaultModel = modelsPayload.defaultModel;
        chat.providers = modelsPayload.providers;
      }

      chat.sessions = sessions;
      docs.list = documents;
      quiz.list = quizzes;

      // Set active session
      chat.sessionId = latestSession.id;
      chat.model = latestSession.model;
      chat.provider = latestSession.provider || "lmstudio";
      chat.messages = latestSession.messages || [];

      // Handle initial route or set session in URL
      const initialRoute = parseHash();
      if (initialRoute.sessionId || initialRoute.documentId) {
        await handleRoute();
      } else {
        pushHash(chat.sessionId, null, false);
      }
    } catch {
      ui.statusError = true;
    }
  }
</script>

<div class="app">
  <Sidebar
    onmodelchange={handleModelChange}
    onnewchat={handleNewChat}
    onswitchsession={handleSwitchSession}
    ondeletesession={handleDeleteSession}
    onselectdoc={handleSelectDoc}
    onfocusdoc={handleFocusDoc}
    ondeletedoc={handleDeleteDoc}
    onselectquiz={handleSelectQuiz}
    ondeletequiz={handleDeleteQuiz}
    onnewquiz={handleNewQuiz}
  />

  <main class="main-content">
    <div class="chat-header">
      <div>
        <h2>RAG4Devs</h2>
        <div class="chat-header-sub">AI Devs 4 — Knowledge base chat</div>
      </div>
    </div>

    {#if currentView === "quiz-setup"}
      <QuizSetup onquizcreated={handleQuizCreated} />
    {:else if currentView === "quiz" || currentView === "quiz-results"}
      <QuizView onnewquiz={handleNewQuiz} />
    {:else}
      <ChatArea {streamingContent} {streamingSources} {showTyping} />
      <InputArea bind:this={inputArea} onsend={handleSend} />
    {/if}
  </main>
</div>

<PreviewPanel onnavchange={(docId, fullscreen) => pushHash(chat.sessionId || null, docId, fullscreen)} />
<Lightbox />

<style>
  .app {
    display: flex;
    height: 100vh;
    animation: fadeIn 600ms ease both;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
    animation: fadeIn 600ms 200ms ease both;
  }

  .chat-header {
    padding: 14px 24px;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--ink);
  }

  .chat-header h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 20px;
    font-weight: 400;
    color: var(--text);
  }

  .chat-header-sub {
    font-size: 12px;
    color: var(--text-3);
  }

  @media (max-width: 768px) {
    .chat-header {
      padding-left: 56px;
    }
  }
</style>
