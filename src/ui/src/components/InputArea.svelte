<script lang="ts">
  import { chat, docs } from "../lib/state.svelte";

  let {
    onsend,
    oncancel,
  }: { onsend: (text: string) => void; oncancel?: () => void } = $props();

  let inputEl: HTMLTextAreaElement | undefined = $state();
  let inputValue = $state("");

  const focusedDoc = $derived(
    docs.focusedId != null
      ? docs.list.find((d) => d.id === docs.focusedId)
      : null,
  );

  const canSend = $derived(
    inputValue.trim().length > 0 && !!chat.sessionId && !chat.isStreaming,
  );

  const modKey = $derived.by(() => {
    if (typeof navigator === "undefined") return "⌘";
    return /Mac|iPhone|iPad|iPod/i.test(
      navigator.userAgent || "",
    )
      ? "⌘"
      : "Ctrl";
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) send();
    }
  }

  function handleInput() {
    if (!inputEl) return;
    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 200)}px`;
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
  <div
    class="composer"
    class:streaming={chat.isStreaming}
    class:scoped={focusedDoc != null}
  >
    {#if focusedDoc}
      <div class="scope-bar">
        <span class="scope-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
            <circle cx="11" cy="11" r="3"></circle>
          </svg>
        </span>
        <span class="scope-text">
          Searching in <span class="scope-name">{focusedDoc.label}</span>
        </span>
        <button
          type="button"
          class="scope-clear"
          aria-label="Clear document scope"
          onclick={() => (docs.focusedId = null)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    {/if}

    <div class="composer-core">
      <div class="field">
        <textarea
          bind:this={inputEl}
          bind:value={inputValue}
          rows="1"
          placeholder="Ask anything about your documents…"
          aria-label="Message"
          aria-describedby="composer-meta"
          autocomplete="off"
          disabled={!chat.sessionId}
          onkeydown={handleKeydown}
          oninput={handleInput}
        ></textarea>
        <div class="meta" id="composer-meta">
          {#if !chat.sessionId}
            <span class="meta-muted">Select or create a chat to continue</span>
          {:else if chat.isStreaming}
            <span class="meta-status" role="status" aria-live="polite">
              <span class="meta-pulse" aria-hidden="true"></span>
              Generating response
            </span>
          {:else}
            <span class="meta-hint">
              <kbd>{modKey}</kbd><span class="kbd-join">+</span><kbd title="Enter">↵</kbd>
              <span class="meta-action">send</span>
              <span class="meta-sep" aria-hidden="true"></span>
              <span class="meta-secondary">Shift+Enter new line</span>
            </span>
          {/if}
        </div>
      </div>

      <div class="actions">
        {#if chat.isStreaming}
          <button
            type="button"
            class="btn-stop"
            aria-label="Stop generating"
            onclick={() => oncancel?.()}
          >
            <span class="stop-icon" aria-hidden="true"></span>
            <span class="btn-text">Stop</span>
          </button>
        {:else}
          <button
            type="button"
            class="btn-send"
            class:is-ready={canSend}
            disabled={!canSend}
            aria-label="Send message"
            onclick={send}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .input-area {
    padding: 12px 20px 20px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(0, 0, 0, 0.35) 100%
    );
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .composer {
    position: relative;
    max-width: 900px;
    margin: 0 auto;
    border-radius: 16px;
    background: linear-gradient(
      165deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(255, 255, 255, 0) 48%
    ),
      var(--surface);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.25) inset,
      0 12px 40px rgba(0, 0, 0, 0.35);
    transition:
      border-color 220ms ease,
      box-shadow 220ms ease;
  }

  .composer:focus-within:not(.streaming) {
    border-color: rgba(245, 158, 11, 0.45);
    box-shadow:
      0 0 0 1px rgba(245, 158, 11, 0.12) inset,
      0 0 0 3px rgba(245, 158, 11, 0.12),
      0 12px 40px rgba(0, 0, 0, 0.35);
  }

  .composer.scoped:not(:focus-within) {
    border-left: 3px solid var(--emerald);
  }

  .composer.scoped:focus-within:not(.streaming) {
    border-left-color: var(--emerald);
  }

  .composer.streaming {
    border-color: rgba(245, 158, 11, 0.28);
    box-shadow:
      0 0 0 1px rgba(245, 158, 11, 0.08) inset,
      0 0 24px rgba(245, 158, 11, 0.06);
  }

  .scope-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px 8px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.35;
  }

  .scope-icon {
    display: flex;
    color: var(--emerald);
    flex-shrink: 0;
  }

  .scope-icon svg {
    width: 15px;
    height: 15px;
  }

  .scope-text {
    flex: 1;
    min-width: 0;
  }

  .scope-name {
    font-weight: 600;
    color: var(--text);
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }

  .scope-clear {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition:
      color 150ms,
      background 150ms;
  }

  .scope-clear svg {
    width: 16px;
    height: 16px;
  }

  .scope-clear:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.06);
  }

  .scope-clear:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  .composer-core {
    display: flex;
    align-items: stretch;
    gap: 2px;
    padding: 4px 6px 6px 12px;
  }

  .field {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 0 4px;
  }

  textarea {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text);
    font-family: "DM Sans", system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    outline: none;
    resize: none;
    min-height: 52px;
    max-height: 200px;
    padding: 4px 8px 0 0;
  }

  textarea::placeholder {
    color: var(--text-3);
    opacity: 0.85;
  }

  textarea:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .meta {
    min-height: 22px;
    display: flex;
    align-items: center;
    padding: 0 8px 2px 0;
    font-size: 11px;
    letter-spacing: 0.01em;
  }

  .meta-muted {
    color: var(--text-3);
  }

  .meta-hint {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    color: var(--text-3);
  }

  kbd {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-2);
    line-height: 1.2;
  }

  .kbd-join {
    font-size: 10px;
    opacity: 0.5;
    margin: 0 -1px;
  }

  .meta-action {
    margin-left: 2px;
    text-transform: lowercase;
    color: var(--text-3);
  }

  .meta-sep {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--surface-3);
    margin: 0 6px;
  }

  .meta-secondary {
    color: var(--text-3);
    opacity: 0.75;
  }

  .meta-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--amber);
    font-weight: 500;
  }

  .meta-pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--amber);
    box-shadow: 0 0 10px var(--amber);
    animation: composerPulse 1.2s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .meta-pulse {
      animation: none;
      opacity: 0.9;
    }
  }

  @keyframes composerPulse {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.85);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .actions {
    display: flex;
    align-items: flex-end;
    padding-bottom: 10px;
    padding-right: 6px;
  }

  .btn-send {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-3);
    transition:
      background 180ms ease,
      color 180ms ease,
      transform 160ms ease,
      box-shadow 180ms ease;
  }

  .btn-send svg {
    width: 20px;
    height: 20px;
  }

  .btn-send.is-ready {
    background: linear-gradient(145deg, #fbbf24 0%, var(--amber) 55%, #d97706 100%);
    color: var(--ink);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.2) inset,
      0 8px 24px rgba(245, 158, 11, 0.22);
  }

  .btn-send.is-ready:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.25) inset,
      0 12px 28px rgba(245, 158, 11, 0.3);
  }

  .btn-send.is-ready:active {
    transform: translateY(0);
  }

  .btn-send:disabled {
    cursor: not-allowed;
    opacity: 1;
    transform: none;
    box-shadow: none;
  }

  .btn-send:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 3px;
  }

  .btn-stop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    padding: 0 18px;
    border-radius: 14px;
    border: 1px solid rgba(251, 113, 133, 0.35);
    background: rgba(251, 113, 133, 0.1);
    color: #fda4af;
    font-family: "DM Sans", system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      transform 160ms ease;
  }

  .btn-stop:hover {
    background: rgba(251, 113, 133, 0.16);
    border-color: rgba(251, 113, 133, 0.5);
  }

  .btn-stop:active {
    transform: scale(0.98);
  }

  .btn-stop:focus-visible {
    outline: 2px solid #fda4af;
    outline-offset: 3px;
  }

  .stop-icon {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: currentColor;
  }

  @media (max-width: 420px) {
    .btn-text {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .btn-stop {
      width: 48px;
      height: 48px;
      padding: 0;
    }
  }

  @media (max-width: 768px) {
    .input-area {
      padding: 10px 12px 16px;
    }

    .meta-secondary {
      display: none;
    }

    .meta-sep {
      display: none;
    }
  }
</style>
