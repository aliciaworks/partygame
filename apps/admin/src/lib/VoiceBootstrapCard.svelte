<script lang="ts">
  import type { VoiceBootstrap, PortalSession } from '$lib/portal';

  export let voiceBootstrap: VoiceBootstrap | null = null;
  export let session: PortalSession | null = null;
</script>

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

<style>
  .card-block {
    padding: 20px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
    margin-bottom: 16px;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent);
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  h3 {
    font-size: 1.1rem;
    margin: 0;
  }

  .pill {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(124, 240, 255, 0.08);
    border: 1px solid rgba(124, 240, 255, 0.18);
    color: var(--text);
  }

  .pill.subtle {
    background: rgba(124, 240, 255, 0.08);
    color: var(--text);
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
    padding: 16px;
  }

  .empty-state strong {
    margin: 0;
  }

  .empty-state p {
    color: var(--muted);
    line-height: 1.6;
    margin: 0;
  }
</style>
