<script lang="ts">
  import { onMount } from 'svelte';
  import HomeView from '$lib/HomeView.svelte';
  import { translate } from '$lib/i18n';
  import { backendUrl, statusMessage, siteName } from '$lib/portalStore';
  import { readBackendUrl, readSiteName, saveSiteName } from '$lib/portal';

  let showZeroTrustHint = true;

  onMount(() => {
    const dismissed = localStorage.getItem('partygame.zeroTrustHintDismissed');
    showZeroTrustHint = dismissed !== '1';
  });

  function dismissZeroTrustHint() {
    localStorage.setItem('partygame.zeroTrustHintDismissed', '1');
    showZeroTrustHint = false;
  }

  onMount(() => {
    const savedBackendUrl = readBackendUrl();
    backendUrl.set(savedBackendUrl);
    statusMessage.set(`${$translate('topbar.backend')} ${savedBackendUrl}`);
    siteName.set(readSiteName());
  });
</script>

<svelte:head>
  <title>{$translate('meta.title')}</title>
  <meta name="description" content={$translate('meta.description')} />
</svelte:head>

<div class="page-shell">
  <header class="topbar panel">
    <div class="brand">
      <div class="brand-mark"></div>
      <div>
        <p class="eyebrow mono">{$translate('topbar.brand')}</p>
        <input
          class="site-name"
          bind:value={$siteName}
          on:blur={() => {
            saveSiteName($siteName);
            statusMessage.set(`${$translate('topbar.site')} ${$siteName}`);
          }}
        />
      </div>
    </div>
  </header>

  {#if showZeroTrustHint}
    <div class="zero-trust-banner panel">
      <div class="zt-content">
        <strong>{$translate('zeroTrust.title')}</strong>
        <span>{$translate('zeroTrust.desc')}</span>
      </div>
      <div class="zt-actions">
        <button class="ghost" on:click={() => window.open('https://developers.cloudflare.com/cloudflare-one/', '_blank', 'noopener,noreferrer')}>
          {$translate('zeroTrust.learn')}
        </button>
        <button class="ghost" on:click={dismissZeroTrustHint}>{$translate('zeroTrust.dismiss')}</button>
      </div>
    </div>
  {/if}

  <HomeView />
</div>

<style>
  .page-shell {
    position: relative;
    min-height: 100vh;
    padding: 24px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
    padding: 22px 26px;
    border-radius: 28px;
    margin-bottom: 24px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
  }

  .panel {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
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

  .site-name {
    font-size: clamp(1rem, 2vw, 1.2rem);
    background: transparent;
    border: 0;
    color: var(--text);
    padding: 0;
    outline: none;
  }

  .zero-trust-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 18px;
    border-radius: 12px;
    background: linear-gradient(90deg, rgba(6, 12, 24, 0.85), rgba(10, 18, 32, 0.85));
    border: 1px solid rgba(124, 240, 255, 0.06);
  }

  .zero-trust-banner .zt-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .zero-trust-banner .zt-content span {
    color: var(--muted);
    font-size: 0.95rem;
  }

  .zt-actions {
    display: flex;
    gap: 8px;
  }

  p {
    margin: 0;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent);
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  @media (max-width: 1100px) {
    .page-shell {
      padding: 16px;
    }

    .topbar {
      flex-direction: column;
      align-items: stretch;
      border-radius: 22px;
      padding: 18px;
    }
  }

  @media (max-width: 720px) {
    .page-shell {
      padding: 14px;
    }

    .topbar {
      border-radius: 20px;
      padding: 16px;
    }

    .brand {
      gap: 10px;
    }

    .brand-mark {
      width: 40px;
      height: 40px;
    }
  }
</style>
