<script lang="ts">
  import type { BackendHealth, BackendSla, ApiVersions } from '$lib/portal';

  export let health: BackendHealth | null = null;
  export let sla: BackendSla | null = null;
  export let versions: ApiVersions | null = null;
</script>

<section class="metric-grid">
  <article class="metric panel">
    <span class="mono">Uptime</span>
    <strong>{sla?.uptime_percent ? `${sla.uptime_percent.toFixed(2)}%` : 'n/a'}</strong>
    <p>{sla?.meets_sla ? 'Meeting SLA' : 'SLA pending'}</p>
  </article>

  <article class="metric panel">
    <span class="mono">Backend health</span>
    <strong>{health?.status ?? 'unknown'}</strong>
    <p>{health?.timestamp ?? 'Not refreshed yet'}</p>
  </article>

  <article class="metric panel">
    <span class="mono">Error rate</span>
    <strong>{sla?.error_rate_percent ? `${sla.error_rate_percent.toFixed(2)}%` : 'n/a'}</strong>
    <p>30-day average</p>
  </article>

  <article class="metric panel">
    <span class="mono">API version</span>
    <strong>{versions?.current ?? 'n/a'}</strong>
    <p>{versions?.supported?.length ?? 0} supported</p>
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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
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
