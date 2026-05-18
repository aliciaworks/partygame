<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BACKEND_STORAGE_KEY,
    DEFAULT_BACKEND_URL,
    EMAIL_STORAGE_KEY,
    clearPortalSession,
    fetchApiVersions,
    fetchBackendHealth,
    fetchBackendSla,
    fetchSessionProfile,
    fetchVoiceBootstrap,
    loginToBackend,
    normalizeBackendUrl,
    readBackendUrl,
    readPortalSession,
    saveBackendUrl,
    savePortalSession,
    type ApiVersions,
    type BackendHealth,
    type BackendSla,
    type PortalSession,
    type SessionProfile,
    type VoiceBootstrap,
  } from '$lib/portal';

  type ViewMode = 'boot' | 'login' | 'home';

  let view: ViewMode = 'boot';
  let busy = false;
  let statusMessage = 'Loading portal...';
  let errorMessage = '';

  let backendUrl = DEFAULT_BACKEND_URL;
  let email = '';
  let password = '';
  let roomId = 'control-room';

  let session: PortalSession | null = null;
  let profile: SessionProfile | null = null;
  let health: BackendHealth | null = null;
  let sla: BackendSla | null = null;
  let versions: ApiVersions | null = null;
  let voiceBootstrap: VoiceBootstrap | null = null;
  let lastSyncedAt = '';

  function setError(message: string) {
    errorMessage = message;
  }

  function clearError() {
    errorMessage = '';
  }

  function syncBackendUrl(value: string) {
    backendUrl = normalizeBackendUrl(value);
    saveBackendUrl(backendUrl);
  }

  function cacheSession(nextSession: PortalSession) {
    session = nextSession;
    savePortalSession(nextSession);
  }

  async function loadRuntimeState(activeSession: PortalSession) {
    const [nextHealth, nextSla, nextVersions] = await Promise.all([
      fetchBackendHealth(backendUrl),
      fetchBackendSla(backendUrl),
      fetchApiVersions(backendUrl),
    ]);

    health = nextHealth;
    sla = nextSla;
    versions = nextVersions;
    lastSyncedAt = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    profile = await fetchSessionProfile(backendUrl, activeSession.accessToken);
    statusMessage = `Signed in as ${profile.playerName}`;
    view = 'home';
  }

  async function restoreSession() {
    if (!session) {
      view = 'login';
      statusMessage = 'Sign in to continue.';
      return;
    }

    busy = true;
    clearError();

    try {
      await loadRuntimeState(session);
    } catch (error) {
      clearPortalSession();
      session = null;
      profile = null;
      view = 'login';
      statusMessage = 'Session expired. Please sign in again.';
      setError(error instanceof Error ? error.message : 'Unable to restore session.');
    } finally {
      busy = false;
    }
  }

  async function handleLogin() {
    busy = true;
    clearError();

    try {
      syncBackendUrl(backendUrl);
      const nextSession = await loginToBackend(backendUrl, email, password);
      cacheSession(nextSession);
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
      await loadRuntimeState(nextSession);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed.');
      statusMessage = 'Login failed.';
    } finally {
      busy = false;
    }
  }

  async function refreshDashboard() {
    if (!session) {
      return;
    }

    busy = true;
    clearError();

    try {
      await loadRuntimeState(session);
      if (voiceBootstrap) {
        voiceBootstrap = await fetchVoiceBootstrap(backendUrl, session.accessToken, roomId);
      }
      statusMessage = `Dashboard refreshed at ${lastSyncedAt}`;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to refresh dashboard.');
    } finally {
      busy = false;
    }
  }

  async function buildVoiceBootstrap() {
    if (!session) {
      return;
    }

    busy = true;
    clearError();

    try {
      voiceBootstrap = await fetchVoiceBootstrap(backendUrl, session.accessToken, roomId);
      statusMessage = `Voice bootstrap prepared for ${roomId}`;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to prepare voice bootstrap.');
    } finally {
      busy = false;
    }
  }

  function signOut() {
    clearPortalSession();
    session = null;
    profile = null;
    health = null;
    sla = null;
    versions = null;
    voiceBootstrap = null;
    password = '';
    statusMessage = 'Signed out.';
    clearError();
    view = 'login';
  }

  function switchBackend() {
    signOut();
  }

  function openBackendHealth() {
    window.open(`${backendUrl}health`, '_blank', 'noopener,noreferrer');
  }

  onMount(async () => {
    backendUrl = readBackendUrl();
    email = localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';

    const savedSession = readPortalSession();
    if (savedSession) {
      session = savedSession;
      await restoreSession();
      return;
    }

    view = 'login';
    statusMessage = `Backend selected: ${backendUrl}`;
  });
