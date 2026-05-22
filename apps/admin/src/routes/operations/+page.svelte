<script lang="ts">
  import { onMount } from "svelte";
  import { translate } from "$lib/i18n";
  import {
    backendUrl,
    busy,
    gameUpdates,
    platformState,
    clearError,
    setError,
    setStatus,
  } from "$lib/portalStore";
  import {
    deleteGameUpdate,
    downloadGameUpdate,
    fetchPlatformState,
    listGameUpdates,
    readAdminToken,
    uploadGameUpdate,
  } from "$lib/portal";

  let fileInput: HTMLInputElement;

  async function load() {
    busy.set(true);
    clearError();
    try {
      const [updates, state] = await Promise.all([
        listGameUpdates($backendUrl),
        fetchPlatformState($backendUrl).catch(() => null),
      ]);
      gameUpdates.set(updates.assets);
      if (state) platformState.set(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      busy.set(false);
    }
  }

  async function onUpload() {
    const file = fileInput?.files?.[0];
    if (!file) {
      setError($translate("hotfix.pickFile"));
      return;
    }
    if (!readAdminToken()) {
      setError($translate("hotfix.needToken"));
      return;
    }

    busy.set(true);
    clearError();
    try {
      await uploadGameUpdate($backendUrl, file);
      await load();
      fileInput.value = "";
      setStatus($translate("hotfix.uploaded"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      busy.set(false);
    }
  }

  async function onDelete(key: string) {
    if (!confirm($translate("hotfix.confirmDelete"))) return;
    busy.set(true);
    clearError();
    try {
      const result = await deleteGameUpdate($backendUrl, key);
      gameUpdates.set(result.assets);
      setStatus($translate("hotfix.deleted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      busy.set(false);
    }
  }

  async function onDownload(key: string, name: string) {
    busy.set(true);
    clearError();
    try {
      await downloadGameUpdate($backendUrl, key, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      busy.set(false);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onMount(load);
</script>

<div class="page-header">
  <p class="eyebrow mono">{$translate("operations.eyebrow")}</p>
  <h1>{$translate("operations.title")}</h1>
  <p>{$translate("operations.desc")}</p>
</div>

{#if $platformState && !$platformState.features.gameUpdates}
  <div class="panel warn">{$translate("hotfix.disabled")}</div>
{/if}

<section class="panel block">
  <h2>{$translate("hotfix.uploadTitle")}</h2>
  <p class="hint">{$translate("operations.hotfixHint")}</p>
  <input bind:this={fileInput} type="file" />
  <button class="btn btn-primary" type="button" on:click={onUpload} disabled={$busy}>
    {$translate("hotfix.upload")}
  </button>
</section>

<section class="panel block">
  <h2>{$translate("hotfix.listTitle")}</h2>
  {#if $gameUpdates.length === 0}
    <div class="empty">{$translate("hotfix.empty")}</div>
  {:else}
    <table>
      <thead>
        <tr>
          <th>{$translate("hotfix.colName")}</th>
          <th>{$translate("hotfix.colSize")}</th>
          <th>{$translate("hotfix.colDate")}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each $gameUpdates as asset}
          <tr>
            <td class="mono">{asset.name}</td>
            <td>{formatSize(asset.size)}</td>
            <td>{new Date(asset.uploadedAt).toLocaleString()}</td>
            <td class="actions">
              <button
                class="btn"
                type="button"
                on:click={() => onDownload(asset.key, asset.name)}
                disabled={$busy}
              >
                {$translate("hotfix.download")}
              </button>
              <button
                class="btn btn-danger"
                type="button"
                on:click={() => onDelete(asset.key)}
                disabled={$busy}
              >
                {$translate("hotfix.delete")}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .warn {
    margin-bottom: 14px;
    padding: 14px 16px;
    color: var(--accent-warm);
  }

  .block {
    padding: 18px 20px;
    margin-bottom: 14px;
  }

  .block h2 {
    margin: 0 0 8px;
    font-size: 1rem;
  }

  .hint {
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .block input[type="file"] {
    display: block;
    margin-bottom: 12px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }

  th {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
