'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import SecurityIcon from '@mui/icons-material/Security';
import LockIcon from '@mui/icons-material/Lock';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import WarningIcon from '@mui/icons-material/Warning';
import ShieldIcon from '@mui/icons-material/Shield';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';

export default function ReportPage() {
    const router = useRouter();
    const hasReport = false;

    if (!hasReport) {
        return (
            <Box>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        Reports
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Security assessment and compliance reports
                    </Typography>
                </Box>

                <Grid container spacing={2.5}>
                    <Grid xs={12} md={6}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: 3, textAlign: 'center' }}>
                                <Box
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '50%',
                                        backgroundColor:
                                            'rgba(0, 230, 118, 0.06)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mx: 'auto',
                                        mb: 2
                                    }}>
                                    <SecurityIcon
                                        sx={{
                                            fontSize: 40,
                                            color: 'primary.main',
                                            opacity: 0.5
                                        }}
                                    />
                                </Box>
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                    Security Report
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ color: 'text.secondary', mb: 3 }}>
                                    Comprehensive security assessment including
                                    discovered vulnerabilities, exploitation
                                    paths, and security recommendations.
                                </Typography>
                                <Chip
                                    label="No data yet"
                                    size="small"
                                    sx={{ mb: 2 }}
                                />
                                <Box>
                                    <Button
                                        variant="outlined"
                                        startIcon={<PlayArrowIcon />}
                                        onClick={() => router.push(PATHS.RUN)}
                                        size="small">
                                        Run Simulation First
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid xs={12} md={6}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: 3, textAlign: 'center' }}>
                                <Box
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '50%',
                                        backgroundColor:
                                            'rgba(255, 82, 82, 0.06)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mx: 'auto',
                                        mb: 2
                                    }}>
                                    <LockIcon
                                        sx={{
                                            fontSize: 40,
                                            color: '#FF5252',
                                            opacity: 0.5
                                        }}
                                    />
                                </Box>
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                    Ransomware Report
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ color: 'text.secondary', mb: 3 }}>
                                    Ransomware simulation results showing file
                                    encryption coverage, affected directories,
                                    and mitigation recommendations.
                                </Typography>
                                <Chip
                                    label="No data yet"
                                    size="small"
                                    sx={{ mb: 2 }}
                                />
                                <Box>
                                    <Button
                                        variant="outlined"
                                        startIcon={<PlayArrowIcon />}
                                        onClick={() => router.push(PATHS.RUN)}
                                        size="small">
                                        Run Simulation First
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid xs={12}>
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Report Categories
                                </Typography>
                                <Grid container spacing={2}>
                                    {[
                                        {
                                            title: 'Exploitation Analysis',
                                            desc: 'Details of successful and failed exploitation attempts',
                                            icon: <BugReportIcon />,
                                            color: '#FF5252'
                                        },
                                        {
                                            title: 'Network Segmentation',
                                            desc: 'Analysis of network boundaries and lateral movement paths',
                                            icon: <ShieldIcon />,
                                            color: '#40C4FF'
                                        },
                                        {
                                            title: 'Credential Security',
                                            desc: 'Stolen credentials and password security assessment',
                                            icon: <LockIcon />,
                                            color: '#FFB74D'
                                        },
                                        {
                                            title: 'MITRE ATT&CK Mapping',
                                            desc: 'Techniques and tactics mapped to the MITRE ATT&CK framework',
                                            icon: <WarningIcon />,
                                            color: '#7C4DFF'
                                        }
                                    ].map((cat) => (
                                        <Grid
                                            xs={12}
                                            sm={6}
                                            md={3}
                                            key={cat.title}>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    borderRadius: 2,
                                                    backgroundColor:
                                                        'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                                    height: '100%'
                                                }}>
                                                <Box
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 1.5,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent:
                                                            'center',
                                                        backgroundColor: `${cat.color}15`,
                                                        color: cat.color,
                                                        mb: 1.5
                                                    }}>
                                                    {cat.icon}
                                                </Box>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 600,
                                                        mb: 0.5
                                                    }}>
                                                    {cat.title}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: 'text.secondary'
                                                    }}>
                                                    {cat.desc}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>
        );
    }

    return null;
}
