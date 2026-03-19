<script lang="ts">
  import { chat } from "../lib/state.svelte";
  import MessageBubble from "./MessageBubble.svelte";
  import TypingIndicator from "./TypingIndicator.svelte";
  import type { Source } from "../lib/types";

  let {
    streamingContent = "",
    streamingSources = [] as Source[],
    showTyping = false,
  }: {
    streamingContent?: string;
    streamingSources?: Source[];
    showTyping?: boolean;
  } = $props();

  let messagesEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    // Re-run whenever messages change or streaming content updates
    void chat.messages;
    void streamingContent;
    void showTyping;
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
</script>

<div class="messages" bind:this={messagesEl}>
  {#if chat.messages.length === 0 && !showTyping && !streamingContent}
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <p class="empty-title">Your research copilot</p>
      <p class="empty-copy">
        Ask questions grounded in your indexed documents. Sessions persist automatically—pick up where you left off anytime.
      </p>
    </div>
  {:else}
    {#each chat.messages as msg (msg.sequence)}
      <MessageBubble role={msg.role} content={msg.content} model={msg.model} />
    {/each}
    {#if showTyping}
      <TypingIndicator />
    {/if}
    {#if streamingContent}
      <MessageBubble role="assistant" content={streamingContent} sources={streamingSources} />
    {/if}
  {/if}
</div>

<style>
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-3) transparent;
  }

  .empty-title {
    font-family: "Instrument Serif", serif;
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--text);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .empty-copy {
    max-width: 34rem;
    margin: 0;
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-3);
  }

  @media (max-width: 768px) {
    .messages {
      padding: 16px 16px 8px;
    }
  }
</style>
