<script lang="ts">
  import { page } from "$app/stores";
  import { locale, translate, availableLocales } from "./i18n";
  import { themeMode, setThemeMode, type ThemeMode } from "./theme";
  import {
    backendUrl,
    busy,
    errorMessage,
    statusMessage,
    siteName,
  } from "./portalStore";
  import { saveSiteName } from "./portal";

  const nav = [
    { href: "/", labelKey: "sidebar.overview" },
    { href: "/operations", labelKey: "sidebar.operations" },
    { href: "/settings", labelKey: "sidebar.settings" },
  ];

  let collapsed = false;

  function setLocale(e: Event) {
    const value = (e.target as HTMLSelectElement)?.value;
    if (value) locale.set(value);
  }

  function onThemeChange(e: Event) {
    setThemeMode((e.target as HTMLSelectElement).value as ThemeMode);
  }

  function toggleSidebar() {
    collapsed = !collapsed;
    try {
      localStorage.setItem("partygame.sidebarCollapsed", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  $: activePath = $page.url.pathname;
</script>

<div class="shell" class:collapsed>
  <aside class="sidebar panel">
    <div class="sidebar-head">
      <div class="brand">
        <div class="brand-mark"></div>
        {#if !collapsed}
          <div>
            <p class="eyebrow mono">{$translate("topbar.brand")}</p>
            <p class="site-title">{$siteName}</p>
          </div>
        {/if}
      </div>
      <button class="btn collapse" on:click={toggleSidebar} aria-label="Toggle sidebar">
        {collapsed ? "›" : "‹"}
      </button>
    </div>

    <nav class="nav">
      {#each nav as item}
        <a
          href={item.href}
          class="nav-item"
          class:active={activePath === item.href || (item.href !== "/" && activePath.startsWith(item.href))}
          aria-current={activePath === item.href ? "page" : undefined}
        >
          {#if !collapsed}{$translate(item.labelKey)}{/if}
        </a>
      {/each}
    </nav>

    <div class="sidebar-foot">
      {#if !collapsed}
        <label class="mono foot-label" for="theme-select">{$translate("theme.label")}</label>
        <select id="theme-select" value={$themeMode} on:change={onThemeChange}>
          <option value="system">{$translate("theme.system")}</option>
          <option value="light">{$translate("theme.light")}</option>
          <option value="dark">{$translate("theme.dark")}</option>
        </select>

        <label class="mono foot-label" for="lang-select">{$translate("language.label")}</label>
        <select id="lang-select" value={$locale} on:change={setLocale}>
          {#each availableLocales as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      {/if}
    </div>
  </aside>

  <div class="main">
    <header class="topbar panel">
      <input
        class="site-input"
        bind:value={$siteName}
        on:blur={() => saveSiteName($siteName)}
        aria-label={$translate("topbar.site")}
      />
      <span class="backend mono">{$backendUrl}</span>
    </header>

    <div class="content">
      <slot />
    </div>

    <footer class="status-footer panel">
      <span class="mono">
        {#if $busy}{$translate("status.busy")}{:else}{$statusMessage || $translate("status.ready")}{/if}
      </span>
      {#if $errorMessage}
        <span class="error">{$errorMessage}</span>
      {/if}
    </footer>
  </div>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 20px;
    min-height: calc(100vh - 48px);
  }

  .shell.collapsed {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    position: sticky;
    top: 24px;
    align-self: start;
    min-height: calc(100vh - 48px);
  }

  .sidebar-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .brand {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .brand-mark {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--accent), var(--accent-warm));
    flex-shrink: 0;
  }

  .site-title {
    margin: 0;
    font-weight: 700;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .collapse {
    padding: 6px 10px;
    min-width: 36px;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .nav-item {
    padding: 10px 12px;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    color: var(--muted);
    font-weight: 500;
  }

  .nav-item:hover,
  .nav-item.active {
    color: var(--text);
    background: var(--bg-soft);
    border-color: var(--border);
  }

  .nav-item.active {
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .shell.collapsed .nav-item {
    text-align: center;
    padding-inline: 8px;
    font-size: 0.72rem;
  }

  .sidebar-foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .foot-label {
    font-size: 0.72rem;
    color: var(--muted);
  }

  .sidebar-foot select {
    width: 100%;
    border-radius: var(--radius-md);
    padding: 8px 10px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text);
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    flex-wrap: wrap;
  }

  .site-input {
    border: 0;
    background: transparent;
    color: var(--text);
    font-size: 1.1rem;
    font-weight: 700;
    outline: none;
    min-width: 160px;
  }

  .backend {
    color: var(--muted);
    font-size: 0.8rem;
    word-break: break-all;
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  @media (max-width: 900px) {
    .shell,
    .shell.collapsed {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
      min-height: auto;
    }
  }
</style>
