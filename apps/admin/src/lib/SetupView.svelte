<script lang="ts">
  import { 
    backendUrl, 
    busy, 
    email, 
    password, 
    errorMessage, 
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
    savePortalSession,
    fetchBackendHealth,
    fetchBackendSla,
    fetchApiVersions,
    fetchSessionProfile
  } from './portal';

  let adminName = 'Admin';

  async function handleCreateAdmin() {
    busy.set(true);
    clearError();

    try {
      const normalized = normalizeBackendUrl($backendUrl);
      backendUrl.set(normalized);
      saveBackendUrl(normalized);

      // Test backend connection
      const testHealth = await fetchBackendHealth(normalized);
      
      if (!testHealth) {
        throw new Error('Backend is not responding. Make sure it is running and the URL is correct.');
      }

      statusMessage.set(`Backend is ready. You can now sign in with your credentials.`);
      view.set('login');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect to backend.');
    } finally {
      busy.set(false);
    }
  }

  async function testBackendConnection() {
    busy.set(true);
    clearError();

    try {
      const normalized = normalizeBackendUrl($backendUrl);
      const health = await fetchBackendHealth(normalized);
      statusMessage.set('✓ Backend connection successful!');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect to backend.');
    } finally {
      busy.set(false);
    }
  }

  function goToLogin() {
    view.set('login');
  }
</script>

<main class="setup-container">
  <div class="setup-wrapper">
    <div class="setup-header">
      <h1>Party Game Setup</h1>
      <p class="subtitle">Configure your backend to get started</p>
    </div>

    <section class="setup-section">
      <h2>Step 1: Backend Configuration</h2>
      <p class="description">Enter your backend URL to connect the admin portal.</p>

      <div class="form-group">
        <label for="backend-url">Backend URL</label>
        <input
          id="backend-url"
          bind:value={$backendUrl}
          type="url"
          placeholder="https://partygame.workers.dev"
        />
        <span class="hint">Make sure the backend is running and accessible</span>
      </div>

      <button class="btn-secondary" on:click={testBackendConnection} disabled={$busy}>
        {$busy ? 'Testing...' : 'Test Connection'}
      </button>
    </section>

    <section class="setup-section">
      <h2>Step 2: Verify Admin Account</h2>
      <p class="description">
        Use your backend to create an admin account if one doesn't exist. 
        This is typically done through your backend's initialization or database setup.
      </p>

      <div class="info-box">
        <p><strong>Default admin credentials:</strong></p>
        <p>Email: <code>admin@partygame.dev</code></p>
        <p>Password: <code>default-password</code></p>
        <p style="font-size: 0.85rem; color: var(--muted); margin-top: 8px;">
          Change these immediately after first login for security.
        </p>
      </div>
    </section>

    <section class="setup-section">
      <h2>Step 3: Sign In</h2>
      <p class="description">Once your backend is set up and you have admin credentials, you can proceed to login.</p>

      <button class="btn-primary" on:click={goToLogin} disabled={$busy}>
        Ready to Sign In
      </button>
    </section>

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
  .setup-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 16px;
    background: linear-gradient(135deg, #0a0f1f 0%, #0d1428 50%, #0a1220 100%);
  }

  .setup-wrapper {
    width: 100%;
    max-width: 560px;
  }

  .setup-header {
    text-align: center;
    margin-bottom: 40px;
  }

  .setup-header h1 {
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

  .setup-section {
    margin-bottom: 32px;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid rgba(124, 240, 255, 0.1);
    background: rgba(255, 255, 255, 0.02);
  }

  .setup-section h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text);
  }

  .description {
    font-size: 13px;
    color: var(--muted);
    margin: 0 0 16px 0;
    line-height: 1.5;
  }

  .form-group {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }

  .form-group label {
    font-size: 12px;
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

  .hint {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-top: 6px;
  }

  .info-box {
    padding: 14px;
    border-radius: 10px;
    background: rgba(124, 240, 255, 0.08);
    border: 1px solid rgba(124, 240, 255, 0.2);
    margin-bottom: 16px;
  }

  .info-box p {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #dfe8ff;
  }

  .info-box p:last-child {
    margin-bottom: 0;
  }

  .info-box code {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
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
    margin-top: 20px;
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
    .setup-header {
      margin-bottom: 32px;
    }

    .setup-header h1 {
      font-size: 24px;
    }

    .setup-section {
      margin-bottom: 24px;
      padding: 16px;
    }
  }
</style>
