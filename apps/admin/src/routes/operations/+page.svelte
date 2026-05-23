<script lang="ts">
  import { onMount } from "svelte";
  import { translate } from "$lib/i18n";
  import {
    backendUrl,
    busy,
    clearError,
    setError,
    setStatus,
  } from "$lib/portalStore";
  import {
    deleteHotfix,
    downloadHotfix,
    fetchPlatformState,
    listHotfixes,
    promoteHotfix,
    rollbackHotfix,
    readAdminToken,
    uploadHotfix,
    type GameUpdateAsset,
  } from "$lib/portal";

  let fileInput: HTMLInputElement;
  let versionInput = "";
  let minVersionInput = "";
  let latestVersion = "";
  let hotfixes: GameUpdateAsset[] = [];

  async function load() {
    busy.set(true);
    clearError();
    try {
      const [hotfixList, platform] = await Promise.all([
        listHotfixes($backendUrl),
        fetchPlatformState($backendUrl).catch(() => null),
      ]);
      hotfixes = hotfixList.versions;
      latestVersion = hotfixList.latest ?? "";
      if (platform && !platform.features.gameUpdates) {
        setStatus($translate("hotfix.disabled"));
      }
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
      await uploadHotfix($backendUrl, file, versionInput.trim() || undefined, minVersionInput.trim() || undefined);
      await load();
      fileInput.value = "";
      versionInput = "";
      minVersionInput = "";
      setStatus($translate("hotfix.uploaded"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      busy.set(false);
    }
  }

  async function onDelete(version: string) {
    if (!confirm($translate("hotfix.confirmDelete"))) return;
    busy.set(true);
    clearError();
    try {
      await deleteHotfix($backendUrl, version);
      await load();
      setStatus($translate("hotfix.deleted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      busy.set(false);
    }
  }

  async function onDownload(version: string) {
    busy.set(true);
    clearError();
    try {
      await downloadHotfix($backendUrl, version);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      busy.set(false);
    }
  }

  async function onPromote(version: string) {
    busy.set(true);
    clearError();
    try {
      await promoteHotfix($backendUrl, version);
      await load();
      setStatus($translate("hotfix.promoted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed");
    } finally {
      busy.set(false);
    }
  }

  async function onRollback(version: string) {
    busy.set(true);
    clearError();
    try {
      await rollbackHotfix($backendUrl, version);
      await load();
      setStatus($translate("hotfix.rolledBack"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      busy.set(false);
    }
  }

  onMount(load);
</script>

<div class="page-header">
  <p class="eyebrow mono">{$translate("operations.eyebrow")}</p>
  <h1>{$translate("operations.title")}</h1>
  <p>{$translate("operations.desc")}</p>
</div>

<section class="panel block">
  <h2>{$translate("hotfix.uploadTitle")}</h2>
  <p class="hint">{$translate("operations.hotfixHint")}</p>
  <div class="grid">
    <input bind:this={fileInput} type="file" />
    <input bind:value={versionInput} placeholder={$translate("hotfix.versionPlaceholder")} spellcheck="false" />
    <input bind:value={minVersionInput} placeholder={$translate("hotfix.minVersionPlaceholder")} spellcheck="false" />
  </div>
  <button class="btn btn-primary" type="button" on:click={onUpload} disabled={$busy}>
    {$translate("hotfix.upload")}
  </button>
</section>

<section class="panel block">
  <div class="head-row">
    <h2>{$translate("hotfix.listTitle")}</h2>
    {#if latestVersion}
      <span class="mono latest">{$translate("hotfix.latest")}: {latestVersion}</span>
    {/if}
  </div>
  {#if hotfixes.length === 0}
    <div class="empty">{$translate("hotfix.empty")}</div>
  {:else}
    <table>
      <thead>
        <tr>
          <th>{$translate("hotfix.colVersion")}</th>
          <th>{$translate("hotfix.colMinVersion")}</th>
          <th>{$translate("hotfix.colChecksum")}</th>
          <th>{$translate("hotfix.colDate")}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each hotfixes as asset}
          <tr>
            <td class="mono">
              {asset.version}
              {#if asset.version === latestVersion}
                <span class="badge">{$translate("hotfix.latest")}</span>
              {/if}
            </td>
            <td>{asset.gameVersionMin}</td>
            <td class="mono checksum">{asset.checksum}</td>
            <td>{new Date(asset.uploadedAt).toLocaleString()}</td>
            <td class="actions">
              <button class="btn" type="button" on:click={() => onDownload(asset.version)} disabled={$busy}>
                {$translate("hotfix.download")}
              </button>
              <button class="btn" type="button" on:click={() => onPromote(asset.version)} disabled={$busy}>
                {$translate("hotfix.promote")}
              </button>
              <button class="btn" type="button" on:click={() => onRollback(asset.version)} disabled={$busy}>
                {$translate("hotfix.rollback")}
              </button>
              <button class="btn btn-danger" type="button" on:click={() => onDelete(asset.version)} disabled={$busy}>
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

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }

  .grid input {
    width: 100%;
  }

  .head-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .latest {
    color: var(--accent);
    font-size: 0.8rem;
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
    vertical-align: top;
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

  .badge {
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.72rem;
    color: var(--accent);
    border: 1px solid var(--border);
  }

  .checksum {
    word-break: break-all;
  }

  @media (max-width: 960px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
