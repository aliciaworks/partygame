<script lang="ts">
  import type { BackendHealth, BackendSla, ApiVersions } from '$lib/portal';
  import { translate } from './i18n';

  export let health: BackendHealth | null = null;
  export let sla: BackendSla | null = null;
  export let versions: ApiVersions | null = null;
</script>

<section class="metric-grid">
  <article class="metric panel">
    <span class="mono">{$translate('metrics.uptime')}</span>
    <strong>{typeof sla?.uptime_percent === 'number' ? `${sla.uptime_percent.toFixed(2)}%` : '—'}</strong>
    <p>{sla ? (sla.meets_sla ? $translate('metrics.uptime') : $translate('metrics.sla_risk')) : $translate('button.refresh')}</p>
  </article>

  <article class="metric panel">
    <span class="mono">{$translate('metrics.health')}</span>
    <strong>{health?.status ?? '—'}</strong>
    <p>{health?.timestamp ?? $translate('button.refresh')}</p>
  </article>

  <article class="metric panel">
    <span class="mono">{$translate('metrics.error_rate')}</span>
    <strong>{typeof sla?.error_rate_percent === 'number' ? `${sla.error_rate_percent.toFixed(2)}%` : '—'}</strong>
    <p>{$translate('metrics.thirty_day_average')}</p>
  </article>

  <article class="metric panel">
    <span class="mono">{$translate('metrics.api_version')}</span>
    <strong>{versions?.current ?? '—'}</strong>
    <p>{versions ? `${versions.supported?.length ?? 0} ${$translate('api.supported')}` : $translate('button.refresh')}</p>
  </article>

</section>

<style>
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .metric {
    padding: 18px;
    border-radius: 24px;
    background: var(--bg-soft);
    border: 1px solid var(--border);
  }

  .metric span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .metric strong {
    display: block;
    margin-bottom: 8px;
    font-size: 1.05rem;
  }

  .metric p {
    color: var(--muted);
    line-height: 1.6;
    margin: 0;
  }

  @media (max-width: 1100px) {
    .metric-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
