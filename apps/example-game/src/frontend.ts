export const DEFAULT_BACKEND_URL = " https://partygame.aliciaworks.workers.dev";

export function normalizeBackendUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_BACKEND_URL;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.origin + parsed.pathname.replace(/\/?$/, "/");
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

export function renderPortalHtml(defaultBackendUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PartyGame Control Room</title>
    <meta name="color-scheme" content="dark" />
    <style>
      :root {
        --bg: #08111f;
        --bg-2: #101c32;
        --panel: rgba(12, 20, 38, 0.86);
        --panel-2: rgba(16, 28, 50, 0.92);
        --border: rgba(168, 194, 255, 0.12);
        --text: #eaf1ff;
        --muted: #9fb0d0;
        --accent: #62f1c2;
        --accent-2: #7aa7ff;
        --danger: #ff7f93;
        --shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(122, 167, 255, 0.24), transparent 35%),
          radial-gradient(circle at top right, rgba(98, 241, 194, 0.18), transparent 28%),
          linear-gradient(180deg, #06101b 0%, var(--bg) 45%, #06101b 100%);
        color: var(--text);
        font-family: "Inter", "Segoe UI Variable Text", "Segoe UI", sans-serif;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 32px 32px;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.35), transparent 85%);
      }

      .shell {
        position: relative;
        min-height: 100vh;
        padding: 28px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        max-width: 1320px;
        margin: 0 auto 24px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .brand-mark {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        box-shadow: 0 12px 30px rgba(122, 167, 255, 0.35);
      }

      .brand h1 {
        margin: 0;
        font-size: 1.02rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .brand p {
        margin: 2px 0 0;
        color: var(--muted);
        font-size: 0.92rem;
      }

      .badge {
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-size: 0.9rem;
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
        gap: 20px;
        max-width: 1320px;
        margin: 0 auto;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .panel.login {
        padding: 28px;
      }

      .panel.home {
        padding: 24px;
        display: none;
      }

      .eyebrow {
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.74rem;
        margin: 0 0 10px;
      }

      .hero-title {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 0.98;
      }

      .hero-copy {
        margin: 16px 0 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .field {
        margin-top: 18px;
      }

      .field label {
        display: block;
        margin-bottom: 8px;
        color: #d9e4fb;
        font-size: 0.88rem;
      }

      .field input,
      .field select {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(169, 192, 255, 0.16);
        background: rgba(7, 13, 25, 0.9);
        color: var(--text);
        padding: 14px 16px;
        font-size: 1rem;
        outline: none;
      }

      .field input:focus,
      .field select:focus {
        border-color: rgba(122, 167, 255, 0.6);
        box-shadow: 0 0 0 4px rgba(122, 167, 255, 0.13);
      }

      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 22px;
      }

      button {
        border: 0;
        cursor: pointer;
        border-radius: 16px;
        padding: 14px 18px;
        font: inherit;
        transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
      }

      button:hover {
        transform: translateY(-1px);
      }

      .primary {
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: #04101a;
        font-weight: 700;
        box-shadow: 0 18px 32px rgba(98, 241, 194, 0.12);
      }

      .ghost {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .danger {
        background: rgba(255, 127, 147, 0.08);
        color: #ffd9df;
        border: 1px solid rgba(255, 127, 147, 0.22);
      }

      .status {
        margin-top: 18px;
        min-height: 24px;
        color: var(--muted);
        font-size: 0.94rem;
      }

      .status strong {
        color: var(--text);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .stat {
        padding: 18px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 18px;
      }

      .stat span {
        display: block;
        color: var(--muted);
        font-size: 0.84rem;
      }

      .stat strong {
        display: block;
        margin-top: 10px;
        font-size: 1.5rem;
      }

      .section {
        margin-top: 22px;
        padding: 18px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 14px;
      }

      .section-head h2 {
        margin: 0;
        font-size: 1rem;
      }

      .section-head p {
        margin: 4px 0 0;
        color: var(--muted);
        font-size: 0.9rem;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .mini-card {
        padding: 16px;
        border-radius: 18px;
        background: rgba(6, 12, 24, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .mini-card h3 {
        margin: 0 0 8px;
        font-size: 0.95rem;
      }

      .mini-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
        font-size: 0.92rem;
      }

      .list {
        display: grid;
        gap: 10px;
      }

      .list-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(8, 15, 28, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .list-item span {
        color: var(--muted);
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(98, 241, 194, 0.08);
        color: #c7ffee;
        border: 1px solid rgba(98, 241, 194, 0.18);
        font-size: 0.84rem;
      }

      .muted {
        color: var(--muted);
      }

      .tiny {
        font-size: 0.84rem;
      }

      .split {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
        margin-top: 16px;
      }

      @media (max-width: 1080px) {
        .grid,
        .split,
        .stats,
        .cards,
        .row {
          grid-template-columns: 1fr;
        }

        .topbar {
          flex-direction: column;
          align-items: stretch;
        }
      }

      @media (max-width: 720px) {
        .shell {
          padding: 18px;
        }

        .panel.login,
        .panel.home {
          padding: 18px;
          border-radius: 20px;
        }

        .actions button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark"></div>
          <div>
            <h1>PartyGame Control Room</h1>
            <p>Login first, then manage the live game backend.</p>
          </div>
        </div>
        <div class="badge" id="backendBadge">Backend: ${escapeHtml(defaultBackendUrl)}</div>
      </header>

      <main class="grid">
        <section class="panel login" id="loginPanel">
          <p class="eyebrow">Secure entry</p>
          <h2 class="hero-title">Login to enter the dashboard.</h2>
          <p class="hero-copy">
            Choose a backend address, sign in, and unlock the control surface.
            The backend address is fully configurable and defaults to ${escapeHtml(defaultBackendUrl)}.
          </p>

          <form id="loginForm">
            <div class="field">
              <label for="backendUrl">Backend address</label>
              <input id="backendUrl" name="backendUrl" type="url" placeholder="https://partygame-b5j.pages.dev/" />
            </div>

            <div class="row">
              <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" placeholder="pilot@partygame.dev" required />
              </div>
              <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>
            </div>

            <div class="actions">
              <button class="primary" type="submit">Enter home</button>
              <button class="ghost" type="button" id="saveBackendBtn">Save backend</button>
            </div>
            <div class="status" id="loginStatus"></div>
          </form>
        </section>

        <section class="panel home" id="homePanel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Live home</p>
              <h2>Command the running game stack from one place.</h2>
              <p>Voice bootstrap, runtime toggles, and deployment controls are surfaced here after login.</p>
            </div>
            <div class="pill" id="sessionPill">Session locked</div>
          </div>

          <div class="stats">
            <div class="stat"><span>Backend</span><strong id="statBackend">-</strong></div>
            <div class="stat"><span>Player</span><strong id="statPlayer">-</strong></div>
            <div class="stat"><span>Voice</span><strong id="statVoice">-</strong></div>
            <div class="stat"><span>Health</span><strong id="statHealth">-</strong></div>
          </div>

          <div class="split">
            <section class="section">
              <div class="section-head">
                <div>
                  <h2>Quick actions</h2>
                  <p>Actions are executed against the backend you selected.</p>
                </div>
              </div>
              <div class="cards">
                <div class="mini-card">
                  <h3>Voice room bootstrap</h3>
                  <p>Create a RealtimeKit-ready room manifest for the current backend session.</p>
                  <div class="actions">
                    <button class="ghost" type="button" id="voiceBootstrapBtn">Build voice bootstrap</button>
                  </div>
                </div>
                <div class="mini-card">
                  <h3>Runtime toggles</h3>
                  <p>Open the admin surface to disable chat, replay, analytics, or spectator mode without redeploying.</p>
                  <div class="actions">
                    <button class="ghost" type="button" id="openAdminBtn">Open admin</button>
                  </div>
                </div>
                <div class="mini-card">
                  <h3>Backend health</h3>
                  <p>Check if the selected backend is reachable and healthy before letting players in.</p>
                  <div class="actions">
                    <button class="ghost" type="button" id="refreshHealthBtn">Refresh status</button>
                  </div>
                </div>
                <div class="mini-card">
                  <h3>Session controls</h3>
                  <p>Switch backend targets or log out without losing the saved backend configuration.</p>
                  <div class="actions">
                    <button class="danger" type="button" id="logoutBtn">Log out</button>
                  </div>
                </div>
              </div>
            </section>

            <section class="section">
              <div class="section-head">
                <div>
                  <h2>Recent signals</h2>
                  <p>Live payloads from the selected backend are shown here.</p>
                </div>
              </div>
              <div class="list" id="signalList">
                <div class="list-item"><strong>Auth</strong><span>Waiting for login</span></div>
                <div class="list-item"><strong>Backend</strong><span>Not selected</span></div>
                <div class="list-item"><strong>Voice</strong><span>Bootstrap idle</span></div>
                <div class="list-item"><strong>Health</strong><span>Unknown</span></div>
              </div>
            </section>
          </div>

          <div class="section">
            <div class="section-head">
              <div>
                <h2>Dashboard notes</h2>
                <p>These signals are meant to replace the old placeholder screen with a real operational home page.</p>
              </div>
            </div>
            <div class="list" id="noteList">
              <div class="list-item"><strong>Login gate</strong><span>Required before the home view is shown</span></div>
              <div class="list-item"><strong>Backend target</strong><span>Editable per operator session</span></div>
              <div class="list-item"><strong>RealtimeKit</strong><span>Used as the voice room bootstrap provider</span></div>
              <div class="list-item"><strong>R2</strong><span>Stores runtime control state and update artifacts</span></div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <script>
      const STORAGE_KEY = "partygame.portal.session";
      const BACKEND_KEY = "partygame.portal.backendUrl";
      const DEFAULT_BACKEND_URL = ${JSON.stringify(defaultBackendUrl)};

      const loginPanel = document.getElementById("loginPanel");
      const homePanel = document.getElementById("homePanel");
      const loginForm = document.getElementById("loginForm");
      const backendUrlInput = document.getElementById("backendUrl");
      const loginStatus = document.getElementById("loginStatus");
      const sessionPill = document.getElementById("sessionPill");
      const statBackend = document.getElementById("statBackend");
      const statPlayer = document.getElementById("statPlayer");
      const statVoice = document.getElementById("statVoice");
      const statHealth = document.getElementById("statHealth");
      const backendBadge = document.getElementById("backendBadge");
      const signalList = document.getElementById("signalList");

      const voiceBootstrapBtn = document.getElementById("voiceBootstrapBtn");
      const openAdminBtn = document.getElementById("openAdminBtn");
      const refreshHealthBtn = document.getElementById("refreshHealthBtn");
      const logoutBtn = document.getElementById("logoutBtn");
      const saveBackendBtn = document.getElementById("saveBackendBtn");

      function sanitizeBackendUrl(value) {
        const trimmed = String(value || "").trim();
        if (!trimmed) {
          return DEFAULT_BACKEND_URL;
        }

        try {
          const parsed = new URL(trimmed);
          return parsed.origin + parsed.pathname.replace(/\/?$/, "/");
        } catch {
          return DEFAULT_BACKEND_URL;
        }
      }

      function setStatus(message, kind = "info") {
        loginStatus.textContent = message;
        loginStatus.style.color = kind === "error" ? "var(--danger)" : "var(--muted)";
      }

      function setSignals(items) {
        signalList.innerHTML = items
          .map(([label, value]) => '<div class="list-item"><strong>' + label + '</strong><span>' + value + '</span></div>')
          .join("");
      }

      function setBackend(value) {
        const normalized = sanitizeBackendUrl(value);
        backendUrlInput.value = normalized;
        localStorage.setItem(BACKEND_KEY, normalized);
        backendBadge.textContent = "Backend: " + normalized;
        statBackend.textContent = normalized.replace(/^https?:\/\//, "");
        return normalized;
      }

      function getBackend() {
        return sanitizeBackendUrl(localStorage.getItem(BACKEND_KEY) || DEFAULT_BACKEND_URL);
      }

      function getSession() {
        try {
          return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        } catch {
          return null;
        }
      }

      function saveSession(session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }

      function clearSession() {
        localStorage.removeItem(STORAGE_KEY);
      }

      function showLogin() {
        loginPanel.style.display = "block";
        homePanel.style.display = "none";
        sessionPill.textContent = "Session locked";
        statPlayer.textContent = "-";
        statVoice.textContent = "-";
        statHealth.textContent = "-";
        setSignals([
          ["Auth", "Waiting for login"],
          ["Backend", getBackend()],
          ["Voice", "Bootstrap idle"],
          ["Health", "Unknown"],
        ]);
      }

      function showHome() {
        loginPanel.style.display = "none";
        homePanel.style.display = "block";
      }

      async function requestJson(path, options = {}) {
        const session = getSession();
        const backend = getBackend();
        const headers = new Headers(options.headers || {});
        headers.set("Content-Type", "application/json");
        if (session?.token) {
          headers.set("Authorization", "Bearer " + session.token);
        }

        const response = await fetch(backend + path.replace(/^\//, ""), {
          ...options,
          headers,
        });

        const text = await response.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { raw: text };
        }

        if (!response.ok) {
          const error = data && data.error ? data.error : "Request failed with " + response.status;
          throw new Error(error);
        }

        return data;
      }

      async function verifySession() {
        const session = getSession();
        if (!session?.token) {
          showLogin();
          return false;
        }

        try {
          const data = await requestJson("/api/session/me", {
            method: "GET",
            headers: {
              Authorization: "Bearer " + session.token,
            },
          });

          sessionPill.textContent = "Signed in as " + data.playerName;
          statPlayer.textContent = data.playerName;
          statVoice.textContent = data.voiceEnabled ? "on" : "off";
          showHome();
          setSignals([
            ["Auth", data.playerName + " authenticated"],
            ["Backend", getBackend()],
            ["Voice", data.voiceEnabled ? "Ready for RealtimeKit" : "Disabled"],
            ["Health", data.backendHealthy ? "Healthy" : "Unknown"],
          ]);
          return true;
        } catch (error) {
          clearSession();
          showLogin();
          setStatus(error instanceof Error ? error.message : "Session expired", "error");
          return false;
        }
      }

      async function refreshHealth() {
        const data = await requestJson("/health", { method: "GET" });
        statHealth.textContent = data.status || "ok";
        setSignals([
          ["Auth", getSession()?.playerName || "Signed out"],
          ["Backend", getBackend()],
          ["Voice", getSession()?.voiceEnabled ? "Ready for RealtimeKit" : "Disabled"],
          ["Health", data.status || "healthy"],
        ]);
      }

      function wireActions() {
        saveBackendBtn.addEventListener("click", () => {
          const backend = setBackend(backendUrlInput.value);
          setStatus("Backend saved: " + backend);
        });

        loginForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const backend = setBackend(backendUrlInput.value);
          const email = document.getElementById("email").value.trim();
          const password = document.getElementById("password").value;

          setStatus("Signing in...");

          try {
            const result = await fetch(backend + "api/session/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });

            const data = await result.json();
            if (!result.ok) {
              throw new Error(data.error || "Login failed");
            }

            saveSession({
              token: data.accessToken,
              refreshToken: data.refreshToken,
              playerName: data.playerName,
              playerId: data.playerId,
              voiceEnabled: data.voiceEnabled,
            });

            sessionPill.textContent = "Signed in as " + data.playerName;
            statPlayer.textContent = data.playerName;
            statVoice.textContent = data.voiceEnabled ? "on" : "off";
            showHome();
            setStatus("Login successful.");
            await refreshHealth();
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Login failed", "error");
          }
        });

        refreshHealthBtn.addEventListener("click", async () => {
          try {
            await refreshHealth();
            setStatus("Backend health refreshed.");
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Failed to load health", "error");
          }
        });

        voiceBootstrapBtn.addEventListener("click", async () => {
          try {
            const session = getSession();
            const roomId = session?.playerId ? session.playerId + "-voice" : "demo-room";
            const data = await requestJson("/api/voice/rooms/" + encodeURIComponent(roomId) + "/bootstrap", {
              method: "POST",
            });

            setSignals([
              ["Auth", session?.playerName || "Signed in"],
              ["Backend", getBackend()],
              ["Voice", data.bootstrap.enabled ? "Bootstrap ready" : "Disabled"],
              ["Health", statHealth.textContent || "unknown"],
            ]);
            setStatus("Voice bootstrap loaded for room " + roomId);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Failed to build voice bootstrap", "error");
          }
        });

        openAdminBtn.addEventListener("click", () => {
          window.location.href = getBackend() + "admin";
        });

        logoutBtn.addEventListener("click", () => {
          clearSession();
          showLogin();
          setStatus("Logged out.");
        });
      }

      (async function init() {
        setBackend(localStorage.getItem(BACKEND_KEY) || DEFAULT_BACKEND_URL);
        wireActions();
        const existingSession = getSession();
        if (existingSession?.playerName) {
          statPlayer.textContent = existingSession.playerName;
        }
        const loggedIn = await verifySession();
        if (!loggedIn) {
          backendUrlInput.value = getBackend();
          showLogin();
          return;
        }

        await refreshHealth().catch(() => null);
      })();
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}