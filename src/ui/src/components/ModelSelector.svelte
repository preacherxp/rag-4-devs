<script lang="ts">
  import { chat } from "../lib/state.svelte";

  let { onchange }: { onchange: (value: string) => void } = $props();

  const providerLabels: Record<string, string> = {
    lmstudio: "LM Studio",
    openrouter: "OpenRouter",
  };

  interface OptionItem {
    value: string;
    label: string;
    provider: string;
  }

  const options = $derived(() => {
    const items: OptionItem[] = chat.models.map((m) => ({
      value: `${m.provider}:${m.id}`,
      label: m.id,
      provider: m.provider,
    }));

    const keys = new Set(items.map((i) => i.value));
    const currentKey = `${chat.provider}:${chat.model}`;

    if (chat.model && !keys.has(currentKey)) {
      items.unshift({ value: currentKey, label: chat.model, provider: chat.provider });
    } else if (
      !chat.model &&
      chat.defaultModel &&
      !keys.has(`${chat.defaultProvider}:${chat.defaultModel}`)
    ) {
      items.unshift({
        value: `${chat.defaultProvider}:${chat.defaultModel}`,
        label: chat.defaultModel,
        provider: chat.defaultProvider,
      });
    }

    return items;
  });

  const grouped = $derived(() => {
    const groups: Record<string, OptionItem[]> = {};
    for (const item of options()) {
      (groups[item.provider] = groups[item.provider] || []).push(item);
    }
    return groups;
  });

  const hasMultipleProviders = $derived(() => Object.keys(grouped()).length > 1);

  const currentValue = $derived.by(() =>
    chat.model
      ? `${chat.provider}:${chat.model}`
      : `${chat.defaultProvider}:${chat.defaultModel}`,
  );
</script>

<section class="session-section">
  <div class="session-info">
    {#if chat.sessionId}
      {chat.sessionId.slice(0, 8)} &middot;
      {chat.provider === "openrouter" ? " OpenRouter" : ""}
    {:else}
      loading session...
    {/if}
  </div>
  <label class="field-label" for="model-select">Model</label>
  <select
    id="model-select"
    value={currentValue}
    disabled={chat.isStreaming || !chat.sessionId || options().length === 0}
    onchange={(e) => onchange((e.target as HTMLSelectElement).value)}
  >
    {#if options().length === 0}
      <option>No models available</option>
    {:else if hasMultipleProviders()}
      {#each ["lmstudio", "openrouter"] as provider}
        {#if grouped()[provider]}
          <optgroup label={providerLabels[provider] || provider}>
            {#each grouped()[provider] as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </optgroup>
        {/if}
      {/each}
    {:else}
      {#each options() as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    {/if}
  </select>
</section>

<style>
  .session-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .session-info {
    font-size: 11px;
    color: var(--text-3);
    font-family: 'JetBrains Mono', monospace;
    word-break: break-all;
  }
</style>
