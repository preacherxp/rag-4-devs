<script lang="ts">
  import { quiz } from "../lib/state.svelte";

  let { onselectquiz, ondeletequiz, onnewquiz }: {
    onselectquiz: (id: string) => void;
    ondeletequiz: (id: string) => void;
    onnewquiz: () => void;
  } = $props();

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  }

  const difficultyColor: Record<string, string> = {
    easy: "var(--emerald)",
    medium: "var(--amber)",
    hard: "var(--rose)",
  };
</script>

<section class="quiz-section">
  <div class="section-label">Quizzes</div>
  <button class="btn btn-secondary" style="width:100%;margin-bottom:4px" onclick={onnewquiz}>
    New quiz
  </button>
  <div class="quiz-list">
    {#each quiz.list as q (q.id)}
      <button
        class="quiz-item"
        class:active={q.id === quiz.activeId}
        onclick={() => onselectquiz(q.id)}
      >
        <div class="quiz-item-label">{q.documentLabel}</div>
        <div class="quiz-item-meta">
          <span class="difficulty-badge" style="color:{difficultyColor[q.difficulty] ?? 'var(--text-3)'}">{q.difficulty}</span>
          &middot; {q.answeredCount}/{q.numQuestions}
          {#if q.score != null}
            &middot; {q.score}/{q.numQuestions}
          {/if}
        </div>
        <div class="quiz-item-date">{formatTime(q.createdAt)}</div>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <span
          class="quiz-delete"
          role="button"
          tabindex="-1"
          title="Delete quiz"
          onclick={(e) => { e.stopPropagation(); ondeletequiz(q.id); }}
        >&#10005;</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .quiz-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
  }

  .quiz-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    max-height: 180px;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-3) transparent;
  }

  .quiz-item {
    width: 100%;
    border: none;
    border-left: 3px solid transparent;
    background: transparent;
    color: var(--text-2);
    border-radius: 0 6px 6px 0;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;
    font-family: 'DM Sans', system-ui, sans-serif;
    position: relative;
  }

  .quiz-item:hover { background: var(--surface); }

  .quiz-item.active {
    border-left-color: var(--amber);
    background: var(--amber-glow);
  }

  .quiz-item-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }

  .quiz-item-meta {
    font-size: 10px;
    color: var(--text-3);
    font-family: 'JetBrains Mono', monospace;
  }

  .quiz-item-date {
    font-size: 10px;
    color: var(--text-3);
    font-family: 'JetBrains Mono', monospace;
  }

  .difficulty-badge {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .quiz-item .quiz-delete {
    display: none;
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--surface-3);
    border: none;
    color: var(--text-3);
    cursor: pointer;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    line-height: 1;
    transition: background 150ms, color 150ms;
  }

  .quiz-item:hover .quiz-delete { display: block; }
  .quiz-delete:hover { background: #e53935 !important; color: #fff !important; }
</style>
