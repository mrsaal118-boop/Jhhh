declare global {
    interface Window {
        __MONKEY_API_PORT__?: number;
    }
}

const DEFAULT_API_PORT = 17813;

export function getApiPort(): number {
    if (typeof window !== 'undefined' && window.__MONKEY_API_PORT__) {
        return window.__MONKEY_API_PORT__;
    }
    return DEFAULT_API_PORT;
}

export function getApiUrl(path: string): string {
    return `http://localhost:${getApiPort()}${path}`;
}
