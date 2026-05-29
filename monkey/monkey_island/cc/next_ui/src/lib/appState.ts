import { getApiUrl } from './apiPort';

const STORAGE_KEYS = {
    CONFIG: 'monkey_config',
    SIMULATION: 'monkey_simulation',
    EVENTS: 'monkey_events',
    SETTINGS: 'monkey_settings',
    SCAN_RESULTS: 'monkey_scan_results',
    PROPAGATION_TREE: 'monkey_propagation_tree'
};

export interface MonkeyConfig {
    propagationDepth: number;
    tunnelTimeout: number;
    scanNetwork: boolean;
    enablePolymorphism: boolean;
    targetSubnets: string;
    blockedIPs: string;
    credentials: { username: string; password: string }[];
    scanPorts: number[];
    enableSSH: boolean;
    enableSMB: boolean;
    enableRDP: boolean;
}

export interface SimulationState {
    status: 'idle' | 'running' | 'stopped' | 'completed';
    startedAt: string | null;
    stoppedAt: string | null;
    machinesDiscovered: number;
    vulnerabilitiesFound: number;
    exploitsSuccessful: number;
    machinesScanned: number;
    machinesExploited: number;
    activeAgents: number;
    currentPhase: string;
    phases: {
        scanning: number;
        exploitation: number;
        postExploitation: number;
        reporting: number;
    };
}

export interface MonkeyEvent {
    id: string;
    timestamp: string;
    type: 'exploitation' | 'scan' | 'credentials' | 'propagation';
    severity: 'info' | 'warning' | 'success' | 'error';
    source: string;
    target: string;
    message: string;
}

export interface ScanResult {
    ip: string;
    alive: boolean;
    responseTime: number;
    hostname: string;
    discoveredAt: string;
    ports: { port: number; state: string; service: string }[];
    os?: string;
    vulnerabilities: string[];
    exploited: boolean;
    exploitMethod?: string;
    implanted: boolean;
    attackTechniques?: {
        id: string;
        name: string;
        tactic: string;
        success: boolean;
    }[];
    toolsUsed?: string[];
    postExploitData?: Record<string, string>;
}

export interface PropagationNode {
    id: string;
    ip: string;
    hostname: string;
    status: 'scanned' | 'exploited' | 'implanted' | 'failed';
    parent: string | null;
    depth: number;
    openPorts: { port: number; service: string }[];
    exploitUsed?: string;
    discoveredAt: string;
    os?: string;
    attackTechniques?: string[];
    toolsUsed?: string[];
    admin?: boolean;
}

export interface AppSettings {
    islandPort: string;
    logLevel: string;
    enableNotifications: boolean;
    enableTelemetry: boolean;
}

const DEFAULT_CONFIG: MonkeyConfig = {
    propagationDepth: 2,
    tunnelTimeout: 30,
    scanNetwork: true,
    enablePolymorphism: false,
    targetSubnets: '',
    blockedIPs: '',
    credentials: [],
    scanPorts: [
        21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1433,
        3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017
    ],
    enableSSH: true,
    enableSMB: true,
    enableRDP: true
};

const DEFAULT_SIMULATION: SimulationState = {
    status: 'idle',
    startedAt: null,
    stoppedAt: null,
    machinesDiscovered: 0,
    vulnerabilitiesFound: 0,
    exploitsSuccessful: 0,
    machinesScanned: 0,
    machinesExploited: 0,
    activeAgents: 0,
    currentPhase: '',
    phases: {
        scanning: 0,
        exploitation: 0,
        postExploitation: 0,
        reporting: 0
    }
};

const DEFAULT_SETTINGS: AppSettings = {
    islandPort: '5000',
    logLevel: 'INFO',
    enableNotifications: true,
    enableTelemetry: false
};

function safeGet<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return fallback;
        return JSON.parse(stored) as T;
    } catch {
        return fallback;
    }
}

function safeSet(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore storage errors
    }
}

