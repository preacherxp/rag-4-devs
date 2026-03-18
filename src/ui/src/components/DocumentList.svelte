<script lang="ts">
  import { docs } from "../lib/state.svelte";

  let { onselect, onfocus, ondelete }: {
    onselect: (id: number) => void;
    onfocus: (id: number) => void;
    ondelete: (id: number) => void;
  } = $props();

  let query = $state("");

  const normalizedQuery = $derived(query.trim().toLowerCase());
  const filteredDocs = $derived(
    normalizedQuery
      ? docs.list.filter((doc) => {
          const haystack = `${doc.label} ${doc.filePath}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : docs.list,
  );
</script>

<section class="documents-section">
  <div class="section-label">Documents</div>
  <input
    class="sidebar-search"
    type="search"
    placeholder="Search documents"
    bind:value={query}
    aria-label="Search documents"
    autocomplete="off"
    spellcheck="false"
  />
  <div class="documents-list">
    {#if docs.list.length === 0}
      <div class="empty-state sidebar-empty-state">No indexed documents found.</div>
    {:else if filteredDocs.length === 0}
      <div class="empty-state sidebar-empty-state">
        No documents match "{query.trim()}".
      </div>
    {:else}
      {#each filteredDocs as doc (doc.id)}
        <button
          class="doc-item"
          class:active={doc.id === docs.selectedId && doc.id !== docs.focusedId}
          class:focused={doc.id === docs.focusedId}
          onclick={() => onselect(doc.id)}
        >
          <div class="doc-header">
            <div class="doc-label">{doc.label}</div>
            <span class="doc-actions">
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <span
                class="doc-focus"
                role="button"
                tabindex="-1"
                title="Focus retrieval on this document"
                onclick={(e) => { e.stopPropagation(); onfocus(doc.id); }}
              >{doc.id === docs.focusedId ? "◉" : "◎"}</span>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <span
                class="doc-delete"
                role="button"
                tabindex="-1"
                title="Remove document"
                onclick={(e) => { e.stopPropagation(); ondelete(doc.id); }}
              >&#10005;</span>
            </span>
          </div>
          <div class="doc-path">{doc.filePath}</div>
        </button>
      {/each}
    {/if}
  </div>
</section>

<style>
  .documents-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .documents-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-3) transparent;
  }

  .doc-item {
    width: 100%;
    border: none;
    border-left: 3px solid transparent;
    background: transparent;
    color: var(--text-2);
    border-radius: 0 8px 8px 0;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  .doc-item:hover { background: var(--surface); }

  .doc-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .doc-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .doc-focus,
  .doc-delete {
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    border-radius: 4px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
    transition: background 150ms, color 150ms;
    opacity: 0.4;
  }

  .doc-item:hover .doc-focus,
  .doc-item:hover .doc-delete { opacity: 1; }

  .doc-item.focused .doc-focus {
    opacity: 1;
    background: var(--emerald);
    color: var(--ink);
  }

  .doc-focus:hover {
    background: rgba(52,211,153,0.2) !important;
    color: var(--emerald) !important;
    opacity: 1 !important;
  }

  .doc-item.focused .doc-focus:hover {
    background: var(--emerald) !important;
    color: var(--ink) !important;
  }

  .doc-delete:hover {
    background: rgba(229,57,53,0.15) !important;
    color: var(--rose) !important;
    opacity: 1 !important;
  }

  .doc-path {
    font-size: 10px;
    color: var(--text-3);
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 1px;
  }

  .doc-item.active {
    border-left-color: var(--amber);
    background: var(--amber-glow);
  }

  .doc-item.focused {
    border-left-color: var(--emerald);
    background: rgba(52,211,153,0.08);
  }
</style>
