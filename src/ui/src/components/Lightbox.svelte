<script lang="ts">
  import { ui } from "../lib/state.svelte";

  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let dragging = $state(false);
  let dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  function close() {
    ui.lightboxSrc = null;
    reset();
  }

  function reset() {
    scale = 1;
    translateX = 0;
    translateY = 0;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!ui.lightboxSrc) return;
    if (e.key === "Escape") close();
    if (e.key === "+" || e.key === "=") zoomBy(0.5);
    if (e.key === "-") zoomBy(-0.5);
    if (e.key === "0") reset();
  }

  function zoomBy(delta: number) {
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));
    if (scale === 1) { translateX = 0; translateY = 0; }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    zoomBy(delta);
  }

  function onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("lightbox")) close();
  }

  function onPointerDown(e: PointerEvent) {
    if (scale <= 1) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, tx: translateX, ty: translateY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    translateX = dragStart.tx + (e.clientX - dragStart.x);
    translateY = dragStart.ty + (e.clientY - dragStart.y);
  }

  function onPointerUp() {
    dragging = false;
  }

  function onDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    if (scale > 1) {
      reset();
    } else {
      scale = 2.5;
    }
  }

  const transform = $derived(
    `translate(${translateX}px, ${translateY}px) scale(${scale})`
  );
</script>

<svelte:window onkeydown={onKeydown} />

{#if ui.lightboxSrc}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="lightbox" onclick={onBackdropClick} onwheel={onWheel}>
    <div class="lightbox-toolbar">
      <button onclick={() => zoomBy(-0.5)} aria-label="Zoom out" title="Zoom out (-)">−</button>
      <span class="lightbox-zoom-level">{Math.round(scale * 100)}%</span>
      <button onclick={() => zoomBy(0.5)} aria-label="Zoom in" title="Zoom in (+)">+</button>
      <button onclick={reset} aria-label="Reset zoom" title="Reset (0)">⟲</button>
      <button onclick={close} aria-label="Close" title="Close (Esc)">✕</button>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <img
      src={ui.lightboxSrc}
      alt=""
      style:transform
      style:cursor={scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in"}
      class:dragging
      ondblclick={onDoubleClick}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
    />
  </div>
{/if}

<style>
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(12, 10, 9, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }

  .lightbox img {
    max-width: 92vw;
    max-height: 88vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6);
    transition: transform 200ms ease;
    transform-origin: center center;
    user-select: none;
    -webkit-user-drag: none;
  }

  .lightbox img.dragging {
    transition: none;
  }

  .lightbox-toolbar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(28, 25, 23, 0.85);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    backdrop-filter: blur(12px);
    z-index: 201;
  }

  .lightbox-toolbar button {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text-2);
    font-size: 16px;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 120ms, color 120ms;
  }

  .lightbox-toolbar button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text);
  }

  .lightbox-zoom-level {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    color: var(--text-3);
    min-width: 40px;
    text-align: center;
  }
</style>
