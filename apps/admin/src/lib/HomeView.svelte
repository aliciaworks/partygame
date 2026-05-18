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
  <aside class="sidebar panel">
    <div>
      <p class="eyebrow mono">BACKEND</p>
      <h2>Control Center</h2>
      <p class="lede">
        {$backendUrl}
      </p>
    </div>

    <div class="sidebar-stack">
      <div class="sidebar-card">
        <span class="mono">Backend state</span>
        <strong>{$health?.status ?? 'unknown'}</strong>
        <p>Health and SLA are pulled from the backend at runtime.</p>
      </div>

      <div class="sidebar-actions">
        <button class="ghost full" on:click={openBackendHealth}>Open health</button>
        <button class="ghost full" on:click={openApiVersions}>Open API versions</button>
      </div>
    </div>
  </aside>

  <section class="workspace">
    <header class="panel workspace-header">
      <div>
        <p class="eyebrow mono">CONTROL CENTER</p>
        <h2>Operational dashboard for the selected backend.</h2>
      </div>

      <div class="workspace-actions">
        <label>
          <span class="mono">Room ID</span>
          <input bind:value={$roomId} type="text" placeholder="control-room" />
        </label>
        <button class="primary" on:click={buildVoiceBootstrap} disabled={$busy}>
          Build voice bootstrap
        </button>
        <button class="ghost" on:click={refreshDashboard} disabled={$busy}>
          Refresh data
        </button>
      </div>
    </header>

    <section class="metric-grid">
      <MetricsGrid health={$health} sla={$sla} versions={$versions} />
    </section>

    <section class="content-grid">
      <RuntimeState health={$health} sla={$sla} lastSyncedAt={$lastSyncedAt} />
      <VoiceBootstrapCard voiceBootstrap={$voiceBootstrap} />
      <ApiSurfaceCard versions={$versions} backendUrl={$backendUrl} />
      <OperationsCard on:refresh={refreshDashboard} />
    </section>

    <footer class="status-strip panel">
      <div>
        <span class="mono">Portal status</span>
        <strong>{$statusMessage}</strong>
      </div>
      {#if $errorMessage}
        <div class="error-badge">{$errorMessage}</div>
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
