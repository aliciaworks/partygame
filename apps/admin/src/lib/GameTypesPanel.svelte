<script lang="ts">
  import { nanoid } from "nanoid";
  import ToggleRow from "./ToggleRow.svelte";
  import { translate } from "./i18n";
  import {
    FEATURE_META,
    applyGameType,
    saveGameType,
    removeGameType,
    type GameTypePreset,
    type PlatformFeatures,
  } from "./portal";
  import { backendUrl, busy, platformState, setError, setStatus } from "./portalStore";

  const featureKeys = Object.keys(FEATURE_META) as (keyof PlatformFeatures)[];

  let editing: GameTypePreset | null = null;
  let isNewPreset = false;
  let draft: GameTypePreset = emptyPreset();

  function emptyPreset(): GameTypePreset {
    return {
      id: `custom-${nanoid(6)}`,
      name: "",
      description: "",
      features: {
        voiceChat: true,
        textChat: true,
        gameUpdates: true,
        matchmaking: false,
      },
    };
  }

  async function onApply(id: string) {
    busy.set(true);
    try {
      platformState.set(await applyGameType($backendUrl, id));
      setStatus($translate("gameTypes.applied"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      busy.set(false);
    }
  }

  function startCreate() {
    isNewPreset = true;
    editing = emptyPreset();
    draft = emptyPreset();
  }

  function startEdit(preset: GameTypePreset) {
    isNewPreset = false;
    editing = preset;
    draft = { ...preset, features: { ...preset.features } };
  }

  function cancelEdit() {
    editing = null;
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      setError($translate("gameTypes.nameRequired"));
      return;
    }
    busy.set(true);
    try {
      platformState.set(await saveGameType($backendUrl, draft));
      editing = null;
      setStatus($translate("gameTypes.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      busy.set(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm($translate("gameTypes.confirmDelete"))) return;
    busy.set(true);
    try {
      platformState.set(await removeGameType($backendUrl, id));
      if (editing?.id === id) editing = null;
      setStatus($translate("gameTypes.deleted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      busy.set(false);
    }
  }
</script>

<section class="section panel">
  <div class="section-head">
    <div>
      <h2>{$translate("gameTypes.title")}</h2>
      <p>{$translate("gameTypes.adminOnly")}</p>
    </div>
    <button class="btn btn-primary" type="button" on:click={startCreate} disabled={$busy}>
      {$translate("gameTypes.create")}
    </button>
  </div>

  {#if $platformState}
    <div class="preset-list">
      {#each $platformState.gameTypes as preset}
        <article class="preset-card" class:active={$platformState.activeGameTypeId === preset.id}>
          <div class="preset-head">
            <div>
              <h3>{preset.name}</h3>
              <p class="mono">{preset.id}</p>
            </div>
            <div class="preset-actions">
              <button class="btn btn-primary" type="button" on:click={() => onApply(preset.id)} disabled={$busy}>
                {$translate("gameTypes.apply")}
              </button>
              <button class="btn" type="button" on:click={() => startEdit(preset)} disabled={$busy}>
                {$translate("gameTypes.edit")}
              </button>
              <button class="btn btn-danger" type="button" on:click={() => onDelete(preset.id)} disabled={$busy}>
                {$translate("gameTypes.delete")}
              </button>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if editing}
    <div class="editor stack">
      <div class="field">
        <label for="gt-id">ID</label>
        <input id="gt-id" bind:value={draft.id} readonly={!isNewPreset} />
      </div>
      <div class="field">
        <label for="gt-name">{$translate("gameTypes.name")}</label>
        <input id="gt-name" bind:value={draft.name} />
      </div>
      <div class="field">
        <label for="gt-desc">{$translate("gameTypes.description")}</label>
        <textarea id="gt-desc" rows="2" bind:value={draft.description}></textarea>
      </div>
      {#each featureKeys as key}
        <ToggleRow
          label={$translate(FEATURE_META[key].labelKey)}
          description={$translate(FEATURE_META[key].descKey)}
          checked={draft.features[key]}
          on:change={(e) => (draft.features[key] = e.detail)}
        />
      {/each}
      <div class="row">
        <button class="btn" type="button" on:click={cancelEdit}>{$translate("button.cancel")}</button>
        <button class="btn btn-primary" type="button" on:click={saveDraft} disabled={$busy}>
          {$translate("button.save")}
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  .section {
    padding: 20px;
    margin-top: 20px;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .section-head h2 {
    margin: 0 0 6px;
    font-size: 1.05rem;
  }

  .section-head p {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .preset-card {
    padding: 14px 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-soft);
  }

  .preset-card.active {
    outline: 2px solid var(--accent);
  }

  .preset-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .preset-head h3 {
    margin: 0 0 4px;
    font-size: 0.98rem;
  }

  .preset-head .mono {
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .preset-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .editor {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .row {
    display: flex;
    gap: 10px;
  }
</style>
