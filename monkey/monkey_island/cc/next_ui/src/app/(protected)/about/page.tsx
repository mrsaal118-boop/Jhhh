'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import SecurityIcon from '@mui/icons-material/Security';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GroupsIcon from '@mui/icons-material/Groups';

export default function AboutPage() {
    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    About
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Infection Monkey - Open-Source Adversary Emulation Platform
                </Typography>
            </Box>

            <Grid container spacing={2.5}>
                <Grid xs={12} lg={8}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    mb: 3
                                }}>
                                <SecurityIcon
                                    sx={{ fontSize: 48, color: 'primary.main' }}
                                />
                                <Box>
                                    <Typography
                                        variant="h5"
                                        sx={{
                                            fontWeight: 800,
                                            background:
                                                'linear-gradient(135deg, #00E676 0%, #40C4FF 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent'
                                        }}>
                                        Infection Monkey
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'text.secondary' }}>
                                        Security Testing Platform
                                    </Typography>
                                </Box>
                            </Box>

                            <Typography
                                variant="body1"
                                sx={{ mb: 2, lineHeight: 1.8 }}>
                                Infection Monkey is an open-source adversary
                                emulation platform that helps you improve your
                                security posture using empirical data. The
                                Monkey uses various methods to self-propagate
                                across a network and reports its activities to a
                                centralized command and control server known as
                                Monkey Island.
                            </Typography>

                            <Typography
                                variant="body1"
                                sx={{ mb: 3, lineHeight: 1.8 }}>
                                Think of it as a &quot;malware vaccine&quot; —
                                it simulates real-world attack techniques in a
                                safe, controlled manner to help you identify
                                weaknesses in your network before real attackers
                                do.
                            </Typography>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Key Features
                            </Typography>
                            <Grid container spacing={1.5}>
                                {[
                                    'Network Propagation',
                                    'Credential Theft Simulation',
                                    'Ransomware Simulation',
                                    'SSH Exploitation',
                                    'SMB Exploitation',
                                    'Plugin Architecture',
                                    'Security Reports',
                                    'MITRE ATT&CK Mapping',
                                    'Network Topology Mapping',
                                    'Cross-Platform Support'
                                ].map((feature) => (
                                    <Grid key={feature} xs="auto">
                                        <Chip
                                            label={feature}
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                borderColor:
                                                    'rgba(0, 230, 118, 0.3)'
                                            }}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid xs={12} lg={4}>
                    <Card sx={{ mb: 2.5 }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Links
                            </Typography>
                            {[
                                {
                                    label: 'GitHub Repository',
                                    url: 'https://github.com/guardicore/monkey',
                                    icon: <GitHubIcon sx={{ fontSize: 20 }} />
                                },
                                {
                                    label: 'Documentation',
                                    url: 'https://techdocs.akamai.com/infection-monkey/docs/',
                                    icon: <MenuBookIcon sx={{ fontSize: 20 }} />
                                },
                                {
                                    label: 'Community',
                                    url: 'https://join.slack.com/t/infectionmonkey/shared_invite/zt-2cm5qiayf-yiEg5RPau0zQhki9xTlORA',
                                    icon: <GroupsIcon sx={{ fontSize: 20 }} />
                                }
                            ].map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="none"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        p: 1.5,
                                        borderRadius: 2,
                                        color: 'text.primary',
                                        transition: 'all 0.15s',
                                        '&:hover': {
                                            backgroundColor:
                                                'rgba(255, 255, 255, 0.04)'
                                        }
                                    }}>
                                    <Box sx={{ color: 'primary.main' }}>
                                        {link.icon}
                                    </Box>
                                    <Typography variant="body2">
                                        {link.label}
                                    </Typography>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                License
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary', mb: 1.5 }}>
                                GNU General Public License v3.0
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}>
                                Copyright (c) Guardicore Ltd. This software is
                                free and open-source, distributed under the
                                GPLv3 license.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
