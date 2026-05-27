'use client';

import React from 'react';
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
import DevicesIcon from '@mui/icons-material/Devices';
import BugReportIcon from '@mui/icons-material/BugReport';
import ShieldIcon from '@mui/icons-material/Shield';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';

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
                        Network security overview and quick actions
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <IconButton size="small" sx={{ color: 'text.secondary' }}>
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => router.push(PATHS.RUN)}
                        sx={{ color: '#000', fontWeight: 700 }}>
                        Start Simulation
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Machines Discovered"
                        value={0}
                        subtitle="In current scan"
                        icon={<DevicesIcon />}
                        color="#40C4FF"
                    />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Vulnerabilities Found"
                        value={0}
                        subtitle="Across all machines"
                        icon={<BugReportIcon />}
                        color="#FF5252"
                    />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Exploits Successful"
                        value={0}
                        subtitle="Propagation attempts"
                        icon={<SecurityIcon />}
                        color="#FFB74D"
                    />
                </Grid>
                <Grid xs={12} sm={6} lg={3}>
                    <StatCard
                        title="Security Score"
                        value="--"
                        subtitle="Run a simulation first"
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
                                    Simulation Status
                                </Typography>
                                <Chip
                                    label="Idle"
                                    size="small"
                                    sx={{
                                        backgroundColor:
                                            'rgba(158, 158, 158, 0.12)',
                                        color: 'text.secondary',
                                        fontWeight: 600
                                    }}
                                />
                            </Box>

                            <Box
                                sx={{
                                    p: 4,
                                    borderRadius: 3,
                                    backgroundColor:
                                        'rgba(255, 255, 255, 0.02)',
                                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                                    textAlign: 'center'
                                }}>
                                <NetworkCheckIcon
                                    sx={{
                                        fontSize: 56,
                                        color: 'text.secondary',
                                        mb: 2,
                                        opacity: 0.5
                                    }}
                                />
                                <Typography
                                    variant="h6"
                                    sx={{ mb: 1, color: 'text.secondary' }}>
                                    No Active Simulation
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: 'text.secondary',
                                        mb: 3,
                                        maxWidth: 400,
                                        mx: 'auto'
                                    }}>
                                    Configure your agent settings and start a
                                    simulation to test your network security
                                    posture.
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 1.5,
                                        justifyContent: 'center'
                                    }}>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={() =>
                                            router.push(PATHS.CONFIGURE)
                                        }
                                        sx={{
                                            borderColor:
                                                'rgba(0, 230, 118, 0.5)'
                                        }}>
                                        Configure Agent
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<PlayArrowIcon />}
                                        onClick={() => router.push(PATHS.RUN)}
                                        sx={{ color: '#000' }}>
                                        Run Simulation
                                    </Button>
                                </Box>
                            </Box>

                            <Box sx={{ mt: 3 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ mb: 1.5, color: 'text.secondary' }}>
                                    Simulation Phases
                                </Typography>
                                <Grid container spacing={1.5}>
                                    {[
                                        'Scanning',
                                        'Exploitation',
                                        'Post-Exploitation',
                                        'Reporting'
                                    ].map((phase, i) => (
                                        <Grid xs={6} sm={3} key={phase}>
                                            <Box
                                                sx={{
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    backgroundColor:
                                                        'rgba(255, 255, 255, 0.03)',
                                                    textAlign: 'center'
                                                }}>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: 'text.secondary',
                                                        display: 'block',
                                                        mb: 0.5
                                                    }}>
                                                    Phase {i + 1}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ fontWeight: 500 }}>
                                                    {phase}
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={0}
                                                    sx={{
                                                        mt: 1,
                                                        height: 3,
                                                        borderRadius: 2,
                                                        backgroundColor:
                                                            'rgba(255, 255, 255, 0.05)'
                                                    }}
                                                />
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid xs={12} lg={4}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 2
                                }}>
                                <Typography variant="h6">
                                    Quick Actions
                                </Typography>
                            </Box>
                            <List disablePadding>
                                {[
                                    {
                                        label: 'Configure Agent',
                                        path: PATHS.CONFIGURE,
                                        icon: (
                                            <StorageIcon
                                                sx={{ fontSize: 20 }}
                                            />
                                        ),
                                        desc: 'Set up propagation options'
                                    },
                                    {
                                        label: 'Manage Plugins',
                                        path: PATHS.PLUGINS,
                                        icon: (
                                            <BugReportIcon
                                                sx={{ fontSize: 20 }}
                                            />
                                        ),
                                        desc: 'Install exploiters & collectors'
                                    },
                                    {
                                        label: 'View Reports',
                                        path: PATHS.REPORT,
                                        icon: (
                                            <SecurityIcon
                                                sx={{ fontSize: 20 }}
                                            />
                                        ),
                                        desc: 'Security assessment reports'
                                    },
                                    {
                                        label: 'Network Map',
                                        path: PATHS.NETWORK_MAP,
                                        icon: (
                                            <NetworkCheckIcon
                                                sx={{ fontSize: 20 }}
                                            />
                                        ),
                                        desc: 'Visualize discovered network'
                                    }
                                ].map((action) => (
                                    <ListItem
                                        key={action.label}
                                        disablePadding
                                        sx={{ mb: 0.5 }}>
                                        <Box
                                            onClick={() =>
                                                router.push(action.path)
                                            }
                                            sx={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                p: 1.5,
                                                borderRadius: 2,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                '&:hover': {
                                                    backgroundColor:
                                                        'rgba(255, 255, 255, 0.04)'
                                                }
                                            }}>
                                            <Box
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 1.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor:
                                                        'rgba(0, 230, 118, 0.08)',
                                                    color: 'primary.main'
                                                }}>
                                                {action.icon}
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ fontWeight: 500 }}>
                                                    {action.label}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: 'text.secondary'
                                                    }}>
                                                    {action.desc}
                                                </Typography>
                                            </Box>
                                            <ArrowForwardIcon
                                                sx={{
                                                    fontSize: 16,
                                                    color: 'text.secondary'
                                                }}
                                            />
                                        </Box>
                                    </ListItem>
                                ))}
                            </List>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Recent Activity
                            </Typography>
                            <Box
                                sx={{
                                    textAlign: 'center',
                                    py: 3,
                                    color: 'text.secondary'
                                }}>
                                <EventNoteIcon
                                    sx={{ fontSize: 40, mb: 1, opacity: 0.3 }}
                                />
                                <Typography variant="body2">
                                    No recent activity
                                </Typography>
                                <Typography variant="caption">
                                    Events will appear here after running a
                                    simulation
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}

function EventNoteIcon(props: any) {
    return (
        <Box component="span" {...props}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                fill="currentColor">
                <path d="M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z" />
            </svg>
        </Box>
    );
}
