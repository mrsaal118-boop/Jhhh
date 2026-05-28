const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const net = require('net');
const os = require('os');
const crypto = require('crypto');

let mainWindow;
let httpServer;
const isDev = process.env.NODE_ENV === 'development';

// Handle NSIS installer events (install/uninstall/update) - quit immediately
if (process.platform === 'win32') {
    const cmd = process.argv[1];
    if (cmd === '--squirrel-install' || cmd === '--squirrel-updated' ||
        cmd === '--squirrel-uninstall' || cmd === '--squirrel-obsolete') {
        app.quit();
    }
}

// Enforce single instance - prevent app from opening multiple times
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Find an available port starting from the given one
function findAvailablePort(startPort) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

// Get app data directory for persistent storage
function getAppDataPath() {
    const appData = app.getPath('userData');
    if (!fs.existsSync(appData)) {
        fs.mkdirSync(appData, { recursive: true });
    }
    return appData;
}

function getUsersFilePath() {
    return path.join(getAppDataPath(), 'users.json');
}

function getUsers() {
    const filePath = getUsersFilePath();
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return {}; }
}

function saveUsers(users) {
    fs.writeFileSync(getUsersFilePath(), JSON.stringify(users, null, 2));
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// MIME types for static file serving
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain',
    '.map': 'application/json'
};

// Get the path to the static export directory
function getStaticDir() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'out');
    }
    return path.join(__dirname, '..', 'out');
}

// Combined server: API endpoints + static file serving
function createAppServer() {
    return http.createServer((req, res) => {
        const urlPath = req.url.split('?')[0];

        // Handle API requests
        if (urlPath.startsWith('/api/')) {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                res.setHeader('Content-Type', 'application/json');

                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    return res.end();
                }

                try {
                    handleApiRequest(urlPath, req.method, body, res);
                } catch (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        // Handle CORS preflight for any route
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.writeHead(200);
            return res.end();
        }

        // Serve static files from the Next.js export
        serveStaticFile(urlPath, res);
    });
}

function handleApiRequest(urlPath, method, body, res) {
    // Registration check
    if (urlPath === '/api/registration-status' && method === 'GET') {
        const users = getUsers();
        res.writeHead(200);
        return res.end(JSON.stringify({ registration_needed: Object.keys(users).length === 0 }));
    }

    // Register
    if (urlPath === '/api/register' && method === 'POST') {
        const data = JSON.parse(body);
        const users = getUsers();
        if (users[data.username]) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: 'User already exists' }));
        }
        users[data.username] = {
            password: hashPassword(data.password),
            createdAt: new Date().toISOString()
        };
        saveUsers(users);
        const token = crypto.randomBytes(32).toString('hex');
        res.writeHead(200);
        return res.end(JSON.stringify({
            user: { name: data.username },
            token: token,
            token_expiration_time: Date.now() + 86400000
        }));
    }

    // Login
    if (urlPath === '/api/login' && method === 'POST') {
        const data = JSON.parse(body);
        const users = getUsers();
        const user = users[data.username];
        if (!user || user.password !== hashPassword(data.password)) {
            res.writeHead(401);
            return res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
        const token = crypto.randomBytes(32).toString('hex');
        res.writeHead(200);
        return res.end(JSON.stringify({
            user: { name: data.username },
            token: token,
            token_expiration_time: Date.now() + 86400000
        }));
    }

    // Network scan (real ping sweep)
    if (urlPath === '/api/scan-network' && method === 'POST') {
        const data = JSON.parse(body);
        const subnet = data.subnet || getLocalSubnet();
        performNetworkScan(subnet, (results) => {
            res.writeHead(200);
            res.end(JSON.stringify({ hosts: results, subnet: subnet }));
        });
        return;
    }

    // Port scan (real)
    if (urlPath === '/api/scan-ports' && method === 'POST') {
        const data = JSON.parse(body);
        performPortScan(data.host, data.ports || [22, 80, 443, 445, 3389, 8080, 8443], (results) => {
            res.writeHead(200);
            res.end(JSON.stringify({ host: data.host, ports: results }));
        });
        return;
    }

    // Network info
    if (urlPath === '/api/network-info' && method === 'GET') {
        res.writeHead(200);
        return res.end(JSON.stringify(getNetworkInfo()));
    }

    // System info
    if (urlPath === '/api/system-info' && method === 'GET') {
        res.writeHead(200);
        return res.end(JSON.stringify({
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            networkInterfaces: getNetworkInfo().interfaces,
            version: '2.4.0'
        }));
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
}

function serveStaticFile(urlPath, res) {
    const staticDir = getStaticDir();

    // Try to find the file
    let filePath;
    const decodedPath = decodeURIComponent(urlPath);

    if (decodedPath === '/') {
        filePath = path.join(staticDir, 'index.html');
    } else {
        // First try exact file path
        filePath = path.join(staticDir, decodedPath);
    }

    // Security: prevent path traversal
    if (!filePath.startsWith(staticDir)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    // Try the exact path, then with index.html, then with .html
    const candidates = [
        filePath,
        path.join(filePath, 'index.html'),
        filePath + '.html',
        filePath.replace(/\/$/, '') + '/index.html'
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            const ext = path.extname(candidate).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.writeHead(200);
            const stream = fs.createReadStream(candidate);
            stream.pipe(res);
            return;
        }
    }

    // Fallback: serve index.html for client-side routing
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        fs.createReadStream(indexPath).pipe(res);
        return;
    }

    res.writeHead(404);
    res.end('Not found');
}

