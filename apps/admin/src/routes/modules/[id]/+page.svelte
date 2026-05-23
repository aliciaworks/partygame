<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { translate } from "$lib/i18n";
  import { backendUrl, busy, clearError, setError, setStatus } from "$lib/portalStore";
  import { fetchModuleManifest, type ModuleManifest } from "$lib/portal";

  let manifest: ModuleManifest | null = null;
  let currentId = "";

  async function load(id: string) {
    if (!id || id === currentId) return;
    currentId = id;
    busy.set(true);
    clearError();
    try {
      manifest = await fetchModuleManifest($backendUrl, id);
      setStatus($translate("modules.detailLoaded"));
    } catch (e) {
      manifest = null;
      setError(e instanceof Error ? e.message : $translate("modules.loadError"));
    } finally {
      busy.set(false);
    }
  }

  $: load($page.params.id);
  onMount(() => load($page.params.id));
</script>

<div class="page-header">
  <p class="eyebrow mono">{$translate("modules.detailEyebrow")}</p>
  <h1>{manifest?.name ?? $page.params.id}</h1>
  <p>{manifest?.description ?? $translate("modules.noDescription")}</p>
</div>

{#if manifest}
  <section class="panel block">
    <h2>{$translate("modules.navTitle")}</h2>
    {#if manifest.nav?.length}
      <ul>
        {#each manifest.nav as item}
          <li><span class="mono">{item.page}</span> - {item.label}</li>
        {/each}
      </ul>
    {:else}
      <div class="empty">{$translate("modules.noNav")}</div>
    {/if}
  </section>

  <section class="panel block">
    <h2>{$translate("modules.flagsTitle")}</h2>
    {#if manifest.flags?.length}
      <div class="flags">
        {#each manifest.flags as flag}
          <article class="flag-card">
            <div class="flag-head">
              <strong>{flag.label}</strong>
              <span class="mono">{flag.type}</span>
            </div>
            <p>{flag.description ?? $translate("modules.noDescription")}</p>
            <div class="mono default">{$translate("modules.defaultValue")}: {JSON.stringify(flag.default)}</div>
          </article>
        {/each}
      </div>
    {:else}
      <div class="empty">{$translate("modules.noFlags")}</div>
    {/if}
  </section>
{:else}
  <div class="panel empty">{$translate("modules.loadError")}</div>
{/if}

<style>
  .block {
    padding: 20px;
    margin-bottom: 16px;
  }

  .block h2 {
    margin: 0 0 12px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }

  li {
    margin-bottom: 8px;
  }

  .flags {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .flag-card {
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--bg-soft);
  }

  .flag-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .flag-card p {
    color: var(--muted);
    margin: 0 0 8px;
    line-height: 1.5;
  }

  .default {
    color: var(--muted);
    font-size: 0.8rem;
    word-break: break-word;
  }

  @media (max-width: 960px) {
    .flags {
      grid-template-columns: 1fr;
    }
  }
</style>