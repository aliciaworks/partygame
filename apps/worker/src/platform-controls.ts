export interface PlatformControls {
  voiceChatEnabled: boolean;
  chatEnabled: boolean;
  leaderboardEnabled: boolean;
  achievementsEnabled: boolean;
  replayEnabled: boolean;
  analyticsEnabled: boolean;
  spectatorEnabled: boolean;
  gameUpdatesEnabled: boolean;
}

export interface PlatformBindings {
  CONTROLS_BUCKET?: R2Bucket;
  GAME_UPDATES_BUCKET?: R2Bucket;
  ADMIN_TOKEN?: string;
  REALTIMEKIT_APP_ID?: string;
  REALTIMEKIT_API_TOKEN?: string;
}

export interface VoiceRoomBootstrap {
  provider: 'realtimekit';
  roomId: string;
  enabled: boolean;
  joinMode: 'client-managed';
  appId: string | null;
  joinHint: string;
}

export interface GameUpdateAssetInput {
  name: string;
  content: string;
  contentType?: string;
}

const CONTROL_KEY = 'admin/platform-controls.json';
const DEFAULT_CONTROLS: PlatformControls = {
  voiceChatEnabled: true,
  chatEnabled: true,
  leaderboardEnabled: true,
  achievementsEnabled: true,
  replayEnabled: true,
  analyticsEnabled: true,
  spectatorEnabled: true,
  gameUpdatesEnabled: true,
};

let memoryControls: PlatformControls = { ...DEFAULT_CONTROLS };

function normalizeControls(partial: Partial<PlatformControls> | null | undefined): PlatformControls {
  return {
    voiceChatEnabled: partial?.voiceChatEnabled ?? DEFAULT_CONTROLS.voiceChatEnabled,
    chatEnabled: partial?.chatEnabled ?? DEFAULT_CONTROLS.chatEnabled,
    leaderboardEnabled: partial?.leaderboardEnabled ?? DEFAULT_CONTROLS.leaderboardEnabled,
    achievementsEnabled: partial?.achievementsEnabled ?? DEFAULT_CONTROLS.achievementsEnabled,
    replayEnabled: partial?.replayEnabled ?? DEFAULT_CONTROLS.replayEnabled,
    analyticsEnabled: partial?.analyticsEnabled ?? DEFAULT_CONTROLS.analyticsEnabled,
    spectatorEnabled: partial?.spectatorEnabled ?? DEFAULT_CONTROLS.spectatorEnabled,
    gameUpdatesEnabled: partial?.gameUpdatesEnabled ?? DEFAULT_CONTROLS.gameUpdatesEnabled,
  };
}

export async function loadPlatformControls(bucket?: R2Bucket): Promise<PlatformControls> {
  if (!bucket) {
    return memoryControls;
  }

  const object = await bucket.get(CONTROL_KEY);
  if (!object) {
    return memoryControls;
  }

  try {
    const raw = await object.text();
    const parsed = JSON.parse(raw) as Partial<PlatformControls>;
    memoryControls = normalizeControls(parsed);
    return memoryControls;
  } catch {
    return memoryControls;
  }
}

export async function savePlatformControls(
  bucket: R2Bucket | undefined,
  updates: Partial<PlatformControls>
): Promise<PlatformControls> {
  memoryControls = normalizeControls({ ...memoryControls, ...updates });

  if (bucket) {
    await bucket.put(CONTROL_KEY, JSON.stringify(memoryControls, null, 2), {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
      },
    });
  }

  return memoryControls;
}

export async function updateSingleControl(
  bucket: R2Bucket | undefined,
  controlName: keyof PlatformControls,
  enabled: boolean
): Promise<PlatformControls> {
  return savePlatformControls(bucket, { [controlName]: enabled } as Partial<PlatformControls>);
}

export function isRouteAllowed(routePath: string, controls: PlatformControls): boolean {
  if (routePath.startsWith('/api/chat')) {
    return controls.chatEnabled;
  }

  if (routePath.startsWith('/api/leaderboard')) {
    return controls.leaderboardEnabled;
  }

  if (routePath.startsWith('/api/achievements')) {
    return controls.achievementsEnabled;
  }

  if (routePath.startsWith('/api/replays')) {
    return controls.replayEnabled;
  }

  if (routePath.startsWith('/api/analytics')) {
    return controls.analyticsEnabled;
  }

  if (routePath.startsWith('/api/spectate')) {
    return controls.spectatorEnabled;
  }

  if (routePath.startsWith('/api/voice')) {
    return controls.voiceChatEnabled;
  }

  if (routePath.startsWith('/api/updates')) {
    return controls.gameUpdatesEnabled;
  }

  return true;
}

export function buildVoiceRoomBootstrap(
  roomId: string,
  controls: PlatformControls,
  env: PlatformBindings
): VoiceRoomBootstrap {
  return {
    provider: 'realtimekit',
    roomId,
    enabled: controls.voiceChatEnabled,
    joinMode: 'client-managed',
    appId: env.REALTIMEKIT_APP_ID ?? null,
    joinHint: env.REALTIMEKIT_APP_ID
      ? 'Create the room in RealtimeKit, then hand the room metadata to the client SDK.'
      : 'RealtimeKit is not configured for this environment.',
  };
}

export async function storeGameUpdateAsset(
  bucket: R2Bucket | undefined,
  input: GameUpdateAssetInput
): Promise<{ key: string; size: number; contentType: string }> {
  const key = `game-updates/${Date.now()}-${input.name}`;
  const contentType = input.contentType ?? 'application/json; charset=utf-8';
  const body = new TextEncoder().encode(input.content);

  if (bucket) {
    await bucket.put(key, body, {
      httpMetadata: {
        contentType,
      },
    });
  }

  return {
    key,
    size: body.byteLength,
    contentType,
  };
}

export function renderAdminPanelHtml(controls: PlatformControls): string {
  const rows = Object.entries(controls)
    .map(([name, enabled]) => {
      const safeName = name.replace(/Enabled$/, '');
      return `
        <tr>
          <td>${safeName}</td>
          <td>${enabled ? 'enabled' : 'disabled'}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PartyGame Admin</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1220;
        --panel: #101a2f;
        --text: #e5eefc;
        --muted: #93a4c3;
        --accent: #45d3a1;
        --border: rgba(255, 255, 255, 0.08);
      }
      body {
        margin: 0;
        font-family: Inter, Segoe UI, sans-serif;
        background: radial-gradient(circle at top, #15213a, var(--bg) 55%);
        color: var(--text);
      }
      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 40px 20px 56px;
      }
      .card {
        background: rgba(16, 26, 47, 0.92);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(12px);
      }
      h1, h2 { margin: 0 0 12px; }
      p { color: var(--muted); line-height: 1.6; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      td, th { padding: 12px 10px; border-bottom: 1px solid var(--border); text-align: left; }
      .badge { color: var(--accent); }
      code { background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>PartyGame Admin Panel</h1>
        <p>Use this panel to switch features on or off, manage voice chat bootstrap data, and store update artifacts in R2.</p>
        <p class="badge">RealtimeKit: enabled as a client-managed bootstrap target when configured</p>
        <table>
          <thead>
            <tr><th>Control</th><th>Status</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p>Protect the panel with <code>X-Admin-Token</code> and persist control state in the <code>CONTROLS_BUCKET</code> binding.</p>
      </section>
    </main>
  </body>
</html>`;
}