export function getConfig(): MonkeyConfig {
    return safeGet(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
}

export function saveConfig(config: MonkeyConfig): void {
    safeSet(STORAGE_KEYS.CONFIG, config);
    addEvent({
        type: 'scan',
        severity: 'info',
        source: 'Island',
        target: 'Configuration',
        message: 'Agent configuration updated'
    });
}

export function resetConfig(): MonkeyConfig {
    safeSet(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    addEvent({
        type: 'scan',
        severity: 'info',
        source: 'Island',
        target: 'Configuration',
        message: 'Agent configuration reset to defaults'
    });
    return DEFAULT_CONFIG;
}

export function getSimulation(): SimulationState {
    return safeGet(STORAGE_KEYS.SIMULATION, DEFAULT_SIMULATION);
}

export function updateSimulation(
    partial: Partial<SimulationState>
): SimulationState {
    const sim = getSimulation();
    const updated = { ...sim, ...partial };
    safeSet(STORAGE_KEYS.SIMULATION, updated);
    return updated;
}

export function getScanResults(): ScanResult[] {
    return safeGet<ScanResult[]>(STORAGE_KEYS.SCAN_RESULTS, []);
}

export function saveScanResults(results: ScanResult[]): void {
    safeSet(STORAGE_KEYS.SCAN_RESULTS, results);
}

export function getPropagationTree(): PropagationNode[] {
    return safeGet<PropagationNode[]>(STORAGE_KEYS.PROPAGATION_TREE, []);
}

export function savePropagationTree(tree: PropagationNode[]): void {
    safeSet(STORAGE_KEYS.PROPAGATION_TREE, tree);
}

// Real simulation runner - calls actual API endpoints
export async function runRealSimulation(
    onProgress: (sim: SimulationState) => void
): Promise<void> {
    const config = getConfig();

    // Phase 1: Network Scanning
    let sim = updateSimulation({
        status: 'running',
        startedAt: new Date().toISOString(),
        stoppedAt: null,
        machinesDiscovered: 0,
        vulnerabilitiesFound: 0,
        exploitsSuccessful: 0,
        machinesScanned: 0,
        machinesExploited: 0,
        activeAgents: 1,
        currentPhase: 'Network Scanning',
        phases: {
            scanning: 10,
            exploitation: 0,
            postExploitation: 0,
            reporting: 0
        }
    });
    onProgress(sim);

    addEvent({
        type: 'scan',
        severity: 'info',
        source: 'Island',
        target: config.targetSubnets || 'Local Network',
        message: `Real network scan started. Ports: ${config.scanPorts.length}, Depth: ${config.propagationDepth}`
    });

    // Call real network scan API
    let hosts: ScanResult[] = [];
    try {
        const scanResp = await fetch(getApiUrl('/api/scan-network'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subnet: config.targetSubnets || undefined })
        });
        const scanData = await scanResp.json();

        hosts = (scanData.hosts || []).map(
            (h: {
                ip: string;
                alive: boolean;
                responseTime: number;
                hostname: string;
                discoveredAt: string;
            }) => ({
                ...h,
                ports: [],
                vulnerabilities: [],
                exploited: false,
                implanted: false
            })
        );

        sim = updateSimulation({
            machinesDiscovered: hosts.length,
            machinesScanned: hosts.length,
            phases: {
                scanning: 100,
                exploitation: 0,
                postExploitation: 0,
                reporting: 0
            },
            currentPhase: 'Port Scanning'
        });
        onProgress(sim);

        addEvent({
            type: 'scan',
            severity: 'success',
            source: 'Island',
            target: scanData.subnet || 'Local Network',
            message: `Network scan complete: ${hosts.length} live hosts discovered`
        });
    } catch (err) {
        addEvent({
            type: 'scan',
            severity: 'error',
            source: 'Island',
            target: 'Network',
            message: `Network scan failed: ${
                err instanceof Error ? err.message : 'Unknown error'
            }`
        });
    }

    // Check if simulation was stopped
    if (getSimulation().status !== 'running') return;

    // Phase 2: Port Scanning each host
    const propagationTree: PropagationNode[] = [];
    for (let i = 0; i < hosts.length; i++) {
        if (getSimulation().status !== 'running') return;

        const host = hosts[i];
        try {
            const portResp = await fetch(getApiUrl('/api/scan-ports'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host: host.ip, ports: config.scanPorts })
            });
            const portData = await portResp.json();
            host.ports = portData.ports || [];

            const openPorts = host.ports.filter((p) => p.state === 'open');
            const vulns: string[] = [];

            // Detect vulnerabilities based on open ports
            for (const p of openPorts) {
                if (p.port === 21) vulns.push('FTP service exposed');
                if (p.port === 22) vulns.push('SSH service available');
                if (p.port === 23) vulns.push('Telnet (unencrypted) exposed');
                if (p.port === 25) vulns.push('SMTP relay potentially open');
                if (p.port === 135 || p.port === 139)
                    vulns.push('Windows RPC/NetBIOS exposed');
                if (p.port === 445)
                    vulns.push('SMB service exposed (EternalBlue risk)');
                if (p.port === 3389) vulns.push('RDP exposed (BlueKeep risk)');
                if (p.port === 1433) vulns.push('MSSQL exposed');
                if (p.port === 3306) vulns.push('MySQL exposed');
                if (p.port === 5432) vulns.push('PostgreSQL exposed');
                if (p.port === 5900) vulns.push('VNC exposed (no encryption)');
                if (p.port === 6379)
                    vulns.push('Redis exposed (no auth default)');
                if (p.port === 27017)
                    vulns.push('MongoDB exposed (no auth default)');
                if (p.port === 8080 || p.port === 8443)
                    vulns.push('Web application on non-standard port');
            }
            host.vulnerabilities = vulns;

            // OS fingerprinting via API
            let detectedOS = openPorts.some(
                (p) => p.port === 445 || p.port === 3389 || p.port === 135
            )
                ? 'Windows'
                : openPorts.some((p) => p.port === 22)
                  ? 'Linux/Unix'
                  : 'Unknown';
            try {
                const osResp = await fetch(getApiUrl('/api/fingerprint-os'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        host: host.ip,
                        openPorts: openPorts.map((p) => ({
                            port: p.port,
                            service: p.service
                        }))
                    })
                });
                const osData = await osResp.json();
                if (osData.os && osData.os !== 'Unknown')
                    detectedOS = osData.os;
            } catch {
                // OS fingerprinting failed, use heuristic
            }
            host.os = detectedOS;

            // Add to propagation tree
            propagationTree.push({
                id: `node-${host.ip}`,
                ip: host.ip,
                hostname: host.hostname || host.ip,
                status: 'scanned',
                parent: null,
                depth: 0,
                openPorts: openPorts.map((p) => ({
                    port: p.port,
                    service: p.service
                })),
                discoveredAt: new Date().toISOString(),
                os: detectedOS
            });

            addEvent({
                type: 'scan',
                severity: openPorts.length > 0 ? 'warning' : 'info',
                source: 'Scanner',
                target: host.ip,
                message: `Port scan: ${openPorts.length} open ports found${
                    vulns.length > 0
                        ? `, ${vulns.length} potential vulnerabilities`
                        : ''
                }`
            });
        } catch {
            // Port scan failed for this host, continue
        }

        sim = updateSimulation({
            phases: {
                scanning: 100,
                exploitation: Math.round(((i + 1) / hosts.length) * 50),
                postExploitation: 0,
                reporting: 0
            },
            vulnerabilitiesFound: hosts.reduce(
                (sum, h) => sum + h.vulnerabilities.length,
                0
            ),
            currentPhase: `Port Scanning (${i + 1}/${hosts.length})`
        });
        onProgress(sim);
    }

    if (getSimulation().status !== 'running') return;

    // Phase 3: Auto-Exploitation (tries ALL methods: SSH, SMB, FTP, Telnet, Redis, MongoDB, MySQL, PostgreSQL, VNC + default creds)
    sim = updateSimulation({
        currentPhase: 'Auto-Exploitation',
        phases: {
            scanning: 100,
            exploitation: 50,
            postExploitation: 0,
            reporting: 0
        }
    });
    onProgress(sim);

    addEvent({
        type: 'exploitation',
        severity: 'warning',
        source: 'Exploiter',
        target: 'All Hosts',
        message: `Starting auto-exploitation against ${hosts.length} hosts with ${config.credentials.length} user credentials + 25 default credential pairs`
    });

    let exploitCount = 0;
    let implantCount = 0;
    for (let hi = 0; hi < hosts.length; hi++) {
        if (getSimulation().status !== 'running') return;

        const host = hosts[hi];
        const openPorts = host.ports.filter((p) => p.state === 'open');
        if (openPorts.length === 0) continue;

        addEvent({
            type: 'exploitation',
            severity: 'info',
            source: 'Exploiter',
            target: host.ip,
            message: `Auto-exploiting ${host.ip} (${
                openPorts.length
            } open ports: ${openPorts.map((p) => p.port).join(', ')})`
        });

        try {
            const resp = await fetch(getApiUrl('/api/auto-exploit'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: host.ip,
                    openPorts: openPorts.map((p) => ({
                        port: p.port,
                        service: p.service
                    })),
                    credentials: config.credentials
                })
            });
            const result = await resp.json();

            // Store ATT&CK mapping and tools used
            const techniques =
                result.attackMapping?.techniques?.map((t: string) => t) || [];
            const toolsUsed = result.toolsUsed || [];
            host.attackTechniques = techniques.map((t: string) => ({
                id: t,
                name: t,
                tactic: 'exploitation',
                success: result.success
            }));
            host.toolsUsed = toolsUsed;

            if (result.success) {
                host.exploited = true;
                host.exploitMethod = `${result.method} (${
                    result.username || 'no-auth'
                })${result.admin ? ' [ADMIN]' : ''}`;
                exploitCount++;

                const isImplant =
                    result.method === 'SSH' ||
                    result.method === 'Telnet' ||
                    result.method === 'Redis-NoAuth' ||
                    result.method === 'MongoDB-NoAuth' ||
                    result.method?.startsWith('Impacket-') ||
                    result.method?.startsWith('NetExec-');
                if (isImplant) {
                    host.implanted = true;
                    implantCount++;
                }

                const node = propagationTree.find((n) => n.ip === host.ip);
                if (node) {
                    node.status = isImplant ? 'implanted' : 'exploited';
                    node.exploitUsed = `${result.method}: ${
                        result.username || 'no-auth'
                    }`;
                    node.attackTechniques = techniques;
                    node.toolsUsed = toolsUsed;
                    node.admin = result.admin || false;
                }

                const toolInfo =
                    toolsUsed.length > 0
                        ? ` [Tools: ${toolsUsed.join(', ')}]`
                        : '';
                addEvent({
                    type: 'exploitation',
                    severity: 'success',
                    source: 'Exploiter',
                    target: host.ip,
                    message: `${result.method} exploitation successful${
                        result.username
                            ? ` (user: ${result.username})`
                            : ' (no-auth)'
                    }${result.admin ? ' [ADMIN ACCESS]' : ''}${
                        isImplant ? ' - Agent implanted!' : ''
                    }${toolInfo}`
                });

                // Log ATT&CK techniques used
                if (techniques.length > 0) {
                    addEvent({
                        type: 'exploitation',
                        severity: 'info',
                        source: 'ATT&CK',
                        target: host.ip,
                        message: `MITRE ATT&CK: ${techniques.join(', ')}`
                    });
                }
            } else {
                const node = propagationTree.find((n) => n.ip === host.ip);
                if (node) {
                    node.status = 'failed';
                    node.toolsUsed = toolsUsed;
                }
                const attemptCount = result.allResults?.length || 0;
                addEvent({
                    type: 'exploitation',
                    severity: 'info',
                    source: 'Exploiter',
                    target: host.ip,
                    message: `All ${attemptCount} exploitation attempts failed against ${
                        host.ip
                    }${
                        toolsUsed.length > 0
                            ? ` [Tools tried: ${toolsUsed.join(', ')}]`
                            : ''
                    }`
                });
            }
        } catch {
            const node = propagationTree.find((n) => n.ip === host.ip);
            if (node) node.status = 'failed';
        }

        sim = updateSimulation({
            exploitsSuccessful: exploitCount,
            machinesExploited: hosts.filter((h) => h.exploited).length,
            phases: {
                scanning: 100,
                exploitation: 50 + Math.round(((hi + 1) / hosts.length) * 50),
                postExploitation: 0,
                reporting: 0
            },
            currentPhase: `Auto-Exploitation (${hi + 1}/${hosts.length})`
        });
        onProgress(sim);

        savePropagationTree(propagationTree);
        saveScanResults(hosts);
    }

    sim = updateSimulation({
        exploitsSuccessful: exploitCount,
        machinesExploited: hosts.filter((h) => h.exploited).length,
        phases: {
            scanning: 100,
            exploitation: 100,
            postExploitation: 0,
            reporting: 0
        },
        currentPhase: 'Post-Exploitation'
    });
    onProgress(sim);

    if (getSimulation().status !== 'running') return;

    // Phase 4: Post-exploitation data collection
    sim = updateSimulation({
        currentPhase: 'Post-Exploitation Analysis',
        phases: {
            scanning: 100,
            exploitation: 100,
            postExploitation: 50,
            reporting: 0
        }
    });
    onProgress(sim);

    // Smart Post-Exploitation Agent: gathers intelligence + discovers new targets
    const exploitedHosts = hosts.filter((h) => h.exploited);
    for (let ei = 0; ei < exploitedHosts.length; ei++) {
        const host = exploitedHosts[ei];
        try {
            // Deploy smart monkey agent
            const resp = await fetch(getApiUrl('/api/post-exploit-agent'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: host.ip,
                    method: host.exploitMethod,
                    credentials: config.credentials?.find(
                        (c) => c.username && c.password
                    ) || { username: 'root', password: 'root' }
                })
            });
            const agentData = await resp.json();
            if (agentData.systemInfo?.os) host.os = agentData.systemInfo.os;

            addEvent({
                type: 'credentials',
                severity: 'warning',
                source: host.ip,
                target: 'Island',
                message: `Smart agent deployed: system info collected, ${
                    agentData.discoveredHosts?.length || 0
                } neighboring hosts discovered`
            });

            // If agent discovered new hosts, add them to scan results
            if (
                agentData.discoveredHosts &&
                agentData.discoveredHosts.length > 0
            ) {
                const existingIps = hosts.map((h) => h.ip);
                const newNeighbors = agentData.discoveredHosts.filter(
                    (ip: string) => !existingIps.includes(ip)
                );
                for (const neighborIp of newNeighbors.slice(0, 10)) {
                    propagationTree.push({
                        id: `node-${neighborIp}`,
                        ip: neighborIp,
                        hostname: neighborIp,
                        status: 'scanned',
                        parent: host.ip,
                        depth: 1,
                        openPorts: [],
                        discoveredAt: new Date().toISOString(),
                        os: 'Unknown'
                    });
                    addEvent({
                        type: 'scan',
                        severity: 'info',
                        source: host.ip,
                        target: neighborIp,
                        message: `Neighboring host discovered via post-exploitation agent on ${host.ip}`
                    });
                }
            }

            // Log sensitive files if found
            if (agentData.systemInfo?.sensitiveFiles) {
                addEvent({
                    type: 'credentials',
                    severity: 'warning',
                    source: host.ip,
                    target: 'Island',
                    message: `Sensitive files found: ${agentData.systemInfo.sensitiveFiles.substring(
                        0,
                        200
                    )}`
                });
            }

            // Update node in propagation tree with agent data
            const node = propagationTree.find((n) => n.ip === host.ip);
            if (node) {
                node.status = 'exploited';
                if (agentData.systemInfo?.os) node.os = agentData.systemInfo.os;
            }
        } catch {
            // Fallback to basic post-exploit
            try {
                const resp = await fetch(getApiUrl('/api/post-exploit'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        host: host.ip,
                        method: host.exploitMethod
                    })
                });
                const data = await resp.json();
                if (data.os) host.os = data.os;
            } catch {
                // Post-exploit data collection failed
            }
        }

        sim = updateSimulation({
            currentPhase: `Post-Exploitation Agent (${ei + 1}/${
                exploitedHosts.length
            })`,
            phases: {
                scanning: 100,
                exploitation: 100,
                postExploitation: Math.round(
                    ((ei + 1) / exploitedHosts.length) * 80
                ),
                reporting: 0
            }
        });
        onProgress(sim);
        savePropagationTree(propagationTree);
        saveScanResults(hosts);
    }

    sim = updateSimulation({
        phases: {
            scanning: 100,
            exploitation: 100,
            postExploitation: 100,
            reporting: 0
        },
        currentPhase: 'Generating Report'
    });
    onProgress(sim);

    if (getSimulation().status !== 'running') return;

    // Phase 5: Reporting
    sim = updateSimulation({
        phases: {
            scanning: 100,
            exploitation: 100,
            postExploitation: 100,
            reporting: 50
        },
        currentPhase: 'Generating Report'
    });
    onProgress(sim);

    // Save results
    saveScanResults(hosts);
    savePropagationTree(propagationTree);

    const totalVulns = hosts.reduce(
        (sum, h) => sum + h.vulnerabilities.length,
        0
    );
    sim = updateSimulation({
        status: 'completed',
        stoppedAt: new Date().toISOString(),
        activeAgents: 0,
        machinesDiscovered: hosts.length,
        machinesScanned: hosts.length,
        vulnerabilitiesFound: totalVulns,
        exploitsSuccessful: exploitCount,
        machinesExploited: hosts.filter((h) => h.exploited).length,
        currentPhase: 'Completed',
        phases: {
            scanning: 100,
            exploitation: 100,
            postExploitation: 100,
            reporting: 100
        }
    });
    onProgress(sim);

    addEvent({
        type: 'scan',
        severity: 'success',
        source: 'Island',
        target: 'All',
        message: `Scan completed: ${hosts.length} hosts, ${totalVulns} vulnerabilities, ${exploitCount} successful exploits, ${implantCount} implants`
    });
}

