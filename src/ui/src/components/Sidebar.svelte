<script lang="ts">
  import { onMount } from "svelte";
  import { ui } from "../lib/state.svelte";
  import ModelSelector from "./ModelSelector.svelte";
  import SessionList from "./SessionList.svelte";
  import DocumentList from "./DocumentList.svelte";
  import QuizList from "./QuizList.svelte";

  let {
    onmodelchange,
    onnewchat,
    onswitchsession,
    ondeletesession,
    onselectdoc,
    onfocusdoc,
    ondeletedoc,
    onselectquiz,
    ondeletequiz,
    onnewquiz,
  }: {
    onmodelchange: (value: string) => void;
    onnewchat: () => void;
    onswitchsession: (id: string) => void;
    ondeletesession: (id: string) => void;
    onselectdoc: (id: number) => void;
    onfocusdoc: (id: number) => void;
    ondeletedoc: (id: number) => void;
    onselectquiz: (id: string) => void;
    ondeletequiz: (id: string) => void;
    onnewquiz: () => void;
  } = $props();

  let isMobile = $state(
    typeof window !== "undefined" && window.innerWidth <= 768,
  );

  function checkMobile() {
    isMobile = window.innerWidth <= 768;
  }

  onMount(checkMobile);

  function toggle() {
    ui.sidebarOpen = !ui.sidebarOpen;
  }
</script>

<svelte:window onresize={checkMobile} />

<aside
  class="sidebar"
  class:collapsed={!ui.sidebarOpen && !isMobile}
  class:expanded={ui.sidebarOpen && isMobile}
>
  <div class="sidebar-inner">
    <div class="brand">
      <h1>AI Devs 4 RAG</h1>
      <div class="status-badge">
        <span class="status-dot" class:error={ui.statusError}></span>
        <span>
          {#if ui.statusError}
            error
          {:else if ui.status.documents > 0}
            {ui.status.documents} docs &middot; {ui.status.chunks} chunks
          {:else}
            loading...
          {/if}
        </span>
      </div>
    </div>

    <ModelSelector onchange={onmodelchange} />

    <button class="btn btn-secondary" style="width:100%" onclick={onnewchat}>
      New chat
    </button>

    <SessionList {onswitchsession} {ondeletesession} />
    <DocumentList
      onselect={onselectdoc}
      onfocus={onfocusdoc}
      ondelete={ondeletedoc}
    />
    <QuizList {onselectquiz} {ondeletequiz} {onnewquiz} />
  </div>

  <button class="sidebar-toggle" title="Toggle sidebar" onclick={toggle}>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class:rotated={!ui.sidebarOpen}
    >
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  </button>
</aside>

<style>
  .sidebar {
    position: relative;
    z-index: 1;
    width: var(--sidebar-w);
    min-width: var(--sidebar-w);
    border-right: 1px solid var(--border-subtle);
    background: var(--ink);
    display: flex;
    flex-direction: column;
    transition:
      width var(--transition),
      min-width var(--transition),
      padding var(--transition);
    overflow: visible;
    animation: fadeIn 600ms 100ms ease both;
  }

  .sidebar.collapsed {
    width: 56px;
    min-width: 56px;
    padding: 0;
  }

  .sidebar.collapsed .sidebar-inner {
    opacity: 0;
    pointer-events: none;
  }

  .sidebar-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px 16px;
    gap: 16px;
    transition: opacity 200ms ease;
    overflow: hidden;
  }

  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand h1 {
    font-family: "Instrument Serif", serif;
    font-size: 24px;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--text);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-3);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--emerald);
    box-shadow: 0 0 6px rgba(52, 211, 153, 0.4);
  }

  .status-dot.error {
    background: var(--rose);
    box-shadow: 0 0 6px rgba(251, 113, 133, 0.4);
  }

  .sidebar-toggle {
    position: absolute;
    top: 16px;
    right: -12px;
    z-index: 20;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      right var(--transition),
      left var(--transition),
      top var(--transition),
      background 150ms,
      transform 150ms;
    padding: 0;
  }

  .sidebar-toggle:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .sidebar-toggle svg {
    width: 14px;
    height: 14px;
    transition: transform var(--transition);
  }

  .sidebar-toggle svg.rotated {
    transform: rotate(180deg);
  }

  @media (max-width: 768px) {
    .sidebar {
      width: 56px;
      min-width: 56px;
    }

    .sidebar .sidebar-inner {
      opacity: 0;
      pointer-events: none;
    }

    .sidebar.expanded {
      position: fixed;
      z-index: 80;
      width: var(--sidebar-w);
      min-width: var(--sidebar-w);
      height: 100vh;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
    }

    .sidebar.expanded .sidebar-inner {
      opacity: 1;
      pointer-events: auto;
    }
  }

  @media (max-width: 768px) {
    .sidebar {
      width: 0;
      min-width: 0;
      border: none;
      transition: none;
    }

    .sidebar-toggle {
      right: auto;
      left: 10px;
      top: 14px;
      width: 36px;
      height: 36px;
    }

    .sidebar-toggle svg {
      width: 18px;
      height: 18px;
    }

    .sidebar.expanded {
      width: 100vw;
      min-width: 100vw;
    }

    .sidebar.expanded .brand {
      padding-right: 48px;
    }

    .sidebar.expanded .sidebar-toggle {
      left: auto;
      right: 16px;
      top: 16px;
    }
  }
</style>
