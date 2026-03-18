<div class="msg-wrapper assistant">
  <div class="msg-avatar ai-avatar">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  </div>
  <div class="msg assistant typing-indicator">
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  </div>
</div>

<style>
  .msg-wrapper {
    display: flex;
    gap: 10px;
    max-width: 85%;
    animation: slideUp 300ms ease both;
    align-self: flex-start;
  }

  .msg-avatar {
    width: 28px;
    height: 28px;
    min-width: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    margin-top: 2px;
  }

  .ai-avatar {
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    color: var(--amber);
  }

  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 14px 16px;
  }

  .typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--amber);
    animation: pulseTyping 1.4s infinite;
  }

  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }

  .msg {
    padding: 12px 16px;
    border-radius: 14px;
    line-height: 1.7;
    font-size: 14px;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-2);
  }
</style>
