const STORAGE_KEYS = {
    CONFIG: 'monkey_config',
    SIMULATION: 'monkey_simulation',
    EVENTS: 'monkey_events',
    SETTINGS: 'monkey_settings'
};

export interface MonkeyConfig {
    propagationDepth: number;
    tunnelTimeout: number;
    scanNetwork: boolean;
    enablePolymorphism: boolean;
    targetSubnets: string;
    blockedIPs: string;
    credentials: { username: string; password: string }[];
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
    credentials: []
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

export function startSimulation(): SimulationState {
    const config = getConfig();
    const state: SimulationState = {
        status: 'running',
        startedAt: new Date().toISOString(),
        stoppedAt: null,
        machinesDiscovered: 0,
        vulnerabilitiesFound: 0,
        exploitsSuccessful: 0,
        machinesScanned: 0,
        machinesExploited: 0,
        activeAgents: 1,
        phases: {
            scanning: 0,
            exploitation: 0,
            postExploitation: 0,
            reporting: 0
        }
    };
    safeSet(STORAGE_KEYS.SIMULATION, state);
    addEvent({
        type: 'scan',
        severity: 'info',
        source: 'Island',
        target: config.targetSubnets || 'Local Network',
        message: `Simulation started with propagation depth ${config.propagationDepth}`
    });
    return state;
}

export function progressSimulation(): SimulationState {
    const sim = getSimulation();
    if (sim.status !== 'running') return sim;

    const elapsed = sim.startedAt
        ? (Date.now() - new Date(sim.startedAt).getTime()) / 1000
        : 0;

    if (elapsed < 5) {
        sim.phases.scanning = Math.min(100, elapsed * 20);
        sim.machinesScanned = Math.floor(elapsed * 2);
        sim.machinesDiscovered = Math.floor(elapsed * 1.5);
    } else if (elapsed < 12) {
        sim.phases.scanning = 100;
        sim.phases.exploitation = Math.min(100, (elapsed - 5) * 15);
        sim.machinesScanned = 10 + Math.floor((elapsed - 5) * 1);
        sim.machinesDiscovered = 7 + Math.floor((elapsed - 5) * 0.5);
        sim.vulnerabilitiesFound = Math.floor((elapsed - 5) * 1.2);
        sim.exploitsSuccessful = Math.floor((elapsed - 5) * 0.6);
        sim.machinesExploited = Math.floor((elapsed - 5) * 0.4);
        sim.activeAgents = 1 + Math.floor((elapsed - 5) * 0.3);
    } else if (elapsed < 18) {
        sim.phases.scanning = 100;
        sim.phases.exploitation = 100;
        sim.phases.postExploitation = Math.min(100, (elapsed - 12) * 17);
        sim.machinesScanned = 17;
        sim.machinesDiscovered = 12;
        sim.vulnerabilitiesFound = 8;
        sim.exploitsSuccessful = 5;
        sim.machinesExploited = 3;
        sim.activeAgents = 3;
    } else if (elapsed < 22) {
        sim.phases.scanning = 100;
        sim.phases.exploitation = 100;
        sim.phases.postExploitation = 100;
        sim.phases.reporting = Math.min(100, (elapsed - 18) * 25);
    } else {
        sim.status = 'completed';
        sim.stoppedAt = new Date().toISOString();
        sim.phases = {
            scanning: 100,
            exploitation: 100,
            postExploitation: 100,
            reporting: 100
        };
        sim.machinesScanned = 24;
        sim.machinesDiscovered = 15;
        sim.vulnerabilitiesFound = 12;
        sim.exploitsSuccessful = 7;
        sim.machinesExploited = 5;
        sim.activeAgents = 0;

        addEvent({
            type: 'scan',
            severity: 'success',
            source: 'Island',
            target: 'All',
            message:
                'Simulation completed successfully. 15 machines discovered, 12 vulnerabilities found.'
        });
    }

    safeSet(STORAGE_KEYS.SIMULATION, sim);
    return sim;
}

export function stopSimulation(): SimulationState {
    const sim = getSimulation();
    sim.status = 'stopped';
    sim.stoppedAt = new Date().toISOString();
    sim.activeAgents = 0;
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
            version: '2.3.0',
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
