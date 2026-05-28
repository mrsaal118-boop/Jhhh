'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ComputerIcon from '@mui/icons-material/Computer';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import BugReportIcon from '@mui/icons-material/BugReport';
import Grid from '@mui/material/Unstable_Grid2';
import {
    getPropagationTree,
    getScanResults,
    type PropagationNode,
    type ScanResult
} from '@/lib/appState';

function getStatusColor(status: string): string {
    switch (status) {
        case 'implanted':
            return '#FF5252';
        case 'exploited':
            return '#FFB74D';
        case 'scanned':
            return '#40C4FF';
        case 'failed':
            return '#666';
        default:
            return '#999';
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case 'implanted':
            return <BugReportIcon sx={{ color: '#FF5252', fontSize: 20 }} />;
        case 'exploited':
            return <SecurityIcon sx={{ color: '#FFB74D', fontSize: 20 }} />;
        case 'scanned':
            return <ComputerIcon sx={{ color: '#40C4FF', fontSize: 20 }} />;
        case 'failed':
            return <CancelIcon sx={{ color: '#666', fontSize: 20 }} />;
        default:
            return <ComputerIcon sx={{ color: '#999', fontSize: 20 }} />;
    }
}

function TreeNodeCard({
    node,
    scanResult
}: {
    node: PropagationNode;
    scanResult?: ScanResult;
}) {
    const statusColor = getStatusColor(node.status);
    const openPorts = node.openPorts || [];

    return (
        <Card sx={{ mb: 2, borderLeft: `3px solid ${statusColor}` }}>
            <CardContent sx={{ p: 2 }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 1
                    }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(node.status)}
                        <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                            {node.ip}
                        </Typography>
                        {node.hostname && node.hostname !== node.ip && (
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary' }}>
                                ({node.hostname})
                            </Typography>
                        )}
                    </Box>
                    <Chip
                        label={node.status.toUpperCase()}
                        size="small"
                        sx={{
                            backgroundColor: `${statusColor}20`,
                            color: statusColor,
                            fontWeight: 700,
                            fontSize: '0.7rem'
                        }}
                    />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                    {node.os && (
                        <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}>
                            OS: <strong>{node.os}</strong>
                        </Typography>
                    )}
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}>
                        Open Ports: <strong>{openPorts.length}</strong>
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}>
                        Discovered:{' '}
                        {new Date(node.discoveredAt).toLocaleTimeString()}
                    </Typography>
                </Box>

                {openPorts.length > 0 && (
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 0.5,
                            flexWrap: 'wrap',
                            mb: 1
                        }}>
                        {openPorts.map((p) => (
                            <Chip
                                key={p.port}
                                label={`${p.port}/${p.service}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                        ))}
                    </Box>
                )}

                {node.exploitUsed && (
                    <Alert
                        severity="error"
                        sx={{
                            py: 0,
                            mt: 1,
                            backgroundColor: 'rgba(255, 82, 82, 0.08)'
                        }}>
                        <Typography variant="caption">
                            Exploit: <strong>{node.exploitUsed}</strong>
                        </Typography>
                    </Alert>
                )}

                {scanResult && scanResult.vulnerabilities.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                        <Typography
                            variant="caption"
                            sx={{ color: '#FFB74D', fontWeight: 600 }}>
                            Vulnerabilities:
                        </Typography>
                        {scanResult.vulnerabilities.map((v, i) => (
                            <Typography
                                key={i}
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    color: 'text.secondary',
                                    pl: 1
                                }}>
                                - {v}
                            </Typography>
                        ))}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export default function PropagationTreePage() {
    const [tree, setTree] = useState<PropagationNode[]>([]);
    const [scanResults, setScanResults] = useState<ScanResult[]>([]);
    useEffect(() => {
        const refresh = () => {
            setTree(getPropagationTree());
            setScanResults(getScanResults());
        };
        refresh();
        const interval = setInterval(refresh, 3000);
        return () => clearInterval(interval);
    }, []);

    const implanted = tree.filter((n) => n.status === 'implanted');
    const exploited = tree.filter((n) => n.status === 'exploited');
    const scanned = tree.filter((n) => n.status === 'scanned');
    const failed = tree.filter((n) => n.status === 'failed');

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
                        <AccountTreeIcon
                            sx={{
                                mr: 1,
                                verticalAlign: 'middle',
                                color: '#FF5252'
                            }}
                        />
                        Propagation Tree
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Real-time view of network spread, exploitation status,
                        and implant deployment
                    </Typography>
                </Box>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid xs={6} sm={3}>
                    <Card>
                        <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography
                                variant="h4"
                                sx={{ fontWeight: 800, color: '#40C4FF' }}>
                                {scanned.length}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}>
                                Scanned
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid xs={6} sm={3}>
                    <Card>
                        <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography
                                variant="h4"
                                sx={{ fontWeight: 800, color: '#FFB74D' }}>
                                {exploited.length}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}>
                                Exploited
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid xs={6} sm={3}>
                    <Card>
                        <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography
                                variant="h4"
                                sx={{ fontWeight: 800, color: '#FF5252' }}>
                                {implanted.length}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}>
                                Implanted
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid xs={6} sm={3}>
                    <Card>
                        <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography
                                variant="h4"
                                sx={{ fontWeight: 800, color: '#666' }}>
                                {failed.length}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}>
                                Failed
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {tree.length === 0 ? (
                <Card>
                    <CardContent sx={{ p: 4, textAlign: 'center' }}>
                        <AccountTreeIcon
                            sx={{
                                fontSize: 64,
                                color: 'text.secondary',
                                mb: 2
                            }}
                        />
                        <Typography
                            variant="h6"
                            sx={{ color: 'text.secondary' }}>
                            No propagation data yet
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', mt: 1 }}>
                            Run a network scan from the Dashboard or Run page to
                            see the propagation tree. The tree shows which hosts
                            were discovered, which were successfully exploited,
                            and where agents were implanted.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Grid container spacing={2.5}>
                    {/* Visual Tree */}
                    <Grid xs={12} lg={7}>
                        <Card>
                            <CardContent sx={{ p: 2.5 }}>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700, mb: 2 }}>
                                    Network Topology
                                </Typography>

                                {/* Island (source) node */}
                                <Card
                                    sx={{
                                        mb: 2,
                                        borderLeft: '3px solid #00E676',
                                        backgroundColor:
                                            'rgba(0, 230, 118, 0.05)'
                                    }}>
                                    <CardContent sx={{ p: 1.5 }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}>
                                            <CheckCircleIcon
                                                sx={{
                                                    color: '#00E676',
                                                    fontSize: 20
                                                }}
                                            />
                                            <Typography
                                                variant="subtitle2"
                                                sx={{ fontWeight: 700 }}>
                                                Monkey Island (Origin)
                                            </Typography>
                                            <Chip
                                                label="ACTIVE"
                                                size="small"
                                                color="success"
                                                sx={{
                                                    height: 18,
                                                    fontSize: '0.6rem'
                                                }}
                                            />
                                        </Box>
                                    </CardContent>
                                </Card>

                                {/* Connection lines */}
                                <Box
                                    sx={{
                                        borderLeft:
                                            '2px dashed rgba(255,255,255,0.1)',
                                        ml: 2,
                                        pl: 3
                                    }}>
                                    {/* Implanted nodes first */}
                                    {implanted.map((node) => (
                                        <TreeNodeCard
                                            key={node.id}
                                            node={node}
                                            scanResult={scanResults.find(
                                                (s) => s.ip === node.ip
                                            )}
                                        />
                                    ))}

                                    {/* Exploited nodes */}
                                    {exploited.map((node) => (
                                        <TreeNodeCard
                                            key={node.id}
                                            node={node}
                                            scanResult={scanResults.find(
                                                (s) => s.ip === node.ip
                                            )}
                                        />
                                    ))}

                                    {/* Scanned-only nodes */}
                                    {scanned.map((node) => (
                                        <TreeNodeCard
                                            key={node.id}
                                            node={node}
                                            scanResult={scanResults.find(
                                                (s) => s.ip === node.ip
                                            )}
                                        />
                                    ))}

                                    {/* Failed nodes */}
                                    {failed.map((node) => (
                                        <TreeNodeCard
                                            key={node.id}
                                            node={node}
                                            scanResult={scanResults.find(
                                                (s) => s.ip === node.ip
                                            )}
                                        />
                                    ))}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Details Table */}
                    <Grid xs={12} lg={5}>
                        <Card>
                            <CardContent sx={{ p: 2.5 }}>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700, mb: 2 }}>
                                    Host Details
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell
                                                    sx={{ fontWeight: 700 }}>
                                                    IP
                                                </TableCell>
                                                <TableCell
                                                    sx={{ fontWeight: 700 }}>
                                                    OS
                                                </TableCell>
                                                <TableCell
                                                    sx={{ fontWeight: 700 }}>
                                                    Ports
                                                </TableCell>
                                                <TableCell
                                                    sx={{ fontWeight: 700 }}>
                                                    Status
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {tree.map((node) => (
                                                <TableRow key={node.id}>
                                                    <TableCell
                                                        sx={{
                                                            fontFamily:
                                                                'monospace',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                        {node.ip}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{
                                                            fontSize: '0.75rem'
                                                        }}>
                                                        {node.os || '?'}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{
                                                            fontSize: '0.75rem'
                                                        }}>
                                                        {node.openPorts.length}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={node.status}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: `${getStatusColor(
                                                                    node.status
                                                                )}20`,
                                                                color: getStatusColor(
                                                                    node.status
                                                                ),
                                                                fontSize:
                                                                    '0.65rem',
                                                                height: 20,
                                                                fontWeight: 600
                                                            }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>

                        {/* Legend */}
                        <Card sx={{ mt: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 700, mb: 1 }}>
                                    Legend
                                </Typography>
                                {[
                                    {
                                        status: 'Scanned',
                                        color: '#40C4FF',
                                        desc: 'Host discovered, ports scanned'
                                    },
                                    {
                                        status: 'Exploited',
                                        color: '#FFB74D',
                                        desc: 'Credentials worked, access gained'
                                    },
                                    {
                                        status: 'Implanted',
                                        color: '#FF5252',
                                        desc: 'Agent deployed on host'
                                    },
                                    {
                                        status: 'Failed',
                                        color: '#666',
                                        desc: 'Exploitation attempts failed'
                                    }
                                ].map((item) => (
                                    <Box
                                        key={item.status}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            mb: 0.5
                                        }}>
                                        <Box
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                backgroundColor: item.color
                                            }}
                                        />
                                        <Typography variant="caption">
                                            <strong>{item.status}</strong>:{' '}
                                            {item.desc}
                                        </Typography>
                                    </Box>
                                ))}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
}
