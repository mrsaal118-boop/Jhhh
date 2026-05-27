'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import DeleteIcon from '@mui/icons-material/Delete';
import StorageIcon from '@mui/icons-material/Storage';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DataObjectIcon from '@mui/icons-material/DataObject';
import WarningIcon from '@mui/icons-material/Warning';

export default function SettingsPage() {
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [islandPort, setIslandPort] = useState('5000');
    const [logLevel, setLogLevel] = useState('INFO');
    const [enableTelemetry, setEnableTelemetry] = useState(false);
    const [enableNotifications, setEnableNotifications] = useState(true);

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    Settings
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Manage Monkey Island server configuration
                </Typography>
            </Box>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={8}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    mb: 2.5
                                }}>
                                <StorageIcon sx={{ color: 'primary.main' }} />
                                <Typography variant="h6">
                                    Server Configuration
                                </Typography>
                            </Box>
                            <Grid container spacing={2.5}>
                                <Grid xs={12} sm={6}>
                                    <TextField
                                        label="Island Server Port"
                                        value={islandPort}
                                        onChange={(e) =>
                                            setIslandPort(e.target.value)
                                        }
                                        size="small"
                                        fullWidth
                                        helperText="Port for the Monkey Island web server"
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
                                        label="Log Level"
                                        value={logLevel}
                                        onChange={(e) =>
                                            setLogLevel(e.target.value)
                                        }
                                        size="small"
                                        fullWidth
                                        select
                                        SelectProps={{ native: true }}
                                        helperText="Server logging verbosity level"
                                        InputProps={{
                                            sx: {
                                                backgroundColor:
                                                    'rgba(255, 255, 255, 0.03)'
                                            }
                                        }}>
                                        <option value="DEBUG">DEBUG</option>
                                        <option value="INFO">INFO</option>
                                        <option value="WARNING">WARNING</option>
                                        <option value="ERROR">ERROR</option>
                                    </TextField>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    mb: 2.5
                                }}>
                                <NotificationsIcon sx={{ color: '#40C4FF' }} />
                                <Typography variant="h6">
                                    Preferences
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1.5
                                }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={enableNotifications}
                                            onChange={(e) =>
                                                setEnableNotifications(
                                                    e.target.checked
                                                )
                                            }
                                            color="primary"
                                        />
                                    }
                                    label="Enable desktop notifications for simulation events"
                                />
                                <Divider />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={enableTelemetry}
                                            onChange={(e) =>
                                                setEnableTelemetry(
                                                    e.target.checked
                                                )
                                            }
                                            color="primary"
                                        />
                                    }
                                    label="Send anonymous usage telemetry to help improve the product"
                                />
                            </Box>
                        </CardContent>
                    </Card>

                    <Card sx={{ borderColor: 'rgba(255, 82, 82, 0.3)' }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    mb: 2
                                }}>
                                <WarningIcon sx={{ color: '#FF5252' }} />
                                <Typography
                                    variant="h6"
                                    sx={{ color: '#FF5252' }}>
                                    Danger Zone
                                </Typography>
                            </Box>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary', mb: 2 }}>
                                These actions are irreversible. Please proceed
                                with caution.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => setClearDialogOpen(true)}>
                                    Clear Simulation Data
                                </Button>
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
                                    alignItems: 'center',
                                    gap: 1.5,
                                    mb: 2
                                }}>
                                <DataObjectIcon sx={{ color: '#7C4DFF' }} />
                                <Typography variant="h6">
                                    System Info
                                </Typography>
                            </Box>
                            {[
                                { label: 'Version', value: 'v2.3.0' },
                                { label: 'Deployment', value: 'Development' },
                                { label: 'Database', value: 'MongoDB' },
                                { label: 'Python', value: '3.11' },
                                { label: 'License', value: 'GPLv3' }
                            ].map((info) => (
                                <Box
                                    key={info.label}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        py: 0.8,
                                        borderBottom:
                                            '1px solid rgba(255, 255, 255, 0.04)'
                                    }}>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        {info.label}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500 }}>
                                        {info.value}
                                    </Typography>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Quick Actions
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1
                                }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    sx={{
                                        justifyContent: 'flex-start',
                                        borderColor: 'rgba(255, 255, 255, 0.1)'
                                    }}>
                                    Export Configuration
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    sx={{
                                        justifyContent: 'flex-start',
                                        borderColor: 'rgba(255, 255, 255, 0.1)'
                                    }}>
                                    Import Configuration
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    sx={{
                                        justifyContent: 'flex-start',
                                        borderColor: 'rgba(255, 255, 255, 0.1)'
                                    }}>
                                    Download Server Logs
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Dialog
                open={clearDialogOpen}
                onClose={() => setClearDialogOpen(false)}>
                <DialogTitle>Clear Simulation Data</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently delete all simulation data
                        including agent events, discovered machines, and
                        reports. This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClearDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => setClearDialogOpen(false)}>
                        Clear All Data
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
