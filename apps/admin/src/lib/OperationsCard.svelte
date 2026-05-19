<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translate } from './i18n';

  export let busy = false;

  const dispatch = createEventDispatcher();

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleOpenHealth() {
    dispatch('open-health');
  }

  function handleOpenApiVersions() {
    dispatch('open-api-versions');
  }
</script>

<article class="panel card-block">
  <div class="section-head">
    <div>
      <p class="eyebrow mono">OPERATIONS</p>
      <h3>Quick actions</h3>
    </div>
  </div>

  <div class="stack">
    <button class="ghost" on:click={handleRefresh} disabled={busy}>{$translate('ops.refresh_backend')}</button>
    <button class="ghost" on:click={handleOpenHealth}>{$translate('ops.open_health')}</button>
    <button class="ghost" on:click={handleOpenApiVersions}>{$translate('ops.open_versions')}</button>
  </div>
</article>

<style>
  .card-block {
    padding: 20px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
    margin-bottom: 16px;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent);
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  h3 {
    font-size: 1.1rem;
    margin: 0;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  button {
    width: 100%;
    border: 0;
    border-radius: 16px;
    padding: 13px 16px;
    color: var(--text);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    font: inherit;
    transition: transform 0.18s ease, opacity 0.18s ease;
  }

  button:hover {
    transform: translateY(-1px);
  }

  button:disabled {
    opacity: 0.65;
    cursor: progress;
  }

  .ghost {
    background: rgba(255, 255, 255, 0.05);
  }
</style>
