<script lang="ts">
  import { tick } from "svelte";
  import { marked } from "marked";
  import { ui, docs } from "../lib/state.svelte";
  import { fetchDocument, deleteDocument as apiDeleteDoc } from "../lib/api";
  import type { DocumentPreview } from "../lib/types";
  import {
    extractTocFromMarkdown,
    prettyPreviewTitle,
    slugifyWithDedup,
  } from "../lib/previewFormat";

  let {
    onnavchange = (_docId: number | null, _fullscreen: boolean) => {},
  }: {
    onnavchange?: (docId: number | null, fullscreen: boolean) => void;
  } = $props();

  let previewShellEl: HTMLDivElement | undefined = $state();
  let previewBodyEl: HTMLDivElement | undefined = $state();
  let previewContentEl: HTMLDivElement | undefined = $state();

  let loading = $state(false);
  let doc = $state<DocumentPreview | null>(null);
  let error = $state<string | null>(null);
  let readProgress = $state(0);
  let activeTocSlug = $state<string | null>(null);
  let tocSideOpen = $state(false);

  // Load document when selectedId changes
  $effect(() => {
    const id = docs.selectedId;
    if (id == null) {
      doc = null;
      error = null;
      tocSideOpen = false;
      return;
    }
    tocSideOpen = false;
    loadDoc(id);
  });

  async function loadDoc(id: number) {
    loading = true;
    error = null;
    try {
      doc = await fetchDocument(id);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load document";
      doc = null;
    } finally {
      loading = false;
    }
  }

  function escapeHtml(s: string) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseFrontmatter(content: string) {
    if (!content.startsWith("---\n"))
      return { metadata: {} as Record<string, string>, body: content };
    const endIndex = content.indexOf("\n---\n", 4);
    if (endIndex === -1)
      return { metadata: {} as Record<string, string>, body: content };

    const raw = content.slice(4, endIndex).trim();
    const body = content.slice(endIndex + 5).trim();
    const metadata: Record<string, string> = {};

    for (const line of raw.split("\n")) {
      const sep = line.indexOf(":");
      if (sep === -1) continue;
      const key = line.slice(0, sep).trim();
      const value = line
        .slice(sep + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (key) metadata[key] = value;
    }
    return { metadata, body };
  }

  function normalizeMarkdown(md: string) {
    return md.replace(
      /!\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      (_match, _alt, url) => {
        if (/vimeo\.com|youtube\.com|youtu\.be/.test(url)) {
          return `\n<a class="embed-link" href="${url}" target="_blank" rel="noopener noreferrer"><span class="embed-label">Video link</span>${url}</a>\n`;
        }
        return `![${_alt}](${url})`;
      },
    );
  }

  function formatPrettyTime(dateStr: string) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  }

  function formatMetaValue(key: string, value: string) {
    if (!value) return "";
    if (key.includes("published") || key.endsWith("_at")) {
      return formatPrettyTime(value);
    }
    return value;
  }

  const parsed = $derived(() => {
    if (!doc) return null;
    const { metadata, body } = parseFrontmatter(doc.content);
    const normalizedBody = normalizeMarkdown(body || doc.content);
    const bodyHtml = marked.parse(normalizedBody) as string;
    const toc = extractTocFromMarkdown(normalizedBody);
    const entries = Object.entries(metadata).filter(
      ([k]) => k !== "title" && k !== "cover_image",
    );
    return {
      title: metadata.title || "Untitled document",
      coverImage: metadata.cover_image || null,
      entries,
      bodyHtml,
      metadata,
      normalizedBody,
      toc,
    };
  });

  function updateReadProgress() {
    const shell = previewShellEl;
    if (!shell) return;
    const max = shell.scrollHeight - shell.clientHeight;
    readProgress =
      max <= 0 ? 100 : Math.min(100, Math.max(0, (100 * shell.scrollTop) / max));
  }

  function updateActiveHeading() {
    const shell = previewShellEl;
    const contentEl = previewContentEl;
    if (!shell || !contentEl) return;
    const heads = [
      ...contentEl.querySelectorAll("h1,h2,h3,h4,h5,h6"),
    ] as HTMLElement[];
    if (heads.length === 0) {
      activeTocSlug = null;
      return;
    }
    const shellTop = shell.getBoundingClientRect().top + 16;
    let current: string | null = heads[0]?.id || null;
    for (const h of heads) {
      if (!h.id) continue;
      if (h.getBoundingClientRect().top <= shellTop) current = h.id;
    }
    activeTocSlug = current;
  }

  function scrollToHeadingId(slug: string, e?: Event) {
    e?.preventDefault();
    const shell = previewShellEl;
    const el = previewContentEl?.querySelector(`#${CSS.escape(slug)}`);
    if (!shell || !el || !(el instanceof HTMLElement)) return;
    const y =
      el.getBoundingClientRect().top -
      shell.getBoundingClientRect().top +
      shell.scrollTop -
      12;
    shell.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  function handleTocKeydown(slug: string, e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      scrollToHeadingId(slug);
    }
  }

  $effect(() => {
    const id = docs.selectedId;
    const shell = previewShellEl;
    if (id == null || !shell) return;
    shell.scrollTop = 0;
    readProgress = 0;
  });

  $effect(() => {
    const p = parsed();
    if (!p || loading || error || !previewContentEl) return;

    void p.bodyHtml;
    const expectDocId = doc?.id;
    const bodySnapshot = p.bodyHtml;

    tick().then(() => {
      if (
        !previewContentEl ||
        doc?.id !== expectDocId ||
        parsed()?.bodyHtml !== bodySnapshot
      ) {
        return;
      }
      const toc = p.toc;
      const domHeads = [
        ...previewContentEl.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      ] as HTMLElement[];
      const used = new Set(toc.map((t) => t.slug));
      let i = 0;
      for (const h of domHeads) {
        h.id =
          i < toc.length
            ? toc[i].slug
            : slugifyWithDedup(h.textContent || "section", used);
        i += 1;
      }
      updateReadProgress();
      updateActiveHeading();
    });
  });

  $effect(() => {
    if (!ui.previewOpen) return;
    const shell = previewShellEl;
    if (!shell) return;

    const onScroll = () => {
      updateReadProgress();
      updateActiveHeading();
    };

    const ro = new ResizeObserver(() => {
      updateReadProgress();
      updateActiveHeading();
    });
    ro.observe(shell);

    shell.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    return () => {
      ro.disconnect();
      shell.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  });

  function close() {
    ui.previewOpen = false;
    ui.previewFullscreen = false;
    docs.selectedId = null;
    onnavchange(null, false);
  }

  function toggleFullscreen() {
    ui.previewFullscreen = !ui.previewFullscreen;
    // Reset card width on toggle
    const card = previewBodyEl?.querySelector(
      ".preview-card",
    ) as HTMLElement | null;
    if (card) card.style.maxWidth = "";
    onnavchange(docs.selectedId, ui.previewFullscreen);
  }

  async function handleDelete() {
    if (docs.selectedId == null) return;
    if (!confirm("Remove this document from the index?")) return;
    try {
      await apiDeleteDoc(docs.selectedId);
      docs.list = docs.list.filter((d) => d.id !== docs.selectedId);
      if (docs.selectedId === docs.focusedId) docs.focusedId = null;
      close();
    } catch {
      /* ignore */
    }
  }

  function handleImageClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG" && (target as HTMLImageElement).src) {
      ui.lightboxSrc = (target as HTMLImageElement).src;
    }
  }

  // Resize logic
  function handleResizeMousedown(e: MouseEvent) {
    const handle = (e.target as HTMLElement).closest(
      ".preview-resize-handle",
    ) as HTMLElement | null;
    if (!handle || !previewBodyEl || !previewShellEl) return;
    e.preventDefault();

    const card = previewBodyEl.querySelector(
      ".preview-card",
    ) as HTMLElement | null;
    if (!card) return;

    const scrollTop = previewShellEl.scrollTop;
    const startX = e.clientX;
    const startWidth = card.getBoundingClientRect().width;
    const side = handle.dataset.resize;
    let resizing = true;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = side === "right" ? ev.clientX - startX : startX - ev.clientX;
      const newWidth = Math.max(280, startWidth + dx * 2);
      card.style.maxWidth = newWidth + "px";
      previewShellEl!.scrollTop = scrollTop;
    };

    const onMouseUp = () => {
      resizing = false;
      document.body.style.cursor = "";
      if (card)
        localStorage.setItem("preview-content-width", card.style.maxWidth);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const rawSaved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("preview-content-width") || ""
      : "";
  // Ignore stale saved widths smaller than the current default (860px)
  const savedWidth = rawSaved && parseInt(rawSaved) >= 860 ? rawSaved : "";
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
{#if ui.previewOpen}
  <div
    class="preview-overlay"
    class:hidden={ui.previewFullscreen}
    onclick={close}
  ></div>
{/if}

<section
  class="preview-panel"
  class:open={ui.previewOpen}
  class:fullscreen={ui.previewFullscreen}
>
  <div class="preview-header-wrap">
    <div
      class="preview-read-progress"
      style="transform: scaleX({readProgress / 100});"
    ></div>
    <div class="preview-header">
      <div class="preview-header-info">
        <h2 title={doc?.label ? doc.label : undefined}>
          {doc ? prettyPreviewTitle(doc.label) : "Document Preview"}
        </h2>
        <div class="preview-meta">
          {#if doc}
            {doc.label}.md &middot; {formatPrettyTime(doc.updatedAt)}
          {/if}
        </div>
      </div>
      <div class="preview-actions">
      <button
        class="preview-action-btn"
        title="Remove document"
        style="color:var(--rose);"
        onclick={handleDelete}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="width:16px;height:16px;"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path
            d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
          ></path>
        </svg>
      </button>
      <button
        class="preview-fullscreen"
        title="Toggle fullscreen"
        onclick={toggleFullscreen}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button class="preview-close" title="Close preview" onclick={close}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      </div>
    </div>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="preview-shell" bind:this={previewShellEl}>
    <div
      class="preview-body"
      bind:this={previewBodyEl}
      onclick={handleImageClick}
      onmousedown={handleResizeMousedown}
    >
      {#if loading}
        <div class="empty-state" style="padding:24px;font-size:13px;">
          Fetching document...
        </div>
      {:else if error}
        <div class="empty-state" style="padding:24px;font-size:13px;">
          {error}
        </div>
      {:else if parsed()}
        {@const p = parsed()!}
        <div class="preview-shell-inner">
          {#if p.toc.length > 0}
            <div
              class="preview-toc-rail"
              class:open={tocSideOpen}
            >
              <aside
                id="preview-toc-panel"
                class="preview-toc-panel"
                aria-label="On this page"
                aria-hidden={!tocSideOpen}
                inert={!tocSideOpen}
              >
                <div class="preview-toc-label">Contents</div>
                <nav class="preview-toc-nav">
                  {#each p.toc as item (item.slug)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <a
                      href="#{item.slug}"
                      class="preview-toc-link"
                      class:active={activeTocSlug === item.slug}
                      style="padding-left: {(item.level - 1) * 10}px"
                      onclick={(e) => scrollToHeadingId(item.slug, e)}
                      onkeydown={(e) => handleTocKeydown(item.slug, e)}
                      >{item.text}</a
                    >
                  {/each}
                </nav>
              </aside>
              <div class="preview-toc-seam">
                <span class="preview-toc-mark" aria-hidden="true">§</span>
                <button
                  type="button"
                  class="preview-toc-edge-tab"
                  aria-expanded={tocSideOpen}
                  aria-controls="preview-toc-panel"
                  title={tocSideOpen ? "Hide contents" : "Show contents"}
                  onclick={() => (tocSideOpen = !tocSideOpen)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <polyline
                      points={tocSideOpen ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}
                    ></polyline>
                  </svg>
                </button>
              </div>
            </div>
          {/if}
          <div class="preview-main-col">
        <div class="preview-card-wrapper">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="preview-resize-handle left" data-resize="left">
            <div class="preview-resize-grip"></div>
          </div>
          <article class="preview-card" style:max-width={savedWidth}>
            <section class="preview-frontmatter">
              <h3>{p.title}</h3>
              {#if p.coverImage}
                <img
                  class="cover-image"
                  src={p.coverImage}
                  alt="{p.title} cover image"
                />
              {/if}
              {#if p.entries.length > 0}
                <div class="preview-grid">
                  {#each p.entries as [key, value]}
                    <div class="meta-item">
                      <span class="meta-key">{key.replaceAll("_", " ")}</span>
                      <div class="meta-value">
                        {formatMetaValue(key, value)}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
            <div class="preview-content" bind:this={previewContentEl}>
              {@html p.bodyHtml}
            </div>
          </article>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="preview-resize-handle right" data-resize="right">
            <div class="preview-resize-grip"></div>
          </div>
        </div>
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              ></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          Select a document to preview
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(12, 10, 9, 0.5);
    z-index: 90;
    transition: opacity var(--transition);
  }

  .preview-overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .preview-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(900px, 90vw);
    height: 100vh;
    background: var(--ink);
    border-left: 1px solid var(--border-subtle);
    z-index: 100;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition:
      transform var(--transition),
      width var(--transition);
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
  }

  .preview-panel.open {
    transform: translateX(0);
  }

  .preview-panel.fullscreen {
    width: 100vw;
    border-left: none;
  }

  .preview-panel.fullscreen .preview-card {
    max-width: 1100px;
  }

  .preview-header-wrap {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border-subtle);
  }

  .preview-read-progress {
    height: 3px;
    flex-shrink: 0;
    width: 100%;
    transform-origin: left center;
    background: var(--amber);
    opacity: 0.95;
  }

  .preview-header {
    padding: 16px 24px;
    border-bottom: none;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .preview-header-info {
    flex: 1;
    min-width: 0;
  }

  .preview-header h2 {
    font-family: "Instrument Serif", serif;
    font-size: 18px;
    font-weight: 400;
    margin-bottom: 4px;
  }

  .preview-meta {
    font-size: 11px;
    color: var(--text-3);
    font-family: "JetBrains Mono", monospace;
    word-break: break-all;
  }

  .preview-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .preview-action-btn,
  .preview-close,
  .preview-fullscreen {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: var(--surface);
    color: var(--text-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 150ms,
      color 150ms;
    flex-shrink: 0;
    padding: 0;
  }

  .preview-action-btn:hover,
  .preview-close:hover,
  .preview-fullscreen:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .preview-action-btn:hover {
    color: var(--rose) !important;
  }

  .preview-close :global(svg),
  .preview-fullscreen :global(svg) {
    width: 16px;
    height: 16px;
  }

  .preview-shell {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-3) transparent;
  }

  .preview-shell-inner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
  }

  .preview-toc-rail {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    align-self: flex-start;
    gap: 0;
  }

  .preview-toc-panel {
    flex-shrink: 0;
    width: min(200px, 32vw);
    max-width: min(200px, 32vw);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding-right: 10px;
    transition:
      max-width 0.2s ease,
      opacity 0.16s ease,
      padding 0.2s ease;
  }

  .preview-toc-rail:not(.open) .preview-toc-panel {
    max-width: 0;
    width: 0;
    min-width: 0;
    opacity: 0;
    padding-right: 0;
    pointer-events: none;
  }

  .preview-toc-seam {
    flex-shrink: 0;
    width: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0 10px;
    gap: 6px;
    border-right: 1px solid var(--border-subtle);
    box-sizing: border-box;
  }

  .preview-toc-mark {
    font-size: 11px;
    font-family: "Instrument Serif", serif;
    color: var(--text-3);
    line-height: 1;
    user-select: none;
    opacity: 0.65;
  }

  .preview-toc-edge-tab {
    flex-shrink: 0;
    width: 100%;
    margin: 0;
    padding: 6px 0;
    border: none;
    border-radius: 0 5px 5px 0;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 140ms ease,
      color 140ms ease;
  }

  .preview-toc-edge-tab:hover {
    background: color-mix(in srgb, var(--surface-2) 55%, transparent);
    color: var(--text);
  }

  .preview-toc-edge-tab :global(svg) {
    width: 14px;
    height: 14px;
  }

  .preview-toc-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    padding: 2px 0 8px;
    flex-shrink: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border-subtle) 70%, transparent);
    margin-bottom: 6px;
  }

  .preview-toc-nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 0 0 8px;
    max-height: min(calc(100vh - 200px), 62vh);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-3) transparent;
  }

  .preview-toc-link {
    display: block;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-3);
    text-decoration: none;
    padding: 3px 0 3px 6px;
    margin-left: -6px;
    border-left: 2px solid transparent;
    transition:
      color 120ms ease,
      border-color 120ms ease;
  }

  .preview-toc-link:hover {
    color: var(--text-2);
  }

  .preview-toc-link.active {
    color: var(--amber);
    border-left-color: var(--amber);
  }

  .preview-main-col {
    flex: 1;
    min-width: 0;
  }

  .preview-card-wrapper {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0;
  }

  :global(.preview-card) {
    max-width: 860px;
    flex: 1;
    min-width: 0;
  }

  .preview-frontmatter {
    padding: 24px 0;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 24px;
  }

  .preview-frontmatter h3 {
    font-family: "Instrument Serif", serif;
    font-size: 32px;
    font-weight: 400;
    line-height: 1.2;
    color: var(--text);
    letter-spacing: -0.02em;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }

  .meta-item {
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 10px 12px;
  }

  .meta-key {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    margin-bottom: 4px;
  }

  .meta-value {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-2);
    overflow-wrap: anywhere;
  }

  :global(.cover-image) {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    cursor: zoom-in;
  }

  :global(.preview-content) {
    line-height: 1.8;
    font-size: 15px;
    color: var(--text-2);
    overflow-wrap: anywhere;
  }

  :global(.preview-content h4),
  :global(.preview-content h5),
  :global(.preview-content h6) {
    font-family: "Instrument Serif", serif;
    font-weight: 400;
    margin: 1em 0 0.4em;
    color: var(--text);
    line-height: 1.25;
  }

  :global(.preview-content h4) {
    font-size: 1.05rem;
  }
  :global(.preview-content h5) {
    font-size: 1rem;
  }
  :global(.preview-content h6) {
    font-size: 0.95rem;
  }

  :global(.preview-content h1),
  :global(.preview-content h2),
  :global(.preview-content h3) {
    font-family: "Instrument Serif", serif;
    font-weight: 400;
    margin: 1em 0 0.4em;
    color: var(--text);
    line-height: 1.25;
  }

  :global(.preview-content h1) {
    font-size: 1.75rem;
  }
  :global(.preview-content h2) {
    font-size: 1.4rem;
  }
  :global(.preview-content h3) {
    font-size: 1.15rem;
  }

  :global(.preview-content p),
  :global(.preview-content ul),
  :global(.preview-content ol) {
    margin: 0.7em 0;
  }

  :global(.preview-content img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 1.2rem auto;
    border-radius: 12px;
    cursor: zoom-in;
  }

  :global(.preview-content hr) {
    border: none;
    border-top: 1px solid var(--border-subtle);
    margin: 1.5rem 0;
  }

  .preview-resize-handle {
    position: sticky;
    top: calc(50vh - 24px);
    z-index: 10;
    width: 16px;
    height: 48px;
    margin: 0 24px;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .preview-resize-handle:hover .preview-resize-grip,
  .preview-resize-handle:active .preview-resize-grip {
    opacity: 1;
    background: var(--amber);
  }

  .preview-resize-grip {
    width: 4px;
    height: 100%;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text-3) 40%, transparent);
    opacity: 0.4;
    transition:
      opacity 200ms ease,
      background 200ms ease;
  }

  @media (max-width: 768px) {
    .preview-panel {
      width: 100vw;
    }

    .preview-shell-inner {
      flex-direction: column;
      gap: 12px;
    }

    .preview-toc-rail {
      position: relative;
      width: 100%;
      top: auto;
      flex-direction: column;
      align-items: stretch;
      max-height: none;
    }

    .preview-toc-seam {
      order: -1;
      flex-direction: row;
      width: 100%;
      justify-content: flex-start;
      align-items: center;
      padding: 6px 0 10px;
      gap: 10px;
      border-right: none;
      border-bottom: 1px solid var(--border-subtle);
    }

    .preview-toc-edge-tab {
      width: auto;
      min-width: 36px;
      padding: 6px 10px;
      border-radius: 6px;
    }

    .preview-toc-panel {
      width: 100%;
      max-width: none;
      border-right: none;
      padding-right: 0;
      margin-right: 0;
      transition:
        max-height 0.22s ease,
        opacity 0.16s ease,
        padding 0.16s ease;
    }

    .preview-toc-rail:not(.open) .preview-toc-panel {
      max-height: 0;
      min-height: 0;
      opacity: 0;
      overflow: hidden;
      padding-top: 0;
      padding-bottom: 0;
      margin-bottom: 0;
      border-bottom: none;
      pointer-events: none;
    }

    .preview-toc-rail.open .preview-toc-panel {
      max-height: min(45vh, 320px);
      opacity: 1;
    }

    .preview-toc-nav {
      max-height: min(38vh, 260px);
    }
  }
</style>
