<script lang="ts">
  import { chat } from "../lib/state.svelte";

  let {
    selectId = "model-select",
    label = "Model",
    model,
    provider,
    defaultModel,
    defaultProvider,
    disabled = false,
    info = "",
    onchange,
  }: {
    selectId?: string;
    label?: string;
    model: string;
    provider: string;
    defaultModel: string;
    defaultProvider: string;
    disabled?: boolean;
    info?: string;
    onchange: (value: string) => void;
  } = $props();

  const providerLabels: Record<string, string> = {
    lmstudio: "LM Studio",
    openrouter: "OpenRouter",
  };

  interface OptionItem {
    value: string;
    label: string;
    provider: string;
  }

  const options = $derived.by(() => {
    const items: OptionItem[] = chat.models.map((m) => ({
      value: `${m.provider}:${m.id}`,
      label: m.id,
      provider: m.provider,
    }));

    const keys = new Set(items.map((i) => i.value));
    const currentKey = `${provider}:${model}`;

    if (model && !keys.has(currentKey)) {
      items.unshift({ value: currentKey, label: model, provider });
    } else if (
      !model &&
      defaultModel &&
      !keys.has(`${defaultProvider}:${defaultModel}`)
    ) {
      items.unshift({
        value: `${defaultProvider}:${defaultModel}`,
        label: defaultModel,
        provider: defaultProvider,
      });
    }

    return items;
  });

  const grouped = $derived.by(() => {
    const groups: Record<string, OptionItem[]> = {};
    for (const item of options) {
      (groups[item.provider] = groups[item.provider] || []).push(item);
    }
    return groups;
  });

  const hasMultipleProviders = $derived.by(() => Object.keys(grouped).length > 1);

  const currentValue = $derived.by(() =>
    model ? `${provider}:${model}` : `${defaultProvider}:${defaultModel}`,
  );
</script>

<section class="session-section">
  {#if info}
    <div class="session-info">{info}</div>
  {/if}
  <label class="field-label" for={selectId}>{label}</label>
  <select
    id={selectId}
    value={currentValue}
    disabled={disabled || options.length === 0}
    onchange={(e) => onchange((e.target as HTMLSelectElement).value)}
  >
    {#if options.length === 0}
      <option>No models available</option>
    {:else if hasMultipleProviders}
      {#each ["lmstudio", "openrouter"] as providerKey}
        {#if grouped[providerKey]}
          <optgroup label={providerLabels[providerKey] || providerKey}>
            {#each grouped[providerKey] as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </optgroup>
        {/if}
      {/each}
    {:else}
      {#each options as opt}
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
