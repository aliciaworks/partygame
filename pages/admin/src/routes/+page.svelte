<script lang="ts">
  import { alerts, events, metrics, rooms } from "$lib/dashboard";

  const filters = ["all", "healthy", "warning", "critical"] as const;

  let selectedFilter: (typeof filters)[number] = "all";
  let search = "";

  $: visibleRooms = rooms.filter((room) => {
    const matchesFilter = selectedFilter === "all" || room.status === selectedFilter;
    const matchesSearch = room.name.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  function statusLabel(status: (typeof rooms)[number]["status"]) {
    return status === "healthy" ? "stable" : status === "warning" ? "watch" : "intervene";
  }
</script>

<svelte:head>
  <title>PartyGame Control Deck</title>
  <meta
    name="description"
    content="Management interface for PartyGame: rooms, moderation, anti-cheat, and live operations."
  />
</svelte:head>

<div class="shell">
  <aside class="sidebar panel">
    <div>
      <p class="eyebrow mono">ADMIN / CONTROL PLANE</p>
      <h1>PartyGame Control Deck</h1>
      <p class="lede">
        Operational view for rooms, abuse signals, purchase safety, and token health.
      </p>
    </div>

    <nav class="nav">
      <a href="#rooms">Rooms</a>
      <a href="#alerts">Alerts</a>
      <a href="#economy">Economy</a>
      <a href="#timeline">Timeline</a>
    </nav>

    <section class="sidebar-card">
      <span class="mono sidebar-label">Deployment</span>
      <strong>pages/admin</strong>
      <p>Static SvelteKit interface deployed separately from the worker backend.</p>
    </section>
  </aside>

  <main class="workspace">
    <header class="topbar panel">
      <div>
        <p class="eyebrow mono">LIVE OPERATIONS</p>
        <h2>Monitor, triage, and intervene without touching the worker runtime.</h2>
      </div>

      <div class="topbar-actions">
        <label class="searchbox">
          <span class="mono">Search room</span>
          <input bind:value={search} type="search" placeholder="rift-echo" />
        </label>
        <button class="cta">Open incident board</button>
      </div>
    </header>

    <section class="metrics">
      {#each metrics as metric}
        <article class="metric panel">
          <span class="mono metric-label">{metric.label}</span>
          <div class="metric-value-row">
            <strong>{metric.value}</strong>
            <span class="metric-delta">{metric.delta}</span>
          </div>
          <p>{metric.detail}</p>
        </article>
      {/each}
    </section>

    <section class="grid">
      <article id="rooms" class="panel room-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow mono">ROOMS</p>
            <h3>Active room health</h3>
          </div>

          <div class="filters">
            {#each filters as filter}
              <button
                class:selected={selectedFilter === filter}
                on:click={() => (selectedFilter = filter)}
              >
                {filter}
              </button>
            {/each}
          </div>
        </div>

        <div class="table">
          {#each visibleRooms as room}
            <div class="room-row">
              <div>
                <strong>{room.name}</strong>
                <p class="mono">{room.region}</p>
              </div>
              <div>
                <span>{room.players}/{room.maxPlayers}</span>
                <p class="mono">{room.tick} • {room.ping}</p>
              </div>
              <div class={`pill ${room.status}`}>{statusLabel(room.status)}</div>
              <div class="mono">{room.antiCheat}</div>
            </div>
          {/each}
        </div>
      </article>

      <article id="alerts" class="panel alert-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow mono">ABUSE SIGNALS</p>
            <h3>Moderation queue</h3>
          </div>
        </div>

        <div class="alert-list">
          {#each alerts as alert}
            <article class={`alert ${alert.tone}`}>
              <strong>{alert.title}</strong>
              <p>{alert.body}</p>
            </article>
          {/each}
        </div>
      </article>

      <article id="economy" class="panel economy-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow mono">ECONOMY</p>
            <h3>Purchase protection</h3>
          </div>
        </div>

        <div class="economy-grid">
          <div class="economy-card">
            <span class="mono">Idempotency</span>
            <strong>Hard fail on duplicate keys</strong>
            <p>Prevents double spend during retries and flaky mobile connections.</p>
          </div>
          <div class="economy-card">
            <span class="mono">Balance guard</span>
            <strong>Atomic deductions</strong>
            <p>Transactions are rejected if the account cannot cover the cost up front.</p>
          </div>
        </div>
      </article>

      <article id="timeline" class="panel timeline-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow mono">EVENTS</p>
            <h3>Recent activity</h3>
          </div>
        </div>

        <ol class="timeline">
          {#each events as event}
            <li>
              <span class="mono">{event.time}</span>
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>
            </li>
          {/each}
        </ol>
      </article>
    </section>
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 24px;
    min-height: 100vh;
    padding: 24px;
    box-sizing: border-box;
  }

  .panel {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
  }

  .sidebar {
    position: sticky;
    top: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 24px;
    padding: 28px;
    border-radius: 28px;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent);
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  h1,
  h2,
  h3,
  strong,
  p {
    margin: 0;
  }

  h1 {
    font-size: clamp(2.4rem, 4vw, 3.4rem);
    line-height: 0.95;
    max-width: 10ch;
  }

  h2 {
    font-size: clamp(1.5rem, 2vw, 2.1rem);
    line-height: 1.05;
  }

  h3 {
    font-size: 1.15rem;
  }

  .lede,
  .sidebar-card p,
  .metric p,
  .alert p,
  .economy-card p,
  .timeline p {
    color: var(--muted);
    line-height: 1.55;
  }

  .nav {
    display: grid;
    gap: 10px;
  }

  .nav a {
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid transparent;
    color: var(--text);
    background: rgba(255, 255, 255, 0.02);
  }

  .nav a:hover {
    border-color: var(--border);
    background: rgba(255, 255, 255, 0.05);
  }

  .sidebar-card {
    padding: 18px;
    border-radius: 20px;
    background: var(--bg-soft);
    border: 1px solid var(--border);
  }

  .sidebar-label,
  .metric-label,
  .searchbox span,
  .room-row p,
  .timeline span {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: end;
    padding: 26px 28px;
    border-radius: 28px;
  }

  .topbar-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: end;
  }

  .searchbox {
    display: grid;
    gap: 8px;
  }

  .searchbox input {
    min-width: 220px;
    border-radius: 14px;
    border: 1px solid var(--border);
    padding: 12px 14px;
    color: var(--text);
    background: rgba(0, 0, 0, 0.18);
    outline: none;
  }

  .searchbox input:focus {
    border-color: rgba(124, 240, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(124, 240, 255, 0.12);
  }

  .cta,
  .filters button {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px 16px;
    color: var(--text);
    background: rgba(255, 255, 255, 0.04);
  }

  .cta {
    background: linear-gradient(135deg, rgba(124, 240, 255, 0.18), rgba(255, 184, 108, 0.18));
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 18px;
  }

  .metric {
    padding: 20px;
    border-radius: 24px;
  }

  .metric-value-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin: 12px 0 10px;
  }

  .metric strong {
    font-size: clamp(1.9rem, 3vw, 2.7rem);
  }

  .metric-delta {
    color: var(--accent);
    font-size: 0.85rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .room-panel,
  .alert-panel,
  .economy-panel,
  .timeline-panel {
    padding: 24px;
    border-radius: 28px;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
    margin-bottom: 18px;
  }

  .filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filters button.selected {
    background: rgba(124, 240, 255, 0.14);
    border-color: rgba(124, 240, 255, 0.4);
  }

  .table {
    display: grid;
    gap: 12px;
  }

  .room-row {
    display: grid;
    grid-template-columns: minmax(140px, 1.5fr) 1fr 110px 1fr;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .pill {
    width: fit-content;
    padding: 8px 12px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.72rem;
  }

  .pill.healthy {
    color: var(--success);
    background: rgba(125, 255, 181, 0.1);
  }

  .pill.warning {
    color: var(--accent-warm);
    background: rgba(255, 184, 108, 0.1);
  }

  .pill.critical {
    color: var(--danger);
    background: rgba(255, 107, 122, 0.1);
  }

  .alert-list {
    display: grid;
    gap: 12px;
  }

  .alert {
    padding: 16px;
    border-radius: 18px;
    border: 1px solid transparent;
  }

  .alert.danger {
    border-color: rgba(255, 107, 122, 0.25);
    background: rgba(255, 107, 122, 0.08);
  }

  .alert.warning {
    border-color: rgba(255, 184, 108, 0.22);
    background: rgba(255, 184, 108, 0.08);
  }

  .alert.info {
    border-color: rgba(124, 240, 255, 0.18);
    background: rgba(124, 240, 255, 0.06);
  }

  .economy-grid {
    display: grid;
    gap: 12px;
  }

  .economy-card {
    padding: 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .economy-card strong {
    display: block;
    margin: 8px 0;
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 14px;
  }

  .timeline li {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 12px;
    align-items: start;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
  }

  @media (max-width: 1080px) {
    .shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
    }

    .metrics,
    .grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .shell {
      padding: 14px;
    }

    .topbar,
    .room-panel,
    .alert-panel,
    .economy-panel,
    .timeline-panel,
    .metric,
    .sidebar {
      border-radius: 22px;
      padding: 18px;
    }

    .room-row {
      grid-template-columns: 1fr;
    }

    .topbar-actions {
      width: 100%;
    }

    .searchbox input {
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }
  }
</style>