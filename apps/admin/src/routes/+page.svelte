<script lang="ts">
  import { onMount } from "svelte";
  import MetricsGrid from "$lib/MetricsGrid.svelte";
  import RuntimeState from "$lib/RuntimeState.svelte";
  import ApiSurfaceCard from "$lib/ApiSurfaceCard.svelte";
  import { translate } from "$lib/i18n";
  import {
    backendUrl,
    busy,
    health,
    sla,
    platformState,
    versions,
    lastSyncedAt,
    clearError,
    setError,
    setStatus,
  } from "$lib/portalStore";
  import {
    fetchBackendHealth,
    fetchBackendSla,
    fetchApiVersions,
    fetchPlatformState,
  } from "$lib/portal";

  async function refresh() {
    busy.set(true);
    clearError();
    try {
      const [h, s, v, p] = await Promise.all([
        fetchBackendHealth($backendUrl),
        fetchBackendSla($backendUrl),
        fetchApiVersions($backendUrl),
        fetchPlatformState($backendUrl),
      ]);
      health.set(h);
      sla.set(s);
      versions.set(v);
      platformState.set(p);
      const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      lastSyncedAt.set(t);
      setStatus(`${$translate("status.refreshed")} ${t}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : $translate("error.refresh"));
    } finally {
      busy.set(false);
    }
  }

  onMount(refresh);
</script>

<div class="page-header">
  <p class="eyebrow mono">{$translate("overview.eyebrow")}</p>
  <h1>{$translate("overview.title")}</h1>
  <p>{$translate("overview.desc")}</p>
</div>

<div class="toolbar">
  <button class="btn btn-primary" on:click={refresh} disabled={$busy}>
    {$translate("button.refresh")}
  </button>
</div>

<MetricsGrid health={$health} sla={$sla} versions={$versions} />

<div class="grid-2">
  <RuntimeState
    health={$health}
    sla={$sla}
    platformState={$platformState}
    lastSyncedAt={$lastSyncedAt}
  />
  <ApiSurfaceCard versions={$versions} />
</div>

<style>
  .toolbar {
    margin-bottom: 16px;
  }
</style>
