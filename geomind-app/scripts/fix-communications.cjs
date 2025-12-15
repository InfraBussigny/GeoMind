const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'lib', 'components', 'CommunicationsPanel.svelte');

let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix import
content = content.replace(
  "const { Webview } = await import('@tauri-apps/api/webview');",
  "const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');"
);

// 2. Replace the webview creation logic
const oldCode = `const mainWindow = await getCurrentWindow();

      // Create webview as child of main window
      currentWebview = await Webview.create(mainWindow, \`webview-\${service.id}\`, {
        url: service.url,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      webviewReady = true;
      isLoading = false;

      // Setup resize observer to keep webview in sync
      setupResizeObserver();`;

const newCode = `const mainWindow = await getCurrentWindow();
      const mainPos = await mainWindow.outerPosition();

      // Calculate absolute screen position
      const absoluteX = mainPos.x + bounds.x;
      const absoluteY = mainPos.y + bounds.y;

      console.log('[Comm] Creating webview at:', absoluteX, absoluteY, bounds.width, bounds.height);

      // Create borderless webview window positioned to look integrated
      const webviewLabel = \`comm-\${service.id}-\${Date.now()}\`;
      currentWebview = new WebviewWindow(webviewLabel, {
        url: service.url,
        x: absoluteX,
        y: absoluteY,
        width: bounds.width,
        height: bounds.height,
        decorations: false,
        skipTaskbar: true,
        focus: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Handle webview creation events
      currentWebview.once('tauri://created', () => {
        console.log('[Comm] Webview created successfully');
        webviewReady = true;
        isLoading = false;
        setupResizeObserver();
      });

      currentWebview.once('tauri://error', (e) => {
        console.error('[Comm] Webview error:', e);
        isLoading = false;
        webviewReady = true;
      });`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  console.log('✓ Webview creation code replaced');
} else {
  console.log('✗ Old code pattern not found');
}

// 3. Fix setupResizeObserver to use absolute positions
const oldResizeCode = `await currentWebview.setPosition({ x: bounds.x, y: bounds.y });`;
const newResizeCode = `const mainWindow = await getCurrentWindow();
          const mainPos = await mainWindow.outerPosition();
          await currentWebview.setPosition({ x: mainPos.x + bounds.x, y: mainPos.y + bounds.y });`;

if (content.includes(oldResizeCode)) {
  content = content.replace(oldResizeCode, newResizeCode);
  console.log('✓ Resize observer code fixed');
} else {
  console.log('✗ Resize code pattern not found');
}

// 4. Add getCurrentWindow import to resize observer if needed
const oldResizeImport = `resizeObserver = new ResizeObserver(async () => {
      if (currentWebview && webviewContainer) {`;
const newResizeImport = `resizeObserver = new ResizeObserver(async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (currentWebview && webviewContainer) {`;

if (content.includes(oldResizeImport) && !content.includes("resizeObserver = new ResizeObserver(async () => {\n      const { getCurrentWindow }")) {
  content = content.replace(oldResizeImport, newResizeImport);
  console.log('✓ Added getCurrentWindow import to resize observer');
}

// 5. Remove calendar service (Outlook already has it)
const calendarService = `{
      id: 'calendar',
      name: 'Calendrier',
      icon: '📅',
      url: 'https://outlook.office.com/calendar/',
      color: '#0078d4',
      description: 'Calendrier Outlook'
    },`;

if (content.includes(calendarService)) {
  content = content.replace(calendarService, '');
  console.log('✓ Removed duplicate Calendar service');
}

fs.writeFileSync(filePath, content);
console.log('\n✅ CommunicationsPanel.svelte updated');
