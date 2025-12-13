<script lang="ts">
  import { currentModule } from '$lib/stores/app';
  import ChatModule from '$lib/components/Chat/ChatModule.svelte';
  import CanvasModule from '$lib/components/Canvas/CanvasModule.svelte';
  import CADModule from '$lib/components/CAD/CADModule.svelte';
  import EditorModule from '$lib/components/Editor/EditorModule.svelte';
  import DocGenModule from '$lib/components/DocGen/DocGenModule.svelte';
  import ConnectionsModule from '$lib/components/Connections/ConnectionsModule.svelte';
  import SettingsModule from '$lib/components/Settings/SettingsModule.svelte';
  import CommunicationsPanel from '$lib/components/CommunicationsPanel.svelte';
  import DatabasesModule from '$lib/components/Databases/DatabasesModule.svelte';
  import TimeProModule from '$lib/components/TimeProModule.svelte';
  import WIPModule from '$lib/components/WIPModule.svelte';
  import ConverterModule from '$lib/components/Converter/ConverterModule.svelte';
  import WakeLockModule from '$lib/components/WakeLock/WakeLockModule.svelte';
  import VpnModule from '$lib/components/VPN/VpnModule.svelte';
  import KDriveModule from '$lib/components/KDrive/KDriveModule.svelte';
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
  {:else if $currentModule === 'docgen'}
    <DocGenModule />
  {:else if $currentModule === 'connections'}
    <ConnectionsModule />
  {:else if $currentModule === 'settings'}
    <SettingsModule />
  {:else if $currentModule === 'wip'}
    <WIPModule />
  {:else if $currentModule === 'cad'}
    <CADModule />
  {:else if $currentModule === 'converter'}
    <ConverterModule />
  {:else if $currentModule === 'wakelock'}
    <WakeLockModule />
  {:else if $currentModule === 'vpn'}
    <VpnModule />
  {:else if $currentModule === 'kdrive'}
    <KDriveModule />
  {/if}
</div>

<style>
  .module-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
