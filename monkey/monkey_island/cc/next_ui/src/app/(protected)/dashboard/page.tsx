'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DevicesIcon from '@mui/icons-material/Devices';
import BugReportIcon from '@mui/icons-material/BugReport';
import ShieldIcon from '@mui/icons-material/Shield';
import SecurityIcon from '@mui/icons-material/Security';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';
import {
    getSimulation,
    runRealSimulation,
    stopSimulation,
    getSecurityScore,
    getEvents,
    type SimulationState,
    type MonkeyEvent
} from '@/lib/appState';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    trend?: string;
}

function StatCard({
    title,
    value,
    subtitle,
    icon,
    color,
    trend
}: StatCardProps) {
    return (
        <Card>
            <CardContent sx={{ p: 2.5 }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 2
                    }}>
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: `${color}15`,
                            color: color
                        }}>
                        {icon}
                    </Box>
                    {trend && (
                        <Chip
                            icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                            label={trend}
                            size="small"
                            sx={{
                                height: 24,
                                fontSize: '0.7rem',
                                backgroundColor: `${color}15`,
                                color: color
                            }}
                        />
                    )}
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {value}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {subtitle}
                </Typography>
            </CardContent>
        </Card>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const [sim, setSim] = useState<SimulationState>(getSimulation());
    const [events, setEvents] = useState<MonkeyEvent[]>([]);
    const runningRef = useRef(false);

    const refreshState = useCallback(() => {
        setSim(getSimulation());
        setEvents(getEvents().slice(0, 8));
    }, []);

    useEffect(() => {
        refreshState();
        const interval = setInterval(refreshState, 2000);
        return () => clearInterval(interval);
    }, [refreshState]);

    const handleStartStop = async () => {
        if (sim.status === 'running') {
            setSim(stopSimulation());
            runningRef.current = false;
        } else {
            runningRef.current = true;
            await runRealSimulation((updatedSim) => {
                setSim(updatedSim);
                setEvents(getEvents().slice(0, 8));
            });
            runningRef.current = false;
            refreshState();
        }
    };

    const statusColor =
        sim.status === 'running'
            ? '#00E676'
            : sim.status === 'completed'
              ? '#40C4FF'
              : sim.status === 'stopped'
                ? '#FF5252'
                : undefined;

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
                        Dashboard
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Real network security scanning and analysis
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <IconButton
                        size="small"
                        sx={{ color: 'text.secondary' }}
                        onClick={refreshState}>
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="contained"
                        color={sim.status === 'running' ? 'error' : 'primary'}
                        startIcon={
                            sim.status === 'running' ? (
                                <StopIcon />
                            ) : (
                                <PlayArrowIcon />
                            )
                        }
                        onClick={handleStartStop}
                        sx={{ color: '#000', fontWeight: 700 }}>
                        {sim.status === 'running'
                            ? 'Stop Scan'
                            : 'Start Real Scan'}
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Machines Discovered"
                        value={sim.machinesDiscovered}
                        subtitle="Real hosts found on network"
                        icon={<DevicesIcon />}
                        color="#40C4FF"
                        trend={
                            sim.machinesDiscovered > 0
                                ? `+${sim.machinesDiscovered}`
                                : undefined
                        }
                    />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Vulnerabilities Found"
                        value={sim.vulnerabilitiesFound}
                        subtitle="Open ports & exposed services"
                        icon={<BugReportIcon />}
                        color="#FF5252"
                        trend={
                            sim.vulnerabilitiesFound > 0
                                ? `+${sim.vulnerabilitiesFound}`
                                : undefined
                        }
                    />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Exploits Successful"
                        value={sim.exploitsSuccessful}
                        subtitle="Credential-based access"
                        icon={<SecurityIcon />}
                        color="#FFB74D"
                    />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Security Score"
                        value={getSecurityScore(sim)}
                        subtitle={
                            sim.status === 'idle'
                                ? 'Run a scan first'
                                : 'Based on exploit ratio'
                        }
                        icon={<ShieldIcon />}
                        color="#00E676"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={8}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 2.5
                                }}>
                                <Typography variant="h6">
                                    Scan Progress
                                </Typography>
                                <Chip
                                    label={
                                        sim.currentPhase ||
                                        sim.status.charAt(0).toUpperCase() +
                                            sim.status.slice(1)
                                    }
                                    size="small"
                                    sx={{
                                        backgroundColor: statusColor
                                            ? `${statusColor}20`
                                            : undefined,
                                        color: statusColor,
                                        fontWeight: 600
                                    }}
                                />
                            </Box>

                            {[
                                {
                                    label: 'Network Scanning',
                                    value: sim.phases.scanning,
                                    color: '#40C4FF'
                                },
                                {
                                    label: 'Port Scan & Exploitation',
                                    value: sim.phases.exploitation,
                                    color: '#FFB74D'
                                },
                                {
                                    label: 'Post-Exploitation',
                                    value: sim.phases.postExploitation,
                                    color: '#FF5252'
                                },
                                {
                                    label: 'Reporting',
                                    value: sim.phases.reporting,
                                    color: '#00E676'
                                }
                            ].map((phase) => (
                                <Box key={phase.label} sx={{ mb: 2.5 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            mb: 0.5
                                        }}>
                                        <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 500 }}>
                                            {phase.label}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary' }}>
                                            {Math.round(phase.value)}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={phase.value}
                                        sx={{
                                            height: 6,
                                            borderRadius: 3,
                                            backgroundColor:
                                                'rgba(255,255,255,0.05)',
                                            '& .MuiLinearProgress-bar': {
                                                backgroundColor: phase.color,
                                                borderRadius: 3
                                            }
                                        }}
                                    />
                                </Box>
                            ))}

                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 2,
                                    mt: 3,
                                    flexWrap: 'wrap'
                                }}>
                                {[
                                    {
                                        label: 'Scanned',
                                        value: sim.machinesScanned
                                    },
                                    {
                                        label: 'Exploited',
                                        value: sim.machinesExploited
                                    },
                                    {
                                        label: 'Active Agents',
                                        value: sim.activeAgents
                                    }
                                ].map((stat) => (
                                    <Box
                                        key={stat.label}
                                        sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography
                                            variant="h5"
                                            sx={{ fontWeight: 800 }}>
                                            {stat.value}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ color: 'text.secondary' }}>
                                            {stat.label}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid xs={12} lg={4}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 2
                                }}>
                                <Typography variant="h6">
                                    Live Events
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => router.push(PATHS.EVENTS)}>
                                    <ArrowForwardIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Box>
                            <List dense sx={{ p: 0 }}>
                                {events.length === 0 ? (
                                    <ListItem sx={{ px: 0 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary' }}>
                                            No events yet. Start a scan to see
                                            real-time activity.
                                        </Typography>
                                    </ListItem>
                                ) : (
                                    events.map((event) => (
                                        <ListItem
                                            key={event.id}
                                            sx={{
                                                px: 0,
                                                py: 0.5,
                                                display: 'block'
                                            }}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1
                                                }}>
                                                <Box
                                                    sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: '50%',
                                                        backgroundColor:
                                                            event.severity ===
                                                            'success'
                                                                ? '#00E676'
                                                                : event.severity ===
                                                                    'error'
                                                                  ? '#FF5252'
                                                                  : event.severity ===
                                                                      'warning'
                                                                    ? '#FFB74D'
                                                                    : '#40C4FF'
                                                    }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: 'text.secondary'
                                                    }}>
                                                    {new Date(
                                                        event.timestamp
                                                    ).toLocaleTimeString()}
                                                </Typography>
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontSize: '0.78rem',
                                                    ml: 1.5
                                                }}>
                                                {event.message}
                                            </Typography>
                                        </ListItem>
                                    ))
                                )}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Quick Actions */}
            <Grid container spacing={2.5} sx={{ mt: 1 }}>
                {[
                    {
                        label: 'Network Map',
                        desc: 'View discovered hosts and topology',
                        path: PATHS.NETWORK_MAP,
                        color: '#40C4FF'
                    },
                    {
                        label: 'Propagation Tree',
                        desc: 'See exploit spread path',
                        path: '/propagation-tree/',
                        color: '#FF5252'
                    },
                    {
                        label: 'Reports',
                        desc: 'View security analysis',
                        path: PATHS.REPORT,
                        color: '#00E676'
                    },
                    {
                        label: 'Configure',
                        desc: 'Set scan parameters',
                        path: PATHS.CONFIGURE,
                        color: '#7C4DFF'
                    }
                ].map((action) => (
                    <Grid key={action.label} xs={12} sm={6} lg={3}>
                        <Card
                            sx={{
                                cursor: 'pointer',
                                '&:hover': { borderColor: action.color }
                            }}
                            onClick={() => router.push(action.path)}>
                            <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        fontWeight: 700,
                                        color: action.color
                                    }}>
                                    {action.label}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{ color: 'text.secondary' }}>
                                    {action.desc}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
