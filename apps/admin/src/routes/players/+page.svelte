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
    banPlayer,
    fetchAuditRecords,
    fetchPlayers,
    kickPlayer,
    unbanPlayer,
    type AuditRecord,
    type PlayerAccount,
  } from "$lib/portal";

  let players: PlayerAccount[] = [];
  let audits: AuditRecord[] = [];
  let cursor = "";

  async function load() {
    busy.set(true);
    clearError();
    try {
      const [playerResult, auditResult] = await Promise.all([
        fetchPlayers($backendUrl, 50),
        fetchAuditRecords($backendUrl, 25),
      ]);
      players = playerResult.players;
      cursor = playerResult.cursor ?? "";
      audits = auditResult.records;
      setStatus($translate("players.loaded"));
    } catch (e) {
      setError(e instanceof Error ? e.message : $translate("players.loadError"));
    } finally {
      busy.set(false);
    }
  }

  async function onBan(playerId: string) {
    const reason = prompt($translate("players.banPrompt")) ?? "";
    if (!reason.trim()) return;

    busy.set(true);
    clearError();
    try {
      await banPlayer($backendUrl, playerId, reason.trim());
      await load();
      setStatus($translate("players.banned"));
    } catch (e) {
      setError(e instanceof Error ? e.message : $translate("players.actionError"));
    } finally {
      busy.set(false);
    }
  }

  async function onKick(playerId: string) {
    busy.set(true);
    clearError();
    try {
      await kickPlayer($backendUrl, playerId);
      await load();
      setStatus($translate("players.kicked"));
    } catch (e) {
      setError(e instanceof Error ? e.message : $translate("players.actionError"));
    } finally {
      busy.set(false);
    }
  }

  async function onUnban(playerId: string) {
    busy.set(true);
    clearError();
    try {
      await unbanPlayer($backendUrl, playerId);
      await load();
      setStatus($translate("players.unbanned"));
    } catch (e) {
      setError(e instanceof Error ? e.message : $translate("players.actionError"));
    } finally {
      busy.set(false);
    }
  }

  onMount(load);
</script>

<div class="page-header">
  <p class="eyebrow mono">{$translate("players.eyebrow")}</p>
  <h1>{$translate("players.title")}</h1>
  <p>{$translate("players.desc")}</p>
</div>

<section class="panel block">
  <h2>{$translate("players.listTitle")}</h2>
  {#if players.length === 0}
    <div class="empty">{$translate("players.empty")}</div>
  {:else}
    <table>
      <thead>
        <tr>
          <th>{$translate("players.colName")}</th>
          <th>{$translate("players.colCreated")}</th>
          <th>{$translate("players.colSeen")}</th>
          <th>{$translate("players.colStatus")}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each players as player}
          <tr>
            <td>
              <strong>{player.playerName}</strong>
              <div class="mono subtle">{player.playerId}</div>
            </td>
            <td>{new Date(player.createdAt).toLocaleString()}</td>
            <td>{new Date(player.lastSeen).toLocaleString()}</td>
            <td>
              <span class:ban={player.banned} class="badge">{player.banned ? $translate("players.banned") : $translate("players.active")}</span>
            </td>
            <td class="actions">
              <button class="btn" type="button" on:click={() => onKick(player.playerId)} disabled={$busy}>
                {$translate("players.kick")}
              </button>
              <button class="btn" type="button" on:click={() => onBan(player.playerId)} disabled={$busy}>
                {$translate("players.ban")}
              </button>
              <button class="btn" type="button" on:click={() => onUnban(player.playerId)} disabled={$busy}>
                {$translate("players.unban")}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if cursor}
      <p class="hint mono">{$translate("players.cursorHint")}: {cursor}</p>
    {/if}
  {/if}
</section>

<section class="panel block">
  <h2>{$translate("players.auditTitle")}</h2>
  {#if audits.length === 0}
    <div class="empty">{$translate("players.auditEmpty")}</div>
  {:else}
    <ul class="audit-list">
      {#each audits as audit}
        <li>
          <strong>{audit.action}</strong>
          <span class="mono subtle">{audit.targetPlayerId ?? "-"}</span>
          <span>{audit.detail}</span>
          <span class="mono subtle">{new Date(audit.timestamp).toLocaleString()}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .block {
    padding: 20px;
    margin-bottom: 16px;
  }

  .block h2 {
    margin: 0 0 12px;
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
    display: inline-block;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-size: 0.78rem;
  }

  .ban {
    color: var(--accent-warm);
  }

  .subtle {
    color: var(--muted);
    font-size: 0.8rem;
    word-break: break-all;
  }

  .audit-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }

  .audit-list li {
    display: grid;
    gap: 4px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--bg-soft);
  }

  .hint {
    margin-top: 12px;
    color: var(--muted);
  }
</style>