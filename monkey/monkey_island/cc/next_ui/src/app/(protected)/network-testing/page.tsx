'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DevicesIcon from '@mui/icons-material/Devices';
import RouterIcon from '@mui/icons-material/Router';
import VideocamIcon from '@mui/icons-material/Videocam';
import ComputerIcon from '@mui/icons-material/Computer';
import StorageIcon from '@mui/icons-material/Storage';
import PrintIcon from '@mui/icons-material/Print';
import DnsIcon from '@mui/icons-material/Dns';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import BugReportIcon from '@mui/icons-material/BugReport';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';

interface DiscoveredHost {
    ip: string;
    alive: boolean;
    openPorts: number[];
    os: string;
    deviceType: string;
    services: string[];
}

interface CredentialPair {
    username: string;
    password: string;
}

interface CredentialResult {
    host: string;
    port: number;
    service: string;
    success: boolean;
    username?: string;
    password?: string;
    method?: string;
    info?: string;
    attempts?: number;
}

interface PostExploitResult {
    host: string;
    systemInfo: Record<string, string>;
    networkInfo: Record<string, unknown>;
    discoveredHosts: string[];
    services: number[];
}

const deviceIcons: Record<string, React.ReactNode> = {
    Camera: <VideocamIcon />,
    Router: <RouterIcon />,
    'Windows PC': <ComputerIcon />,
    'Linux Server': <DnsIcon />,
    'Web Server': <DnsIcon />,
    'Database Server': <StorageIcon />,
    Printer: <PrintIcon />,
    'IoT Device': <DevicesIcon />,
    'Mail Server': <DnsIcon />,
    'Network Device': <RouterIcon />,
    Unknown: <DevicesIcon />
};

