<script lang="ts">
  import { 
    backendUrl, 
    busy, 
    email, 
    errorMessage, 
    password, 
    statusMessage, 
    clearError, 
    setError,
    view,
    session,
    profile,
    health,
    sla,
    versions,
    lastSyncedAt
  } from './portalStore';
  import { 
    DEFAULT_BACKEND_URL, 
    normalizeBackendUrl, 
    saveBackendUrl,
    loginToBackend,
    savePortalSession,
    fetchBackendHealth,
    fetchBackendSla,
    fetchApiVersions,
    fetchSessionProfile,
    EMAIL_STORAGE_KEY
  } from './portal';

  async function handleLogin() {
    busy.set(true);
    clearError();

    try {
      const normalized = normalizeBackendUrl($backendUrl);
      backendUrl.set(normalized);
      saveBackendUrl(normalized);

      const nextSession = await loginToBackend(normalized, $email, $password);
      session.set(nextSession);
      savePortalSession(nextSession);
      localStorage.setItem(EMAIL_STORAGE_KEY, $email);

      // Load runtime state
      const [nextHealth, nextSla, nextVersions] = await Promise.all([
        fetchBackendHealth(normalized),
        fetchBackendSla(normalized),
        fetchApiVersions(normalized),
      ]);

      health.set(nextHealth);
      sla.set(nextSla);
      versions.set(nextVersions);

      const syncTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      lastSyncedAt.set(syncTime);

      const nextProfile = await fetchSessionProfile(normalized, nextSession.accessToken);
      profile.set(nextProfile);
      statusMessage.set(`Signed in as ${nextProfile.playerName}`);
      view.set('home');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed.');
      statusMessage.set('Login failed.');
    } finally {
      busy.set(false);
    }
  }

  function resetBackend() {
    backendUrl.set(normalizeBackendUrl(DEFAULT_BACKEND_URL));
    saveBackendUrl($backendUrl);
  }
</script>

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
          bind:value={$backendUrl}
          type="url"
          placeholder="https://partygame-b5j.pages.dev/"
          on:blur={() => backendUrl.set(normalizeBackendUrl($backendUrl))}
        />
      </label>

      <label>
        <span>Email</span>
        <input bind:value={$email} type="email" placeholder="pilot@partygame.dev" required />
      </label>

      <label>
        <span>Password</span>
        <input bind:value={$password} type="password" placeholder="••••••••" required />
      </label>

      <div class="form-actions">
        <button class="primary" type="submit" disabled={$busy}>
          {$busy ? 'Working...' : 'Sign in'}
        </button>
        <button class="ghost" type="button" on:click={resetBackend}>
          Reset backend
        </button>
      </div>
    </form>

    <div class="status-box">
      <span class="mono">Status</span>
      <strong>{$statusMessage}</strong>
      {#if $errorMessage}
        <p class="error">{$errorMessage}</p>
      {/if}
    </div>
  </section>
</main>

<style>
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

  .hero > p {
    color: var(--muted);
    line-height: 1.6;
  }

  .hero-notes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .hero-notes > div,
  .hero-banner {
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 16px;
  }

  .hero-notes span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
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

  .form-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 4px;
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

  .status-box {
    padding: 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: 20px;
  }

  .status-box span {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 8px;
  }

  .error {
    color: #ffb6bf;
    margin-top: 8px;
  }

  @media (max-width: 1100px) {
    .auth-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
