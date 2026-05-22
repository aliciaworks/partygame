<script lang="ts">
  import type { BackendHealth, BackendSla } from "$lib/portal";
  import { translate } from "./i18n";

  export let health: BackendHealth | null = null;
  export let sla: BackendSla | null = null;
  export let lastSyncedAt = "";
</script>

<article class="panel card-block">
  <div class="section-head">
    <div>
      <p class="eyebrow mono">{$translate("runtime.title")}</p>
      <h3>{$translate("runtime.title")}</h3>
    </div>
    <span class="pill subtle">
      {lastSyncedAt ? `${$translate("runtime.updated")} ${lastSyncedAt}` : $translate("runtime.idle")}
    </span>
  </div>

  {#if health || sla}
    <div class="info-list">
      <div>
        <span class="mono">{$translate("metrics.health")}</span>
        <strong>{health?.status ?? "—"}</strong>
      </div>
      <div>
        <span class="mono">{$translate("metrics.uptime")}</span>
        <strong>
          {typeof sla?.uptime_percent === "number"
            ? `${sla.uptime_percent.toFixed(2)}%`
            : "—"}
        </strong>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>{$translate("runtime.no_data")}</p>
    </div>
  {/if}
</article>

<style>
  .card-block {
    padding: 20px;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 1.1rem;
    margin: 0;
  }

  .pill {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--bg-soft);
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.85rem;
  }

  .info-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .info-list > div {
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--bg-soft);
    border: 1px solid var(--border);
  }

  .info-list span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .empty-state {
    color: var(--muted);
  }
</style>
