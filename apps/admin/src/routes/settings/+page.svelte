<script lang="ts">
  import { onMount } from "svelte";
  import ToggleRow from "$lib/ToggleRow.svelte";
  import GameTypesPanel from "$lib/GameTypesPanel.svelte";
  import { translate } from "$lib/i18n";
  import {
    FEATURE_META,
    fetchPlatformState,
    patchPlatformFeatures,
    saveBackendUrl,
    saveSiteName,
    saveAdminToken,
    readAdminToken,
    DEFAULT_BACKEND_URL,
    type PlatformFeatures,
  } from "$lib/portal";
  import {
    backendUrl,
    siteName,
    busy,
    platformState,
    clearError,
    setError,
    setStatus,
  } from "$lib/portalStore";

  const featureKeys = Object.keys(FEATURE_META) as (keyof PlatformFeatures)[];

  let backendEdit = "";
  let siteEdit = "";
  let tokenEdit = "";

  $: backendEdit = $backendUrl;
  $: siteEdit = $siteName;
  $: tokenEdit = readAdminToken();

  async function loadPlatform() {
    busy.set(true);
    clearError();
    try {
      platformState.set(await fetchPlatformState($backendUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load platform");
    } finally {
      busy.set(false);
    }
  }

  async function toggleFeature(key: keyof PlatformFeatures, enabled: boolean) {
    busy.set(true);
    clearError();
    try {
      platformState.set(
        await patchPlatformFeatures($backendUrl, { [key]: enabled }),
      );
      setStatus($translate("features.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      await loadPlatform();
    } finally {
      busy.set(false);
    }
  }

  function saveBackend() {
    backendUrl.set(saveBackendUrl(backendEdit));
    setStatus($translate("settings.backendSaved"));
  }

  function saveSite() {
    siteName.set(saveSiteName(siteEdit));
    setStatus($translate("settings.siteSaved"));
  }

  function saveToken() {
    saveAdminToken(tokenEdit);
    setStatus($translate("settings.tokenSaved"));
  }

  onMount(loadPlatform);
</script>

<div class="page-header">
  <p class="eyebrow mono">{$translate("settings.eyebrow")}</p>
  <h1>{$translate("settings.title")}</h1>
  <p>{$translate("settings.desc")}</p>
</div>

<section class="panel block">
  <h2>{$translate("settings.connection")}</h2>
  <div class="stack">
    <div class="field">
      <label for="backend">{$translate("topbar.backend")}</label>
      <input id="backend" bind:value={backendEdit} spellcheck="false" />
      <button class="btn btn-primary" type="button" on:click={saveBackend}>
        {$translate("button.save")}
      </button>
    </div>
    <div class="field">
      <label for="site">{$translate("topbar.site")}</label>
      <input id="site" bind:value={siteEdit} />
      <button class="btn btn-primary" type="button" on:click={saveSite}>
        {$translate("button.save")}
      </button>
    </div>
    <div class="field">
      <label for="token">{$translate("settings.adminToken")}</label>
      <input id="token" type="password" bind:value={tokenEdit} autocomplete="off" />
      <p class="hint">{$translate("settings.tokenHint")}</p>
      <button class="btn btn-primary" type="button" on:click={saveToken}>
        {$translate("settings.saveToken")}
      </button>
    </div>
    <p class="hint mono">{$translate("settings.defaultBackend")}: {DEFAULT_BACKEND_URL}</p>
  </div>
</section>

<section class="panel block">
  <h2>{$translate("features.title")}</h2>
  <p class="hint">{$translate("settings.featuresHint")}</p>
  {#if $platformState}
    <div class="stack">
      {#each featureKeys as key}
        <ToggleRow
          label={$translate(FEATURE_META[key].labelKey)}
          description={$translate(FEATURE_META[key].descKey)}
          checked={$platformState.features[key]}
          disabled={$busy}
          on:change={(e) => toggleFeature(key, e.detail)}
        />
      {/each}
    </div>
  {:else}
    <div class="empty">{$translate("features.loading")}</div>
  {/if}
</section>

<GameTypesPanel />

<style>
  .block {
    padding: 20px;
    margin-bottom: 16px;
  }

  .block h2 {
    margin: 0 0 8px;
    font-size: 1.05rem;
  }

  .hint {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.45;
  }
</style>
