declare global {
    interface Window {
        __MONKEY_API_PORT__?: number;
    }
}

export function getApiPort(): number {
    if (typeof window !== 'undefined' && window.__MONKEY_API_PORT__) {
        return window.__MONKEY_API_PORT__;
    }
    // Same origin - API is on the same server as the page
    if (typeof window !== 'undefined' && window.location.port) {
        return parseInt(window.location.port, 10);
    }
    return 17812;
}

export function getApiUrl(path: string): string {
    return `http://127.0.0.1:${getApiPort()}${path}`;
}
