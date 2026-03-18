<script lang="ts">
  import type { QuizQuestion } from "../lib/types";

  let { question, onselect, onrestart }: {
    question: QuizQuestion;
    onselect: (answer: "A" | "B" | "C" | "D") => void;
    onrestart: () => void;
  } = $props();

  const options = $derived([
    { letter: "A" as const, text: question.optionA },
    { letter: "B" as const, text: question.optionB },
    { letter: "C" as const, text: question.optionC },
    { letter: "D" as const, text: question.optionD },
  ]);

  const answered = $derived(question.selectedAnswer != null);

  function optionClass(letter: "A" | "B" | "C" | "D"): string {
    if (!answered) return "";
    if (letter === question.correctAnswer && letter === question.selectedAnswer) return "correct";
    if (letter === question.correctAnswer) return "correct-reveal";
    if (letter === question.selectedAnswer) return "incorrect";
    return "dimmed";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (answered) return;
    const map: Record<string, "A" | "B" | "C" | "D"> = { "1": "A", "2": "B", "3": "C", "4": "D" };
    const letter = map[e.key];
    if (letter) onselect(letter);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="quiz-question">
  <div class="question-text">{question.question}</div>
  <div class="options">
    {#each options as opt}
      <button
        class="option-btn {optionClass(opt.letter)}"
        disabled={answered}
        onclick={() => onselect(opt.letter)}
      >
        <span class="option-letter">{opt.letter}</span>
        <span class="option-text">{opt.text}</span>
      </button>
    {/each}
  </div>

  {#if answered}
    <div class="answer-actions">
      {#if question.selectedAnswer === question.correctAnswer}
        <div class="answer-feedback correct-feedback">Correct!</div>
      {:else}
        <div class="answer-feedback incorrect-feedback">
          Incorrect — correct answer: {question.correctAnswer}
        </div>
      {/if}
      <button class="btn btn-secondary restart-btn" onclick={onrestart}>
        Retry question
      </button>
    </div>
  {/if}
</div>

<style>
  .quiz-question {
    animation: slideUp 300ms ease both;
  }

  .question-text {
    font-size: 18px;
    font-weight: 500;
    line-height: 1.5;
    margin-bottom: 24px;
    color: var(--text);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .option-btn {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: background 150ms, border-color 150ms, transform 100ms;
  }

  .option-btn:not(:disabled):hover {
    background: var(--surface-2);
    border-color: var(--border);
    transform: translateX(4px);
  }

  .option-btn:disabled { cursor: default; }

  .option-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    border-radius: 8px;
    background: var(--surface-2);
    font-weight: 600;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-3);
  }

  .option-text {
    padding-top: 3px;
    line-height: 1.4;
  }

  /* Answer states */
  .option-btn.correct {
    border-color: var(--emerald);
    background: rgba(52, 211, 153, 0.12);
  }
  .option-btn.correct .option-letter {
    background: var(--emerald);
    color: var(--ink);
  }

  .option-btn.correct-reveal {
    border-color: var(--emerald);
    background: rgba(52, 211, 153, 0.06);
    opacity: 0.8;
  }
  .option-btn.correct-reveal .option-letter {
    background: var(--emerald);
    color: var(--ink);
  }

  .option-btn.incorrect {
    border-color: var(--rose);
    background: rgba(251, 113, 133, 0.12);
  }
  .option-btn.incorrect .option-letter {
    background: var(--rose);
    color: var(--ink);
  }

  .option-btn.dimmed {
    opacity: 0.4;
  }

  .answer-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 20px;
  }

  .answer-feedback {
    font-size: 14px;
    font-weight: 600;
  }

  .correct-feedback { color: var(--emerald); }
  .incorrect-feedback { color: var(--rose); }

  .restart-btn {
    margin-left: auto;
    font-size: 12px;
    padding: 6px 12px;
  }
</style>
