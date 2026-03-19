<script lang="ts">
  import { quiz } from "../lib/state.svelte";
  import { answerQuizQuestion, restartQuizApi, completeQuizApi, fetchQuiz, fetchQuizzes } from "../lib/api";
  import QuizProgress from "./QuizProgress.svelte";
  import QuizQuestionComp from "./QuizQuestion.svelte";
  import QuizResults from "./QuizResults.svelte";

  let { onnewquiz, onclose }: {
    onnewquiz: () => void;
    onclose: () => void;
  } = $props();

  let showResults = $state(false);

  const currentQuestion = $derived(
    quiz.activeQuiz?.questions[quiz.currentQuestionIndex] ?? null,
  );

  const allAnswered = $derived(
    quiz.activeQuiz?.questions.every((q) => q.selectedAnswer != null) ?? false,
  );

  async function handleSelect(answer: "A" | "B" | "C" | "D") {
    if (!quiz.activeQuiz || !currentQuestion) return;
    await answerQuizQuestion(quiz.activeQuiz.id, quiz.currentQuestionIndex, answer);
    // Update local state
    currentQuestion.selectedAnswer = answer;
    currentQuestion.answeredAt = new Date().toISOString();
  }

  async function handleRestartQuestion() {
    if (!quiz.activeQuiz || !currentQuestion) return;
    await answerQuizQuestion(quiz.activeQuiz.id, quiz.currentQuestionIndex, null);
    currentQuestion.selectedAnswer = null;
    currentQuestion.answeredAt = null;
  }

  function handleNavigate(index: number) {
    showResults = false;
    quiz.currentQuestionIndex = index;
  }

  async function handleComplete() {
    if (!quiz.activeQuiz) return;
    const updated = await completeQuizApi(quiz.activeQuiz.id);
    quiz.activeQuiz = updated;
    quiz.list = await fetchQuizzes();
    showResults = true;
  }

  async function handleRestartQuiz() {
    if (!quiz.activeQuiz) return;
    const updated = await restartQuizApi(quiz.activeQuiz.id);
    quiz.activeQuiz = updated;
    quiz.currentQuestionIndex = 0;
    quiz.list = await fetchQuizzes();
    showResults = false;
  }
</script>

{#if quiz.activeQuiz}
  <div class="quiz-view">
    <div class="quiz-header">
      <div class="quiz-header-text">
        <h2>{quiz.activeQuiz.documentLabel}</h2>
        <span class="quiz-meta">
          {quiz.activeQuiz.difficulty} &middot; {quiz.activeQuiz.numQuestions} questions
        </span>
      </div>
      <button
        type="button"
        class="btn btn-secondary quiz-close"
        onclick={() => onclose()}
      >Close</button>
    </div>

    {#if showResults || quiz.activeQuiz.completedAt}
      <QuizResults
        quiz={quiz.activeQuiz}
        onrestart={handleRestartQuiz}
        {onnewquiz}
        onnavigate={handleNavigate}
      />
    {:else}
      <QuizProgress
        questions={quiz.activeQuiz.questions}
        currentIndex={quiz.currentQuestionIndex}
        onnavigate={handleNavigate}
      />

      {#if currentQuestion}
        {#key quiz.currentQuestionIndex}
          <QuizQuestionComp
            question={currentQuestion}
            onselect={handleSelect}
            onrestart={handleRestartQuestion}
          />
        {/key}
      {/if}

      {#if allAnswered && !quiz.activeQuiz.completedAt}
        <div class="complete-bar">
          <button class="btn btn-primary" onclick={handleComplete}>
            Finish Quiz
          </button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .quiz-view {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 24px;
    overflow-y: auto;
    height: 100%;
  }

  .quiz-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }

  .quiz-header-text {
    min-width: 0;
  }

  .quiz-close {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .quiz-header h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 24px;
    font-weight: 400;
    color: var(--text);
  }

  .quiz-meta {
    font-size: 13px;
    color: var(--text-3);
    text-transform: capitalize;
  }

  .complete-bar {
    display: flex;
    justify-content: center;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border-subtle);
  }
</style>
