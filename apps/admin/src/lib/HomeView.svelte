<script lang="ts">
  import { 
    backendUrl, 
    busy, 
    roomId, 
    health, 
    sla, 
    versions, 
    lastSyncedAt, 
    statusMessage,
    errorMessage,
    voiceBootstrap,
    clearError,
    setError
  } from './portalStore';
  import { 
    fetchBackendHealth, 
    fetchBackendSla, 
    fetchApiVersions, 
    fetchVoiceBootstrap
  } from './portal';
  onMount(() => {
    refreshDashboard();
  });

  import { onMount } from 'svelte';
  import MetricsGrid from './MetricsGrid.svelte';
  import RuntimeState from './RuntimeState.svelte';
  import VoiceBootstrapCard from './VoiceBootstrapCard.svelte';
  import ApiSurfaceCard from './ApiSurfaceCard.svelte';
  import OperationsCard from './OperationsCard.svelte';

  async function refreshDashboard() {
    busy.set(true);
    clearError();

    try {
      const [nextHealth, nextSla, nextVersions] = await Promise.all([
        fetchBackendHealth($backendUrl),
        fetchBackendSla($backendUrl),
        fetchApiVersions($backendUrl),
      ]);

      health.set(nextHealth);
      sla.set(nextSla);
      versions.set(nextVersions);

      const syncTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      lastSyncedAt.set(syncTime);

      if ($voiceBootstrap) {
        voiceBootstrap.set(await fetchVoiceBootstrap($backendUrl, $roomId));
      }

      statusMessage.set(`Dashboard refreshed at ${syncTime}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to refresh dashboard.');
    } finally {
      busy.set(false);
    }
  }

  async function buildVoiceBootstrap() {
    busy.set(true);
    clearError();

    try {
      const bootstrap = await fetchVoiceBootstrap($backendUrl, $roomId);
      voiceBootstrap.set(bootstrap);
      statusMessage.set(`Voice bootstrap prepared for ${$roomId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to prepare voice bootstrap.');
    } finally {
      busy.set(false);
    }
  }

  function openBackendHealth() {
    window.open(`${$backendUrl}health`, '_blank', 'noopener,noreferrer');
  }

  function openApiVersions() {
    window.open(`${$backendUrl}api-versions`, '_blank', 'noopener,noreferrer');
  }

</script>

<main class="home-layout">
  <section class="workspace">
    <div class="action-bar panel">
      <div class="room-selector">
        <label for="room-id" class="mono">ROOM</label>
        <input id="room-id" bind:value={$roomId} type="text" placeholder="control-room" />
      </div>
      
      <div class="actions">
        <button class="primary" on:click={buildVoiceBootstrap} disabled={$busy}>
          {$busy ? '...' : 'Build Voice Manifest'}
        </button>
        <button class="ghost" on:click={refreshDashboard} disabled={$busy}>
          Refresh
        </button>
      </div>
    </div>

    <MetricsGrid health={$health} sla={$sla} versions={$versions} />

    <div class="content-grid">
      <div class="main-content">
        <VoiceBootstrapCard voiceBootstrap={$voiceBootstrap} />
        <RuntimeState health={$health} sla={$sla} lastSyncedAt={$lastSyncedAt} />
      </div>

      <div class="side-content">
        <ApiSurfaceCard versions={$versions} />
        <OperationsCard on:refresh={refreshDashboard} on:open-health={openBackendHealth} on:open-api-versions={openApiVersions} />
      </div>
    </div>

    <footer class="status-bar">
      <span class="mono">{$statusMessage}</span>
      {#if $errorMessage}
        <span class="error-text">{$errorMessage}</span>
      {/if}
    </footer>
  </section>
</main>

<style>
  .home-layout {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 24px;
  }

  .sidebar {
    position: sticky;
    top: 24px;
    padding: 24px;
    border-radius: 28px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sidebar-stack {
    display: grid;
    gap: 14px;
  }

  .sidebar-card {
    padding: 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sidebar-card span,
  .sidebar-card p {
    display: block;
  }

  .sidebar-card span {
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .sidebar-card p {
    color: var(--muted);
    line-height: 1.6;
  }

  .sidebar-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .workspace {
    display: grid;
    gap: 20px;
  }

  .workspace-header {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: end;
    padding: 22px 24px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .workspace-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: end;
  }

  .workspace-actions label {
    min-width: 240px;
  }

  .workspace-actions label span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  input {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 14px 16px;
    color: var(--text);
    background: rgba(6, 12, 24, 0.8);
    outline: none;
  }

  input:focus {
    border-color: rgba(124, 240, 255, 0.7);
    box-shadow: 0 0 0 4px rgba(124, 240, 255, 0.12);
  }

  button {
    border: 0;
    border-radius: 16px;
    padding: 13px 16px;
    color: var(--text);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    font: inherit;
    transition: transform 0.18s ease, opacity 0.18s ease;
  }

  button:hover {
    transform: translateY(-1px);
  }

  button:disabled {
    opacity: 0.65;
    cursor: progress;
  }

  .primary {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #05131d;
    font-weight: 700;
    box-shadow: 0 18px 34px rgba(124, 240, 255, 0.12);
  }

  .ghost {
    background: rgba(255, 255, 255, 0.05);
  }

  .full {
    width: 100%;
    justify-content: center;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .status-strip {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    padding: 18px 22px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .status-strip span,
  .status-strip strong {
    display: block;
  }

  .status-strip span {
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .error-badge {
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255, 107, 122, 0.08);
    border: 1px solid rgba(255, 107, 122, 0.18);
    color: #ffdbe0;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent);
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  h2 {
    margin: 0;
  }

  h2 {
    font-size: clamp(1.6rem, 3vw, 2.6rem);
    line-height: 1;
  }

  .lede {
    color: var(--muted);
    line-height: 1.6;
  }

  @media (max-width: 1100px) {
    .home-layout,
    .metric-grid,
    .content-grid {
      grid-template-columns: 1fr;
    }

    .workspace-header,
    .status-strip {
      flex-direction: column;
      align-items: stretch;
    }

    .sidebar {
      position: static;
    }
  }
</style>
