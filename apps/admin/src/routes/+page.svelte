<script lang="ts">
  import { onMount } from 'svelte';
  import HomeView from '$lib/HomeView.svelte';
  import {
    backendUrl,
    statusMessage,
  } from '$lib/portalStore';
  import {
    readBackendUrl,
  } from '$lib/portal';

  onMount(async () => {
    const savedBackendUrl = readBackendUrl();
    backendUrl.set(savedBackendUrl);
    statusMessage.set(`Backend: ${savedBackendUrl}`);
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
      <div class="brand-mark"></div>
      <div>
        <p class="eyebrow mono">PARTYGAME / ADMIN</p>
        <h1>{$backendUrl}</h1>
      </div>
    </div>
  </header>

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

  h1,
  p {
    margin: 0;
  }

  h1 {
    font-size: clamp(1.4rem, 3vw, 2rem);
    line-height: 1.02;
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

    .status-pills {
      justify-content: stretch;
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

    h1 {
      font-size: 1.2rem;
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