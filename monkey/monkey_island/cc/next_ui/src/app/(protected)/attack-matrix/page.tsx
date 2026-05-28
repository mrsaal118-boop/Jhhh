'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import SecurityIcon from '@mui/icons-material/Security';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getApiUrl } from '@/lib/apiPort';
import { getScanResults, getPropagationTree } from '@/lib/appState';

interface Technique {
    id: string;
    name: string;
    subtechniques?: string[];
}

interface TechniqueMap {
    [tactic: string]: Technique[];
}

interface ToolInfo {
    [name: string]: string;
}

const TACTIC_COLORS: Record<string, string> = {
    reconnaissance: '#e91e63',
    discovery: '#9c27b0',
    credential_access: '#f44336',
    lateral_movement: '#ff9800',
    execution: '#ff5722',
    collection: '#795548',
    exfiltration: '#607d8b'
};

const TACTIC_LABELS: Record<string, string> = {
    reconnaissance: 'Reconnaissance',
    discovery: 'Discovery',
    credential_access: 'Credential Access',
    lateral_movement: 'Lateral Movement',
    execution: 'Execution',
    collection: 'Collection',
    exfiltration: 'Exfiltration'
};

export default function ATTACKMatrixPage() {
    const [techniques, setTechniques] = useState<TechniqueMap>({});
    const [tools, setTools] = useState<ToolInfo>({});
    const [loading, setLoading] = useState(true);
    const [usedTechniques, setUsedTechniques] = useState<Set<string>>(
        new Set()
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [techResp, toolResp] = await Promise.all([
                fetch(getApiUrl('/api/attack-techniques')),
                fetch(getApiUrl('/api/detect-tools'))
            ]);
            const techData = await techResp.json();
            const toolData = await toolResp.json();
            setTechniques(techData);
            setTools(toolData.tools || {});

            // Get used techniques from scan results
            const scanResults = getScanResults();
            const propTree = getPropagationTree();
            const used = new Set<string>();

            scanResults.forEach((r) => {
                if (r.attackTechniques) {
                    r.attackTechniques.forEach((t) => used.add(t.id));
                }
                if (r.alive) {
                    used.add('T1595');
                    used.add('T1046');
                }
                if (r.exploited) used.add('T1110');
                if (r.ports?.some((p) => p.state === 'open')) used.add('T1046');
            });

            propTree.forEach((n) => {
                if (n.attackTechniques) {
                    n.attackTechniques.forEach((t) => used.add(t));
                }
                if (n.status === 'exploited' || n.status === 'implanted') {
                    if (n.exploitUsed?.includes('SSH')) used.add('T1021.004');
                    if (n.exploitUsed?.includes('SMB')) used.add('T1021.002');
                    if (n.exploitUsed?.includes('RDP')) used.add('T1021.001');
                    if (n.exploitUsed?.includes('WinRM')) used.add('T1021.006');
                    if (n.exploitUsed?.includes('Impacket')) used.add('T1569');
                    if (n.exploitUsed?.includes('wmiexec')) used.add('T1047');
                    used.add('T1078');
                }
            });

            setUsedTechniques(used);
        } catch {
            // API may not be available yet
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalTechniques = Object.values(techniques).reduce(
        (sum, arr) => sum + (arr as Technique[]).length,
        0
    );
    const usedCount = usedTechniques.size;
    const toolCount = Object.keys(tools).length;

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '60vh'
                }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 3
                }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <SecurityIcon sx={{ fontSize: 32, color: '#e91e63' }} />
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        MITRE ATT&CK Matrix
                    </Typography>
                    <Chip
                        label="Caldera v5 Inspired"
                        size="small"
                        sx={{
                            bgcolor: 'rgba(233,30,99,0.15)',
                            color: '#e91e63'
                        }}
                    />
                </Box>
                <Button
                    startIcon={<RefreshIcon />}
                    onClick={loadData}
                    variant="outlined"
                    size="small">
                    Refresh
                </Button>
            </Box>

            {/* Stats row */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Paper
                    sx={{
                        p: 2,
                        flex: 1,
                        minWidth: 200,
                        bgcolor: 'rgba(233,30,99,0.08)',
                        border: '1px solid rgba(233,30,99,0.3)'
                    }}>
                    <Typography variant="overline" color="text.secondary">
                        Total Techniques
                    </Typography>
                    <Typography
                        variant="h4"
                        sx={{ color: '#e91e63', fontWeight: 700 }}>
                        {totalTechniques}
                    </Typography>
                </Paper>
                <Paper
                    sx={{
                        p: 2,
                        flex: 1,
                        minWidth: 200,
                        bgcolor: 'rgba(76,175,80,0.08)',
                        border: '1px solid rgba(76,175,80,0.3)'
                    }}>
                    <Typography variant="overline" color="text.secondary">
                        Techniques Used
                    </Typography>
                    <Typography
                        variant="h4"
                        sx={{ color: '#4caf50', fontWeight: 700 }}>
                        {usedCount}
                    </Typography>
                </Paper>
                <Paper
                    sx={{
                        p: 2,
                        flex: 1,
                        minWidth: 200,
                        bgcolor: 'rgba(33,150,243,0.08)',
                        border: '1px solid rgba(33,150,243,0.3)'
                    }}>
                    <Typography variant="overline" color="text.secondary">
                        Tools Detected
                    </Typography>
                    <Typography
                        variant="h4"
                        sx={{ color: '#2196f3', fontWeight: 700 }}>
                        {toolCount}
                    </Typography>
                </Paper>
                <Paper
                    sx={{
                        p: 2,
                        flex: 1,
                        minWidth: 200,
                        bgcolor: 'rgba(255,152,0,0.08)',
                        border: '1px solid rgba(255,152,0,0.3)'
                    }}>
                    <Typography variant="overline" color="text.secondary">
                        Coverage
                    </Typography>
                    <Typography
                        variant="h4"
                        sx={{ color: '#ff9800', fontWeight: 700 }}>
                        {totalTechniques > 0
                            ? Math.round((usedCount / totalTechniques) * 100)
                            : 0}
                        %
                    </Typography>
                </Paper>
            </Box>

            {/* Installed Tools */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 2
                    }}>
                    <BuildIcon sx={{ color: '#2196f3' }} />
                    <Typography variant="h6">
                        Installed Exploitation Tools
                    </Typography>
                </Box>
                {toolCount > 0 ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {Object.keys(tools).map((t) => (
                            <Chip
                                key={t}
                                icon={<CheckCircleIcon />}
                                label={t}
                                color="success"
                                variant="outlined"
                            />
                        ))}
                    </Box>
                ) : (
                    <Alert severity="info">
                        No external tools detected. Install NetExec, Impacket,
                        Nmap, or Hydra to unlock more techniques.
                        <br />
                        <code>
                            pip install netexec impacket && sudo apt install
                            nmap hydra
                        </code>
                    </Alert>
                )}
            </Paper>

            {/* ATT&CK Matrix Grid */}
            <Box
                sx={{
                    display: 'flex',
                    gap: 2,
                    overflowX: 'auto',
                    pb: 2
                }}>
                {Object.entries(techniques).map(([tactic, techs]) => (
                    <Paper
                        key={tactic}
                        sx={{
                            minWidth: 220,
                            maxWidth: 280,
                            flex: '0 0 auto'
                        }}>
                        <Box
                            sx={{
                                p: 1.5,
                                bgcolor:
                                    TACTIC_COLORS[tactic] ||
                                    'rgba(255,255,255,0.1)',
                                borderBottom: `3px solid ${
                                    TACTIC_COLORS[tactic] || '#666'
                                }`
                            }}>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: 700,
                                    color: '#fff',
                                    textTransform: 'uppercase',
                                    fontSize: '0.7rem',
                                    letterSpacing: '0.05em'
                                }}>
                                {TACTIC_LABELS[tactic] || tactic}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                {(techs as Technique[]).length} techniques
                            </Typography>
                        </Box>
                        <Box sx={{ p: 1 }}>
                            {(techs as Technique[]).map((tech) => {
                                const isUsed =
                                    usedTechniques.has(tech.id) ||
                                    (tech.subtechniques &&
                                        tech.subtechniques.some((st) =>
                                            usedTechniques.has(st)
                                        ));
                                return (
                                    <Tooltip
                                        key={tech.id}
                                        title={`${tech.id}: ${tech.name}${
                                            isUsed ? ' (USED)' : ''
                                        }`}
                                        arrow>
                                        <Box
                                            sx={{
                                                p: 0.8,
                                                mb: 0.5,
                                                borderRadius: 1,
                                                cursor: 'pointer',
                                                bgcolor: isUsed
                                                    ? 'rgba(76,175,80,0.15)'
                                                    : 'rgba(255,255,255,0.03)',
                                                border: isUsed
                                                    ? '1px solid rgba(76,175,80,0.5)'
                                                    : '1px solid rgba(255,255,255,0.08)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.5,
                                                '&:hover': {
                                                    bgcolor: isUsed
                                                        ? 'rgba(76,175,80,0.25)'
                                                        : 'rgba(255,255,255,0.08)'
                                                }
                                            }}>
                                            {isUsed ? (
                                                <CheckCircleIcon
                                                    sx={{
                                                        fontSize: 14,
                                                        color: '#4caf50'
                                                    }}
                                                />
                                            ) : (
                                                <CancelIcon
                                                    sx={{
                                                        fontSize: 14,
                                                        color: 'rgba(255,255,255,0.2)'
                                                    }}
                                                />
                                            )}
                                            <Box>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: 'block',
                                                        fontWeight: isUsed
                                                            ? 700
                                                            : 400,
                                                        color: isUsed
                                                            ? '#4caf50'
                                                            : 'text.secondary',
                                                        fontSize: '0.68rem',
                                                        lineHeight: 1.3
                                                    }}>
                                                    {tech.id}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: 'block',
                                                        color: isUsed
                                                            ? 'text.primary'
                                                            : 'text.secondary',
                                                        fontSize: '0.62rem',
                                                        lineHeight: 1.2
                                                    }}>
                                                    {tech.name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Tooltip>
                                );
                            })}
                        </Box>
                    </Paper>
                ))}
            </Box>

            {/* Legend */}
            <Paper sx={{ p: 2, mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Legend
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                        }}>
                        <CheckCircleIcon
                            sx={{ fontSize: 16, color: '#4caf50' }}
                        />
                        <Typography variant="caption">
                            Technique Used in Scan
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                        }}>
                        <CancelIcon
                            sx={{
                                fontSize: 16,
                                color: 'rgba(255,255,255,0.2)'
                            }}
                        />
                        <Typography variant="caption">
                            Technique Available (Not Used)
                        </Typography>
                    </Box>
                </Box>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}>
                    Based on MITRE ATT&CK Framework. Technique coverage
                    increases when external tools (NetExec, Impacket, Nmap,
                    Hydra) are installed.
                </Typography>
            </Paper>
        </Box>
    );
}
