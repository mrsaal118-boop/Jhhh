'use client';

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Unstable_Grid2';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ComputerIcon from '@mui/icons-material/Computer';
import WifiIcon from '@mui/icons-material/Wifi';
import { addEvent } from '@/lib/appState';

const API_PORT = 17813;

interface DiscoveredHost {
    ip: string;
    alive: boolean;
    responseTime: number;
    hostname: string;
    discoveredAt: string;
    ports?: { port: number; state: string; service: string }[];
}

export default function NetworkMapPage() {
    const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [subnet, setSubnet] = useState('');
    const [selectedHost, setSelectedHost] = useState<DiscoveredHost | null>(
        null
    );
    const [portScanning, setPortScanning] = useState(false);

    const scanNetwork = useCallback(async () => {
        setScanning(true);
        setScanProgress('Scanning network...');
        setHosts([]);

        try {
            const resp = await fetch(
                `http://localhost:${API_PORT}/api/scan-network`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        subnet: subnet || undefined
                    })
                }
            );

            if (resp.ok) {
                const data = await resp.json();
                setHosts(data.hosts);
                if (!subnet) setSubnet(data.subnet);
                setScanProgress(`Found ${data.hosts.length} hosts`);
                addEvent({
                    type: 'scan',
                    severity: 'success',
                    source: 'Island',
                    target: data.subnet || 'Local Network',
                    message: `Network scan complete: ${data.hosts.length} hosts discovered`
                });
            } else {
                setScanProgress('Scan failed - API not available');
            }
        } catch {
            setScanProgress(
                'Scan failed - start app via Electron for real network scanning'
            );
        }
        setScanning(false);
    }, [subnet]);

    const scanPorts = useCallback(async (host: DiscoveredHost) => {
        setPortScanning(true);
        setSelectedHost(host);

        try {
            const resp = await fetch(
                `http://localhost:${API_PORT}/api/scan-ports`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        host: host.ip,
                        ports: [
                            21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 993,
                            995, 1433, 3306, 3389, 5432, 5900, 6379, 8080, 8443,
                            27017
                        ]
                    })
                }
            );

            if (resp.ok) {
                const data = await resp.json();
                const updatedHost = {
                    ...host,
                    ports: data.ports
                };
                setSelectedHost(updatedHost);
                setHosts((prev) =>
                    prev.map((h) => (h.ip === host.ip ? updatedHost : h))
                );
                const openPorts = data.ports.filter(
                    (p: { state: string }) => p.state === 'open'
                );
                addEvent({
                    type: 'scan',
                    severity: openPorts.length > 0 ? 'warning' : 'info',
                    source: 'Island',
                    target: host.ip,
                    message: `Port scan: ${openPorts.length} open ports found on ${host.ip}`
                });
            }
        } catch {
            // Port scan not available outside Electron
        }
        setPortScanning(false);
    }, []);

    return (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3
                }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        Network Map
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'text.secondary',
                            mt: 0.5
                        }}>
                        Discover and scan network hosts
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField
                        placeholder="Subnet (e.g. 192.168.1)"
                        value={subnet}
                        onChange={(e) => setSubnet(e.target.value)}
                        size="small"
                        sx={{ width: 220 }}
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SearchIcon />}
                        onClick={scanNetwork}
                        disabled={scanning}
                        sx={{
                            color: '#000',
                            fontWeight: 700
                        }}>
                        {scanning ? 'Scanning...' : 'Scan Network'}
                    </Button>
                </Box>
            </Box>

            {scanning && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

            {scanProgress && (
                <Typography
                    variant="body2"
                    sx={{
                        color: 'text.secondary',
                        mb: 2
                    }}>
                    {scanProgress}
                </Typography>
            )}

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={selectedHost ? 7 : 12}>
                    <Card>
                        <CardContent sx={{ p: 0 }}>
                            {hosts.length === 0 && !scanning ? (
                                <Box
                                    sx={{
                                        textAlign: 'center',
                                        py: 8
                                    }}>
                                    <MapIcon
                                        sx={{
                                            fontSize: 64,
                                            color: 'text.secondary',
                                            mb: 2,
                                            opacity: 0.3
                                        }}
                                    />
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            mb: 1,
                                            color: 'text.secondary'
                                        }}>
                                        No Hosts Discovered
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: 'text.secondary',
                                            mb: 3,
                                            maxWidth: 420,
                                            mx: 'auto'
                                        }}>
                                        Click &quot;Scan Network&quot; to
                                        discover hosts on your local network.
                                        The scan sends ICMP pings to all
                                        addresses in the subnet.
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>
                                                    IP Address
                                                </TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>
                                                    Response Time
                                                </TableCell>
                                                <TableCell>
                                                    Open Ports
                                                </TableCell>
                                                <TableCell>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {hosts.map((host) => (
                                                <TableRow
                                                    key={host.ip}
                                                    hover
                                                    selected={
                                                        selectedHost?.ip ===
                                                        host.ip
                                                    }
                                                    sx={{
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() =>
                                                        setSelectedHost(host)
                                                    }>
                                                    <TableCell>
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems:
                                                                    'center',
                                                                gap: 1
                                                            }}>
                                                            <ComputerIcon
                                                                sx={{
                                                                    fontSize: 18,
                                                                    color: 'primary.main'
                                                                }}
                                                            />
                                                            {host.ip}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label="Online"
                                                            size="small"
                                                            sx={{
                                                                backgroundColor:
                                                                    'rgba(0,230,118,0.15)',
                                                                color: '#00E676'
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {host.responseTime > 0
                                                            ? `${host.responseTime}ms`
                                                            : '<1ms'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {host.ports
                                                            ? host.ports.filter(
                                                                  (p) =>
                                                                      p.state ===
                                                                      'open'
                                                              ).length
                                                            : '--'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                scanPorts(host);
                                                            }}
                                                            sx={{
                                                                fontSize:
                                                                    '0.7rem'
                                                            }}>
                                                            Scan Ports
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {selectedHost && (
                    <Grid xs={12} lg={5}>
                        <Card>
                            <CardContent sx={{ p: 2.5 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        mb: 2
                                    }}>
                                    <Typography variant="h6">
                                        Host Details
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => setSelectedHost(null)}>
                                        <RefreshIcon
                                            sx={{
                                                fontSize: 18
                                            }}
                                        />
                                    </IconButton>
                                </Box>

                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        mb: 2,
                                        p: 1.5,
                                        borderRadius: 2,
                                        backgroundColor: 'rgba(0,230,118,0.05)'
                                    }}>
                                    <WifiIcon
                                        sx={{
                                            color: '#00E676'
                                        }}
                                    />
                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                fontWeight: 600
                                            }}>
                                            {selectedHost.ip}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: 'text.secondary'
                                            }}>
                                            Response:{' '}
                                            {selectedHost.responseTime > 0
                                                ? `${selectedHost.responseTime}ms`
                                                : '<1ms'}
                                        </Typography>
                                    </Box>
                                </Box>

                                {portScanning && (
                                    <LinearProgress
                                        sx={{
                                            mb: 2,
                                            borderRadius: 1
                                        }}
                                    />
                                )}

                                {selectedHost.ports &&
                                    selectedHost.ports.length > 0 && (
                                        <>
                                            <Typography
                                                variant="subtitle2"
                                                sx={{
                                                    mb: 1,
                                                    color: 'text.secondary'
                                                }}>
                                                Port Scan Results
                                            </Typography>
                                            <TableContainer>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>
                                                                Port
                                                            </TableCell>
                                                            <TableCell>
                                                                State
                                                            </TableCell>
                                                            <TableCell>
                                                                Service
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {selectedHost.ports.map(
                                                            (p) => (
                                                                <TableRow
                                                                    key={
                                                                        p.port
                                                                    }>
                                                                    <TableCell>
                                                                        {p.port}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Chip
                                                                            label={
                                                                                p.state
                                                                            }
                                                                            size="small"
                                                                            sx={{
                                                                                backgroundColor:
                                                                                    p.state ===
                                                                                    'open'
                                                                                        ? 'rgba(0,230,118,0.15)'
                                                                                        : p.state ===
                                                                                            'filtered'
                                                                                          ? 'rgba(255,183,77,0.15)'
                                                                                          : 'rgba(158,158,158,0.15)',
                                                                                color:
                                                                                    p.state ===
                                                                                    'open'
                                                                                        ? '#00E676'
                                                                                        : p.state ===
                                                                                            'filtered'
                                                                                          ? '#FFB74D'
                                                                                          : 'text.secondary'
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {
                                                                            p.service
                                                                        }
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </>
                                    )}

                                {!selectedHost.ports && (
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        onClick={() => scanPorts(selectedHost)}
                                        disabled={portScanning}
                                        sx={{ mt: 1 }}>
                                        {portScanning
                                            ? 'Scanning...'
                                            : 'Scan Ports'}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}
