<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";
  import AdminShell from "$lib/AdminShell.svelte";
  import { initTheme } from "$lib/theme";
  import { translate } from "$lib/i18n";
  import { backendUrl, siteName } from "$lib/portalStore";
  import {
    DEFAULT_BACKEND_URL,
    readBackendUrl,
    readSiteName,
    saveBackendUrl,
  } from "$lib/portal";

  let unlocked = false;
  let backendSelection = DEFAULT_BACKEND_URL;
  let teardownTheme: (() => void) | undefined;

  onMount(() => {
    teardownTheme = initTheme();
    const saved = readBackendUrl();
    backendUrl.set(saved);
    siteName.set(readSiteName());
    backendSelection = saved;
    if (localStorage.getItem("partygame.portal.backendUrl")) {
      unlocked = true;
    }

    try {
      const collapsed = localStorage.getItem("partygame.sidebarCollapsed") === "1";
      /* applied in AdminShell via initial state - optional */
    } catch {
      /* ignore */
    }

    return () => teardownTheme?.();
  });

  function enterPanel() {
    const normalized = saveBackendUrl(backendSelection);
    backendUrl.set(normalized);
    unlocked = true;
  }
</script>

<svelte:head>
  <title>{$translate("meta.title")}</title>
  <meta name="description" content={$translate("meta.description")} />
  <meta name="theme-color" content="#070b14" />
</svelte:head>

{#if !unlocked}
  <div class="gate-page">
    <section class="gate panel">
      <p class="eyebrow mono">{$translate("topbar.brand")}</p>
      <h1>{$translate("gate.title")}</h1>
      <p>{$translate("gate.desc")}</p>

      <div class="field">
        <label class="mono" for="backend-url">{$translate("topbar.backend")}</label>
        <input id="backend-url" bind:value={backendSelection} spellcheck="false" />
      </div>

      <div class="gate-actions">
        <button class="btn" type="button" on:click={() => (backendSelection = DEFAULT_BACKEND_URL)}>
          {$translate("gate.useDefault")}
        </button>
        <button class="btn btn-primary" type="button" on:click={enterPanel}>
          {$translate("gate.enter")}
        </button>
      </div>
      <p class="hint mono">{DEFAULT_BACKEND_URL}</p>
    </section>
  </div>
{:else}
  <div class="app-root">
    <AdminShell>
      <slot />
    </AdminShell>
  </div>
{/if}

<style>
  .app-root {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .gate-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .gate {
    width: min(520px, 100%);
    padding: 28px;
  }

  .gate h1 {
    margin: 0 0 10px;
    font-size: 1.8rem;
  }

  .gate > p {
    margin: 0 0 20px;
    color: var(--muted);
    line-height: 1.5;
  }

  .gate-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .hint {
    margin: 14px 0 0;
    color: var(--muted);
    font-size: 0.82rem;
    word-break: break-all;
  }

  @media (max-width: 720px) {
    .app-root {
      padding: 14px;
    }
  }
</style>