// Real network scanning functions
function getLocalSubnet() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                const parts = addr.address.split('.');
                return `${parts[0]}.${parts[1]}.${parts[2]}`;
            }
        }
    }
    return '192.168.1';
}

function getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const result = { interfaces: [], localIP: '', subnet: '' };
    for (const [name, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
            if (addr.family === 'IPv4') {
                result.interfaces.push({
                    name: name,
                    address: addr.address,
                    netmask: addr.netmask,
                    mac: addr.mac,
                    internal: addr.internal
                });
                if (!addr.internal) {
                    result.localIP = addr.address;
                    const parts = addr.address.split('.');
                    result.subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
                }
            }
        }
    }
    return result;
}

function performNetworkScan(subnet, callback) {
    const hosts = [];
    let pending = 0;
    const isWin = process.platform === 'win32';

    for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        pending++;

        const pingCmd = isWin
            ? `ping -n 1 -w 500 ${ip}`
            : `ping -c 1 -W 1 ${ip}`;

        exec(pingCmd, { timeout: 2000 }, (error, stdout) => {
            if (!error && stdout) {
                const isAlive = isWin
                    ? !stdout.includes('Request timed out') && !stdout.includes('Destination host unreachable')
                    : stdout.includes('1 received') || stdout.includes('1 packets received');
                if (isAlive) {
                    hosts.push({
                        ip: ip,
                        alive: true,
                        responseTime: extractPingTime(stdout),
                        hostname: '',
                        discoveredAt: new Date().toISOString()
                    });
                }
            }
            pending--;
            if (pending === 0) {
                hosts.sort((a, b) => {
                    const aParts = a.ip.split('.').map(Number);
                    const bParts = b.ip.split('.').map(Number);
                    return aParts[3] - bParts[3];
                });
                callback(hosts);
            }
        });
    }
}

function extractPingTime(output) {
    const match = output.match(/time[=<](\d+\.?\d*)\s*ms/i);
    return match ? parseFloat(match[1]) : 0;
}

function performPortScan(host, ports, callback) {
    const results = [];
    let pending = ports.length;

    const commonServices = {
        21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
        80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS',
        445: 'SMB', 993: 'IMAPS', 995: 'POP3S', 1433: 'MSSQL',
        3306: 'MySQL', 3389: 'RDP', 5432: 'PostgreSQL', 5900: 'VNC',
        6379: 'Redis', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 27017: 'MongoDB'
    };

    ports.forEach(port => {
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on('connect', () => {
            results.push({
                port: port,
                state: 'open',
                service: commonServices[port] || 'unknown'
            });
            socket.destroy();
            pending--;
            if (pending === 0) callback(results.sort((a, b) => a.port - b.port));
        });

        socket.on('timeout', () => {
            results.push({ port: port, state: 'filtered', service: commonServices[port] || 'unknown' });
            socket.destroy();
            pending--;
            if (pending === 0) callback(results.sort((a, b) => a.port - b.port));
        });

        socket.on('error', () => {
            results.push({ port: port, state: 'closed', service: commonServices[port] || 'unknown' });
            pending--;
            if (pending === 0) callback(results.sort((a, b) => a.port - b.port));
        });

        socket.connect(port, host);
    });
}

// No separate Next.js server needed - static files served by the combined app server