</script>

<svelte:head>
  <title>PartyGame Portal</title>
  <meta
    name="description"
    content="Login-gated PartyGame portal with configurable backend selection and live operations view."
  />
</svelte:head>

<div class="page-shell">
  <header class="topbar panel">
    <div class="brand">
      <span class="brand-mark"></span>
      <div>
        <p class="eyebrow mono">PARTYGAME / PORTAL</p>
        <h1>Control the backend from SvelteKit.</h1>
      </div>
    </div>

    <div class="status-pills">
      <span class="pill">Backend: {backendUrl}</span>
      <span class="pill">{session ? `Signed in as ${session.playerName}` : 'Not signed in'}</span>
    </div>
  </header>

  {#if view !== 'home'}
    <main class="auth-grid">
      <section class="hero panel">
        <p class="eyebrow mono">SECURE ENTRY</p>
        <h2>Login first, then the dashboard appears.</h2>
        <p>
          All frontend work lives here in SvelteKit. The worker stays backend-only,
          and the backend URL can be changed directly in this page.
        </p>

        <div class="hero-notes">
          <div>
            <span class="mono">Default backend</span>
            <strong>{DEFAULT_BACKEND_URL}</strong>
          </div>
          <div>
            <span class="mono">Stored locally</span>
            <strong>backend URL + session</strong>
          </div>
        </div>

        <div class="hero-banner">
          <strong>What this portal does</strong>
          <p>
            Login gates the homepage, syncs backend health, prepares voice bootstrap
            data, and keeps the selected backend editable without touching Wrangler.
          </p>
        </div>
      </section>

      <section class="login-card panel">
        <p class="eyebrow mono">SIGN IN</p>
        <h2>Enter your backend and authenticate.</h2>

        <form class="login-form" on:submit|preventDefault={handleLogin}>
          <label>
            <span>Backend URL</span>
            <input
              bind:value={backendUrl}
              type="url"
              placeholder="https://partygame-b5j.pages.dev/"
              on:blur={() => syncBackendUrl(backendUrl)}
            />
          </label>

          <label>
            <span>Email</span>
            <input bind:value={email} type="email" placeholder="pilot@partygame.dev" required />
          </label>

          <label>
            <span>Password</span>
            <input bind:value={password} type="password" placeholder="••••••••" required />
          </label>

          <div class="form-actions">
            <button class="primary" type="submit" disabled={busy}>
              {busy ? 'Working...' : 'Sign in'}
            </button>
            <button class="ghost" type="button" on:click={() => syncBackendUrl(DEFAULT_BACKEND_URL)}>
              Reset backend
            </button>
          </div>
        </form>

        <div class="status-box">
          <span class="mono">Status</span>
          <strong>{statusMessage}</strong>
          {#if errorMessage}
            <p class="error">{errorMessage}</p>
          {/if}
        </div>
      </section>
    </main>
  {:else}
    <main class="home-layout">
      <aside class="sidebar panel">
        <div>
          <p class="eyebrow mono">LIVE SESSION</p>
          <h2>{profile?.playerName}</h2>
          <p class="lede">
            {profile?.playerId}
            <br />
            {backendUrl}
          </p>
        </div>

        <div class="sidebar-stack">
          <div class="sidebar-card">
            <span class="mono">Voice chat</span>
            <strong>{session?.voiceEnabled ? 'Enabled' : 'Disabled'}</strong>
            <p>Voice bootstrap is generated against the selected backend.</p>
          </div>

          <div class="sidebar-card">
            <span class="mono">Backend state</span>
            <strong>{health?.status ?? 'unknown'}</strong>
            <p>Health and SLA are pulled from the backend at runtime.</p>
          </div>

          <div class="sidebar-actions">
            <button class="ghost full" type="button" on:click={switchBackend}>Switch backend</button>
            <button class="ghost full" type="button" on:click={openBackendHealth}>Open health</button>
            <button class="danger full" type="button" on:click={signOut}>Sign out</button>
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
              <input bind:value={roomId} type="text" placeholder="control-room" />
            </label>
            <button class="primary" type="button" on:click={buildVoiceBootstrap} disabled={busy}>
              Build voice bootstrap
            </button>
            <button class="ghost" type="button" on:click={refreshDashboard} disabled={busy}>
              Refresh data
            </button>
          </div>
        </header>

        <section class="metric-grid">
          <article class="metric panel">
            <span class="mono">Session</span>
            <strong>{profile?.playerName ?? 'Signed in'}</strong>
            <p>{profile?.playerId}</p>
          </article>

          <article class="metric panel">
            <span class="mono">Backend health</span>
            <strong>{health?.status ?? 'unknown'}</strong>
            <p>{health?.timestamp ?? 'Not refreshed yet'}</p>
          </article>

          <article class="metric panel">
            <span class="mono">SLA</span>
            <strong>{sla?.uptime_percent ? `${sla.uptime_percent.toFixed(2)}%` : 'n/a'}</strong>
            <p>{sla?.meets_sla ? 'Meeting target' : 'Target pending'}</p>
          </article>

          <article class="metric panel">
            <span class="mono">API version</span>
            <strong>{versions?.current ?? 'n/a'}</strong>
            <p>{versions?.supported?.join(', ') ?? 'No version data yet'}</p>
          </article>
        </section>

        <section class="content-grid">
          <article class="panel card-block">
            <div class="section-head">
              <div>
                <p class="eyebrow mono">RUNTIME STATE</p>
                <h3>Backend health and readiness</h3>
              </div>
              <span class="pill subtle">{lastSyncedAt ? `Updated ${lastSyncedAt}` : 'Idle'}</span>
            </div>

            <div class="info-list">
              <div>
                <span class="mono">Health</span>
                <strong>{health?.status ?? 'unknown'}</strong>
              </div>
              <div>
                <span class="mono">Uptime</span>
                <strong>{health?.uptime_ms ? `${Math.round(health.uptime_ms / 1000)}s` : 'n/a'}</strong>
              </div>
              <div>
                <span class="mono">SLA target</span>
                <strong>{sla?.sla_target_uptime ? `${sla.sla_target_uptime}%` : 'n/a'}</strong>
              </div>
              <div>
                <span class="mono">Last incident</span>
                <strong>{sla?.last_incident ?? 'none'}</strong>
              </div>
            </div>

            {#if health?.checks}
              <div class="chip-row">
                {#each Object.entries(health.checks) as [name, value]}
                  <span class:chip={true} class:good={value} class:bad={!value}>
                    {name}: {value ? 'ok' : 'down'}
                  </span>
                {/each}
              </div>
            {/if}
          </article>

          <article class="panel card-block">
            <div class="section-head">
              <div>
                <p class="eyebrow mono">VOICE</p>
                <h3>RealtimeKit bootstrap manifest</h3>
              </div>
              <span class="pill subtle">{session?.voiceEnabled ? 'Available' : 'Disabled'}</span>
            </div>

            {#if voiceBootstrap}
              <pre>{JSON.stringify(voiceBootstrap, null, 2)}</pre>
            {:else}
              <div class="empty-state">
                <strong>No bootstrap yet</strong>
                <p>Click the button above to build a voice room bootstrap for the selected room.</p>
              </div>
            {/if}
          </article>

          <article class="panel card-block wide">
            <div class="section-head">
              <div>
                <p class="eyebrow mono">API SURFACE</p>
                <h3>Version and support matrix</h3>
              </div>
            </div>

            <div class="support-grid">
              <div>
                <span class="mono">Current</span>
                <strong>{versions?.current ?? 'n/a'}</strong>
              </div>
              <div>
                <span class="mono">Supported</span>
                <strong>{versions?.supported?.length ?? 0}</strong>
              </div>
              <div>
                <span class="mono">Deprecated</span>
                <strong>{versions?.deprecated?.length ?? 0}</strong>
              </div>
              <div>
                <span class="mono">Backend URL</span>
                <strong>{backendUrl}</strong>
              </div>
            </div>
          </article>

          <article class="panel card-block">
            <div class="section-head">
              <div>
                <p class="eyebrow mono">OPERATIONS</p>
                <h3>Quick actions</h3>
              </div>
            </div>

            <div class="stack">
              <button class="ghost" type="button" on:click={refreshDashboard} disabled={busy}>Refresh backend data</button>
              <button class="ghost" type="button" on:click={openBackendHealth}>Open backend health</button>
              <button class="ghost" type="button" on:click={() => window.open(`${backendUrl}api-versions`, '_blank', 'noopener,noreferrer')}>Open API versions</button>
            </div>
          </article>
        </section>

        <footer class="status-strip panel">
          <div>
            <span class="mono">Portal status</span>
            <strong>{statusMessage}</strong>
          </div>
          {#if errorMessage}
            <div class="error-badge">{errorMessage}</div>
          {/if}
        </footer>
      </section>
    </main>
  {/if}
</div>

<style>
  .page-shell {
    position: relative;
    min-height: 100vh;
    padding: 24px;
  }

  .topbar,
  .panel {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
    padding: 22px 26px;
    border-radius: 28px;
    margin-bottom: 24px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 16px;
    background: linear-gradient(135deg, var(--accent), var(--accent-warm));
    box-shadow: 0 16px 34px rgba(124, 240, 255, 0.18);
  }

  h1,
  h2,
  h3,
  strong,
  p {
    margin: 0;
  }

  h1 {
    font-size: clamp(1.4rem, 3vw, 2rem);
    line-height: 1.02;
  }

  h2 {
    font-size: clamp(1.6rem, 3vw, 2.6rem);
    line-height: 1;
  }

  h3 {
    font-size: 1.1rem;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent);
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  .status-pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
  }

  .pill {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--muted);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pill.subtle {
    background: rgba(124, 240, 255, 0.08);
    color: var(--text);
  }

  .auth-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(360px, 520px);
    gap: 24px;
  }

  .hero,
  .login-card {
    padding: 28px;
    border-radius: 28px;
  }

  .hero {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 18px;
  }

  .hero > p,
  .lede,
  .status-box p,
  .sidebar-card p,
  .card-block p,
  .empty-state p {
    color: var(--muted);
    line-height: 1.6;
  }

  .hero-notes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .hero-notes > div,
  .hero-banner,
  .sidebar-card,
  .metric,
  .card-block,
  .status-strip,
  .login-card {
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hero-notes > div {
    padding: 16px;
  }

  .hero-notes span,
  .sidebar-card span,
  .metric span,
  .card-block span,
  .status-strip span,
  .status-box span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .hero-banner {
    padding: 18px;
  }

  .login-form {
    display: grid;
    gap: 14px;
    margin-top: 18px;
  }

  label {
    display: grid;
    gap: 8px;
  }

  label span {
    color: #dfe8ff;
    font-size: 0.9rem;
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

  .form-actions,
  .workspace-actions,
  .sidebar-actions,
  .stack {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .workspace-actions {
    justify-content: flex-end;
    align-items: end;
  }

  .workspace-actions label {
    min-width: 240px;
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
    transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
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

  .danger {
    background: rgba(255, 107, 122, 0.08);
    border-color: rgba(255, 107, 122, 0.24);
    color: #ffdce1;
  }

  .full {
    width: 100%;
    justify-content: center;
  }

  .status-box,
  .sidebar-card,
  .empty-state {
    padding: 16px;
    border-radius: 20px;
  }

  .status-box {
    margin-top: 20px;
  }

  .error {
    color: #ffb6bf;
    margin-top: 8px;
  }

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
  }

  .sidebar-stack {
    display: grid;
    gap: 14px;
  }

  .sidebar-card strong,
  .metric strong,
  .card-block strong,
  .status-strip strong {
    display: block;
    margin-bottom: 8px;
    font-size: 1.05rem;
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
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .metric {
    padding: 18px;
  }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .card-block {
    padding: 20px;
  }

  .card-block.wide {
    grid-column: 1 / -1;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
    margin-bottom: 16px;
  }

  .info-list,
  .support-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .info-list > div,
  .support-grid > div {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }

  .chip {
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid transparent;
  }

  .chip.good {
    background: rgba(125, 255, 181, 0.08);
    border-color: rgba(125, 255, 181, 0.18);
    color: #d7ffe9;
  }

  .chip.bad {
    background: rgba(255, 107, 122, 0.08);
    border-color: rgba(255, 107, 122, 0.18);
    color: #ffdbe0;
  }

  pre {
    margin: 0;
    padding: 18px;
    border-radius: 20px;
    background: rgba(2, 8, 18, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: auto;
    color: #bfe8ff;
    font-size: 0.84rem;
    line-height: 1.5;
  }

  .empty-state {
    min-height: 152px;
    display: grid;
    align-content: center;
    gap: 8px;
  }

  .status-strip {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    padding: 18px 22px;
    border-radius: 24px;
  }

  .error-badge {
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255, 107, 122, 0.08);
    border: 1px solid rgba(255, 107, 122, 0.18);
    color: #ffdbe0;
  }

  @media (max-width: 1100px) {
    .auth-grid,
    .home-layout,
    .metric-grid,
    .content-grid,
    .info-list,
    .support-grid {
      grid-template-columns: 1fr;
    }

    .workspace-header,
    .topbar,
    .status-strip {
      flex-direction: column;
      align-items: stretch;
    }

    .sidebar {
      position: static;
    }
  }

  @media (max-width: 720px) {
    .page-shell {
      padding: 14px;
    }

    .hero,
    .login-card,
    .sidebar,
    .workspace-header,
    .card-block,
    .metric,
    .status-strip,
    .topbar {
      border-radius: 22px;
      padding: 18px;
    }
  }
</style>