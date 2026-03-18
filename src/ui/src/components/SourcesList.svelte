<script lang="ts">
  import type { Source } from "../lib/types";

  let { sources }: { sources: Source[] } = $props();

  let open = $state(false);

  const deduped = $derived(() => {
    const seen = new Set<string>();
    return sources.filter((s) => {
      if (seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });
  });
</script>

{#if sources.length > 0}
  <button class="sources-toggle" onclick={() => (open = !open)}>
    Sources ({sources.length})
  </button>
  {#if open}
    <div class="sources-list open">
      {#each deduped() as source}
        <div class="source-item">
          {source.heading ? `${source.label} — ${source.heading}` : source.label}
          <span class="sim">{(source.similarity * 100).toFixed(1)}%</span>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .sources-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    padding: 4px 0;
    border: none;
    background: none;
    color: var(--amber);
    cursor: pointer;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 12px;
    text-align: left;
    transition: color 150ms;
  }

  .sources-toggle:hover { color: #d97706; }

  .sources-list {
    margin-top: 8px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-3);
    border: 1px solid var(--border-subtle);
  }

  .source-item { margin: 4px 0; }
  .sim { color: var(--text-3); margin-left: 6px; opacity: 0.6; }
</style>
