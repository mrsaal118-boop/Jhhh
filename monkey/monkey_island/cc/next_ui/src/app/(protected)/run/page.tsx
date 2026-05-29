'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ComputerIcon from '@mui/icons-material/Computer';
import LanIcon from '@mui/icons-material/Lan';
import {
    getSimulation,
    runRealSimulation,
    stopSimulation,
    getConfig,
    getScanResults,
    type SimulationState
} from '@/lib/appState';

export default function RunPage() {
    const [sim, setSim] = useState<SimulationState>(getSimulation());
    const isRunning = sim.status === 'running';
    const config = getConfig();

    const refreshState = useCallback(() => {
        setSim(getSimulation());
    }, []);

    useEffect(() => {
        refreshState();
        const interval = setInterval(refreshState, 2000);
        return () => clearInterval(interval);
    }, [refreshState]);

    const handleStartStop = async () => {
        if (isRunning) {
            setSim(stopSimulation());
        } else {
            await runRealSimulation((updatedSim) => {
                setSim(updatedSim);
            });
            refreshState();
        }
    };

    const scanResults = getScanResults();

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
                        Run Network Scan
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Execute real network scanning, port analysis, and
                        exploitation attempts
                    </Typography>
                </Box>
            </Box>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={8}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    mb: 3
                                }}>
                                <ComputerIcon
                                    sx={{ color: '#00E676', fontSize: 28 }}
                                />
                                <Box>
                                    <Typography
                                        variant="h6"
                                        sx={{ fontWeight: 700 }}>
                                        Network Penetration Test
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        Scans your real network, discovers
                                        hosts, checks open ports, and attempts
                                        exploitation
                                    </Typography>
                                </Box>
                            </Box>

                            <Alert
                                severity="info"
                                sx={{
                                    mb: 3,
                                    backgroundColor: 'rgba(64, 196, 255, 0.08)'
                                }}>
                                This performs real ICMP ping sweeps, TCP port
                                scans, and credential-based exploitation on your
                                network. Configure credentials in the Configure
                                page for exploitation attempts.
                            </Alert>

                            <Box sx={{ mb: 3 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ mb: 1, fontWeight: 600 }}>
                                    Current Configuration
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 1,
                                        flexWrap: 'wrap'
                                    }}>
                                    <Chip
                                        label={`Target: ${
                                            config.targetSubnets ||
                                            'Auto-detect'
                                        }`}
                                        size="small"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`Ports: ${
                                            config.scanPorts?.length || 23
                                        }`}
                                        size="small"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`Depth: ${config.propagationDepth}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`Credentials: ${
                                            config.credentials?.length || 0
                                        }`}
                                        size="small"
                                        variant="outlined"
                                    />
                                    {config.enableSSH && (
                                        <Chip
                                            label="SSH"
                                            size="small"
                                            color="success"
                                            variant="outlined"
                                        />
                                    )}
                                    {config.enableSMB && (
                                        <Chip
                                            label="SMB"
                                            size="small"
                                            color="success"
                                            variant="outlined"
                                        />
                                    )}
                                    {config.enableRDP && (
                                        <Chip
                                            label="RDP"
                                            size="small"
                                            color="success"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>
                            </Box>

                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                color={isRunning ? 'error' : 'primary'}
                                startIcon={
                                    isRunning ? <StopIcon /> : <PlayArrowIcon />
                                }
                                onClick={handleStartStop}
                                sx={{
                                    py: 1.5,
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    color: '#000'
                                }}>
                                {isRunning
                                    ? 'Stop Scan'
                                    : 'Start Real Network Scan'}
                            </Button>

                            {sim.status !== 'idle' && (
                                <Box sx={{ mt: 3 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            mb: 1
                                        }}>
                                        <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 600 }}>
                                            {sim.currentPhase || sim.status}
                                        </Typography>
                                        <Chip
                                            label={sim.status}
                                            size="small"
                                            color={
                                                sim.status === 'running'
                                                    ? 'success'
                                                    : sim.status === 'completed'
                                                      ? 'info'
                                                      : 'error'
                                            }
                                        />
                                    </Box>
                                    {[
                                        'Network Scanning',
                                        'Port Scan & Exploitation',
                                        'Post-Exploitation',
                                        'Reporting'
                                    ].map((phase, i) => {
                                        const values = [
                                            sim.phases.scanning,
                                            sim.phases.exploitation,
                                            sim.phases.postExploitation,
                                            sim.phases.reporting
                                        ];
                                        const colors = [
                                            '#40C4FF',
                                            '#FFB74D',
                                            '#FF5252',
                                            '#00E676'
                                        ];
                                        return (
                                            <Box key={phase} sx={{ mb: 1.5 }}>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent:
                                                            'space-between',
                                                        mb: 0.3
                                                    }}>
                                                    <Typography variant="caption">
                                                        {phase}
                                                    </Typography>
                                                    <Typography variant="caption">
                                                        {Math.round(values[i])}%
                                                    </Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={values[i]}
                                                    sx={{
                                                        height: 4,
                                                        borderRadius: 2,
                                                        backgroundColor:
                                                            'rgba(255,255,255,0.05)',
                                                        '& .MuiLinearProgress-bar':
                                                            {
                                                                backgroundColor:
                                                                    colors[i]
                                                            }
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid xs={12} lg={4}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 700, mb: 2 }}>
                                <LanIcon
                                    sx={{
                                        mr: 1,
                                        verticalAlign: 'middle',
                                        color: '#40C4FF'
                                    }}
                                />
                                Scan Results
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            {[
                                {
                                    label: 'Hosts Discovered',
                                    value: sim.machinesDiscovered,
                                    color: '#40C4FF'
                                },
                                {
                                    label: 'Vulnerabilities',
                                    value: sim.vulnerabilitiesFound,
                                    color: '#FF5252'
                                },
                                {
                                    label: 'Exploits Success',
                                    value: sim.exploitsSuccessful,
                                    color: '#FFB74D'
                                },
                                {
                                    label: 'Machines Exploited',
                                    value: sim.machinesExploited,
                                    color: '#FF5252'
                                }
                            ].map((item) => (
                                <Box
                                    key={item.label}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        mb: 1.5
                                    }}>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        {item.label}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 700,
                                            color: item.color
                                        }}>
                                        {item.value}
                                    </Typography>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>

                    {scanResults.length > 0 && (
                        <Card>
                            <CardContent sx={{ p: 2.5 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 700, mb: 1.5 }}>
                                    Discovered Hosts
                                </Typography>
                                {scanResults.slice(0, 8).map((host) => (
                                    <Box
                                        key={host.ip}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            mb: 1
                                        }}>
                                        <Typography
                                            variant="body2"
                                            sx={{ fontFamily: 'monospace' }}>
                                            {host.ip}
                                        </Typography>
                                        <Chip
                                            label={
                                                host.exploited
                                                    ? 'Exploited'
                                                    : host.ports.filter(
                                                            (p) =>
                                                                p.state ===
                                                                'open'
                                                        ).length > 0
                                                      ? 'Vulnerable'
                                                      : 'Scanned'
                                            }
                                            size="small"
                                            color={
                                                host.exploited
                                                    ? 'error'
                                                    : host.ports.filter(
                                                            (p) =>
                                                                p.state ===
                                                                'open'
                                                        ).length > 0
                                                      ? 'warning'
                                                      : 'default'
                                            }
                                            variant="outlined"
                                            sx={{
                                                fontSize: '0.65rem',
                                                height: 20
                                            }}
                                        />
                                    </Box>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </Grid>
            </Grid>
        </Box>
    );
}
