<script lang="ts">
  import { currentModule } from '$lib/stores/app';
  import ChatModule from '$lib/components/Chat/ChatModule.svelte';
  import CanvasModule from '$lib/components/Canvas/CanvasModule.svelte';
  import EditorModule from '$lib/components/Editor/EditorModule.svelte';
  import DocGenModule from '$lib/components/DocGen/DocGenModule.svelte';
  import ConnectionsModule from '$lib/components/Connections/ConnectionsModule.svelte';
  import SettingsModule from '$lib/components/Settings/SettingsModule.svelte';
</script>

<div class="module-container">
  {#if $currentModule === 'chat'}
    <ChatModule />
  {:else if $currentModule === 'canvas'}
    <CanvasModule />
  {:else if $currentModule === 'editor'}
    <EditorModule />
  {:else if $currentModule === 'docgen'}
    <DocGenModule />
  {:else if $currentModule === 'connections'}
    <ConnectionsModule />
  {:else if $currentModule === 'settings'}
    <SettingsModule />
  {/if}
</div>

<style>
  .module-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
