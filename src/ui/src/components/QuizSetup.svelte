<script lang="ts">
  import { docs, quiz } from "../lib/state.svelte";
  import { streamCreateQuiz } from "../lib/api";
  import type { QuizGenProgress } from "../lib/types";
  import { parseModelValue } from "../lib/utils";
  import ModelSelector from "./ModelSelector.svelte";

  let { onquizcreated, onclose }: {
    onquizcreated: (id: string) => void;
    onclose: () => void;
  } = $props();

  const LANGUAGES = [
    { value: "", label: "Auto (match document)" },
    { value: "English", label: "English" },
    { value: "Polish", label: "Polish" },
    { value: "German", label: "German" },
    { value: "French", label: "French" },
    { value: "Spanish", label: "Spanish" },
    { value: "Italian", label: "Italian" },
    { value: "Portuguese", label: "Portuguese" },
    { value: "Ukrainian", label: "Ukrainian" },
    { value: "Czech", label: "Czech" },
    { value: "Japanese", label: "Japanese" },
    { value: "Chinese", label: "Chinese" },
    { value: "Korean", label: "Korean" },
  ] as const;

  let selectedDocId = $state<number | null>(null);
  let numQuestions = $state(10);
  let difficulty = $state<"easy" | "medium" | "hard">("medium");
  let language = $state("");
  let error = $state("");
  let generationCancelled = $state(false);
  let generateAbort: AbortController | null = null;

  function isAbortError(e: unknown): boolean {
    return (
      e instanceof DOMException && e.name === "AbortError"
    ) || (e instanceof Error && e.name === "AbortError");
  }

  function handleQuizModelChange(value: string) {
    if (!value) return;
    const selected = parseModelValue(value, quiz.defaultProvider);
    quiz.model = selected.model;
    quiz.provider = selected.provider;
  }

  function progressDetail(p: QuizGenProgress): string {
    if (p.phase === "document") {
      const kb = (p.charCount / 1024).toFixed(1);
      return `${p.chunkCount} chunk${p.chunkCount === 1 ? "" : "s"} · ~${kb} KB context`;
    }
    if (p.phase === "generating") {
      return `${p.charsReceived.toLocaleString()} chars from model`;
    }
    return "";
  }

  async function handleGenerate() {
    if (!selectedDocId) return;
    generationCancelled = false;
    quiz.isGenerating = true;
    quiz.generationProgress = null;
    error = "";
    generateAbort = new AbortController();
    try {
      let created: { id: string } | null = null;
      for await (const ev of streamCreateQuiz(
        {
          documentId: selectedDocId,
          numQuestions,
          difficulty,
          model: quiz.model || quiz.defaultModel,
          provider: quiz.provider || quiz.defaultProvider,
          ...(language ? { language } : {}),
        },
        { signal: generateAbort.signal },
      )) {
        if (ev.type === "progress") {
          quiz.generationProgress = ev.data;
        } else if (ev.type === "quiz") {
          created = ev.data;
        } else if (ev.type === "error") {
          throw new Error(ev.data.replace(/^\[ERROR\]\s*/, "").trim());
        }
      }
      if (!created) throw new Error("Quiz stream ended without a result");
      onquizcreated(created.id);
    } catch (e) {
      if (isAbortError(e)) {
        generationCancelled = true;
        error = "";
        return;
      }
      error = e instanceof Error ? e.message : "Failed to generate quiz";
    } finally {
      generateAbort = null;
      quiz.isGenerating = false;
      quiz.generationProgress = null;
    }
  }

  function handleCancelGeneration() {
    error = "";
    generateAbort?.abort();
  }

  function handleClose() {
    generateAbort?.abort();
    onclose();
  }
</script>

