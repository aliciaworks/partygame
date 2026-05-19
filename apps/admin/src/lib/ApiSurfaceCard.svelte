<script lang="ts">
  import type { ApiVersions } from '$lib/portal';
  import { translate } from './i18n';

  export let versions: ApiVersions | null = null;
</script>

<article class="panel card-block wide">
  <div class="section-head">
    <div>
      <p class="eyebrow mono">{$translate('api.title')}</p>
      <h3>{$translate('api.title')}</h3>
    </div>
  </div>

  {#if versions}
    <div class="support-grid">
      <div>
        <span class="mono">{$translate('api.current')}</span>
        <strong>{versions.current ?? '—'}</strong>
      </div>
      <div>
        <span class="mono">{$translate('api.supported')}</span>
        <strong>{versions.supported?.length ?? 0}</strong>
      </div>
      <div>
        <span class="mono">{$translate('api.deprecated')}</span>
        <strong>{versions.deprecated?.length ?? 0}</strong>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>{$translate('empty.api')}</p>
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

  .card-block.wide {
    grid-column: 1 / -1;
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

  .support-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .support-grid > div {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .support-grid span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .support-grid strong {
    display: block;
    font-size: 1.05rem;
  }

  .empty-state {
    min-height: 120px;
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 12px;
  }

  @media (max-width: 1100px) {
    .support-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
