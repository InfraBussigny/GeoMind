<script lang="ts">
  import { currentModule } from '$lib/stores/app';
  import ChatModule from '$lib/components/Chat/ChatModule.svelte';
  import CanvasModule from '$lib/components/Canvas/CanvasModule.svelte';
  import EditorModule from '$lib/components/Editor/EditorModule.svelte';
  import DocGenModule from '$lib/components/DocGen/DocGenModule.svelte';
  import ConnectionsModule from '$lib/components/Connections/ConnectionsModule.svelte';
  import SettingsModule from '$lib/components/Settings/SettingsModule.svelte';
  // Nouveaux modules Phase 7-11
  import SchemaBrowser from '$lib/components/SchemaBrowser.svelte';
  import QueryBuilder from '$lib/components/QueryBuilder.svelte';
  import LayerPanel from '$lib/components/LayerPanel.svelte';
  import SSHTerminal from '$lib/components/SSHTerminal.svelte';
  import CommunicationsPanel from '$lib/components/CommunicationsPanel.svelte';
  import AISettingsPanel from '$lib/components/AISettingsPanel.svelte';
</script>

<div class="module-container">
  {#if $currentModule === 'chat'}
    <ChatModule />
  {:else if $currentModule === 'canvas'}
    <CanvasModule />
  {:else if $currentModule === 'editor'}
    <EditorModule />
  {:else if $currentModule === 'data'}
    <div class="split-view">
      <SchemaBrowser />
      <QueryBuilder />
    </div>
  {:else if $currentModule === 'carto'}
    <LayerPanel />
  {:else if $currentModule === 'ssh'}
    <SSHTerminal />
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

  .split-view {
    display: flex;
    height: 100%;
    gap: 1px;
    background: var(--border-color);
  }

  .split-view > :global(*) {
    flex: 1;
    background: var(--bg-primary);
    overflow: auto;
  }

  .split-view > :global(*:first-child) {
    max-width: 350px;
    min-width: 250px;
  }
</style>