export function stopSimulation(): SimulationState {
    const sim = getSimulation();
    sim.status = 'stopped';
    sim.stoppedAt = new Date().toISOString();
    sim.activeAgents = 0;
    sim.currentPhase = 'Stopped';
    safeSet(STORAGE_KEYS.SIMULATION, sim);
    addEvent({
        type: 'scan',
        severity: 'warning',
        source: 'Island',
        target: 'All',
        message: 'Simulation stopped by user'
    });
    return sim;
}

export function clearSimulation(): SimulationState {
    safeSet(STORAGE_KEYS.SIMULATION, DEFAULT_SIMULATION);
    safeSet(STORAGE_KEYS.EVENTS, []);
    safeSet(STORAGE_KEYS.SCAN_RESULTS, []);
    safeSet(STORAGE_KEYS.PROPAGATION_TREE, []);
    return DEFAULT_SIMULATION;
}

export function getEvents(): MonkeyEvent[] {
    return safeGet<MonkeyEvent[]>(STORAGE_KEYS.EVENTS, []);
}

export function addEvent(
    partial: Omit<MonkeyEvent, 'id' | 'timestamp'>
): MonkeyEvent {
    const event: MonkeyEvent = {
        ...partial,
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString()
    };
    const events = getEvents();
    events.unshift(event);
    if (events.length > 500) events.length = 500;
    safeSet(STORAGE_KEYS.EVENTS, events);
    return event;
}

export function clearEvents(): void {
    safeSet(STORAGE_KEYS.EVENTS, []);
}

export function getSettings(): AppSettings {
    return safeGet(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(settings: AppSettings): void {
    safeSet(STORAGE_KEYS.SETTINGS, settings);
}

export function getSecurityScore(sim: SimulationState): string {
    if (sim.status === 'idle') return '--';
    if (sim.machinesDiscovered === 0) return '--';
    const exploitRate =
        sim.exploitsSuccessful / Math.max(1, sim.machinesDiscovered);
    const score = Math.max(0, Math.round(100 - exploitRate * 100));
    return `${score}%`;
}

export function exportConfigAsJSON(): string {
    const config = getConfig();
    const settings = getSettings();
    return JSON.stringify(
        {
            exportedAt: new Date().toISOString(),
            version: '2.5.0',
            configuration: config,
            settings: settings
        },
        null,
        2
    );
}

export function importConfigFromJSON(json: string): boolean {
    try {
        const data = JSON.parse(json);
        if (data.configuration) {
            saveConfig({ ...DEFAULT_CONFIG, ...data.configuration });
        }
        if (data.settings) {
            saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }
        return true;
    } catch {
        return false;
    }
}
