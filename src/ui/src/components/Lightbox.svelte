<script lang="ts">
  import { ui } from "../lib/state.svelte";

  function close() {
    ui.lightboxSrc = null;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && ui.lightboxSrc) close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if ui.lightboxSrc}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="lightbox open" onclick={close}>
    <img src={ui.lightboxSrc} alt="" />
  </div>
{/if}

<style>
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(12, 10, 9, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }

  .lightbox img {
    max-width: 92vw;
    max-height: 92vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6);
    transition: transform 200ms ease;
  }
</style>
