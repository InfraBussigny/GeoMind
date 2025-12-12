<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { notificationsStore } from '$lib/services/communications';

  // Time Pro URL
  const timeProUrl = 'https://timepro.bussigny.ch/employee/dashboard';

  // Window state
  let timeProWebWindow: Window | null = null;
  let timeProWebOpen = $state(false);

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

  onMount(() => {
    if (browser) {
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
    }
  });

  onDestroy(() => {
    stopRePointageTimer();
    stopAutoPointageChecker();
  });

  // Open Time Pro Web
  async function openTimeProWeb() {
    if (timeProWebWindow && !timeProWebWindow.closed) {
      timeProWebWindow.focus();
      return;
    }

    if (browser) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        const existing = await WebviewWindow.getByLabel('timepro');
        if (existing) {
          await existing.setFocus();
          timeProWebOpen = true;
          return;
        }

        const webview = new WebviewWindow('timepro', {
          url: timeProUrl,
          title: 'Time Pro - Pointage',
          width: 1200,
          height: 800,
          center: true,
          resizable: true,
          decorations: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

        webview.once('tauri://created', () => {
          timeProWebOpen = true;
        });

        webview.once('tauri://error', () => {
          openTimeProWebFallback();
        });

        webview.once('tauri://close-requested', () => {
          timeProWebOpen = false;
        });

      } catch (e) {
        openTimeProWebFallback();
      }
    } else {
      openTimeProWebFallback();
    }
  }

  function openTimeProWebFallback() {
    const width = 1200;
    const height = 800;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    timeProWebWindow = window.open(
      timeProUrl,
      'TimeProWeb',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (timeProWebWindow) {
      timeProWebOpen = true;

      const checkWindow = setInterval(() => {
        if (timeProWebWindow?.closed) {
          timeProWebOpen = false;
          timeProWebWindow = null;
          clearInterval(checkWindow);
        }
      }, 1000);
    }
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
  <!-- Header with Time Pro Web button -->
  <div class="timepro-header">
    <h2>Time Pro - Pointage</h2>
    <button class="timepro-web-btn" onclick={openTimeProWeb}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      {timeProWebOpen ? 'Time Pro ouvert' : 'Ouvrir Time Pro'}
    </button>
  </div>

  <div class="timepro-content">
    <!-- Re-pointage Timer Section -->
    <div class="timepro-section">
      <h3>Timer Re-pointage</h3>
      <p class="section-desc">Demarrez un timer pour etre rappele de re-pointer apres une pause.</p>

      {#if rePointageTimer}
        <div class="timer-active">
          <div class="timer-display">
            <span class="timer-countdown">{rePointageTimeLeft}</span>
            <span class="timer-label">avant rappel</span>
          </div>
          <button class="timer-stop-btn" onclick={stopRePointageTimer}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="6" width="12" height="12"/>
            </svg>
            Annuler
          </button>
        </div>
      {:else}
        <div class="timer-setup">
          <div class="timer-input-group">
            <label>Minutes:</label>
            <input type="number" min="1" max="180" bind:value={rePointageMinutes} />
          </div>
          <div class="timer-presets">
            <button class="preset-btn" onclick={() => startRePointageTimer(30)}>30min</button>
            <button class="preset-btn" onclick={() => startRePointageTimer(45)}>45min</button>
            <button class="preset-btn" onclick={() => startRePointageTimer(60)}>1h</button>
            <button class="preset-btn" onclick={() => startRePointageTimer(90)}>1h30</button>
          </div>
          <button class="timer-start-btn" onclick={() => startRePointageTimer()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Demarrer ({rePointageMinutes}min)
          </button>
        </div>
      {/if}
    </div>

    <!-- Scheduled Pointages Section -->
    <div class="timepro-section">
      <div class="section-header">
        <h3>Pointages Programmes</h3>
        <button
          class="toggle-auto-btn"
          class:active={autoPointageConfig.enabled}
          onclick={toggleAutoPointage}
        >
          {autoPointageConfig.enabled ? 'Actif' : 'Inactif'}
        </button>
      </div>
      <p class="section-desc">Configurez des rappels automatiques pour vos pointages quotidiens.</p>

      {#if nextPointage && autoPointageConfig.enabled}
        <div class="next-pointage">
          <span class="next-label">Prochain pointage:</span>
          <span class="next-info">{nextPointage.label} - {nextPointage.time}</span>
        </div>
      {/if}

      <!-- Existing schedules -->
      {#if autoPointageConfig.schedules.length > 0}
        <div class="schedules-list">
          {#each autoPointageConfig.schedules as schedule}
            <div class="schedule-item" class:in={schedule.type === 'in'} class:out={schedule.type === 'out'}>
              <div class="schedule-info">
                <span class="schedule-time">{schedule.time}</span>
                <span class="schedule-label">{schedule.label}</span>
                <span class="schedule-days">
                  {schedule.days.map(d => getDayName(d)).join(', ')}
                </span>
              </div>
              <button class="schedule-delete" onclick={() => removeScheduledPointage(schedule.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Add new schedule -->
      <div class="add-schedule-form">
        <div class="schedule-form-row">
          <input type="time" bind:value={newScheduleTime} class="time-input" />
          <select bind:value={newScheduleType} class="type-select">
            <option value="in">Entree</option>
            <option value="out">Sortie</option>
          </select>
          <input type="text" placeholder="Label (optionnel)" bind:value={newScheduleLabel} class="label-input" />
        </div>
        <div class="days-selector">
          {#each [1, 2, 3, 4, 5, 6, 0] as day}
            <button
              class="day-btn"
              class:selected={newScheduleDays.includes(day)}
              onclick={() => toggleScheduleDay(day)}
            >
              {getDayName(day)}
            </button>
          {/each}
        </div>
        <button class="add-schedule-btn" onclick={addScheduledPointage} disabled={newScheduleDays.length === 0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter un pointage programme
        </button>
      </div>
    </div>

    <!-- Quick Examples -->
    <div class="timepro-section examples">
      <h3>Exemples typiques</h3>
      <div class="example-btns">
        <button class="example-btn" onclick={() => {
          newScheduleTime = '08:00'; newScheduleType = 'in'; newScheduleLabel = 'Matin'; newScheduleDays = [1,2,3,4,5];
          addScheduledPointage();
        }}>+ 08:00 Entree (Lun-Ven)</button>
        <button class="example-btn" onclick={() => {
          newScheduleTime = '12:00'; newScheduleType = 'out'; newScheduleLabel = 'Pause midi'; newScheduleDays = [1,2,3,4,5];
          addScheduledPointage();
        }}>+ 12:00 Sortie</button>
        <button class="example-btn" onclick={() => {
          newScheduleTime = '13:00'; newScheduleType = 'in'; newScheduleLabel = 'Retour midi'; newScheduleDays = [1,2,3,4,5];
          addScheduledPointage();
        }}>+ 13:00 Entree</button>
        <button class="example-btn" onclick={() => {
          newScheduleTime = '17:00'; newScheduleType = 'out'; newScheduleLabel = 'Fin journee'; newScheduleDays = [1,2,3,4,5];
          addScheduledPointage();
        }}>+ 17:00 Sortie</button>
      </div>
    </div>
  </div>
</div>

<style>
  .timepro-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .timepro-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .timepro-header h2 {
    margin: 0;
    font-size: 20px;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .timepro-header h2::before {
    content: '';
    width: 4px;
    height: 24px;
    background: linear-gradient(180deg, #00d4ff, #0099cc);
    border-radius: 2px;
  }

  .timepro-web-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 212, 255, 0.3);
  }

  .timepro-web-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 212, 255, 0.4);
  }

  .timepro-content {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  .timepro-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .timepro-section h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: var(--text-primary);
    font-weight: 600;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .section-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 16px 0;
  }

  .toggle-auto-btn {
    padding: 6px 14px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-auto-btn.active {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
    color: #00d4ff;
  }

  /* Timer styles */
  .timer-active {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid #00d4ff;
    border-radius: 8px;
    padding: 20px;
  }

  .timer-display {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .timer-countdown {
    font-size: 42px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: #00d4ff;
    text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
  }

  .timer-label {
    font-size: 13px;
    color: var(--text-muted);
  }

  .timer-stop-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    background: rgba(255, 100, 100, 0.2);
    border: 1px solid #ff6464;
    border-radius: 6px;
    color: #ff6464;
    cursor: pointer;
    transition: all 0.2s;
  }

  .timer-stop-btn:hover {
    background: #ff6464;
    color: white;
  }

  .timer-setup {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .timer-input-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .timer-input-group label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .timer-input-group input {
    width: 90px;
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 16px;
    text-align: center;
  }

  .timer-presets {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .preset-btn {
    padding: 10px 18px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    border-color: #00d4ff;
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  .timer-start-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 24px;
    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .timer-start-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 212, 255, 0.4);
  }

  /* Next pointage */
  .next-pointage {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: rgba(0, 212, 255, 0.1);
    border-left: 4px solid #00d4ff;
    border-radius: 0 8px 8px 0;
    margin-bottom: 16px;
  }

  .next-label {
    font-size: 13px;
    color: var(--text-muted);
  }

  .next-info {
    font-weight: 600;
    color: #00d4ff;
  }

  /* Schedules list */
  .schedules-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .schedule-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    border-left: 4px solid var(--border-color);
  }

  .schedule-item.in {
    border-left-color: #22c55e;
  }

  .schedule-item.out {
    border-left-color: #f59e0b;
  }

  .schedule-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .schedule-time {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary);
  }

  .schedule-label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .schedule-days {
    font-size: 12px;
    color: var(--text-muted);
    padding: 3px 10px;
    background: var(--bg-primary);
    border-radius: 4px;
  }

  .schedule-delete {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .schedule-delete:hover {
    background: rgba(255, 100, 100, 0.2);
    border-color: #ff6464;
    color: #ff6464;
  }

  /* Add schedule form */
  .add-schedule-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .schedule-form-row {
    display: flex;
    gap: 12px;
  }

  .time-input {
    width: 110px;
    padding: 12px 14px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .type-select {
    padding: 12px 14px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .label-input {
    flex: 1;
    padding: 12px 14px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .days-selector {
    display: flex;
    gap: 8px;
  }

  .day-btn {
    flex: 1;
    padding: 10px 6px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .day-btn:hover {
    border-color: #00d4ff;
    color: var(--text-primary);
  }

  .day-btn.selected {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
    color: #00d4ff;
    font-weight: 600;
  }

  .add-schedule-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 24px;
    background: var(--bg-tertiary);
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-schedule-btn:hover:not(:disabled) {
    border-style: solid;
    border-color: #00d4ff;
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  .add-schedule-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Examples section */
  .timepro-section.examples {
    background: transparent;
    border: none;
    padding: 0;
  }

  .example-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
  }

  .example-btn {
    padding: 10px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .example-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
</style>
