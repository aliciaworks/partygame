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

<main class="login-container">
  <div class="login-wrapper">
    <div class="login-header">
      <h1>Party Game Portal</h1>
      <p class="subtitle">Backend Administration</p>
    </div>

    <form class="login-form" on:submit|preventDefault={handleLogin}>
      <div class="form-group">
        <label for="backend-url">Backend URL</label>
        <input
          id="backend-url"
          bind:value={$backendUrl}
          type="url"
          placeholder="https://partygame.aliciaworks.workers.dev"
          on:blur={() => backendUrl.set(normalizeBackendUrl($backendUrl))}
        />
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input id="email" bind:value={$email} type="email" placeholder="admin@partygame.dev" required />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input id="password" bind:value={$password} type="password" placeholder="••••••••" required />
      </div>

      <button class="btn-primary" type="submit" disabled={$busy}>
        {$busy ? 'Signing in...' : 'Sign in'}
      </button>

      <button class="btn-secondary" type="button" on:click={resetBackend}>
        Use default backend
      </button>
    </form>

    {#if $errorMessage}
      <div class="error-box">
        <p>{$errorMessage}</p>
      </div>
    {/if}

    {#if $statusMessage && !$errorMessage}
      <div class="success-box">
        <p>{$statusMessage}</p>
      </div>
    {/if}
  </div>
</main>

<style>
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 16px;
    background: linear-gradient(135deg, #0a0f1f 0%, #0d1428 50%, #0a1220 100%);
  }

  .login-wrapper {
    width: 100%;
    max-width: 420px;
  }

  .login-header {
    text-align: center;
    margin-bottom: 40px;
  }

  .login-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px 0;
    background: linear-gradient(135deg, #7cf0ff, #ff7cf0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: var(--muted);
    font-size: 14px;
    margin: 0;
    letter-spacing: 0.5px;
  }

  .login-form {
    display: grid;
    gap: 16px;
    margin-bottom: 24px;
  }

  .form-group {
    display: grid;
    gap: 6px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 600;
    color: #dfe8ff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-group input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(124, 240, 255, 0.15);
    background: rgba(6, 12, 24, 0.5);
    color: var(--text);
    font-size: 14px;
    transition: all 0.2s ease;
    outline: none;
  }

  .form-group input::placeholder {
    color: var(--muted);
  }

  .form-group input:focus {
    border-color: rgba(124, 240, 255, 0.5);
    background: rgba(6, 12, 24, 0.8);
    box-shadow: 0 0 0 3px rgba(124, 240, 255, 0.1);
  }

  .btn-primary,
  .btn-secondary {
    padding: 12px 16px;
    border-radius: 10px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #05131d;
    box-shadow: 0 8px 24px rgba(124, 240, 255, 0.15);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(124, 240, 255, 0.2);
  }

  .btn-primary:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-box,
  .success-box {
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
  }

  .error-box {
    background: rgba(255, 182, 191, 0.1);
    border: 1px solid rgba(255, 182, 191, 0.3);
    color: #ffb6bf;
  }

  .error-box p {
    margin: 0;
  }

  .success-box {
    background: rgba(124, 240, 255, 0.1);
    border: 1px solid rgba(124, 240, 255, 0.3);
    color: #7cf0ff;
  }

  .success-box p {
    margin: 0;
  }

  @media (max-width: 480px) {
    .login-header {
      margin-bottom: 32px;
    }

    .login-header h1 {
      font-size: 24px;
    }

    .login-form {
      gap: 14px;
    }
  }
</style>
