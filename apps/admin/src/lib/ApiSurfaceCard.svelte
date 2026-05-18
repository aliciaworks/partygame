<script lang="ts">
  import type { ApiVersions } from '$lib/portal';

  export let versions: ApiVersions | null = null;
  export let backendUrl = '';
</script>

<article class="panel card-block wide">
  <div class="section-head">
    <div>
      <p class="eyebrow mono">API SURFACE</p>
      <h3>Version and support matrix</h3>
    </div>
  </div>

  <div class="support-grid">
    <div>
      <span class="mono">Current</span>
      <strong>{versions?.current ?? 'n/a'}</strong>
    </div>
    <div>
      <span class="mono">Supported</span>
      <strong>{versions?.supported?.length ?? 0}</strong>
    </div>
    <div>
      <span class="mono">Deprecated</span>
      <strong>{versions?.deprecated?.length ?? 0}</strong>
    </div>
    <div>
      <span class="mono">Backend URL</span>
      <strong>{backendUrl}</strong>
    </div>
  </div>
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

  @media (max-width: 1100px) {
    .support-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
