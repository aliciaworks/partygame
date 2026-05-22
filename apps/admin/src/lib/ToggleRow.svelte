<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let label: string;
  export let description: string;
  export let checked = false;
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: boolean }>();

  function onInput(e: Event) {
    const next = (e.currentTarget as HTMLInputElement).checked;
    dispatch("change", next);
  }
</script>

<div class="toggle-row">
  <div class="meta">
    <h3>{label}</h3>
    <p>{description}</p>
  </div>
  <label class="switch">
    <input type="checkbox" {checked} {disabled} on:change={onInput} />
    <span class="track"><span class="thumb"></span></span>
  </label>
</div>
