'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import SecurityIcon from '@mui/icons-material/Security';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DevicesIcon from '@mui/icons-material/Devices';
import { getConfig, saveConfig, resetConfig } from '@/lib/appState';

export default function ConfigurePage() {
    const [propagationDepth, setPropagationDepth] = useState<number>(2);
    const [tunnelTimeout, setTunnelTimeout] = useState<number>(30);
    const [scanNetwork, setScanNetwork] = useState(true);
    const [enablePolymorphism, setEnablePolymorphism] = useState(false);
    const [targetSubnets, setTargetSubnets] = useState('');
    const [blockedIPs, setBlockedIPs] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });

    useEffect(() => {
        const config = getConfig();
        setPropagationDepth(config.propagationDepth);
        setTunnelTimeout(config.tunnelTimeout);
        setScanNetwork(config.scanNetwork);
        setEnablePolymorphism(config.enablePolymorphism);
        setTargetSubnets(config.targetSubnets);
        setBlockedIPs(config.blockedIPs);
    }, []);

    const handleSave = () => {
        saveConfig({
            propagationDepth,
            tunnelTimeout,
            scanNetwork,
            enablePolymorphism,
            targetSubnets,
            blockedIPs,
            credentials: []
        });
        setSnackbar({
            open: true,
            message: 'Configuration saved successfully!'
        });
    };

    const handleReset = () => {
        const defaults = resetConfig();
        setPropagationDepth(defaults.propagationDepth);
        setTunnelTimeout(defaults.tunnelTimeout);
        setScanNetwork(defaults.scanNetwork);
        setEnablePolymorphism(defaults.enablePolymorphism);
        setTargetSubnets(defaults.targetSubnets);
        setBlockedIPs(defaults.blockedIPs);
        setSnackbar({
            open: true,
            message: 'Configuration reset to defaults.'
        });
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
                        Agent Configuration
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Configure how the Infection Monkey agent behaves during
                        simulation
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RestoreIcon />}
                        onClick={handleReset}
                        sx={{
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            color: 'text.secondary'
                        }}>
                        Reset Defaults
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        sx={{ color: '#000', fontWeight: 700 }}>
                        Save Configuration
                    </Button>
                </Box>
            </Box>

            <Alert
                severity="info"
                sx={{
                    mb: 3,
                    backgroundColor: 'rgba(64, 196, 255, 0.08)',
                    border: '1px solid rgba(64, 196, 255, 0.2)'
                }}>
                Configure the agent before running a simulation. Changes will
                take effect on the next run.
            </Alert>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={8}>
                    <Accordion
                        defaultExpanded
                        sx={{ backgroundColor: 'background.paper', mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5
                                }}>
                                <NetworkCheckIcon
                                    sx={{ color: 'primary.main' }}
                                />
                                <Box>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{ fontWeight: 600 }}>
                                        Network Propagation
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Control how the agent spreads through
                                        the network
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={3}>
                                <Grid xs={12} sm={6}>
                                    <Typography
                                        variant="body2"
                                        sx={{ mb: 1, fontWeight: 500 }}>
                                        Propagation Depth
                                    </Typography>
                                    <Slider
                                        value={propagationDepth}
                                        onChange={(_, val) =>
                                            setPropagationDepth(val as number)
                                        }
                                        min={0}
                                        max={10}
                                        marks
                                        valueLabelDisplay="on"
                                        sx={{ color: 'primary.main' }}
                                    />
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Maximum number of hops from the initial
                                        machine (0 = no limit)
                                    </Typography>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                    <Typography
                                        variant="body2"
                                        sx={{ mb: 1, fontWeight: 500 }}>
                                        Keep Tunnel Open (seconds)
                                    </Typography>
                                    <TextField
                                        type="number"
                                        value={tunnelTimeout}
                                        onChange={(e) =>
                                            setTunnelTimeout(
                                                Number(e.target.value)
                                            )
                                        }
                                        size="small"
                                        fullWidth
                                        InputProps={{
                                            sx: {
                                                backgroundColor:
                                                    'rgba(255, 255, 255, 0.03)'
                                            }
                                        }}
                                    />
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Time to keep tunnel open after last
                                        exploit
                                    </Typography>
                                </Grid>
                                <Grid xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={scanNetwork}
                                                onChange={(e) =>
                                                    setScanNetwork(
                                                        e.target.checked
                                                    )
                                                }
                                                color="primary"
                                            />
                                        }
                                        label="Scan local network subnets automatically"
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion
                        defaultExpanded
                        sx={{ backgroundColor: 'background.paper', mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5
                                }}>
                                <DevicesIcon sx={{ color: '#40C4FF' }} />
                                <Box>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{ fontWeight: 600 }}>
                                        Target Configuration
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Define which machines and networks to
                                        scan
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={3}>
                                <Grid xs={12} sm={6}>
                                    <TextField
                                        label="Target Subnets"
                                        placeholder="e.g. 192.168.1.0/24, 10.0.0.0/8"
                                        value={targetSubnets}
                                        onChange={(e) =>
                                            setTargetSubnets(e.target.value)
                                        }
                                        multiline
                                        rows={3}
                                        fullWidth
                                        size="small"
                                        helperText="Comma-separated list of subnets or IP ranges to scan"
                                        InputProps={{
                                            sx: {
                                                backgroundColor:
                                                    'rgba(255, 255, 255, 0.03)'
                                            }
                                        }}
                                    />
                                </Grid>
                                <Grid xs={12} sm={6}>
                                    <TextField
                                        label="Blocked IPs"
                                        placeholder="e.g. 192.168.1.1, 10.0.0.1"
                                        value={blockedIPs}
                                        onChange={(e) =>
                                            setBlockedIPs(e.target.value)
                                        }
                                        multiline
                                        rows={3}
                                        fullWidth
                                        size="small"
                                        helperText="Comma-separated list of IPs or ranges to exclude"
                                        InputProps={{
                                            sx: {
                                                backgroundColor:
                                                    'rgba(255, 255, 255, 0.03)'
                                            }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion
                        sx={{ backgroundColor: 'background.paper', mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5
                                }}>
                                <VpnKeyIcon sx={{ color: '#FFB74D' }} />
                                <Box>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{ fontWeight: 600 }}>
                                        Credentials Configuration
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Manage credentials used for propagation
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Credentials configured here will be used by the
                                agent to attempt authentication on discovered
                                machines.
                            </Alert>
                            <Button
                                variant="outlined"
                                size="small"
                                sx={{
                                    borderColor: 'rgba(255, 183, 77, 0.5)',
                                    color: '#FFB74D'
                                }}>
                                Manage Propagation Credentials
                            </Button>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion
                        sx={{ backgroundColor: 'background.paper', mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5
                                }}>
                                <SecurityIcon sx={{ color: '#7C4DFF' }} />
                                <Box>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{ fontWeight: 600 }}>
                                        Advanced Options
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Polymorphism, evasion, and other
                                        advanced features
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={enablePolymorphism}
                                        onChange={(e) =>
                                            setEnablePolymorphism(
                                                e.target.checked
                                            )
                                        }
                                        color="secondary"
                                    />
                                }
                                label="Enable Polymorphism (modify agent binary before propagation)"
                            />
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    color: 'text.secondary',
                                    mt: 1,
                                    ml: 6
                                }}>
                                Emulates polymorphic malware by changing the
                                agent binary hash on each propagation
                            </Typography>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                <Grid xs={12} lg={4}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Configuration Summary
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
                                        Propagation Depth
                                    </Typography>
                                    <Chip
                                        label={propagationDepth}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
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
                                        Tunnel Timeout
                                    </Typography>
                                    <Typography variant="body2">
                                        {tunnelTimeout}s
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
                                        Auto-scan Network
                                    </Typography>
                                    <Chip
                                        label={
                                            scanNetwork ? 'Enabled' : 'Disabled'
                                        }
                                        size="small"
                                        color={
                                            scanNetwork ? 'success' : 'default'
                                        }
                                        variant="outlined"
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
                                        Polymorphism
                                    </Typography>
                                    <Chip
                                        label={
                                            enablePolymorphism
                                                ? 'Enabled'
                                                : 'Disabled'
                                        }
                                        size="small"
                                        color={
                                            enablePolymorphism
                                                ? 'secondary'
                                                : 'default'
                                        }
                                        variant="outlined"
                                    />
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                                Enabled Plugins
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary', mb: 2 }}>
                                Active exploiters and collectors for this
                                configuration
                            </Typography>
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    backgroundColor:
                                        'rgba(255, 255, 255, 0.02)',
                                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                                    textAlign: 'center'
                                }}>
                                <Typography
                                    variant="body2"
                                    sx={{ color: 'text.secondary' }}>
                                    No plugins installed
                                </Typography>
                                <Button
                                    size="small"
                                    sx={{ mt: 1 }}
                                    onClick={() => {}}>
                                    Install Plugins
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Box>
    );
}
