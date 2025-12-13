<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Ecran actif
  let activeScreen: 'menu' | 'windows-update' | 'bsod' | 'terminal' | 'chkdsk' | 'bios' | 'antivirus' | 'sfc' | 'dism' = $state('menu');

  // Windows Update
  let wuProgress = $state(0);
  let wuStage = $state(0);
  let wuStuck = $state(false);
  let wuRestarting = $state(false);
  const wuStages = [
    { text: "Telechargement des mises a jour", sub: "KB5034441 - Mise a jour cumulative pour Windows 11" },
    { text: "Telechargement des mises a jour", sub: "KB5034204 - Mise a jour de securite .NET Framework" },
    { text: "Preparation de l'installation", sub: "Verification de l'espace disque..." },
    { text: "Installation des mises a jour", sub: "KB5034441 - Mise a jour cumulative" },
    { text: "Installation des mises a jour", sub: "Configuration des composants Windows" },
    { text: "Finalisation", sub: "Nettoyage des fichiers temporaires" },
  ];

  // Terminal - historique unique
  let terminalLines: string[] = $state([]);
  let terminalInput = $state('');
  let cursorVisible = $state(true);
  let terminalCommandIndex = $state(0);
  let terminalBusy = $state(false);

  const terminalScenario = [
    { cmd: 'cd C:\\Projects\\GeoMind', output: [] },
    { cmd: 'git status', output: [
      'On branch feature/postgis-integration',
      'Your branch is up to date with \'origin/feature/postgis-integration\'.',
      '',
      'Changes not staged for commit:',
      '  (use "git add <file>..." to update what will be committed)',
      '',
      '        modified:   src/services/database.ts',
      '        modified:   src/components/MapViewer.svelte',
      '',
      'no changes added to commit (use "git add" and/or "git commit -a")'
    ]},
    { cmd: 'npm run build', output: [
      '',
      '> geomind@2.1.0 build',
      '> vite build',
      '',
      'vite v5.4.2 building for production...',
      'transforming (1) index.html',
      'transforming (47) src/main.ts',
      'transforming (156) src/App.svelte',
    ], slow: true, continueOutput: [
      'transforming (298) src/lib/utils.ts',
      'transforming (412) src/components/Map.svelte',
      'transforming (523) node_modules/.pnpm/...',
      'transforming (687) src/services/postgis.ts',
      '',
      'build completed in 12.4s',
      '',
      'dist/assets/index-Dk4x8fQ2.js    847.23 kB | gzip: 245.12 kB',
      'dist/assets/index-Bx9zL4Kw.css    52.18 kB | gzip: 11.24 kB',
      '',
      'built in 14.21s'
    ]},
    { cmd: 'npm run test', output: [
      '',
      '> geomind@2.1.0 test',
      '> vitest run',
      '',
      ' RUN  v1.6.0',
      '',
    ], slow: true, continueOutput: [
      ' PASS  src/utils/coordinates.test.ts (4 tests) 124ms',
      ' PASS  src/utils/validation.test.ts (12 tests) 89ms',
      ' PASS  src/services/database.test.ts (8 tests) 1.2s',
      ' PASS  src/components/Map.test.ts (6 tests) 892ms',
      '',
      ' Test Files  4 passed (4)',
      '      Tests  30 passed (30)',
      '   Start at  14:32:18',
      '   Duration  3.42s'
    ]},
    { cmd: 'docker compose up -d', output: [
      '[+] Running 4/4',
      ' - Network geomind_default      Created                               0.1s',
      ' - Container geomind-postgres   Started                               1.2s',
      ' - Container geomind-redis      Started                               1.1s',
      ' - Container geomind-api        Started                               2.3s',
    ]},
    { cmd: 'curl -s http://localhost:3001/api/health | jq', output: [
      '{',
      '  "status": "healthy",',
      '  "version": "2.1.0",',
      '  "database": "connected",',
      '  "uptime": "0d 0h 0m 12s"',
      '}'
    ]},
    { cmd: 'psql -h localhost -U geomind -d geomind_prod -c "SELECT count(*) FROM parcelles;"', output: [
      ' count ',
      '-------',
      ' 14523',
      '(1 row)'
    ]},
    { cmd: 'git add . && git commit -m "feat: add PostGIS layer synchronization"', output: [
      '[feature/postgis-integration 7a3b2c1] feat: add PostGIS layer synchronization',
      ' 2 files changed, 147 insertions(+), 23 deletions(-)'
    ]},
    { cmd: 'git push origin feature/postgis-integration', output: [
      'Enumerating objects: 9, done.',
      'Counting objects: 100% (9/9), done.',
      'Delta compression using up to 8 threads',
      'Compressing objects: 100% (5/5), done.',
      'Writing objects: 100% (5/5), 2.34 KiB | 2.34 MiB/s, done.',
      'Total 5 (delta 3), reused 0 (delta 0), pack-reused 0',
      'remote: Resolving deltas: 100% (3/3), completed with 3 local objects.',
      'To github.com:example-org/geomind.git',
      '   e8b4c92..7a3b2c1  feature/postgis-integration -> feature/postgis-integration'
    ]},
  ];

  // BSOD - QR code fixe
  let bsodProgress = $state(0);
  let bsodCode = $state('CRITICAL_PROCESS_DIED');
  const bsodCodes = ['CRITICAL_PROCESS_DIED', 'KERNEL_SECURITY_CHECK_FAILURE', 'SYSTEM_SERVICE_EXCEPTION', 'IRQL_NOT_LESS_OR_EQUAL', 'PAGE_FAULT_IN_NONPAGED_AREA'];
  let bsodQRPattern: boolean[][] = $state([]);

  // CHKDSK
  let chkdskStage = $state(0);
  let chkdskPercent = $state(0);
  let chkdskLines: string[] = $state([]);

  // BIOS
  let biosLines: string[] = $state([]);
  let biosComplete = $state(false);

  // Antivirus
  let avScanning = $state(true);
  let avProgress = $state(0);
  let avCurrentFile = $state('');
  let avFilesScanned = $state(0);
  let avThreatsFound = $state(0);

  // SFC (System File Checker)
  let sfcStage = $state(0);
  let sfcPercent = $state(0);
  let sfcLines: string[] = $state([]);

  // DISM (Deployment Image Servicing)
  let dismStage = $state(0);
  let dismPercent = $state(0);
  let dismLines: string[] = $state([]);

  let intervals: ReturnType<typeof setInterval>[] = [];

  // Générer un QR code fixe au démarrage
  function generateQRPattern(): boolean[][] {
    const pattern: boolean[][] = [];
    for (let i = 0; i < 21; i++) {
      const row: boolean[] = [];
      for (let j = 0; j < 21; j++) {
        // Corners (finder patterns)
        if ((i < 7 && j < 7) || (i < 7 && j > 13) || (i > 13 && j < 7)) {
          if (i === 0 || i === 6 || j === 0 || j === 6 || j === 14 || j === 20 || i === 14 || i === 20) {
            row.push(true);
          } else if (i >= 2 && i <= 4 && j >= 2 && j <= 4) {
            row.push(true);
          } else if (i >= 2 && i <= 4 && j >= 16 && j <= 18) {
            row.push(true);
          } else if (i >= 16 && i <= 18 && j >= 2 && j <= 4) {
            row.push(true);
          } else {
            row.push(false);
          }
        } else {
          row.push(Math.random() > 0.5);
        }
      }
      pattern.push(row);
    }
    return pattern;
  }

  function startWindowsUpdate() {
    activeScreen = 'windows-update';
    wuProgress = 0;
    wuStage = 0;
    wuStuck = false;
    wuRestarting = false;

    const interval = setInterval(() => {
      if (wuRestarting) return;

      // Parfois rester bloqué
      if (Math.random() < 0.03 && !wuStuck && wuProgress > 10 && wuProgress < 90) {
        wuStuck = true;
        setTimeout(() => { wuStuck = false; }, 5000 + Math.random() * 10000);
        return;
      }

      if (wuStuck) return;

      if (wuProgress < 100) {
        // Progression variable selon l'étape
        let increment = Math.random() * 0.8;
        if (wuProgress > 30 && wuProgress < 35) increment *= 0.3; // Ralentir
        if (wuProgress > 70 && wuProgress < 80) increment *= 0.2; // Très lent

        wuProgress = Math.min(100, wuProgress + increment);

        // Changer d'étape
        if (wuProgress > 15 && wuStage === 0) wuStage = 1;
        if (wuProgress > 25 && wuStage === 1) wuStage = 2;
        if (wuProgress > 40 && wuStage === 2) wuStage = 3;
        if (wuProgress > 75 && wuStage === 3) wuStage = 4;
        if (wuProgress > 95 && wuStage === 4) wuStage = 5;
      }

      if (wuProgress >= 100 && !wuRestarting) {
        wuRestarting = true;
      }
    }, 600);
    intervals.push(interval);
  }

  function startBSOD() {
    activeScreen = 'bsod';
    bsodProgress = 0;
    bsodCode = bsodCodes[Math.floor(Math.random() * bsodCodes.length)];
    bsodQRPattern = generateQRPattern();

    const interval = setInterval(() => {
      if (bsodProgress < 100) {
        // Progression très variable
        let inc = Math.random() * 2;
        if (bsodProgress > 20 && bsodProgress < 30) inc *= 0.1;
        if (bsodProgress > 85) inc *= 0.3;
        bsodProgress = Math.min(100, bsodProgress + inc);
      }
    }, 800);
    intervals.push(interval);
  }

  function startTerminal() {
    activeScreen = 'terminal';
    terminalLines = [
      'Microsoft Windows [Version 10.0.22631.4602]',
      '(c) Microsoft Corporation. Tous droits reserves.',
      ''
    ];
    terminalCommandIndex = 0;
    terminalBusy = false;

    const cursorInterval = setInterval(() => {
      cursorVisible = !cursorVisible;
    }, 530);
    intervals.push(cursorInterval);

    runTerminalScenario();
  }

  async function runTerminalScenario() {
    const basePrompt = 'C:\\Projects\\GeoMind>';
    let currentPath = 'C:\\Users\\Marc>';

    for (let i = 0; i < terminalScenario.length; i++) {
      if (activeScreen !== 'terminal') break;

      const step = terminalScenario[i];
      terminalBusy = true;

      // Pause avant de taper
      await sleep(1500 + Math.random() * 2000);
      if (activeScreen !== 'terminal') break;

      // Taper la commande caractère par caractère
      terminalInput = '';
      for (let c = 0; c < step.cmd.length; c++) {
        if (activeScreen !== 'terminal') break;
        terminalInput = step.cmd.substring(0, c + 1);
        await sleep(30 + Math.random() * 80);
      }

      await sleep(300);
      if (activeScreen !== 'terminal') break;

      // Exécuter
      if (step.cmd.startsWith('cd ')) {
        currentPath = step.cmd.substring(3) + '>';
      }

      terminalLines = [...terminalLines, currentPath + step.cmd];
      terminalInput = '';

      // Output ligne par ligne
      for (const line of step.output) {
        if (activeScreen !== 'terminal') break;
        await sleep(50 + Math.random() * 100);
        terminalLines = [...terminalLines, line];
      }

      // Output lent si spécifié
      if (step.slow && step.continueOutput) {
        await sleep(2000 + Math.random() * 3000);
        for (const line of step.continueOutput) {
          if (activeScreen !== 'terminal') break;
          await sleep(200 + Math.random() * 400);
          terminalLines = [...terminalLines, line];
        }
      }

      terminalLines = [...terminalLines, ''];

      // Garder un historique raisonnable
      if (terminalLines.length > 50) {
        terminalLines = terminalLines.slice(-40);
      }

      terminalBusy = false;
    }

    // Fin du scénario - prompt final
    if (activeScreen === 'terminal') {
      terminalLines = [...terminalLines, 'C:\\Projects\\GeoMind>'];
      // Attendre indéfiniment avec le curseur qui clignote
    }
  }

  function startChkdsk() {
    activeScreen = 'chkdsk';
    chkdskStage = 0;
    chkdskPercent = 0;
    chkdskLines = [
      'Le type du systeme de fichiers est NTFS.',
      'Le nom de volume est OS.',
      '',
      'CHKDSK verifie les fichiers (etape 1 sur 5)...',
    ];

    const interval = setInterval(() => {
      if (chkdskStage < 5) {
        chkdskPercent += Math.random() * 3;

        if (chkdskPercent >= 100) {
          chkdskPercent = 0;
          chkdskStage++;

          const stageMessages = [
            `  ${Math.floor(Math.random() * 50000 + 200000)} enregistrements de fichiers traites.`,
            'Verification des fichiers terminee.',
            '',
          ];

          if (chkdskStage < 5) {
            const stageNames = [
              'CHKDSK verifie les index (etape 2 sur 5)...',
              'CHKDSK verifie les descripteurs de securite (etape 3 sur 5)...',
              'CHKDSK verifie les donnees des fichiers (etape 4 sur 5)...',
              'CHKDSK verifie l\'espace libre (etape 5 sur 5)...',
            ];
            stageMessages.push(stageNames[chkdskStage - 1]);
          }

          chkdskLines = [...chkdskLines, ...stageMessages];
        }
      }
    }, 150);
    intervals.push(interval);
  }

  function startBios() {
    activeScreen = 'bios';
    biosComplete = false;
    biosLines = [];

    const lines = [
      'American Megatrends BIOS v2.21.1279',
      'Copyright (C) 2023 American Megatrends, Inc.',
      '',
      'BIOS Date: 11/15/2023  Ver: 2.21.1279',
      '',
      'CPU: Intel(R) Core(TM) i7-12700K @ 3.60GHz',
      'Speed: 3600 MHz    Count: 12',
      '',
      'Initializing USB Controllers .. Done.',
      'Total Memory: 32768 MB  OK',
      'Memory Frequency: 3200 MHz',
      '',
    ];

    let lineIndex = 0;
    const interval = setInterval(() => {
      if (lineIndex < lines.length) {
        biosLines = [...biosLines, lines[lineIndex]];
        lineIndex++;
      } else if (!biosComplete) {
        biosLines = [...biosLines,
          'Detecting SATA devices...',
          '  SATA Port 0: Samsung SSD 980 PRO 1TB',
          '  SATA Port 1: WDC WD40EZRZ-00GXCB0 4TB',
          '  SATA Port 2: None',
          '',
          'Detecting NVMe devices...',
          '  NVMe 0: Samsung 980 PRO 2TB',
          '',
          'Press DEL to enter SETUP, F12 for Boot Menu',
          '',
          'Booting from Samsung SSD 980 PRO...',
        ];
        biosComplete = true;
        clearInterval(interval);
      }
    }, 200);
    intervals.push(interval);
  }

  function startAntivirus() {
    activeScreen = 'antivirus';
    avScanning = true;
    avProgress = 0;
    avFilesScanned = 0;
    avThreatsFound = 0;

    const paths = [
      'C:\\Windows\\System32\\',
      'C:\\Windows\\SysWOW64\\',
      'C:\\Program Files\\',
      'C:\\Program Files (x86)\\',
      'C:\\Users\\Marc\\AppData\\',
      'C:\\Users\\Marc\\Documents\\',
      'C:\\Projects\\',
    ];

    const files = [
      'ntdll.dll', 'kernel32.dll', 'user32.dll', 'advapi32.dll', 'msvcrt.dll',
      'shell32.dll', 'ole32.dll', 'oleaut32.dll', 'gdi32.dll', 'comdlg32.dll',
      'chrome.exe', 'firefox.exe', 'code.exe', 'node.exe', 'python.exe',
      'settings.json', 'config.xml', 'database.db', 'cache.tmp', 'log.txt',
    ];

    const interval = setInterval(() => {
      if (avProgress < 100) {
        avProgress += Math.random() * 0.5;
        avFilesScanned += Math.floor(Math.random() * 50 + 10);
        avCurrentFile = paths[Math.floor(Math.random() * paths.length)] +
                        files[Math.floor(Math.random() * files.length)];
      } else {
        avScanning = false;
      }
    }, 100);
    intervals.push(interval);
  }

  function startSfc() {
    activeScreen = 'sfc';
    sfcStage = 0;
    sfcPercent = 0;
    sfcLines = [
      'Microsoft Windows [Version 10.0.22631.4602]',
      '(c) Microsoft Corporation. Tous droits reserves.',
      '',
      'C:\\Windows\\System32>sfc /scannow',
      '',
      'Debut de l\'analyse du systeme. Cette operation peut prendre du temps.',
      '',
      'Debut de la phase de verification de l\'analyse du systeme.',
    ];

    const interval = setInterval(() => {
      if (sfcStage === 0) {
        // Phase de vérification
        let inc = Math.random() * 1.2;
        if (sfcPercent > 40 && sfcPercent < 50) inc *= 0.3;
        if (sfcPercent > 85) inc *= 0.4;
        sfcPercent = Math.min(100, sfcPercent + inc);

        if (sfcPercent >= 100) {
          sfcStage = 1;
          sfcPercent = 0;
          sfcLines = [...sfcLines,
            'Verification 100% terminee.',
            '',
            'La protection des ressources Windows n\'a trouve aucune violation d\'integrite.',
            '',
            'C:\\Windows\\System32>_'
          ];
        }
      }
    }, 200);
    intervals.push(interval);
  }

  function startDism() {
    activeScreen = 'dism';
    dismStage = 0;
    dismPercent = 0;
    dismLines = [
      'Microsoft Windows [Version 10.0.22631.4602]',
      '(c) Microsoft Corporation. Tous droits reserves.',
      '',
      'C:\\Windows\\System32>DISM /Online /Cleanup-Image /RestoreHealth',
      '',
      'Outil Gestion et maintenance des images de deploiement',
      'Version : 10.0.22621.1',
      '',
      'Version de l\'image : 10.0.22631.4602',
      '',
    ];

    const stages = [
      { name: 'Analyse du magasin de composants', duration: 15 },
      { name: 'Verification de l\'integrite de l\'image', duration: 25 },
      { name: 'Verification de reparabilite de l\'image', duration: 20 },
      { name: 'Analyse du magasin de composants', duration: 20 },
      { name: 'Restauration de l\'image', duration: 20 },
    ];

    let currentStageProgress = 0;

    const interval = setInterval(() => {
      if (dismStage < stages.length) {
        let inc = Math.random() * 2;
        if (currentStageProgress > 50 && currentStageProgress < 60) inc *= 0.3;
        if (currentStageProgress > 90) inc *= 0.2;
        currentStageProgress = Math.min(100, currentStageProgress + inc);
        dismPercent = currentStageProgress;

        if (currentStageProgress >= 100) {
          dismStage++;
          currentStageProgress = 0;
          dismPercent = 0;

          if (dismStage >= stages.length) {
            dismLines = [...dismLines,
              '[==========================100.0%==========================]',
              '',
              'L\'operation de restauration a ete effectuee.',
              'L\'operation a reussi.',
              '',
              'C:\\Windows\\System32>_'
            ];
          }
        }
      }
    }, 180);
    intervals.push(interval);
  }

  function exitScreen() {
    intervals.forEach(i => clearInterval(i));
    intervals = [];
    activeScreen = 'menu';
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      exitScreen();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    intervals.forEach(i => clearInterval(i));
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if activeScreen === 'menu'}
  <div class="wip-menu">
    <div class="menu-header">
      <h1>Ecrans de couverture</h1>
      <p>Appuyez sur <kbd>Echap</kbd> pour revenir</p>
    </div>

    <div class="screen-grid">
      <button class="screen-card" onclick={startWindowsUpdate}>
        <div class="card-icon windows-icon"></div>
        <h3>Windows Update</h3>
        <p>Mise a jour Windows 11</p>
      </button>

      <button class="screen-card" onclick={startBSOD}>
        <div class="card-icon bsod-icon">:(</div>
        <h3>Ecran bleu</h3>
        <p>BSOD Windows</p>
      </button>

      <button class="screen-card" onclick={startTerminal}>
        <div class="card-icon terminal-icon">&gt;_</div>
        <h3>Terminal Dev</h3>
        <p>Build & Deploy</p>
      </button>

      <button class="screen-card" onclick={startChkdsk}>
        <div class="card-icon chkdsk-icon">C:\\</div>
        <h3>CHKDSK</h3>
        <p>Verification disque</p>
      </button>

      <button class="screen-card" onclick={startBios}>
        <div class="card-icon bios-icon">BIOS</div>
        <h3>Demarrage BIOS</h3>
        <p>POST & Boot</p>
      </button>

      <button class="screen-card" onclick={startAntivirus}>
        <div class="card-icon av-icon">🛡</div>
        <h3>Antivirus</h3>
        <p>Analyse systeme</p>
      </button>

      <button class="screen-card" onclick={startSfc}>
        <div class="card-icon sfc-icon">SFC</div>
        <h3>SFC /scannow</h3>
        <p>Verification fichiers systeme</p>
      </button>

      <button class="screen-card" onclick={startDism}>
        <div class="card-icon dism-icon">DISM</div>
        <h3>DISM Restore</h3>
        <p>Reparation image Windows</p>
      </button>
    </div>
  </div>

{:else if activeScreen === 'windows-update'}
  <div class="fullscreen wu-screen" onclick={exitScreen}>
    {#if wuRestarting}
      <div class="wu-restart">
        <div class="wu-spinner"></div>
        <p>Redemarrage en cours...</p>
      </div>
    {:else}
      <div class="wu-content">
        <div class="wu-spinner"></div>
        <div class="wu-info">
          <p class="wu-working">Preparation de Windows</p>
          <p class="wu-percent">{Math.floor(wuProgress)}%</p>
          <p class="wu-stage">{wuStages[wuStage].text}</p>
          <p class="wu-substage">{wuStages[wuStage].sub}</p>
          <p class="wu-warning">N'eteignez pas votre ordinateur</p>
        </div>
      </div>
    {/if}
  </div>

{:else if activeScreen === 'bsod'}
  <div class="fullscreen bsod-screen" onclick={exitScreen}>
    <div class="bsod-content">
      <div class="bsod-sad">:(</div>
      <p class="bsod-main">Votre PC a rencontre un probleme et doit redemarrer. Nous collectons simplement des informations relatives aux erreurs, puis nous redemarrerons l'ordinateur.</p>
      <p class="bsod-percent">{Math.floor(bsodProgress)}% termine</p>

      <div class="bsod-footer">
        <div class="bsod-qr">
          {#each bsodQRPattern as row}
            <div class="qr-row">
              {#each row as cell}
                <div class="qr-cell" class:filled={cell}></div>
              {/each}
            </div>
          {/each}
        </div>
        <div class="bsod-info">
          <p>Pour plus d'informations sur ce probleme et les</p>
          <p>solutions possibles, visitez</p>
          <p>https://www.windows.com/stopcode</p>
          <p class="bsod-code">Si vous contactez le support technique, communiquez-lui ces informations :</p>
          <p class="bsod-code">Code d'arret : {bsodCode}</p>
        </div>
      </div>
    </div>
  </div>

{:else if activeScreen === 'terminal'}
  <div class="fullscreen terminal-screen" onclick={exitScreen}>
    <div class="terminal-window">
      <div class="terminal-header">
        <div class="terminal-tabs">
          <span class="terminal-tab active">Invite de commandes</span>
        </div>
        <div class="terminal-controls">
          <span class="ctrl minimize">─</span>
          <span class="ctrl maximize">□</span>
          <span class="ctrl close">✕</span>
        </div>
      </div>
      <div class="terminal-body">
        {#each terminalLines as line}
          <pre class="terminal-line">{line}</pre>
        {/each}
        <pre class="terminal-input">{terminalInput}<span class="cursor" class:visible={cursorVisible && !terminalBusy}>█</span></pre>
      </div>
    </div>
  </div>

{:else if activeScreen === 'chkdsk'}
  <div class="fullscreen chkdsk-screen" onclick={exitScreen}>
    <div class="chkdsk-content">
      {#each chkdskLines as line}
        <pre>{line}</pre>
      {/each}
      {#if chkdskStage < 5}
        <pre>  {Math.floor(chkdskPercent)}% termine.</pre>
      {:else}
        <pre></pre>
        <pre>Windows a verifie le systeme de fichiers et n'a detecte aucun probleme.</pre>
        <pre>Aucune autre action n'est requise.</pre>
      {/if}
    </div>
  </div>

{:else if activeScreen === 'bios'}
  <div class="fullscreen bios-screen" onclick={exitScreen}>
    <div class="bios-content">
      {#each biosLines as line}
        <pre>{line}</pre>
      {/each}
      {#if !biosComplete}
        <pre class="bios-cursor">_</pre>
      {/if}
    </div>
  </div>

{:else if activeScreen === 'antivirus'}
  <div class="fullscreen av-screen" onclick={exitScreen}>
    <div class="av-window">
      <div class="av-header">
        <div class="av-logo">🛡️ Windows Security</div>
        <div class="av-controls">
          <span>─</span><span>□</span><span>✕</span>
        </div>
      </div>
      <div class="av-body">
        <h2>Analyse antivirus</h2>
        {#if avScanning}
          <div class="av-scanning">
            <div class="av-progress-bar">
              <div class="av-progress-fill" style="width: {avProgress}%"></div>
            </div>
            <p class="av-status">Analyse en cours...</p>
            <p class="av-file">{avCurrentFile}</p>
            <div class="av-stats">
              <span>Fichiers analyses : {avFilesScanned.toLocaleString()}</span>
              <span>Menaces detectees : {avThreatsFound}</span>
            </div>
          </div>
        {:else}
          <div class="av-complete">
            <div class="av-check">✓</div>
            <p>Analyse terminee</p>
            <p class="av-result">Aucune menace detectee</p>
            <p class="av-stats-final">{avFilesScanned.toLocaleString()} fichiers analyses</p>
          </div>
        {/if}
      </div>
    </div>
  </div>

{:else if activeScreen === 'sfc'}
  <div class="fullscreen sfc-screen" onclick={exitScreen}>
    <div class="cmd-window">
      <div class="cmd-header">
        <span>Administrateur : Invite de commandes</span>
        <div class="cmd-controls">
          <span>─</span><span>□</span><span>✕</span>
        </div>
      </div>
      <div class="cmd-body">
        {#each sfcLines as line}
          <pre>{line}</pre>
        {/each}
        {#if sfcStage === 0}
          <pre>Verification {Math.floor(sfcPercent)}% terminee.</pre>
        {/if}
      </div>
    </div>
  </div>

{:else if activeScreen === 'dism'}
  <div class="fullscreen dism-screen" onclick={exitScreen}>
    <div class="cmd-window">
      <div class="cmd-header">
        <span>Administrateur : Invite de commandes</span>
        <div class="cmd-controls">
          <span>─</span><span>□</span><span>✕</span>
        </div>
      </div>
      <div class="cmd-body">
        {#each dismLines as line}
          <pre>{line}</pre>
        {/each}
        {#if dismStage < 5}
          {@const stageNames = ['Analyse du magasin de composants', 'Verification de l\'integrite de l\'image', 'Verification de reparabilite de l\'image', 'Analyse du magasin de composants', 'Restauration de l\'image']}
          <pre>{stageNames[dismStage]}...</pre>
          <pre>[{'='.repeat(Math.floor(dismPercent / 4))}{' '.repeat(25 - Math.floor(dismPercent / 4))}{dismPercent.toFixed(1)}%{' '.repeat(25 - Math.floor(dismPercent / 4))}{'='.repeat(Math.floor(dismPercent / 4))}]</pre>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .wip-menu {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #0d1117;
    color: #e6edf3;
  }

  .menu-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .menu-header h1 {
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .menu-header p { color: #7d8590; }
  .menu-header kbd {
    background: #21262d;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #30363d;
    font-family: monospace;
  }

  .screen-grid {
    display: grid;
    grid-template-columns: repeat(4, 170px);
    gap: 1rem;
  }

  .screen-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 1.5rem 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .screen-card:hover {
    border-color: #58a6ff;
    transform: translateY(-2px);
  }

  .card-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    border-radius: 8px;
  }

  .windows-icon { background: linear-gradient(135deg, #00a4ef, #0078d4); }
  .bsod-icon { background: #0078d4; color: white; font-size: 2rem; }
  .terminal-icon { background: #1e1e1e; color: #0f0; font-family: monospace; font-size: 1.2rem; }
  .chkdsk-icon { background: #000; color: #ccc; font-family: monospace; font-size: 0.9rem; }
  .bios-icon { background: #000080; color: #ff0; font-family: monospace; font-size: 0.8rem; }
  .av-icon { background: linear-gradient(135deg, #0078d4, #00bcf2); font-size: 1.5rem; }
  .sfc-icon { background: #0c0c0c; color: #ccc; font-family: monospace; font-size: 0.7rem; font-weight: bold; }
  .dism-icon { background: #0c0c0c; color: #4ec9b0; font-family: monospace; font-size: 0.65rem; font-weight: bold; }

  .screen-card h3 { margin: 0 0 0.25rem; font-size: 0.95rem; font-weight: 600; }
  .screen-card p { margin: 0; font-size: 0.8rem; color: #7d8590; }

  .fullscreen {
    position: fixed;
    inset: 0;
    z-index: 99999;
    cursor: pointer;
  }

  /* Windows Update - style Windows 11 */
  .wu-screen {
    background: #0078d4;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wu-content, .wu-restart {
    text-align: center;
    color: white;
  }

  .wu-spinner {
    width: 60px;
    height: 60px;
    border: 3px solid rgba(255,255,255,0.2);
    border-top-color: white;
    border-radius: 50%;
    margin: 0 auto 2rem;
    animation: spin 1.2s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .wu-working { font-size: 2rem; font-weight: 300; margin-bottom: 1.5rem; }
  .wu-percent { font-size: 4rem; font-weight: 200; margin-bottom: 1rem; }
  .wu-stage { font-size: 1rem; opacity: 0.9; }
  .wu-substage { font-size: 0.85rem; opacity: 0.7; margin-top: 0.5rem; }
  .wu-warning { font-size: 0.9rem; opacity: 0.6; margin-top: 2rem; }

  /* BSOD */
  .bsod-screen {
    background: #0078d4;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8%;
  }

  .bsod-content { color: white; max-width: 900px; }
  .bsod-sad { font-size: 7rem; margin-bottom: 1rem; }
  .bsod-main { font-size: 1.4rem; line-height: 1.5; margin-bottom: 2rem; }
  .bsod-percent { font-size: 1.3rem; margin-bottom: 3rem; }

  .bsod-footer { display: flex; gap: 1.5rem; }

  .bsod-qr {
    width: 84px;
    min-width: 84px;
    height: 84px;
    background: white;
    padding: 4px;
    display: flex;
    flex-direction: column;
  }

  .qr-row { display: flex; flex: 1; }
  .qr-cell { flex: 1; background: white; }
  .qr-cell.filled { background: black; }

  .bsod-info { font-size: 0.75rem; line-height: 1.6; }
  .bsod-info p { margin: 0; }
  .bsod-code { margin-top: 0.5rem; }

  /* Terminal - style Windows Terminal */
  .terminal-screen {
    background: rgba(0,0,0,0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .terminal-window {
    width: 100%;
    max-width: 1100px;
    height: 85%;
    background: #0c0c0c;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 25px 80px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
  }

  .terminal-header {
    background: #1f1f1f;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333;
  }

  .terminal-tabs { display: flex; gap: 4px; }
  .terminal-tab {
    background: #0c0c0c;
    color: #ccc;
    padding: 6px 16px;
    font-size: 0.8rem;
    border-radius: 4px 4px 0 0;
  }

  .terminal-controls { display: flex; gap: 16px; }
  .terminal-controls span {
    color: #888;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .terminal-controls .close:hover { color: #ff5f56; }

  .terminal-body {
    flex: 1;
    padding: 12px;
    font-family: 'Cascadia Code', 'Consolas', monospace;
    font-size: 14px;
    color: #cccccc;
    overflow-y: auto;
    line-height: 1.4;
  }

  .terminal-line, .terminal-input {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .cursor { opacity: 0; }
  .cursor.visible { opacity: 1; }

  /* CHKDSK */
  .chkdsk-screen {
    background: #000;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 2rem;
  }

  .chkdsk-content {
    font-family: 'Consolas', monospace;
    font-size: 16px;
    color: #ccc;
    line-height: 1.5;
  }

  .chkdsk-content pre { margin: 0; }

  /* BIOS */
  .bios-screen {
    background: #000;
    padding: 1.5rem;
  }

  .bios-content {
    font-family: 'Perfect DOS VGA 437', 'Consolas', monospace;
    font-size: 16px;
    color: #aaa;
    line-height: 1.4;
  }

  .bios-content pre { margin: 0; }
  .bios-cursor { animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }

  /* Antivirus */
  .av-screen {
    background: rgba(0,0,0,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .av-window {
    width: 600px;
    background: #202020;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }

  .av-header {
    background: #1a1a1a;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333;
  }

  .av-logo { font-size: 0.9rem; color: white; }
  .av-controls { display: flex; gap: 12px; color: #888; font-size: 0.8rem; }

  .av-body {
    padding: 2rem;
    color: white;
  }

  .av-body h2 { margin: 0 0 1.5rem; font-weight: 400; font-size: 1.3rem; }

  .av-progress-bar {
    height: 4px;
    background: #333;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .av-progress-fill {
    height: 100%;
    background: #0078d4;
    transition: width 0.1s;
  }

  .av-status { margin: 0 0 0.5rem; font-size: 0.95rem; }
  .av-file {
    margin: 0;
    font-size: 0.8rem;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .av-stats {
    margin-top: 1.5rem;
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #aaa;
  }

  .av-complete { text-align: center; padding: 2rem 0; }
  .av-check {
    width: 60px;
    height: 60px;
    background: #107c10;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin: 0 auto 1rem;
  }
  .av-result { color: #6ccb5f; font-size: 1.1rem; margin: 0.5rem 0; }
  .av-stats-final { color: #888; font-size: 0.9rem; }

  /* SFC & DISM - style invite de commandes admin */
  .sfc-screen, .dism-screen {
    background: rgba(0,0,0,0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .cmd-window {
    width: 100%;
    max-width: 900px;
    height: 70%;
    background: #0c0c0c;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 25px 80px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
  }

  .cmd-header {
    background: #1f1f1f;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333;
    font-size: 0.85rem;
    color: #ccc;
  }

  .cmd-controls {
    display: flex;
    gap: 16px;
    color: #888;
    font-size: 0.9rem;
  }

  .cmd-body {
    flex: 1;
    padding: 12px;
    font-family: 'Consolas', 'Cascadia Code', monospace;
    font-size: 14px;
    color: #cccccc;
    overflow-y: auto;
    line-height: 1.4;
  }

  .cmd-body pre {
    margin: 0;
    white-space: pre-wrap;
  }
</style>
