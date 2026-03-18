<script lang="ts">
  import type { QuizQuestion } from "../lib/types";

  let { questions, currentIndex, onnavigate }: {
    questions: QuizQuestion[];
    currentIndex: number;
    onnavigate: (index: number) => void;
  } = $props();
</script>

<div class="quiz-progress">
  <div class="progress-label">
    Question {currentIndex + 1} of {questions.length}
  </div>
  <div class="progress-dots">
    {#each questions as q, i}
      <button
        class="dot"
        class:current={i === currentIndex}
        class:correct={q.selectedAnswer != null && q.selectedAnswer === q.correctAnswer}
        class:incorrect={q.selectedAnswer != null && q.selectedAnswer !== q.correctAnswer}
        class:unanswered={q.selectedAnswer == null}
        onclick={() => onnavigate(i)}
        title="Question {i + 1}"
      ></button>
    {/each}
  </div>
  <div class="progress-nav">
    <button
      class="btn btn-secondary nav-btn"
      disabled={currentIndex <= 0}
      onclick={() => onnavigate(currentIndex - 1)}
    >Prev</button>
    <button
      class="btn btn-secondary nav-btn"
      disabled={currentIndex >= questions.length - 1}
      onclick={() => onnavigate(currentIndex + 1)}
    >Next</button>
  </div>
</div>

<style>
  .quiz-progress {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
  }

  .progress-label {
    font-size: 13px;
    color: var(--text-3);
    white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
  }

  .progress-dots {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: transparent;
    cursor: pointer;
    padding: 0;
    transition: background 150ms, border-color 150ms, transform 150ms;
  }

  .dot:hover { transform: scale(1.3); }
  .dot.current { border-color: var(--amber); box-shadow: 0 0 6px var(--amber-glow); }
  .dot.correct { background: var(--emerald); border-color: var(--emerald); }
  .dot.incorrect { background: var(--rose); border-color: var(--rose); }
  .dot.unanswered { background: transparent; }

  .progress-nav {
    display: flex;
    gap: 6px;
  }

  .nav-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
</style>
