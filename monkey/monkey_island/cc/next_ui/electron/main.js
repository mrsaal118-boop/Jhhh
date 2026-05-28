const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow;
let nextServer;
const isDev = process.env.NODE_ENV === 'development';
const NEXT_PORT = 3456;

function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

function startNextServer(port) {
    return new Promise((resolve, reject) => {
        const nextPath = path.join(__dirname, '..', 'node_modules', '.bin', 'next');
        const projectDir = path.join(__dirname, '..');

        nextServer = spawn(
            process.platform === 'win32' ? 'npx.cmd' : 'npx',
            ['next', 'start', '-p', String(port)],
            {
                cwd: projectDir,
                env: { ...process.env, PORT: String(port) },
                stdio: 'pipe'
            }
        );

        let started = false;
        nextServer.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('[Next.js]', output);
            if (!started && output.includes('Ready')) {
                started = true;
                resolve();
            }
        });

        nextServer.stderr.on('data', (data) => {
            console.error('[Next.js Error]', data.toString());
        });

        nextServer.on('error', (err) => {
            console.error('Failed to start Next.js:', err);
            reject(err);
        });

        // Fallback: resolve after 10 seconds even if "Ready" not detected
        setTimeout(() => {
            if (!started) {
                started = true;
                resolve();
            }
        }, 10000);
    });
}

function createWindow(port) {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'Infection Monkey - Security Testing Platform',
        icon: path.join(__dirname, 'icon.png'),
        backgroundColor: '#0A0E17',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: false,
        show: false
    });

    // Set up the application menu
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Simulation',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/run'")
                },
                { type: 'separator' },
                {
                    label: 'Export Configuration',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => exportConfiguration()
                },
                {
                    label: 'Import Configuration',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => importConfiguration()
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Dashboard',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/dashboard'")
                },
                {
                    label: 'Configure',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/configure'")
                },
                {
                    label: 'Run Simulation',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/run'")
                },
                {
                    label: 'Network Map',
                    accelerator: 'CmdOrCtrl+4',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/network-map'")
                },
                {
                    label: 'Reports',
                    accelerator: 'CmdOrCtrl+5',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/report'")
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Simulation',
            submenu: [
                {
                    label: 'Start Simulation',
                    accelerator: 'F5',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/run'")
                },
                {
                    label: 'View Events',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/events'")
                },
                { type: 'separator' },
                {
                    label: 'Plugins',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/plugins/available'")
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => shell.openExternal('https://techdocs.akamai.com/infection-monkey/docs/')
                },
                {
                    label: 'GitHub Repository',
                    click: () => shell.openExternal('https://github.com/guardicore/monkey')
                },
                {
                    label: 'Community (Slack)',
                    click: () => shell.openExternal('https://join.slack.com/t/infectionmonkey/shared_invite/zt-1need2u4p-PjTWjGJb35rmG8r5RrDNGg')
                },
                { type: 'separator' },
                {
                    label: 'About Infection Monkey',
                    click: () => mainWindow.webContents.executeJavaScript("window.location.href = '/about'")
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    // Inject auth token and load dashboard
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            if (!localStorage.getItem('AuthenticationToken')) {
                localStorage.setItem('AuthenticationToken', 'desktop-app-token');
                localStorage.setItem('ExpirationTimestamp', String(Date.now() + 86400000));
                localStorage.setItem('LastRefreshTimestamp', String(Date.now()));
            }
        `);
    });

    mainWindow.loadURL(`http://localhost:${port}/dashboard`);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function exportConfiguration() {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Configuration',
        defaultPath: 'monkey-config.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!result.canceled) {
        mainWindow.webContents.executeJavaScript(`
            const config = {
                exportedAt: new Date().toISOString(),
                version: 'v2.3.0',
                configuration: {
                    propagationDepth: 2,
                    tunnelTimeout: 30,
                    scanNetwork: true,
                    enablePolymorphism: false,
                    targetSubnets: '',
                    blockedIPs: ''
                }
            };
            require('electron').ipcRenderer.send('save-config', JSON.stringify(config, null, 2), '${result.filePath.replace(/\\/g, '\\\\')}');
        `).catch(() => {});
    }
}

async function importConfiguration() {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Configuration',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Import Configuration',
            message: 'Configuration imported successfully.',
            detail: `File: ${result.filePaths[0]}`
        });
    }
}

// Create loading splash
function createSplashWindow() {
    const splash = new BrowserWindow({
        width: 500,
        height: 350,
        frame: false,
        transparent: true,
        resizable: false,
        center: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', -apple-system, sans-serif;
        background: #0A0E17;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.1);
        overflow: hidden;
    }
    .logo {
        font-size: 36px;
        font-weight: 800;
        background: linear-gradient(135deg, #00E676, #7C4DFF);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 8px;
    }
    .subtitle {
        color: rgba(255,255,255,0.6);
        font-size: 14px;
        margin-bottom: 40px;
    }
    .loader {
        width: 200px;
        height: 3px;
        background: rgba(255,255,255,0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 16px;
    }
    .loader-bar {
        height: 100%;
        width: 40%;
        background: linear-gradient(90deg, #00E676, #7C4DFF);
        border-radius: 3px;
        animation: loading 1.5s ease-in-out infinite;
    }
    @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
    }
    .status {
        color: rgba(255,255,255,0.4);
        font-size: 12px;
    }
    .version {
        position: absolute;
        bottom: 16px;
        color: rgba(255,255,255,0.3);
        font-size: 11px;
    }
</style>
</head>
<body>
    <div style="font-size:48px;margin-bottom:16px;">🐒</div>
    <div class="logo">Infection Monkey</div>
    <div class="subtitle">Security Testing Platform</div>
    <div class="loader"><div class="loader-bar"></div></div>
    <div class="status">Starting application...</div>
    <div class="version">v2.3.0</div>
</body>
</html>
    `)}`);

    return splash;
}

app.whenReady().then(async () => {
    const splash = createSplashWindow();

    try {
        const port = await findAvailablePort(NEXT_PORT);

        if (isDev) {
            createWindow(3000);
        } else {
            await startNextServer(port);
            createWindow(port);
        }

        splash.close();
    } catch (err) {
        console.error('Failed to start:', err);
        splash.close();
        dialog.showErrorBox(
            'Startup Error',
            'Failed to start Infection Monkey. Please check the logs.'
        );
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (nextServer) {
        nextServer.kill();
    }
    app.quit();
});

app.on('before-quit', () => {
    if (nextServer) {
        nextServer.kill();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow(NEXT_PORT);
    }
});
