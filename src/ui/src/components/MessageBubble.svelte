<script lang="ts">
  import { marked } from "marked";
  import SourcesList from "./SourcesList.svelte";
  import type { Source } from "../lib/types";

  let { role, content, model = null, sources = [] }: {
    role: "user" | "assistant" | "error";
    content: string;
    model?: string | null;
    sources?: Source[];
  } = $props();

  marked.setOptions({ breaks: true });

  const rendered = $derived(
    role === "assistant" ? marked.parse(content) as string : ""
  );
</script>

<div class="msg-wrapper {role}">
  <div class="msg-avatar {role === 'user' ? 'user-avatar' : 'ai-avatar'}">
    {#if role === "user"}
      U
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    {/if}
  </div>
  <div class="msg {role} markdown-content">
    {#if role === "user" || role === "error"}
      {content}
    {:else}
      {@html rendered}
      <SourcesList {sources} />
    {/if}
    {#if model && role === "assistant"}
      <span class="msg-model">{model}</span>
    {/if}
  </div>
</div>

<style>
  .msg-wrapper {
    display: flex;
    gap: 10px;
    max-width: 85%;
    animation: slideUp 300ms ease both;
  }

  .msg-wrapper.user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .msg-wrapper.assistant,
  .msg-wrapper.error {
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

  .user-avatar {
    background: linear-gradient(135deg, var(--amber), #d97706);
    color: var(--ink);
  }

  .ai-avatar {
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    color: var(--amber);
  }

  .msg {
    padding: 12px 16px;
    border-radius: 14px;
    line-height: 1.7;
    font-size: 14px;
  }

  .msg.user {
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    white-space: pre-wrap;
    color: var(--text);
  }

  .msg.assistant {
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-2);
  }

  .msg.error {
    background: rgba(251, 113, 133, 0.1);
    border: 1px solid rgba(251, 113, 133, 0.2);
    color: var(--rose);
    white-space: pre-wrap;
  }

  .msg.assistant :global(p) { margin: 0.4em 0; }
  .msg.assistant :global(ul),
  .msg.assistant :global(ol) { margin: 0.4em 0; padding-left: 1.4em; }

  .msg-model {
    display: block;
    font-size: 10px;
    color: var(--text-3);
    margin-top: 6px;
    font-family: 'JetBrains Mono', monospace;
    opacity: 0.7;
  }

  @media (max-width: 768px) {
    .msg-wrapper { max-width: 95%; }
  }
</style>
