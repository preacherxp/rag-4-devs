<script lang="ts">
  import { docs, quiz } from "../lib/state.svelte";
  import { createQuiz } from "../lib/api";
  import { parseModelValue } from "../lib/utils";
  import ModelSelector from "./ModelSelector.svelte";

  let { onquizcreated, onclose }: {
    onquizcreated: (id: string) => void;
    onclose: () => void;
  } = $props();

  let selectedDocId = $state<number | null>(null);
  let numQuestions = $state(10);
  let difficulty = $state<"easy" | "medium" | "hard">("medium");
  let error = $state("");

  function handleQuizModelChange(value: string) {
    if (!value) return;
    const selected = parseModelValue(value, quiz.defaultProvider);
    quiz.model = selected.model;
    quiz.provider = selected.provider;
  }

  async function handleGenerate() {
    if (!selectedDocId) return;
    quiz.isGenerating = true;
    error = "";
    try {
      const created = await createQuiz({
        documentId: selectedDocId,
        numQuestions,
        difficulty,
        model: quiz.model || quiz.defaultModel,
        provider: quiz.provider || quiz.defaultProvider,
      });
      onquizcreated(created.id);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to generate quiz";
    } finally {
      quiz.isGenerating = false;
    }
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
      onclick={() => onclose()}
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

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  <button
    class="btn btn-primary generate-btn"
    disabled={!selectedDocId || quiz.isGenerating}
    onclick={handleGenerate}
  >
    {#if quiz.isGenerating}
      Generating...
    {:else}
      Generate Quiz
    {/if}
  </button>
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

  .generate-btn {
    width: 100%;
    padding: 12px;
    font-size: 14px;
    margin-top: 8px;
  }
</style>
