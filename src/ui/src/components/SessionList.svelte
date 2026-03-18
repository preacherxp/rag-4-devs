<script lang="ts">
  import { chat } from "../lib/state.svelte";

  let { onswitchsession, ondeletesession }: {
    onswitchsession: (id: string) => void;
    ondeletesession: (id: string) => void;
  } = $props();

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let query = $state("");

  const normalizedQuery = $derived(query.trim().toLowerCase());
  const filteredSessions = $derived(
    normalizedQuery
      ? chat.sessions.filter((session) => {
          const haystack = [
            session.preview,
            session.id,
            session.model,
            session.provider,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : chat.sessions,
  );
</script>

<section class="sessions-section">
  <div class="section-label">Sessions</div>
  <input
    class="sidebar-search"
    type="search"
    placeholder="Search sessions"
    bind:value={query}
    aria-label="Search sessions"
    autocomplete="off"
    spellcheck="false"
  />
  <div class="sessions-list">
    {#if filteredSessions.length === 0}
      <div class="empty-state sidebar-empty-state">
        {#if normalizedQuery}
          No sessions match "{query.trim()}".
        {:else}
          No sessions yet.
        {/if}
      </div>
    {:else}
      {#each filteredSessions as s (s.id)}
        <button
          class="session-item"
          class:active={s.id === chat.sessionId}
          onclick={() => onswitchsession(s.id)}
        >
          <div class="session-item-preview">
            {s.preview ? s.preview.slice(0, 60) : "Empty session"}
          </div>
          <div class="session-item-meta">
            {formatTime(s.updatedAt)} &middot; {s.messageCount} msgs
          </div>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <span
            class="session-delete"
            role="button"
            tabindex="-1"
            title="Delete session"
            onclick={(e) => { e.stopPropagation(); ondeletesession(s.id); }}
          >&#10005;</span>
        </button>
      {/each}
    {/if}
  </div>
</section>

<style>
  .sessions-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
  }

  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    max-height: 180px;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-3) transparent;
  }

  .session-item {
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

  .session-item .session-delete {
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

  .session-item:hover .session-delete { display: block; }
  .session-delete:hover { background: #e53935 !important; color: #fff !important; }
  .session-item:hover { background: var(--surface); }

  .session-item.active {
    border-left-color: var(--amber);
    background: var(--amber-glow);
  }

  .session-item-preview {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }

  .session-item-meta {
    font-size: 10px;
    color: var(--text-3);
    font-family: 'JetBrains Mono', monospace;
  }
</style>
