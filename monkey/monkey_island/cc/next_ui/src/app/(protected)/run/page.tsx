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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ComputerIcon from '@mui/icons-material/Computer';
import TerminalIcon from '@mui/icons-material/Terminal';
import LanguageIcon from '@mui/icons-material/Language';
import LanIcon from '@mui/icons-material/Lan';
import {
    getSimulation,
    startSimulation,
    stopSimulation,
    progressSimulation,
    getConfig
} from '@/lib/appState';

export default function RunPage() {
    const [tabValue, setTabValue] = useState(0);
    const [sim, setSim] = useState(getSimulation());
    const isRunning = sim.status === 'running';
    const config = getConfig();

    const refreshState = useCallback(() => {
        const currentSim = getSimulation();
        if (currentSim.status === 'running') {
            setSim(progressSimulation());
        } else {
            setSim(currentSim);
        }
    }, []);

    useEffect(() => {
        refreshState();
        const interval = setInterval(refreshState, 1000);
        return () => clearInterval(interval);
    }, [refreshState]);

    const handleStartStop = () => {
        if (isRunning) {
            setSim(stopSimulation());
        } else {
            setSim(startSimulation());
        }
    };

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
                        Run Simulation
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Launch Infection Monkey agents to test your network
                        security
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    color={isRunning ? 'error' : 'primary'}
                    size="large"
                    startIcon={isRunning ? <StopIcon /> : <PlayArrowIcon />}
                    onClick={handleStartStop}
                    sx={{
                        color: isRunning ? '#fff' : '#000',
                        fontWeight: 700,
                        px: 4,
                        py: 1.2
                    }}>
                    {isRunning ? 'Stop Simulation' : 'Start Simulation'}
                </Button>
            </Box>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={8}>
                    <Card>
                        <CardContent sx={{ p: 0 }}>
                            <Tabs
                                value={tabValue}
                                onChange={(_, v) => setTabValue(v)}
                                sx={{
                                    borderBottom:
                                        '1px solid rgba(255, 255, 255, 0.06)',
                                    px: 2
                                }}>
                                <Tab
                                    icon={
                                        <ComputerIcon sx={{ fontSize: 18 }} />
                                    }
                                    iconPosition="start"
                                    label="Run from Island"
                                    sx={{ textTransform: 'none' }}
                                />
                                <Tab
                                    icon={
                                        <TerminalIcon sx={{ fontSize: 18 }} />
                                    }
                                    iconPosition="start"
                                    label="Run Manually"
                                    sx={{ textTransform: 'none' }}
                                />
                                <Tab
                                    icon={
                                        <LanguageIcon sx={{ fontSize: 18 }} />
                                    }
                                    iconPosition="start"
                                    label="Run on AWS"
                                    sx={{ textTransform: 'none' }}
                                />
                            </Tabs>

                            <Box sx={{ p: 3 }}>
                                {tabValue === 0 && (
                                    <Box>
                                        <Typography variant="h6" sx={{ mb: 1 }}>
                                            Run from Monkey Island
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'text.secondary',
                                                mb: 3
                                            }}>
                                            Start the agent directly on this
                                            machine. The agent will begin
                                            scanning and exploiting based on
                                            your configuration.
                                        </Typography>

                                        <Box
                                            sx={{
                                                p: 3,
                                                borderRadius: 2,
                                                backgroundColor:
                                                    'rgba(0, 230, 118, 0.04)',
                                                border: '1px solid rgba(0, 230, 118, 0.15)',
                                                mb: 3
                                            }}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1.5,
                                                    mb: 1.5
                                                }}>
                                                <LanIcon
                                                    sx={{
                                                        color: 'primary.main'
                                                    }}
                                                />
                                                <Typography
                                                    variant="subtitle1"
                                                    sx={{ fontWeight: 600 }}>
                                                    Local Network Simulation
                                                </Typography>
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: 'text.secondary',
                                                    mb: 2
                                                }}>
                                                The agent will propagate through
                                                your local network using the
                                                configured exploiters and
                                                credentials.
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                startIcon={<PlayArrowIcon />}
                                                sx={{
                                                    color: '#000',
                                                    fontWeight: 600
                                                }}>
                                                Run on Island Server
                                            </Button>
                                        </Box>
                                    </Box>
                                )}

                                {tabValue === 1 && (
                                    <Box>
                                        <Typography variant="h6" sx={{ mb: 1 }}>
                                            Run Agent Manually
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'text.secondary',
                                                mb: 3
                                            }}>
                                            Download and run the agent on a
                                            target machine to start scanning
                                            from that location.
                                        </Typography>

                                        <Alert severity="info" sx={{ mb: 3 }}>
                                            Choose the platform matching your
                                            target machine and run the command
                                            below.
                                        </Alert>

                                        <Grid container spacing={2}>
                                            <Grid xs={12} sm={6}>
                                                <Card
                                                    sx={{
                                                        border: '1px solid rgba(0, 230, 118, 0.3)',
                                                        cursor: 'pointer'
                                                    }}>
                                                    <CardContent
                                                        sx={{
                                                            p: 2,
                                                            textAlign: 'center'
                                                        }}>
                                                        <Typography
                                                            variant="h6"
                                                            sx={{ mb: 0.5 }}>
                                                            Linux
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                color: 'text.secondary'
                                                            }}>
                                                            Download Linux agent
                                                            binary
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                            <Grid xs={12} sm={6}>
                                                <Card
                                                    sx={{ cursor: 'pointer' }}>
                                                    <CardContent
                                                        sx={{
                                                            p: 2,
                                                            textAlign: 'center'
                                                        }}>
                                                        <Typography
                                                            variant="h6"
                                                            sx={{ mb: 0.5 }}>
                                                            Windows
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                color: 'text.secondary'
                                                            }}>
                                                            Download Windows
                                                            agent binary
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        </Grid>

                                        <Box
                                            sx={{
                                                mt: 3,
                                                p: 2,
                                                borderRadius: 2,
                                                backgroundColor:
                                                    'rgba(0, 0, 0, 0.3)',
                                                fontFamily: 'monospace',
                                                fontSize: '0.85rem',
                                                position: 'relative'
                                            }}>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'primary.main',
                                                    display: 'block',
                                                    mb: 1
                                                }}>
                                                # Run on target machine:
                                            </Typography>
                                            <code style={{ color: '#E0E0E0' }}>
                                                curl -O
                                                https://&lt;island-ip&gt;:5000/api/agent-binaries/linux
                                                &amp;&amp; chmod +x linux
                                                &amp;&amp; ./linux m0nk3y -s
                                                &lt;island-ip&gt;:5000
                                            </code>
                                        </Box>
                                    </Box>
                                )}

                                {tabValue === 2 && (
                                    <Box>
                                        <Typography variant="h6" sx={{ mb: 1 }}>
                                            Run on AWS
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'text.secondary',
                                                mb: 3
                                            }}>
                                            Automatically deploy agents to your
                                            AWS instances using AWS integration.
                                        </Typography>
                                        <Alert
                                            severity="warning"
                                            sx={{ mb: 2 }}>
                                            AWS integration requires proper IAM
                                            permissions. Make sure you have
                                            configured your AWS credentials.
                                        </Alert>
                                        <Button
                                            variant="outlined"
                                            color="primary">
                                            Configure AWS Integration
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid xs={12} lg={4}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Simulation Status
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1.5
                                }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        Status
                                    </Typography>
                                    <Chip
                                        label={
                                            sim.status.charAt(0).toUpperCase() +
                                            sim.status.slice(1)
                                        }
                                        size="small"
                                        color={
                                            isRunning
                                                ? 'success'
                                                : sim.status === 'completed'
                                                  ? 'info'
                                                  : 'default'
                                        }
                                    />
                                </Box>
                                <Divider />
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        Active Agents
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600 }}>
                                        {sim.activeAgents}
                                    </Typography>
                                </Box>
                                <Divider />
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        Machines Scanned
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600 }}>
                                        {sim.machinesScanned}
                                    </Typography>
                                </Box>
                                <Divider />
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        Machines Exploited
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600 }}>
                                        {sim.machinesExploited}
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Pre-flight Checklist
                            </Typography>
                            {[
                                { label: 'Agent Configuration', done: true },
                                { label: 'Plugins Installed', done: false },
                                {
                                    label: 'Credentials Configured',
                                    done: config.credentials.length > 0
                                },
                                {
                                    label: 'Network Targets Set',
                                    done: config.targetSubnets.length > 0
                                }
                            ].map((item) => (
                                <Box
                                    key={item.label}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        py: 0.8
                                    }}>
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            backgroundColor: item.done
                                                ? 'success.main'
                                                : 'rgba(255, 255, 255, 0.2)'
                                        }}
                                    />
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: item.done
                                                ? 'text.primary'
                                                : 'text.secondary'
                                        }}>
                                        {item.label}
                                    </Typography>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
