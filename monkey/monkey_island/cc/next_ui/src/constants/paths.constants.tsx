export enum PATHS {
    ABOUT = '/about',
    CONFIGURE = '/configure',
    DASHBOARD = '/dashboard',
    LOGIN = '/login',
    NETWORK_MAP = '/network-map',
    REGISTRATION = '/registration',
    REPORT = '/report',
    PLUGINS = '/plugins',
    ROOT = '/',
    RUN = '/run',
    SETTINGS = '/settings',
    EVENTS = '/events',
    PROPAGATION_TREE = '/propagation-tree',
    ATTACK_MATRIX = '/attack-matrix'
}

export const getApiPath = () => {
    if (typeof window !== 'undefined') {
        return location.protocol + '//' + location.host + '/api';
    }
};