function createWindow(port) {
    const apiPort = port; // API and static files served on same port

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
                { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => navigateTo('/dashboard') },
                { label: 'Configure', accelerator: 'CmdOrCtrl+2', click: () => navigateTo('/configure') },
                { label: 'Run Simulation', accelerator: 'CmdOrCtrl+3', click: () => navigateTo('/run') },
                { label: 'Network Map', accelerator: 'CmdOrCtrl+4', click: () => navigateTo('/network-map') },
                { label: 'Reports', accelerator: 'CmdOrCtrl+5', click: () => navigateTo('/report') },
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
                { label: 'Start Simulation', accelerator: 'F5', click: () => navigateTo('/run') },
                { label: 'View Events', click: () => navigateTo('/events') },
                { type: 'separator' },
                { label: 'Plugins', click: () => navigateTo('/plugins/available') }
            ]
        },
        {
            label: 'Help',
            submenu: [
                { label: 'Documentation', click: () => shell.openExternal('https://techdocs.akamai.com/infection-monkey/docs/') },
                { label: 'GitHub Repository', click: () => shell.openExternal('https://github.com/guardicore/monkey') },
                { type: 'separator' },
                { label: 'About Infection Monkey', click: () => navigateTo('/about') }
            ]
        }
    ];

    function navigateTo(p) {
        mainWindow.webContents.executeJavaScript(`window.location.href = '${p}'`);
    }

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    // Inject desktop app configuration on page load
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            window.__MONKEY_DESKTOP__ = true;
            window.__MONKEY_API_PORT__ = ${apiPort};
        `).catch(() => {});
    });

    // Retry loading URL until the server is ready
    const loadWithRetry = (url, retries = 10) => {
        mainWindow.loadURL(url).catch((err) => {
            console.error(`Failed to load ${url}:`, err.message);
            if (retries > 0) {
                setTimeout(() => loadWithRetry(url, retries - 1), 2000);
            } else {
                // After all retries, show error page
                mainWindow.loadURL(`data:text/html,<html><body style="background:#0A0E17;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Startup Error</h1><p>Could not connect to internal server.</p><p>Please restart the application.</p></div></body></html>`);
            }
        });
    };

    loadWithRetry(`http://127.0.0.1:${port}`);

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
            (function() {
                const keys = ['monkey_config', 'monkey_simulation', 'monkey_events', 'monkey_settings'];
                const data = {};
                keys.forEach(k => {
                    try { data[k] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
                });
                return JSON.stringify(data, null, 2);
            })()
        `).then(json => {
            fs.writeFileSync(result.filePath, json);
        }).catch(() => {});
    }
}

async function importConfiguration() {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Configuration',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const content = fs.readFileSync(result.filePaths[0], 'utf8');
            const data = JSON.parse(content);
            mainWindow.webContents.executeJavaScript(`
                (function() {
                    const data = ${JSON.stringify(data)};
                    Object.entries(data).forEach(([k, v]) => {
                        if (v) localStorage.setItem(k, JSON.stringify(v));
                    });
                    window.location.reload();
                })()
            `);
        } catch (e) {
            dialog.showErrorBox('Import Error', 'Failed to import configuration file.');
        }
    }
}

function createSplashWindow() {
    const splash = new BrowserWindow({
        width: 500,
        height: 350,
        frame: false,
        transparent: true,
        resizable: false,
        center: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
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
    .subtitle { color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 40px; }
    .loader { width: 200px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 16px; }
    .loader-bar { height: 100%; width: 40%; background: linear-gradient(90deg, #00E676, #7C4DFF); border-radius: 3px; animation: loading 1.5s ease-in-out infinite; }
    @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
    .status { color: rgba(255,255,255,0.4); font-size: 12px; }
    .version { position: absolute; bottom: 16px; color: rgba(255,255,255,0.3); font-size: 11px; }
</style>
</head>
<body>
    <div style="font-size:48px;margin-bottom:16px;">&#x1F412;</div>
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

// IPC handlers
ipcMain.handle('get-network-info', () => getNetworkInfo());
ipcMain.handle('get-system-info', () => ({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime()
}));

app.whenReady().then(async () => {
    const splash = createSplashWindow();

    try {
        // Find an available port for the combined server (API + static files)
        const appPort = await findAvailablePort(17812);
        console.log(`Using port: ${appPort}`);
        console.log(`Static dir: ${getStaticDir()}`);
        console.log(`Static dir exists: ${fs.existsSync(getStaticDir())}`);

        // Start the combined server (serves both API and static files)
        const appServer = createAppServer();
        await new Promise((resolve, reject) => {
            appServer.on('error', (err) => {
                console.error('Server error:', err);
                reject(err);
            });
            appServer.listen(appPort, '127.0.0.1', () => {
                console.log(`App server running on port ${appPort}`);
                resolve();
            });
        });
        global.apiServer = appServer;

        createWindow(appPort);
        splash.close();
    } catch (err) {
        console.error('Failed to start:', err);
        splash.close();
        dialog.showErrorBox(
            'Startup Error',
            `Failed to start Infection Monkey.\n\nError: ${err.message}\n\nPlease try restarting the application.`
        );
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (global.apiServer) global.apiServer.close();
    app.quit();
});

app.on('before-quit', () => {
    if (global.apiServer) global.apiServer.close();
});
