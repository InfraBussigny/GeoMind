<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { notificationsStore } from '$lib/services/communications';

  // State
  let isTauri = $state(false);
  let webviewReady = $state(false);
  let isLoading = $state(false);
  let iframeError = $state(false);
  let currentWebview: any = null;
  let webviewContainer: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;

  // Time Pro URL - Configurable
  let timeProUrl = $state('');
  let showSettings = $state(false);
  let showPanel = $state(true);

  // Auto-pointage config
  interface AutoPointageConfig {
    enabled: boolean;
    schedules: Array<{
      id: string;
      time: string;
      type: 'in' | 'out';
      label: string;
      days: number[];
    }>;
  }

  let autoPointageConfig = $state<AutoPointageConfig>({ enabled: false, schedules: [] });
  let nextPointage = $state<{ time: string; type: string; label: string } | null>(null);
  let autoPointageIntervalId: ReturnType<typeof setInterval> | null = null;

  // New schedule form
  let newScheduleTime = $state('08:00');
  let newScheduleType = $state<'in' | 'out'>('in');
  let newScheduleLabel = $state('');
  let newScheduleDays = $state<number[]>([1, 2, 3, 4, 5]);

  // Timer state for re-pointage
  let rePointageTimer = $state<{ endTime: Date; minutes: number } | null>(null);
  let rePointageIntervalId: ReturnType<typeof setInterval> | null = null;
  let rePointageTimeLeft = $state('');
  let rePointageMinutes = $state(45);

  onMount(async () => {
    if (browser) {
      // Load Time Pro URL
      timeProUrl = localStorage.getItem('geomind_timepro_url') || '';

      // Check if Tauri
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = await getCurrentWindow();
        if (win) {
          isTauri = true;
        }
      } catch {
        isTauri = false;
      }

      // Load saved config from localStorage
      try {
        const saved = localStorage.getItem('geomind_autopointage');
        if (saved) {
          autoPointageConfig = JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Failed to load autopointage config:', e);
      }

      restoreRePointageTimer();
      requestNotificationPermission();
      if (autoPointageConfig.enabled) {
        startAutoPointageChecker();
      }

      // Load Time Pro if URL configured
      if (timeProUrl) {
        loadTimePro();
      }
    }
  });

  onDestroy(() => {
    stopRePointageTimer();
    stopAutoPointageChecker();
    destroyWebview();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  // Webview management
  async function destroyWebview() {
    if (currentWebview) {
      try {
        await currentWebview.close();
      } catch (e) {
        console.log('Error closing webview:', e);
      }
      currentWebview = null;
      webviewReady = false;
    }
  }

  function getContainerBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!webviewContainer) return null;
    const rect = webviewContainer.getBoundingClientRect();
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  async function loadTimePro() {
    if (!timeProUrl) {
      showSettings = true;
      return;
    }

    isLoading = true;
    iframeError = false;
    await destroyWebview();

    if (isTauri) {
      await createTauriWebview();
    } else {
      webviewReady = true;
      isLoading = false;
    }
  }

  async function createTauriWebview() {
    try {
      const { Webview } = await import('@tauri-apps/api/webview');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');

      const bounds = getContainerBounds();
      if (!bounds) {
        console.error('Could not get container bounds');
        isLoading = false;
        return;
      }

      const mainWindow = await getCurrentWindow();
      currentWebview = await Webview.create(mainWindow, 'webview-timepro', {
        url: timeProUrl,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      webviewReady = true;
      isLoading = false;
      setupResizeObserver();
    } catch (e) {
      console.error('Error creating Tauri webview:', e);
      isLoading = false;
      webviewReady = true;
    }
  }

  function setupResizeObserver() {
    if (resizeObserver) resizeObserver.disconnect();

    resizeObserver = new ResizeObserver(async () => {
      if (currentWebview && webviewContainer) {
        const bounds = getContainerBounds();
        if (bounds) {
          try {
            await currentWebview.setPosition({ x: bounds.x, y: bounds.y });
            await currentWebview.setSize({ width: bounds.width, height: bounds.height });
          } catch (e) {
            console.log('Error resizing webview:', e);
          }
        }
      }
    });

    resizeObserver.observe(webviewContainer);
  }

  function refreshWebview() {
    loadTimePro();
  }

  function openExternal() {
    if (timeProUrl) {
      window.open(timeProUrl, '_blank');
    }
  }

  // Open Time Pro - in Tauri, focus the webview; in browser, open external
  async function openTimeProWeb() {
    if (isTauri && currentWebview) {
      try {
        // Focus the main window and refresh webview if needed
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const mainWindow = await getCurrentWindow();
        await mainWindow.setFocus();
        // Optionally navigate to ensure we're on the right page
        await currentWebview.navigate(timeProUrl);
      } catch (e) {
        console.log('Error focusing webview:', e);
        openExternal();
      }
    } else {
      openExternal();
    }
  }

  function saveTimeProUrl() {
    if (browser && timeProUrl) {
      localStorage.setItem('geomind_timepro_url', timeProUrl);
      showSettings = false;
      loadTimePro();
    }
  }

  function handleIframeLoad() {
    isLoading = false;
    iframeError = false;
  }

  function handleIframeError() {
    isLoading = false;
    iframeError = true;
  }

  // Timer functions
  function startRePointageTimer(minutes?: number) {
    const mins = minutes ?? rePointageMinutes;
    const endTime = new Date(Date.now() + mins * 60 * 1000);
    rePointageTimer = { endTime, minutes: mins };

    localStorage.setItem('geomind_repointage_timer', JSON.stringify({ endTime: endTime.toISOString(), minutes: mins }));

    updateRePointageCountdown();

    if (rePointageIntervalId) clearInterval(rePointageIntervalId);

    rePointageIntervalId = setInterval(() => {
      updateRePointageCountdown();
    }, 1000);

    notificationsStore.add({
      type: 'timepro',
      title: 'Timer re-pointage demarr\u00e9',
      message: `Rappel dans ${mins} minutes pour re-pointer`
    });
  }

  function updateRePointageCountdown() {
    if (!rePointageTimer) {
      rePointageTimeLeft = '';
      return;
    }

    const now = Date.now();
    const remaining = rePointageTimer.endTime.getTime() - now;

    if (remaining <= 0) {
      rePointageTimeLeft = '00:00';
      stopRePointageTimer();
      triggerRePointageNotification();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    rePointageTimeLeft = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function stopRePointageTimer() {
    if (rePointageIntervalId) {
      clearInterval(rePointageIntervalId);
      rePointageIntervalId = null;
    }
    rePointageTimer = null;
    rePointageTimeLeft = '';
    localStorage.removeItem('geomind_repointage_timer');
  }

  function triggerRePointageNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Time Pro - Re-pointage', {
        body: 'Il est temps de re-pointer!',
        icon: '/favicon.png',
        requireInteraction: true
      });
    }

    notificationsStore.add({
      type: 'timepro',
      title: 'Re-pointage!',
      message: 'Il est temps de re-pointer dans Time Pro'
    });

    openTimeProWeb();
  }

  function restoreRePointageTimer() {
    const saved = localStorage.getItem('geomind_repointage_timer');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const endTime = new Date(data.endTime);
        if (endTime.getTime() > Date.now()) {
          rePointageTimer = { endTime, minutes: data.minutes };
          updateRePointageCountdown();
          rePointageIntervalId = setInterval(() => {
            updateRePointageCountdown();
          }, 1000);
        } else {
          localStorage.removeItem('geomind_repointage_timer');
        }
      } catch (e) {
        localStorage.removeItem('geomind_repointage_timer');
      }
    }
  }

  // Auto-pointage functions
  function saveAutoPointageConfig() {
    if (browser) {
      localStorage.setItem('geomind_autopointage', JSON.stringify(autoPointageConfig));
    }
  }

  function addScheduledPointage() {
    if (!newScheduleTime || newScheduleDays.length === 0) return;

    const newSchedule = {
      id: `schedule_${Date.now()}`,
      time: newScheduleTime,
      type: newScheduleType,
      label: newScheduleLabel || (newScheduleType === 'in' ? 'Entree' : 'Sortie'),
      days: [...newScheduleDays]
    };

    autoPointageConfig.schedules = [...autoPointageConfig.schedules, newSchedule];
    saveAutoPointageConfig();

    newScheduleTime = '08:00';
    newScheduleType = 'in';
    newScheduleLabel = '';
    newScheduleDays = [1, 2, 3, 4, 5];
  }

  function removeScheduledPointage(id: string) {
    autoPointageConfig.schedules = autoPointageConfig.schedules.filter(s => s.id !== id);
    saveAutoPointageConfig();
  }

  function toggleAutoPointage() {
    autoPointageConfig.enabled = !autoPointageConfig.enabled;
    saveAutoPointageConfig();

    if (autoPointageConfig.enabled) {
      startAutoPointageChecker();
    } else {
      stopAutoPointageChecker();
    }
  }

  function toggleScheduleDay(day: number) {
    if (newScheduleDays.includes(day)) {
      newScheduleDays = newScheduleDays.filter(d => d !== day);
    } else {
      newScheduleDays = [...newScheduleDays, day].sort();
    }
  }

  function startAutoPointageChecker() {
    if (autoPointageIntervalId) clearInterval(autoPointageIntervalId);

    autoPointageIntervalId = setInterval(() => {
      checkScheduledPointages();
    }, 60000);

    checkScheduledPointages();
    updateNextPointage();
  }

  function stopAutoPointageChecker() {
    if (autoPointageIntervalId) {
      clearInterval(autoPointageIntervalId);
      autoPointageIntervalId = null;
    }
    nextPointage = null;
  }

  function checkScheduledPointages() {
    if (!autoPointageConfig.enabled) return;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const schedule of autoPointageConfig.schedules) {
      if (schedule.days.includes(currentDay) && schedule.time === currentTime) {
        const notifiedKey = `geomind_pointage_notified_${schedule.id}_${now.toDateString()}`;
        if (!localStorage.getItem(notifiedKey)) {
          triggerScheduledPointage(schedule);
          localStorage.setItem(notifiedKey, 'true');
          setTimeout(() => localStorage.removeItem(notifiedKey), 24 * 60 * 60 * 1000);
        }
      }
    }

    updateNextPointage();
  }

  function triggerScheduledPointage(schedule: AutoPointageConfig['schedules'][0]) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Time Pro - ${schedule.label}`, {
        body: `C'est l'heure de pointer (${schedule.type === 'in' ? 'entree' : 'sortie'})`,
        icon: '/favicon.png',
        requireInteraction: true
      });
    }

    notificationsStore.add({
      type: 'timepro',
      title: `Pointage: ${schedule.label}`,
      message: `Heure de ${schedule.type === 'in' ? 'pointer' : 'depointer'} (${schedule.time})`
    });

    openTimeProWeb();
  }

  function updateNextPointage() {
    if (!autoPointageConfig.enabled || autoPointageConfig.schedules.length === 0) {
      nextPointage = null;
      return;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let closestSchedule: typeof autoPointageConfig.schedules[0] | null = null;
    let closestDiff = Infinity;
    let closestDayOffset = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDay + dayOffset) % 7;

      for (const schedule of autoPointageConfig.schedules) {
        if (schedule.days.includes(checkDay)) {
          const [hours, mins] = schedule.time.split(':').map(Number);
          const scheduleMinutes = hours * 60 + mins;

          if (dayOffset === 0 && scheduleMinutes <= currentMinutes) continue;

          const diff = dayOffset === 0
            ? scheduleMinutes - currentMinutes
            : (dayOffset * 24 * 60) + scheduleMinutes - currentMinutes;

          if (diff < closestDiff) {
            closestDiff = diff;
            closestSchedule = schedule;
            closestDayOffset = dayOffset;
          }
        }
      }
    }

    if (closestSchedule) {
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const nextDay = (currentDay + closestDayOffset) % 7;
      const prefix = closestDayOffset === 0 ? "Aujourd'hui" : (closestDayOffset === 1 ? 'Demain' : dayNames[nextDay]);

      nextPointage = {
        time: `${prefix} ${closestSchedule.time}`,
        type: closestSchedule.type === 'in' ? 'Entree' : 'Sortie',
        label: closestSchedule.label
      };
    } else {
      nextPointage = null;
    }
  }

  function getDayName(day: number): string {
    return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][day];
  }

  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
</script>

<div class="timepro-module">
  <!-- Collapsible Panel -->
  <div class="timepro-panel" class:collapsed={!showPanel}>
    <div class="panel-header">
      <h3>Pointage</h3>
      <button class="panel-toggle" onclick={() => showPanel = !showPanel} title={showPanel ? 'Reduire' : 'Agrandir'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if showPanel}
            <polyline points="15 18 9 12 15 6"/>
          {:else}
            <polyline points="9 18 15 12 9 6"/>
          {/if}
        </svg>
      </button>
    </div>

    {#if showPanel}
      <div class="panel-content">
        <!-- Timer Section -->
        <div class="panel-section">
          <h4>Timer Re-pointage</h4>
          {#if rePointageTimer}
            <div class="timer-active-compact">
              <span class="timer-countdown-compact">{rePointageTimeLeft}</span>
              <button class="timer-stop-compact" onclick={stopRePointageTimer} title="Annuler">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="6" width="12" height="12"/>
                </svg>
              </button>
            </div>
          {:else}
            <div class="timer-presets-compact">
              <button class="preset-compact" onclick={() => startRePointageTimer(30)}>30m</button>
              <button class="preset-compact" onclick={() => startRePointageTimer(45)}>45m</button>
              <button class="preset-compact" onclick={() => startRePointageTimer(60)}>1h</button>
            </div>
          {/if}
        </div>

        <!-- Schedules Section -->
        <div class="panel-section">
          <div class="section-title-row">
            <h4>Programmes</h4>
            <button
              class="toggle-auto-compact"
              class:active={autoPointageConfig.enabled}
              onclick={toggleAutoPointage}
            >
              {autoPointageConfig.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {#if nextPointage && autoPointageConfig.enabled}
            <div class="next-pointage-compact">
              <span>{nextPointage.label}</span>
              <span class="next-time">{nextPointage.time}</span>
            </div>
          {/if}

          {#if autoPointageConfig.schedules.length > 0}
            <div class="schedules-compact">
              {#each autoPointageConfig.schedules as schedule}
                <div class="schedule-compact" class:in={schedule.type === 'in'} class:out={schedule.type === 'out'}>
                  <span class="sched-time">{schedule.time}</span>
                  <span class="sched-label">{schedule.label}</span>
                  <button class="sched-del" onclick={() => removeScheduledPointage(schedule.id)}>x</button>
                </div>
              {/each}
            </div>
          {/if}

          <div class="add-schedule-compact">
            <input type="time" bind:value={newScheduleTime} class="time-compact" />
            <select bind:value={newScheduleType} class="type-compact">
              <option value="in">E</option>
              <option value="out">S</option>
            </select>
            <button class="add-compact" onclick={addScheduledPointage}>+</button>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="panel-section">
          <button class="quick-action" onclick={() => { showSettings = true; }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Configurer URL
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Main Content: Webview -->
  <div class="timepro-main">
    <!-- Toolbar -->
    <div class="timepro-toolbar">
      <div class="toolbar-left">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="toolbar-title">Time Pro</span>
        {#if isTauri}
          <span class="mode-badge desktop">Desktop</span>
        {:else}
          <span class="mode-badge web">Web</span>
        {/if}
      </div>
      <div class="toolbar-actions">
        <button class="tool-btn" onclick={refreshWebview} title="Rafraichir" disabled={!timeProUrl}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
        <button class="tool-btn" onclick={openExternal} title="Ouvrir externe" disabled={!timeProUrl}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
        <button class="tool-btn" onclick={() => showSettings = true} title="Parametres">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Webview Container -->
    <div class="webview-container" bind:this={webviewContainer}>
      {#if !timeProUrl}
        <div class="setup-required">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <h3>Configuration requise</h3>
          <p>Entrez l'URL de votre instance Time Pro pour l'integrer ici.</p>
          <button class="setup-btn" onclick={() => showSettings = true}>
            Configurer Time Pro
          </button>
        </div>
      {:else if isLoading}
        <div class="loading-overlay">
          <div class="spinner"></div>
          <p>Chargement de Time Pro...</p>
        </div>
      {:else if iframeError && !isTauri}
        <div class="error-overlay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Affichage bloque</h3>
          <p>Time Pro ne permet pas l'integration en mode navigateur.<br/>
             Utilisez l'application desktop pour une integration complete.</p>
          <button class="primary-btn" onclick={openExternal}>
            Ouvrir dans un nouvel onglet
          </button>
        </div>
      {:else if !isTauri && webviewReady}
        <!-- Notice about OAuth -->
        <div class="oauth-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>L'authentification Microsoft peut ne pas fonctionner ici.</span>
          <button class="notice-btn" onclick={openExternal}>Ouvrir dans un nouvel onglet</button>
        </div>
        <iframe
          src={timeProUrl}
          title="Time Pro"
          class="timepro-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
          onload={handleIframeLoad}
          onerror={handleIframeError}
        ></iframe>
      {:else if isTauri && webviewReady}
        <div class="webview-placeholder"></div>
      {/if}
    </div>
  </div>

  <!-- Settings Modal -->
  {#if showSettings}
    <div class="modal-overlay" onclick={() => showSettings = false}>
      <div class="modal-content" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Configuration Time Pro</h3>
          <button class="modal-close" onclick={() => showSettings = false}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <label class="field-label">
            URL Time Pro
            <input
              type="url"
              bind:value={timeProUrl}
              placeholder="https://timepro.votreentreprise.ch"
              class="field-input"
            />
          </label>
          <p class="field-help">L'URL complete de votre portail Time Pro (avec https://)</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" onclick={() => showSettings = false}>Annuler</button>
          <button class="btn-save" onclick={saveTimeProUrl} disabled={!timeProUrl}>Enregistrer</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .timepro-module {
    display: flex;
    height: 100%;
    background: var(--bg-primary);
    overflow: hidden;
  }

  /* === Panel === */
  .timepro-panel {
    width: 240px;
    min-width: 240px;
    display: flex;
    flex-direction: column;
    background: var(--noir-card, #161b22);
    border-right: 1px solid var(--border-color);
    transition: width 0.2s, min-width 0.2s;
  }

  .timepro-panel.collapsed {
    width: 48px;
    min-width: 48px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .timepro-panel.collapsed .panel-header h3 {
    display: none;
  }

  .panel-toggle {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .panel-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .panel-toggle svg {
    width: 16px;
    height: 16px;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .panel-section {
    margin-bottom: 16px;
  }

  .panel-section h4 {
    margin: 0 0 10px 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .section-title-row h4 {
    margin: 0;
  }

  /* Timer compact */
  .timer-active-compact {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid #00d4ff;
    border-radius: 6px;
  }

  .timer-countdown-compact {
    font-size: 24px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: #00d4ff;
  }

  .timer-stop-compact {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid #ff6464;
    border-radius: 4px;
    color: #ff6464;
    cursor: pointer;
  }

  .timer-stop-compact:hover {
    background: #ff6464;
    color: white;
  }

  .timer-stop-compact svg {
    width: 14px;
    height: 14px;
  }

  .timer-presets-compact {
    display: flex;
    gap: 6px;
  }

  .preset-compact {
    flex: 1;
    padding: 8px 4px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-compact:hover {
    border-color: #00d4ff;
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  /* Toggle button compact */
  .toggle-auto-compact {
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: var(--bg-tertiary);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-auto-compact.active {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
    color: #00d4ff;
  }

  /* Next pointage compact */
  .next-pointage-compact {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    background: rgba(0, 212, 255, 0.1);
    border-left: 3px solid #00d4ff;
    border-radius: 0 4px 4px 0;
    margin-bottom: 10px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .next-pointage-compact .next-time {
    font-weight: 600;
    color: #00d4ff;
  }

  /* Schedules compact */
  .schedules-compact {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }

  .schedule-compact {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    border-left: 3px solid var(--border-color);
    font-size: 12px;
  }

  .schedule-compact.in { border-left-color: #22c55e; }
  .schedule-compact.out { border-left-color: #f59e0b; }

  .sched-time {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-primary);
  }

  .sched-label {
    flex: 1;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sched-del {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;
  }

  .schedule-compact:hover .sched-del {
    opacity: 1;
  }

  .sched-del:hover {
    background: rgba(255, 100, 100, 0.2);
    color: #ff6464;
  }

  /* Add schedule compact */
  .add-schedule-compact {
    display: flex;
    gap: 4px;
  }

  .time-compact {
    flex: 1;
    padding: 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 11px;
    font-family: var(--font-mono);
  }

  .type-compact {
    width: 36px;
    padding: 6px 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 11px;
  }

  .add-compact {
    width: 28px;
    padding: 6px;
    background: var(--bg-tertiary);
    border: 1px dashed var(--border-color);
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-compact:hover {
    border-color: #00d4ff;
    color: #00d4ff;
    border-style: solid;
  }

  /* Quick action */
  .quick-action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-action:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(0, 255, 136, 0.05);
  }

  .quick-action svg {
    width: 14px;
    height: 14px;
  }

  /* === Main Content === */
  .timepro-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* Toolbar */
  .timepro-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--noir-surface, #0d1117);
    border-bottom: 1px solid var(--border-color);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toolbar-icon {
    width: 20px;
    height: 20px;
    color: #00d4ff;
  }

  .toolbar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .mode-badge {
    padding: 3px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-badge.desktop {
    background: rgba(0, 255, 136, 0.15);
    color: var(--primary);
    border: 1px solid var(--primary);
  }

  .mode-badge.web {
    background: rgba(255, 165, 0, 0.15);
    color: var(--warning);
    border: 1px solid var(--warning);
  }

  .toolbar-actions {
    display: flex;
    gap: 4px;
  }

  .tool-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tool-btn:hover:not(:disabled) {
    border-color: #00d4ff;
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  .tool-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .tool-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Webview container */
  .webview-container {
    flex: 1;
    position: relative;
    background: #fff;
    overflow: hidden;
  }

  .webview-placeholder {
    width: 100%;
    height: 100%;
  }

  .timepro-iframe {
    width: 100%;
    height: calc(100% - 36px);
    border: none;
  }

  .oauth-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: rgba(255, 165, 0, 0.1);
    border-bottom: 1px solid rgba(255, 165, 0, 0.3);
    font-size: 12px;
    color: var(--warning, #ffa500);
  }

  .oauth-notice svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .oauth-notice span {
    flex: 1;
  }

  .notice-btn {
    padding: 4px 12px;
    background: transparent;
    border: 1px solid var(--warning, #ffa500);
    border-radius: 4px;
    color: var(--warning, #ffa500);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .notice-btn:hover {
    background: rgba(255, 165, 0, 0.2);
  }

  /* States */
  .setup-required,
  .loading-overlay,
  .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--noir-profond, #010409);
    text-align: center;
    padding: 40px;
  }

  .setup-required svg,
  .error-overlay svg {
    width: 64px;
    height: 64px;
    color: #00d4ff;
    opacity: 0.6;
  }

  .error-overlay svg {
    color: var(--warning);
  }

  .setup-required h3,
  .error-overlay h3 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
  }

  .setup-required p,
  .error-overlay p {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
    max-width: 400px;
    line-height: 1.6;
  }

  .setup-btn,
  .primary-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .setup-btn:hover,
  .primary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 212, 255, 0.4);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: #00d4ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-overlay p {
    color: var(--text-muted);
    font-size: 14px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    width: 90%;
    max-width: 450px;
    background: var(--noir-card, #161b22);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .modal-close svg {
    width: 18px;
    height: 18px;
  }

  .modal-body {
    padding: 20px;
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .field-input {
    width: 100%;
    padding: 12px;
    background: var(--noir-surface, #0d1117);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    margin-top: 8px;
  }

  .field-input:focus {
    outline: none;
    border-color: #00d4ff;
  }

  .field-help {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);
  }

  .btn-cancel,
  .btn-save {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
  }

  .btn-save {
    background: #00d4ff;
    border: none;
    color: #000;
  }

  .btn-save:hover:not(:disabled) {
    background: #00b8db;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
