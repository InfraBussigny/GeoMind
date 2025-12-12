<script lang="ts">
  import { currentModule } from '$lib/stores/app';
  import ChatModule from '$lib/components/Chat/ChatModule.svelte';
  import CanvasModule from '$lib/components/Canvas/CanvasModule.svelte';
  import EditorModule from '$lib/components/Editor/EditorModule.svelte';
  import DocGenModule from '$lib/components/DocGen/DocGenModule.svelte';
  import ConnectionsModule from '$lib/components/Connections/ConnectionsModule.svelte';
  import SettingsModule from '$lib/components/Settings/SettingsModule.svelte';
  import CommunicationsPanel from '$lib/components/CommunicationsPanel.svelte';
  import AISettingsPanel from '$lib/components/AISettingsPanel.svelte';
  import DatabasesModule from '$lib/components/Databases/DatabasesModule.svelte';
  import TimeProModule from '$lib/components/TimeProModule.svelte';
</script>

<div class="module-container">
  {#if $currentModule === 'chat'}
    <ChatModule />
  {:else if $currentModule === 'canvas'}
    <CanvasModule />
  {:else if $currentModule === 'editor'}
    <EditorModule />
  {:else if $currentModule === 'databases'}
    <DatabasesModule />
  {:else if $currentModule === 'timepro'}
    <TimeProModule />
  {:else if $currentModule === 'comm'}
    <CommunicationsPanel />
  {:else if $currentModule === 'ai'}
    <AISettingsPanel />
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
