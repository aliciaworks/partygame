<script lang="ts">
  import type { BackendHealth, BackendSla } from '$lib/portal';
  import { translate } from './i18n';

  export let health: BackendHealth | null = null;
  export let sla: BackendSla | null = null;
  export let lastSyncedAt = '';
</script>

<article class="panel card-block">
  <div class="section-head">
    <div>
      <p class="eyebrow mono">{$translate('runtime.title')}</p>
      <h3>{$translate('runtime.title')}</h3>
    </div>
    <span class="pill subtle">{lastSyncedAt ? `Updated ${lastSyncedAt}` : 'Idle'}</span>
  </div>

  {#if health || sla}
    <div class="info-list">
      <div>
        <span class="mono">{$translate('label.health')}</span>
        <strong>{health?.status ?? '—'}</strong>
      </div>
      <div>
        <span class="mono">{$translate('label.uptime')}</span>
        <strong>{health?.uptime_ms ? `${Math.round(health.uptime_ms / 1000)}s` : '—'}</strong>
      </div>
      <div>
        <span class="mono">{$translate('label.sla_target')}</span>
        <strong>{typeof sla?.sla_target_uptime === 'number' ? `${sla!.sla_target_uptime}%` : '—'}</strong>
      </div>
      <div>
        <span class="mono">{$translate('label.last_incident')}</span>
        <strong>{sla?.last_incident ?? '—'}</strong>
      </div>
    </div>

    {#if health?.checks}
      <div class="chip-row">
        {#each Object.entries(health.checks) as [name, value]}
          <span class:chip={true} class:good={value} class:bad={!value}>
            {name}: {value ? 'ok' : 'down'}
          </span>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <p>No runtime data available. Click <strong>Refresh</strong> to query the backend.</p>
    </div>
  {/if}
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

  .pill {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--muted);
  }

  .pill.subtle {
    background: rgba(124, 240, 255, 0.08);
    color: var(--text);
  }

  .info-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .info-list > div {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .info-list span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .info-list strong {
    display: block;
    font-size: 1.05rem;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }

  .empty-state {
    min-height: 120px;
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 12px;
    color: var(--muted);
  }

  .chip {
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid transparent;
  }

  .chip.good {
    background: rgba(125, 255, 181, 0.08);
    border-color: rgba(125, 255, 181, 0.18);
    color: #d7ffe9;
  }

  .chip.bad {
    background: rgba(255, 107, 122, 0.08);
    border-color: rgba(255, 107, 122, 0.18);
    color: #ffdbe0;
  }
</style>
