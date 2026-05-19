<script lang="ts">
  import { onMount } from 'svelte';
  import MetricsGrid from './MetricsGrid.svelte';
  import RuntimeState from './RuntimeState.svelte';
  import VoiceBootstrapCard from './VoiceBootstrapCard.svelte';
  import ApiSurfaceCard from './ApiSurfaceCard.svelte';
  import OperationsCard from './OperationsCard.svelte';
  import { locale, translate, availableLocales } from './i18n';
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
    setError,
  } from './portalStore';
  import {
    fetchBackendHealth,
    fetchBackendSla,
    fetchApiVersions,
    fetchVoiceBootstrap,
  } from './portal';

  function setLocale(e: Event) {
    const value = (e.target as HTMLSelectElement)?.value;
    if (value) locale.set(value);
  }

  // client-only UI state for the sidebar
  let sidebarOpen = true;
  let activeCategory: string = 'dashboard';

  onMount(() => {
    try {
      const v = window.localStorage.getItem('partygame.sidebarOpen');
      sidebarOpen = v === null ? true : v === '1';
    } catch (e) {
      sidebarOpen = true;
    }
  });

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    try {
      window.localStorage.setItem('partygame.sidebarOpen', sidebarOpen ? '1' : '0');
    } catch (e) {}
  }

  function selectCategory(name: string) {
    activeCategory = name;
  }

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

      statusMessage.set(`${$translate('status.dashboard_refreshed')} ${syncTime}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : $translate('error.refresh_dashboard'));
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
      statusMessage.set(`${$translate('status.voice_bootstrap_prepared')} ${$roomId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : $translate('error.voice_bootstrap'));
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

  onMount(() => {
    refreshDashboard();
  });
</script>

<main class="home-layout">
  <aside class="sidebar panel" class:collapsed={!sidebarOpen} aria-hidden={!sidebarOpen}>
    <div class="sidebar-top">
      <button class="collapse-btn" on:click={toggleSidebar} aria-label="Toggle sidebar">{sidebarOpen ? '‹' : '›'}</button>
    </div>

    <nav class="sidebar-stack">
      <ul class="category-list">
        <li><button class:active={activeCategory === 'dashboard'} class="category-item" on:click={() => selectCategory('dashboard')}>{$translate('sidebar.dashboard')}</button></li>
        <li><button class:active={activeCategory === 'operations'} class="category-item" on:click={() => selectCategory('operations')}>{$translate('sidebar.operations')}</button></li>
        <li><button class:active={activeCategory === 'settings'} class="category-item" on:click={() => selectCategory('settings')}>{$translate('sidebar.settings')}</button></li>
        <li><button class:active={activeCategory === 'users'} class="category-item" on:click={() => selectCategory('users')}>{$translate('sidebar.users')}</button></li>
        <li><button class:active={activeCategory === 'logs'} class="category-item" on:click={() => selectCategory('logs')}>{$translate('sidebar.logs')}</button></li>
      </ul>
    </nav>

    <div class="sidebar-actions">
      <label for="lang-select" class="mono">{$translate('language.label')}</label>
      <select id="lang-select" value={$locale} on:change={setLocale}>
        {#each availableLocales as opt}
          <option value={opt.value} selected={opt.value === $locale}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </aside>

  <section class="workspace">
    <div class="action-bar panel">
      <div class="room-selector">
        <label for="room-id" class="mono">{$translate('label.room')}</label>
        <input id="room-id" bind:value={$roomId} type="text" placeholder={$translate('placeholder.room')} />
      </div>

      <div class="actions">
        <button class="primary" on:click={buildVoiceBootstrap} disabled={$busy}>
          {$busy ? '...' : $translate('button.build')}
        </button>
        <button class="ghost" on:click={refreshDashboard} disabled={$busy}>
          {$translate('button.refresh')}
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
      <span class="mono">{$translate('topbar.backend')} {$backendUrl}</span>
      <span class:status-muted={!$statusMessage || $statusMessage === 'Loading portal...'}>{$statusMessage}</span>
      {#if $errorMessage}
        <span class="error-text">{$errorMessage}</span>
      {/if}
    </footer>
  </section>
</main>

<style>
  .home-layout {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border-radius: 24px;
    position: sticky;
    top: 24px;
    align-self: start;
    min-height: calc(100vh - 48px);
  }

  .sidebar.collapsed {
    width: 72px;
    padding-inline: 10px;
  }

  .sidebar-top {
    display: flex;
    justify-content: flex-end;
  }

  .collapse-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--muted);
    border-radius: 10px;
    width: 32px;
    height: 32px;
    cursor: pointer;
  }

  .sidebar-stack {
    display: block;
  }

  .category-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .category-item {
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text);
    text-align: left;
    cursor: pointer;
    font: inherit;
  }

  .category-item.active,
  .category-item:hover,
  .category-item:focus-visible {
    background: rgba(124, 240, 255, 0.12);
    border-color: rgba(124, 240, 255, 0.3);
  }

  .sidebar-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
  }

  .sidebar-actions select,
  .room-selector input {
    width: 100%;
  }

  .workspace {
    display: grid;
    gap: 20px;
    min-width: 0;
  }

  input {
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

  .content-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .status-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    justify-content: space-between;
  }

  .status-muted {
    color: var(--muted);
  }

  .error-text {
    color: var(--danger, #ff9d7a);
  }

  @media (max-width: 1100px) {
    .home-layout,
    .content-grid {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
      min-height: auto;
    }

    .content-grid {
      grid-auto-flow: row;
    }
  }

  @media (max-width: 720px) {
    .home-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