export default function NetworkTestingPage() {
    const [subnet, setSubnet] = useState('');
    const [detectedSubnets, setDetectedSubnets] = useState<string[]>([]);
    const [scanning, setScanning] = useState(false);
    const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
    const [credentials, setCredentials] = useState<CredentialPair[]>([
        { username: 'admin', password: 'admin' },
        { username: 'root', password: 'root' },
        { username: 'admin', password: 'password' },
        { username: 'admin', password: '123456' },
        { username: 'admin', password: '' }
    ]);
    const [newCred, setNewCred] = useState<CredentialPair>({
        username: '',
        password: ''
    });
    const [testingCredentials, setTestingCredentials] = useState(false);
    const [credResults, setCredResults] = useState<
        Record<string, CredentialResult>
    >({});
    const [postExploitRunning, setPostExploitRunning] = useState(false);
    const [postExploitResults, setPostExploitResults] =
        useState<PostExploitResult | null>(null);
    const [detailDialog, setDetailDialog] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const apiBase =
        typeof window !== 'undefined'
            ? location.protocol + '//' + location.host
            : '';

    // Detect local subnets on mount
    useEffect(() => {
        fetch(`${apiBase}/api/network-info`)
            .then((r) => r.json())
            .then((data) => {
                if (data.interfaces) {
                    const subnets: string[] = [];
                    data.interfaces.forEach(
                        (iface: { address: string; family: string }) => {
                            if (
                                iface.family === 'IPv4' &&
                                iface.address !== '127.0.0.1'
                            ) {
                                const parts = iface.address.split('.');
                                subnets.push(
                                    `${parts[0]}.${parts[1]}.${parts[2]}`
                                );
                            }
                        }
                    );
                    setDetectedSubnets([...new Set(subnets)]);
                    if (subnets.length > 0 && !subnet) setSubnet(subnets[0]);
                }
            })
            .catch(() => {});
    }, [apiBase]);

    const scanNetwork = useCallback(async () => {
        if (!subnet) return;
        setScanning(true);
        setHosts([]);
        setStatusMessage(`Scanning ${subnet}.0/24...`);
        setCredResults({});

        try {
            const resp = await fetch(`${apiBase}/api/scan-subnet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subnet, startIp: 1, endIp: 254 })
            });
            const data = await resp.json();
            setHosts(data.hosts || []);
            setStatusMessage(
                `Found ${data.hosts?.length || 0} hosts in ${subnet}.0/24`
            );
        } catch (err) {
            setStatusMessage(
                `Scan error: ${err instanceof Error ? err.message : 'Unknown'}`
            );
        }
        setScanning(false);
    }, [subnet, apiBase]);

    const testPasswordsOnHost = useCallback(
        async (host: DiscoveredHost) => {
            setTestingCredentials(true);
            setStatusMessage(`Testing credentials on ${host.ip}...`);

            const servicesToTest: { port: number; service: string }[] = [];
            host.openPorts.forEach((p) => {
                if (p === 22) servicesToTest.push({ port: 22, service: 'ssh' });
                if (p === 21) servicesToTest.push({ port: 21, service: 'ftp' });
                if (p === 445 || p === 139)
                    servicesToTest.push({ port: 445, service: 'smb' });
                if (p === 23)
                    servicesToTest.push({ port: 23, service: 'telnet' });
                if (p === 3306)
                    servicesToTest.push({ port: 3306, service: 'mysql' });
                if (p === 5432)
                    servicesToTest.push({
                        port: 5432,
                        service: 'postgresql'
                    });
                if (p === 3389)
                    servicesToTest.push({ port: 3389, service: 'rdp' });
            });

            if (servicesToTest.length === 0) {
                setStatusMessage(
                    `No testable services on ${host.ip} (no SSH/FTP/SMB/Telnet/MySQL/PostgreSQL ports open)`
                );
                setTestingCredentials(false);
                return;
            }

            for (const svc of servicesToTest) {
                try {
                    const resp = await fetch(
                        `${apiBase}/api/batch-test-credentials`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                host: host.ip,
                                port: svc.port,
                                service: svc.service,
                                credentials
                            })
                        }
                    );
                    const result = await resp.json();
                    setCredResults((prev) => ({
                        ...prev,
                        [`${host.ip}:${svc.port}`]: result
                    }));
                } catch {
                    setCredResults((prev) => ({
                        ...prev,
                        [`${host.ip}:${svc.port}`]: {
                            host: host.ip,
                            port: svc.port,
                            service: svc.service,
                            success: false,
                            info: 'Connection error'
                        }
                    }));
                }
            }

            setStatusMessage(`Credential testing complete for ${host.ip}`);
            setTestingCredentials(false);
        },
        [apiBase, credentials]
    );

    const testAllHosts = useCallback(async () => {
        setTestingCredentials(true);
        setStatusMessage('Testing credentials on all discovered hosts...');

        for (const host of hosts) {
            await testPasswordsOnHost(host);
        }

        setStatusMessage('Credential testing complete for all hosts');
        setTestingCredentials(false);
    }, [hosts, testPasswordsOnHost]);

    const runPostExploit = useCallback(
        async (host: DiscoveredHost) => {
            const key = Object.keys(credResults).find(
                (k) => k.startsWith(host.ip) && credResults[k].success
            );
            if (!key || !credResults[key]) {
                setStatusMessage(
                    `No valid credentials for ${host.ip}. Test passwords first.`
                );
                return;
            }
            const cred = credResults[key];
            setPostExploitRunning(true);
            setStatusMessage(
                `Running post-exploitation agent on ${host.ip}...`
            );

            try {
                const resp = await fetch(`${apiBase}/api/post-exploit-agent`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        host: host.ip,
                        method: cred.service === 'ssh' ? 'SSH' : 'SMB',
                        credentials: {
                            username: cred.username,
                            password: cred.password
                        }
                    })
                });
                const result = await resp.json();
                setPostExploitResults(result);
                setDetailDialog(true);
                setStatusMessage(
                    `Post-exploitation complete on ${host.ip}. Found ${
                        result.discoveredHosts?.length || 0
                    } new hosts.`
                );

                if (
                    result.discoveredHosts &&
                    result.discoveredHosts.length > 0
                ) {
                    const existingIps = hosts.map((h) => h.ip);
                    const newHosts = result.discoveredHosts.filter(
                        (ip: string) => !existingIps.includes(ip)
                    );
                    if (newHosts.length > 0) {
                        setStatusMessage(
                            (prev) =>
                                `${prev} Discovered ${newHosts.length} new neighboring hosts!`
                        );
                    }
                }
            } catch (err) {
                setStatusMessage(
                    `Post-exploit error: ${
                        err instanceof Error ? err.message : 'Unknown'
                    }`
                );
            }
            setPostExploitRunning(false);
        },
        [apiBase, credResults, hosts]
    );

    const addCredential = () => {
        if (newCred.username) {
            setCredentials((prev) => [...prev, { ...newCred }]);
            setNewCred({ username: '', password: '' });
        }
    };

    const removeCredential = (index: number) => {
        setCredentials((prev) => prev.filter((_, i) => i !== index));
    };

    const getCredResultForHost = (ip: string) => {
        return Object.entries(credResults)
            .filter(([key]) => key.startsWith(ip))
            .map(([, result]) => result);
    };

    const hasSuccessfulCred = (ip: string) => {
        return getCredResultForHost(ip).some((r) => r.success);
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <WifiTetheringIcon
                    sx={{ fontSize: 36, mr: 1.5, color: '#00e676' }}
                />
                <Box>
                    <Typography variant="h4" fontWeight={700}>
                        Network Testing
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Scan networks, test credentials, deploy
                        post-exploitation agent
                    </Typography>
                </Box>
            </Box>

            {statusMessage && (
                <Alert
                    severity={
                        statusMessage.includes('error')
                            ? 'error'
                            : statusMessage.includes('complete') ||
                                statusMessage.includes('Found')
                              ? 'success'
                              : 'info'
                    }
                    sx={{ mb: 2 }}
                    onClose={() => setStatusMessage('')}>
                    {statusMessage}
                </Alert>
            )}

            {/* Step 1: Network Selection & Scan */}
            <Card
                sx={{
                    mb: 3,
                    background:
                        'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    border: '1px solid rgba(0,230,118,0.2)'
                }}>
                <CardContent>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}>
                        <SearchIcon sx={{ color: '#00e676' }} />
                        Step 1: Select Network & Scan
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Network Subnet</InputLabel>
                                <Select
                                    value={subnet}
                                    label="Network Subnet"
                                    onChange={(e) => setSubnet(e.target.value)}>
                                    {detectedSubnets.map((s) => (
                                        <MenuItem key={s} value={s}>
                                            {s}.0/24 (Detected)
                                        </MenuItem>
                                    ))}
                                    <MenuItem value="custom">
                                        Custom...
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        {subnet === 'custom' && (
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Custom Subnet (e.g., 10.0.0)"
                                    placeholder="192.168.1"
                                    onChange={(e) => setSubnet(e.target.value)}
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} md={4}>
                            <Button
                                variant="contained"
                                onClick={scanNetwork}
                                disabled={scanning || !subnet}
                                startIcon={
                                    scanning ? (
                                        <CircularProgress size={20} />
                                    ) : (
                                        <SearchIcon />
                                    )
                                }
                                sx={{
                                    background:
                                        'linear-gradient(45deg, #00e676, #00bfa5)',
                                    '&:hover': {
                                        background:
                                            'linear-gradient(45deg, #00c853, #009688)'
                                    }
                                }}>
                                {scanning ? 'Scanning...' : 'Scan Network'}
                            </Button>
                        </Grid>
                    </Grid>
                    {scanning && (
                        <LinearProgress sx={{ mt: 2 }} color="success" />
                    )}
                </CardContent>
            </Card>

            {/* Step 2: Credentials Configuration */}
            <Card
                sx={{
                    mb: 3,
                    background:
                        'linear-gradient(135deg, #1a1a2e 0%, #1e2a3a 100%)',
                    border: '1px solid rgba(255,152,0,0.2)'
                }}>
                <CardContent>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}>
                        <VpnKeyIcon sx={{ color: '#ff9800' }} />
                        Step 2: Configure Credentials
                    </Typography>
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                            mb: 2
                        }}>
                        {credentials.map((cred, i) => (
                            <Chip
                                key={i}
                                label={`${cred.username}:${
                                    cred.password || '(empty)'
                                }`}
                                onDelete={() => removeCredential(i)}
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(255,152,0,0.15)',
                                    borderColor: 'rgba(255,152,0,0.3)',
                                    border: '1px solid'
                                }}
                            />
                        ))}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            label="Username"
                            value={newCred.username}
                            onChange={(e) =>
                                setNewCred((prev) => ({
                                    ...prev,
                                    username: e.target.value
                                }))
                            }
                            sx={{ width: 180 }}
                        />
                        <TextField
                            size="small"
                            label="Password"
                            value={newCred.password}
                            onChange={(e) =>
                                setNewCred((prev) => ({
                                    ...prev,
                                    password: e.target.value
                                }))
                            }
                            sx={{ width: 180 }}
                        />
                        <Button
                            variant="outlined"
                            onClick={addCredential}
                            startIcon={<AddIcon />}
                            size="small">
                            Add
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Step 3: Discovered Hosts & Results */}
            {hosts.length > 0 && (
                <Card
                    sx={{
                        mb: 3,
                        background:
                            'linear-gradient(135deg, #1a1a2e 0%, #1a2a1e 100%)',
                        border: '1px solid rgba(33,150,243,0.2)'
                    }}>
                    <CardContent>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 2
                            }}>
                            <Typography
                                variant="h6"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                <DevicesIcon sx={{ color: '#2196f3' }} />
                                Step 3: Discovered Hosts ({hosts.length})
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={testAllHosts}
                                    disabled={testingCredentials}
                                    startIcon={
                                        testingCredentials ? (
                                            <CircularProgress size={16} />
                                        ) : (
                                            <VpnKeyIcon />
                                        )
                                    }
                                    color="warning">
                                    {testingCredentials
                                        ? 'Testing...'
                                        : 'Test All Passwords'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={scanNetwork}
                                    startIcon={<RefreshIcon />}>
                                    Rescan
                                </Button>
                            </Box>
                        </Box>

                        <TableContainer
                            component={Paper}
                            sx={{
                                bgcolor: 'rgba(0,0,0,0.3)',
                                maxHeight: 500
                            }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            Device
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            IP Address
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            Type
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            OS
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            Open Ports
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            Credentials
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            Actions
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {hosts.map((host) => {
                                        const results = getCredResultForHost(
                                            host.ip
                                        );
                                        const hasSuccess = hasSuccessfulCred(
                                            host.ip
                                        );
                                        return (
                                            <TableRow
                                                key={host.ip}
                                                sx={{
                                                    '&:hover': {
                                                        bgcolor:
                                                            'rgba(255,255,255,0.05)'
                                                    },
                                                    bgcolor: hasSuccess
                                                        ? 'rgba(0,230,118,0.08)'
                                                        : 'transparent'
                                                }}>
                                                <TableCell>
                                                    <Box
                                                        sx={{
                                                            color: hasSuccess
                                                                ? '#00e676'
                                                                : '#90a4ae'
                                                        }}>
                                                        {deviceIcons[
                                                            host.deviceType
                                                        ] || <DevicesIcon />}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                        fontFamily="monospace">
                                                        {host.ip}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={host.deviceType}
                                                        size="small"
                                                        sx={{
                                                            bgcolor:
                                                                host.deviceType ===
                                                                'Camera'
                                                                    ? 'rgba(244,67,54,0.2)'
                                                                    : host.deviceType ===
                                                                        'Router'
                                                                      ? 'rgba(33,150,243,0.2)'
                                                                      : 'rgba(156,39,176,0.2)'
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary">
                                                        {host.os || 'Unknown'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: 0.5
                                                        }}>
                                                        {host.services.map(
                                                            (svc, i) => (
                                                                <Chip
                                                                    key={i}
                                                                    label={svc}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{
                                                                        fontSize:
                                                                            '0.7rem',
                                                                        height: 22
                                                                    }}
                                                                />
                                                            )
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {results.length > 0 ? (
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems:
                                                                    'center',
                                                                gap: 0.5
                                                            }}>
                                                            {hasSuccess ? (
                                                                <>
                                                                    <CheckCircleIcon
                                                                        sx={{
                                                                            color: '#00e676',
                                                                            fontSize: 28
                                                                        }}
                                                                    />
                                                                    <Typography
                                                                        variant="caption"
                                                                        sx={{
                                                                            color: '#00e676',
                                                                            fontWeight: 700
                                                                        }}>
                                                                        {
                                                                            results.find(
                                                                                (
                                                                                    r
                                                                                ) =>
                                                                                    r.success
                                                                            )
                                                                                ?.username
                                                                        }
                                                                    </Typography>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CancelIcon
                                                                        sx={{
                                                                            color: '#f44336',
                                                                            fontSize: 24
                                                                        }}
                                                                    />
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="error">
                                                                        Failed
                                                                    </Typography>
                                                                </>
                                                            )}
                                                        </Box>
                                                    ) : (
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary">
                                                            Not tested
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            gap: 0.5
                                                        }}>
                                                        <Tooltip title="Test Passwords">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() =>
                                                                    testPasswordsOnHost(
                                                                        host
                                                                    )
                                                                }
                                                                disabled={
                                                                    testingCredentials
                                                                }
                                                                sx={{
                                                                    color: '#ff9800'
                                                                }}>
                                                                <VpnKeyIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {hasSuccess && (
                                                            <Tooltip title="Deploy Monkey Agent">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() =>
                                                                        runPostExploit(
                                                                            host
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        postExploitRunning
                                                                    }
                                                                    sx={{
                                                                        color: '#00e676'
                                                                    }}>
                                                                    <BugReportIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {/* Post-Exploitation Results Dialog */}
            <Dialog
                open={detailDialog}
                onClose={() => setDetailDialog(false)}
                maxWidth="md"
                fullWidth>
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: '#1a1a2e'
                    }}>
                    <SecurityIcon sx={{ color: '#00e676' }} />
                    Post-Exploitation Agent Results
                </DialogTitle>
                <DialogContent sx={{ bgcolor: '#16213e' }}>
                    {postExploitResults && (
                        <Box sx={{ mt: 2 }}>
                            <Typography
                                variant="subtitle2"
                                color="primary"
                                gutterBottom>
                                Target: {postExploitResults.host}
                            </Typography>
                            <Divider sx={{ my: 1 }} />

                            {postExploitResults.systemInfo?.os && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary">
                                        System Information
                                    </Typography>
                                    <Paper
                                        sx={{
                                            p: 1.5,
                                            bgcolor: 'rgba(0,0,0,0.3)',
                                            mt: 0.5
                                        }}>
                                        <Typography
                                            variant="body2"
                                            fontFamily="monospace"
                                            sx={{
                                                whiteSpace: 'pre-wrap',
                                                fontSize: '0.8rem'
                                            }}>
                                            {postExploitResults.systemInfo.os}
                                        </Typography>
                                    </Paper>
                                </Box>
                            )}

                            {postExploitResults.systemInfo?.users && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary">
                                        Users & Sessions
                                    </Typography>
                                    <Paper
                                        sx={{
                                            p: 1.5,
                                            bgcolor: 'rgba(0,0,0,0.3)',
                                            mt: 0.5
                                        }}>
                                        <Typography
                                            variant="body2"
                                            fontFamily="monospace"
                                            sx={{
                                                whiteSpace: 'pre-wrap',
                                                fontSize: '0.8rem'
                                            }}>
                                            {
                                                postExploitResults.systemInfo
                                                    .users
                                            }
                                        </Typography>
                                    </Paper>
                                </Box>
                            )}

                            {postExploitResults.discoveredHosts?.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary">
                                        Discovered Neighboring Hosts (
                                        {
                                            postExploitResults.discoveredHosts
                                                .length
                                        }
                                        )
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 1,
                                            mt: 0.5
                                        }}>
                                        {postExploitResults.discoveredHosts.map(
                                            (ip) => (
                                                <Chip
                                                    key={ip}
                                                    label={ip}
                                                    size="small"
                                                    icon={<ComputerIcon />}
                                                    sx={{
                                                        bgcolor:
                                                            'rgba(0,230,118,0.15)',
                                                        border: '1px solid rgba(0,230,118,0.3)'
                                                    }}
                                                />
                                            )
                                        )}
                                    </Box>
                                </Box>
                            )}

                            {postExploitResults.services?.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary">
                                        Internal Services
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 1,
                                            mt: 0.5
                                        }}>
                                        {postExploitResults.services.map(
                                            (port) => (
                                                <Chip
                                                    key={port}
                                                    label={`Port ${port}`}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )
                                        )}
                                    </Box>
                                </Box>
                            )}

                            {postExploitResults.systemInfo?.sensitiveFiles && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary">
                                        Sensitive Files Found
                                    </Typography>
                                    <Paper
                                        sx={{
                                            p: 1.5,
                                            bgcolor: 'rgba(244,67,54,0.1)',
                                            border: '1px solid rgba(244,67,54,0.3)',
                                            mt: 0.5
                                        }}>
                                        <Typography
                                            variant="body2"
                                            fontFamily="monospace"
                                            sx={{
                                                whiteSpace: 'pre-wrap',
                                                fontSize: '0.8rem'
                                            }}>
                                            {
                                                postExploitResults.systemInfo
                                                    .sensitiveFiles
                                            }
                                        </Typography>
                                    </Paper>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ bgcolor: '#1a1a2e' }}>
                    <Button onClick={() => setDetailDialog(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
