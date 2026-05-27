'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Unstable_Grid2';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FilterListIcon from '@mui/icons-material/FilterList';
import DevicesIcon from '@mui/icons-material/Devices';
import RouterIcon from '@mui/icons-material/Router';
import DnsIcon from '@mui/icons-material/Dns';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';

export default function NetworkMapPage() {
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
                        Network Map
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Visual representation of discovered network topology
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Filter nodes">
                        <IconButton
                            size="small"
                            sx={{ color: 'text.secondary' }}>
                            <FilterListIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh map">
                        <IconButton
                            size="small"
                            sx={{ color: 'text.secondary' }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Fullscreen">
                        <IconButton
                            size="small"
                            sx={{ color: 'text.secondary' }}>
                            <FullscreenIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={9}>
                    <Card sx={{ height: 500 }}>
                        <CardContent
                            sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                            <Box
                                sx={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(0, 230, 118, 0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 3
                                }}>
                                <MapIcon
                                    sx={{
                                        fontSize: 56,
                                        color: 'primary.main',
                                        opacity: 0.4
                                    }}
                                />
                            </Box>
                            <Typography
                                variant="h6"
                                sx={{ mb: 1, color: 'text.secondary' }}>
                                No Network Data Available
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.secondary',
                                    mb: 3,
                                    textAlign: 'center',
                                    maxWidth: 420
                                }}>
                                Run a simulation to discover machines and map
                                the network topology. The map will show all
                                discovered nodes, connections, and exploitation
                                paths.
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PlayArrowIcon />}
                                onClick={() => router.push(PATHS.RUN)}
                                sx={{ color: '#000' }}>
                                Start Simulation
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid xs={12} lg={3}>
                    <Card sx={{ mb: 2 }}>
                        <CardContent sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                                Network Summary
                            </Typography>
                            {[
                                {
                                    label: 'Total Nodes',
                                    value: '0',
                                    icon: <DevicesIcon sx={{ fontSize: 18 }} />,
                                    color: '#40C4FF'
                                },
                                {
                                    label: 'Exploited',
                                    value: '0',
                                    icon: <DnsIcon sx={{ fontSize: 18 }} />,
                                    color: '#FF5252'
                                },
                                {
                                    label: 'Scanned',
                                    value: '0',
                                    icon: <RouterIcon sx={{ fontSize: 18 }} />,
                                    color: '#FFB74D'
                                }
                            ].map((stat) => (
                                <Box
                                    key={stat.label}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        py: 1,
                                        borderBottom:
                                            '1px solid rgba(255, 255, 255, 0.04)'
                                    }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1
                                        }}>
                                        <Box sx={{ color: stat.color }}>
                                            {stat.icon}
                                        </Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary' }}>
                                            {stat.label}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600 }}>
                                        {stat.value}
                                    </Typography>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                                Legend
                            </Typography>
                            {[
                                { label: 'Island Server', color: '#00E676' },
                                {
                                    label: 'Exploited Machine',
                                    color: '#FF5252'
                                },
                                { label: 'Scanned Machine', color: '#40C4FF' },
                                { label: 'Agent Active', color: '#FFB74D' }
                            ].map((item) => (
                                <Box
                                    key={item.label}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        py: 0.6
                                    }}>
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            backgroundColor: item.color
                                        }}
                                    />
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}>
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
