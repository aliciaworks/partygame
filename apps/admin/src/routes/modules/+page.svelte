<script lang="ts">
  import { onMount } from "svelte";
  import { translate } from "$lib/i18n";
  import { backendUrl, busy, clearError, setError, setStatus } from "$lib/portalStore";
  import { fetchModules, type ModuleSummary } from "$lib/portal";

  let modules: ModuleSummary[] = [];

  async function load() {
    busy.set(true);
    clearError();
    try {
      const result = await fetchModules($backendUrl);
      modules = result.modules;
      setStatus($translate("modules.loaded"));
    } catch (e) {
      setError(e instanceof Error ? e.message : $translate("modules.loadError"));
    } finally {
      busy.set(false);
    }
  }

  onMount(load);
</script>

<div class="page-header">
  <p class="eyebrow mono">{$translate("modules.eyebrow")}</p>
  <h1>{$translate("modules.title")}</h1>
  <p>{$translate("modules.desc")}</p>
</div>

<section class="grid">
  {#each modules as module}
    <a class="panel card" href={`/modules/${module.id}`}>
      <div class="card-head">
        <div>
          <p class="mono id">{module.id}</p>
          <h2>{module.name}</h2>
        </div>
        <span class="status">{$translate(module.enabled ? "modules.enabled" : "modules.disabled")}</span>
      </div>
      <p class="desc">{module.description ?? $translate("modules.noDescription")}</p>
      <div class="meta">
        <span>{$translate("modules.flags")}: {module.flags?.length ?? 0}</span>
        <span>{$translate("modules.pages")}: {module.nav?.length ?? 0}</span>
      </div>
    </a>
  {/each}
</section>

{#if modules.length === 0}
  <div class="panel empty">{$translate("modules.empty")}</div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .card {
    display: block;
    padding: 18px;
    color: inherit;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: start;
  }

  .id {
    margin: 0 0 6px;
    color: var(--accent);
    font-size: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .status {
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--bg-soft);
    border: 1px solid var(--border);
  }

  .desc {
    color: var(--muted);
    line-height: 1.6;
    margin: 14px 0 12px;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .empty {
    padding: 20px;
  }

  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>