<script lang="ts">
  import type { Quiz } from "../lib/types";

  let { quiz, onrestart, onnewquiz, onnavigate }: {
    quiz: Quiz;
    onrestart: () => void;
    onnewquiz: () => void;
    onnavigate: (index: number) => void;
  } = $props();

  const score = $derived(quiz.score ?? 0);
  const total = $derived(quiz.numQuestions);
  const pct = $derived(Math.round((score / total) * 100));
</script>

<div class="quiz-results">
  <div class="score-card">
    <div class="score-number">{score}/{total}</div>
    <div class="score-pct">{pct}% correct</div>
    <div class="score-bar-bg">
      <div class="score-bar-fill" style="width:{pct}%"></div>
    </div>
  </div>

  <div class="questions-summary">
    {#each quiz.questions as q, i}
      <button
        class="summary-row"
        class:correct={q.selectedAnswer === q.correctAnswer}
        class:incorrect={q.selectedAnswer != null && q.selectedAnswer !== q.correctAnswer}
        class:unanswered={q.selectedAnswer == null}
        onclick={() => onnavigate(i)}
      >
        <span class="summary-index">{i + 1}</span>
        <span class="summary-question">{q.question}</span>
        <span class="summary-icon">
          {#if q.selectedAnswer === q.correctAnswer}
            &#10003;
          {:else if q.selectedAnswer != null}
            &#10007;
          {:else}
            &mdash;
          {/if}
        </span>
      </button>
    {/each}
  </div>

  <div class="results-actions">
    <button class="btn btn-secondary" onclick={onrestart}>Restart Quiz</button>
    <button class="btn btn-primary" onclick={onnewquiz}>New Quiz</button>
  </div>
</div>

<style>
  .quiz-results {
    animation: slideUp 400ms ease both;
  }

  .score-card {
    text-align: center;
    padding: 32px 0;
    margin-bottom: 32px;
  }

  .score-number {
    font-family: 'Instrument Serif', serif;
    font-size: 56px;
    font-weight: 400;
    color: var(--text);
  }

  .score-pct {
    font-size: 16px;
    color: var(--text-3);
    margin-bottom: 16px;
  }

  .score-bar-bg {
    width: 100%;
    max-width: 320px;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    margin: 0 auto;
    overflow: hidden;
  }

  .score-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--emerald);
    transition: width 600ms ease;
  }

  .questions-summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 24px;
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--surface);
    color: var(--text);
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 150ms;
  }

  .summary-row:hover { background: var(--surface-2); }

  .summary-index {
    width: 24px;
    min-width: 24px;
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: var(--text-3);
  }

  .summary-question {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary-icon {
    font-size: 14px;
    min-width: 20px;
    text-align: center;
  }

  .summary-row.correct .summary-icon { color: var(--emerald); }
  .summary-row.incorrect .summary-icon { color: var(--rose); }
  .summary-row.unanswered .summary-icon { color: var(--text-3); }

  .results-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
</style>
