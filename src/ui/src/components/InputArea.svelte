<script lang="ts">
  import { chat, docs } from "../lib/state.svelte";

  let { onsend }: { onsend: (text: string) => void } = $props();

  let inputEl: HTMLTextAreaElement | undefined = $state();
  let inputValue = $state("");

  const focusedDoc = $derived(
    docs.focusedId != null
      ? docs.list.find((d) => d.id === docs.focusedId)
      : null,
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleInput() {
    if (!inputEl) return;
    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
  }

  function send() {
    const text = inputValue.trim();
    if (!text || chat.isStreaming || !chat.sessionId) return;
    inputValue = "";
    if (inputEl) inputEl.style.height = "auto";
    onsend(text);
  }

  export function focus() {
    inputEl?.focus();
  }
</script>

<div class="input-area">
  {#if focusedDoc}
    <div class="focus-indicator">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0;">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <span>Focused: {focusedDoc.label}</span>
      <button class="focus-clear" title="Clear focus" onclick={() => (docs.focusedId = null)}>&#10005;</button>
    </div>
  {/if}
  <div class="input-row">
    <div class="input-wrapper" class:has-focus={docs.focusedId != null}>
      <textarea
        bind:this={inputEl}
        bind:value={inputValue}
        rows="1"
        placeholder="Ask about the documents..."
        onkeydown={handleKeydown}
        oninput={handleInput}
      ></textarea>
      <span class="input-hint">&#8984; Enter</span>
    </div>
    <button
      class="send-btn"
      title="Send message"
      disabled={chat.isStreaming}
      onclick={send}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </div>
</div>

<style>
  .input-area {
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--ink);
  }

  .focus-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(52,211,153,0.08);
    border: 1px solid rgba(52,211,153,0.20);
    border-radius: 8px;
    font-size: 12px;
    color: var(--emerald);
    margin-bottom: 8px;
  }

  .focus-clear {
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    margin-left: auto;
  }

  .focus-clear:hover { color: var(--text); }

  .input-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
  }

  textarea {
    width: 100%;
    padding: 14px 16px;
    padding-bottom: 28px;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    background: var(--surface);
    color: var(--text);
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14px;
    outline: none;
    resize: none;
    min-height: 56px;
    max-height: 160px;
    transition: border-color 200ms, box-shadow 200ms;
    line-height: 1.5;
  }

  .has-focus textarea {
    border-color: rgba(52,211,153,0.4);
  }

  .has-focus textarea:focus {
    border-color: var(--emerald);
    box-shadow: 0 0 0 3px rgba(52,211,153,0.15), 0 0 20px rgba(52,211,153,0.10);
  }

  textarea:focus {
    border-color: var(--amber);
    box-shadow: 0 0 0 3px var(--amber-glow), 0 0 20px var(--amber-glow);
  }

  textarea::placeholder { color: var(--text-3); }

  .input-hint {
    position: absolute;
    bottom: 8px;
    right: 12px;
    font-size: 11px;
    color: var(--text-3);
    opacity: 0.5;
    pointer-events: none;
  }

  .send-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: none;
    background: var(--amber);
    color: var(--ink);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms, transform 150ms, box-shadow 150ms;
    flex-shrink: 0;
  }

  .send-btn:hover {
    background: #d97706;
    box-shadow: 0 0 16px var(--amber-glow);
    transform: scale(1.05);
  }

  .send-btn:active { transform: scale(0.95); }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }

  .send-btn svg { width: 18px; height: 18px; }

  @media (max-width: 768px) {
    .input-area { padding: 12px 16px; }
  }
</style>