<div class="quiz-setup">
  <div class="quiz-setup-header">
    <div class="quiz-setup-header-text">
      <h2>New Quiz</h2>
      <p class="subtitle">Generate a multiple-choice quiz from an indexed document.</p>
    </div>
    <button
      type="button"
      class="btn btn-secondary quiz-setup-close"
      onclick={handleClose}
    >Close</button>
  </div>

  <div class="form-group">
    <label class="field-label" for="quiz-doc">Document</label>
    <select id="quiz-doc" bind:value={selectedDocId}>
      <option value={null}>Select a document...</option>
      {#each docs.list as doc (doc.id)}
        <option value={doc.id}>{doc.label}</option>
      {/each}
    </select>
  </div>

  <div class="form-group">
    <ModelSelector
      selectId="quiz-model-select"
      label="Quiz model"
      model={quiz.model}
      provider={quiz.provider}
      defaultModel={quiz.defaultModel}
      defaultProvider={quiz.defaultProvider}
      disabled={quiz.isGenerating}
      onchange={handleQuizModelChange}
    />
  </div>

  <div class="form-group">
    <span class="field-label">Number of questions</span>
    <div class="radio-group" role="radiogroup" aria-label="Number of questions">
      {#each [5, 10, 20] as n}
        <button
          class="radio-btn"
          class:active={numQuestions === n}
          role="radio"
          aria-checked={numQuestions === n}
          onclick={() => numQuestions = n}
        >{n}</button>
      {/each}
    </div>
  </div>

  <div class="form-group">
    <span class="field-label">Difficulty</span>
    <div class="radio-group" role="radiogroup" aria-label="Difficulty">
      {#each ["easy", "medium", "hard"] as d}
        <button
          class="radio-btn"
          class:active={difficulty === d}
          class:easy={d === "easy"}
          class:medium={d === "medium"}
          class:hard={d === "hard"}
          role="radio"
          aria-checked={difficulty === d}
          onclick={() => difficulty = d as "easy" | "medium" | "hard"}
        >{d}</button>
      {/each}
    </div>
  </div>

  <div class="form-group">
    <label class="field-label" for="quiz-language">Language</label>
    <select id="quiz-language" bind:value={language}>
      {#each LANGUAGES as lang}
        <option value={lang.value}>{lang.label}</option>
      {/each}
    </select>
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  <div class="generate-row">
    <button
      type="button"
      class="btn btn-primary generate-btn"
      disabled={!selectedDocId || quiz.isGenerating}
      onclick={handleGenerate}
    >
      {#if quiz.isGenerating}
        Generating…
      {:else}
        Generate Quiz
      {/if}
    </button>
    {#if quiz.isGenerating}
      <button
        type="button"
        class="btn btn-secondary cancel-gen-btn"
        onclick={handleCancelGeneration}
      >Cancel</button>
    {/if}
  </div>

  {#if generationCancelled && !quiz.isGenerating}
    <p class="cancel-msg">Generation cancelled.</p>
  {/if}

  {#if quiz.isGenerating}
    <div class="gen-progress" aria-live="polite">
      {#if quiz.generationProgress}
        {@const p = quiz.generationProgress}
        <div class="gen-progress-phase">
          {#if p.phase === "document"}
            Loading document context
          {:else if p.phase === "generating"}
            Generating questions
          {:else if p.phase === "parsing"}
            Validating quiz structure
          {:else if p.phase === "saving"}
            Saving quiz
          {/if}
        </div>
        {#if progressDetail(p)}
          <div class="gen-progress-detail">{progressDetail(p)}</div>
        {/if}
      {:else}
        <div class="gen-progress-phase">Connecting…</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .quiz-setup {
    max-width: 480px;
    margin: 0 auto;
    padding: 48px 24px;
    animation: slideUp 400ms ease both;
  }

  .quiz-setup-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 32px;
  }

  .quiz-setup-header-text {
    min-width: 0;
  }

  .quiz-setup-close {
    flex-shrink: 0;
    margin-top: 4px;
  }

  h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 28px;
    font-weight: 400;
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--text-3);
    font-size: 14px;
    margin-bottom: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .radio-group {
    display: flex;
    gap: 8px;
  }

  .radio-btn {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-2);
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms, border-color 150ms, color 150ms;
    text-transform: capitalize;
  }

  .radio-btn:hover {
    background: var(--surface-2);
    border-color: var(--border);
  }

  .radio-btn.active {
    border-color: var(--amber);
    background: var(--amber-glow);
    color: var(--text);
  }

  .radio-btn.active.easy { border-color: var(--emerald); background: rgba(52, 211, 153, 0.15); }
  .radio-btn.active.medium { border-color: var(--amber); background: var(--amber-glow); }
  .radio-btn.active.hard { border-color: var(--rose); background: rgba(251, 113, 133, 0.15); }

  .error-msg {
    color: var(--rose);
    font-size: 13px;
    margin-bottom: 12px;
  }

  .generate-row {
    display: flex;
    gap: 10px;
    align-items: stretch;
    margin-top: 8px;
  }

  .generate-btn {
    flex: 1;
    min-width: 0;
    padding: 12px;
    font-size: 14px;
  }

  .cancel-gen-btn {
    flex-shrink: 0;
    padding: 12px 18px;
    font-size: 14px;
  }

  .cancel-msg {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--text-3);
  }

  .gen-progress {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
  }

  .gen-progress-phase {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .gen-progress-detail {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
</style>
