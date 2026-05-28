'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CloseIcon from '@mui/icons-material/Close';
import Grid from '@mui/material/Unstable_Grid2';
import {
    getPropagationTree,
    getScanResults,
    type PropagationNode,
    type ScanResult
} from '@/lib/appState';

const STATUS_COLORS: Record<string, string> = {
    origin: '#00E676',
    implanted: '#FF5252',
    exploited: '#FFB74D',
    scanned: '#40C4FF',
    failed: '#555'
};

const STATUS_LABELS: Record<string, string> = {
    origin: 'Origin (Island)',
    implanted: 'Agent Implanted',
    exploited: 'Access Gained',
    scanned: 'Scanned',
    failed: 'Failed'
};

interface TreePosition {
    node: PropagationNode | null;
    x: number;
    y: number;
    isOrigin?: boolean;
}

function DynamicTree({
    nodes,
    scanResults,
    onNodeClick
}: {
    nodes: PropagationNode[];
    scanResults: ScanResult[];
    onNodeClick: (node: PropagationNode | null, scan?: ScanResult) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [positions, setPositions] = useState<TreePosition[]>([]);
    const animRef = useRef<number>(0);
    const pulseRef = useRef(0);

    const calculatePositions = useCallback(() => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const pos: TreePosition[] = [];

        // Origin node at top center
        pos.push({ node: null, x: w / 2, y: 60, isOrigin: true });

        if (nodes.length === 0) {
            setPositions(pos);
            return;
        }

        // Group by status for visual layout
        const implanted = nodes.filter((n) => n.status === 'implanted');
        const exploited = nodes.filter((n) => n.status === 'exploited');
        const scanned = nodes.filter((n) => n.status === 'scanned');
        const failed = nodes.filter((n) => n.status === 'failed');

        const groups = [implanted, exploited, scanned, failed].filter(
            (g) => g.length > 0
        );
        let currentY = 160;

        groups.forEach((group) => {
            const spacing = Math.min(180, (w - 80) / Math.max(1, group.length));
            const startX = w / 2 - ((group.length - 1) * spacing) / 2;

            group.forEach((node, i) => {
                const jitter = Math.sin(i * 2.7) * 15;
                pos.push({
                    node,
                    x: startX + i * spacing,
                    y: currentY + jitter
                });
            });
            currentY += 130;
        });

        setPositions(pos);
    }, [nodes]);

    useEffect(() => {
        calculatePositions();
        window.addEventListener('resize', calculatePositions);
        return () => window.removeEventListener('resize', calculatePositions);
    }, [calculatePositions]);

    // Animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || positions.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const animate = () => {
            pulseRef.current += 0.02;
            const pulse = Math.sin(pulseRef.current) * 0.3 + 0.7;

            const container = containerRef.current;
            if (!container) return;
            canvas.width = container.clientWidth;
            canvas.height = Math.max(500, 120 + nodes.length * 70);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const origin = positions[0];
            if (!origin) return;

            // Draw connections from origin to each node
            positions.slice(1).forEach((pos) => {
                if (!pos.node) return;
                const color = STATUS_COLORS[pos.node.status] || '#555';

                // Curved connection line
                ctx.beginPath();
                ctx.moveTo(origin.x, origin.y + 20);

                const midY = (origin.y + 20 + pos.y) / 2;
                ctx.bezierCurveTo(
                    origin.x,
                    midY,
                    pos.x,
                    midY,
                    pos.x,
                    pos.y - 20
                );

                ctx.strokeStyle = color + '60';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Animated data packet dot
                const t =
                    ((pulseRef.current * 0.5 + positions.indexOf(pos) * 0.3) %
                        1.0) *
                    1.0;
                const packetX =
                    (1 - t) * (1 - t) * (1 - t) * origin.x +
                    3 * (1 - t) * (1 - t) * t * origin.x +
                    3 * (1 - t) * t * t * pos.x +
                    t * t * t * pos.x;
                const packetY =
                    (1 - t) * (1 - t) * (1 - t) * (origin.y + 20) +
                    3 * (1 - t) * (1 - t) * t * midY +
                    3 * (1 - t) * t * t * midY +
                    t * t * t * (pos.y - 20);

                ctx.beginPath();
                ctx.arc(packetX, packetY, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            });

            // Draw origin node
            const originPulse = 18 + pulse * 4;
            ctx.beginPath();
            ctx.arc(origin.x, origin.y, originPulse, 0, Math.PI * 2);
            ctx.fillStyle = STATUS_COLORS.origin + '30';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(origin.x, origin.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = STATUS_COLORS.origin;
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('M', origin.x, origin.y);
            ctx.fillStyle = '#fff';
            ctx.font = '11px sans-serif';
            ctx.fillText('Monkey Island', origin.x, origin.y + 30);

            // Draw each node
            positions.slice(1).forEach((pos) => {
                if (!pos.node) return;
                const color = STATUS_COLORS[pos.node.status] || '#555';
                const r = 22;

                // Glow
                const glow =
                    pos.node.status === 'implanted' ||
                    pos.node.status === 'exploited'
                        ? r + pulse * 6
                        : r + 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, glow, 0, Math.PI * 2);
                ctx.fillStyle = color + '20';
                ctx.fill();

                // Main circle
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
                ctx.fillStyle = '#1a1a2e';
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.stroke();

                // Icon
                ctx.fillStyle = color;
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const icon =
                    pos.node.status === 'implanted'
                        ? '!!'
                        : pos.node.status === 'exploited'
                          ? 'EX'
                          : pos.node.status === 'scanned'
                            ? 'SC'
                            : 'X';
                ctx.fillText(icon, pos.x, pos.y);

                // IP label
                ctx.fillStyle = '#ccc';
                ctx.font = '10px monospace';
                ctx.fillText(pos.node.ip, pos.x, pos.y + r + 14);

                // Port count
                const openPorts = pos.node.openPorts?.length || 0;
                if (openPorts > 0) {
                    ctx.fillStyle = '#888';
                    ctx.font = '9px sans-serif';
                    ctx.fillText(`${openPorts} ports`, pos.x, pos.y + r + 26);
                }
            });

            animRef.current = requestAnimationFrame(animate);
        };

        animRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animRef.current);
    }, [positions, nodes]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        for (const pos of positions.slice(1)) {
            if (!pos.node) continue;
            const dx = mx - pos.x;
            const dy = my - pos.y;
            if (dx * dx + dy * dy < 30 * 30) {
                const scan = scanResults.find((s) => s.ip === pos.node?.ip);
                onNodeClick(pos.node, scan);
                return;
            }
        }
    };

    const treeHeight = Math.max(500, 120 + nodes.length * 70);

    return (
        <Box
            ref={containerRef}
            sx={{
                position: 'relative',
                width: '100%',
                height: treeHeight,
                borderRadius: 2,
                overflow: 'hidden',
                backgroundColor: '#0a0a1a'
            }}>
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer'
                }}
                onClick={handleCanvasClick}
            />
        </Box>
    );
}

export default function PropagationTreePage() {
    const [tree, setTree] = useState<PropagationNode[]>([]);
    const [scanResults, setScanResults] = useState<ScanResult[]>([]);
    const [selectedNode, setSelectedNode] = useState<PropagationNode | null>(
        null
    );
    const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        const refresh = () => {
            setTree(getPropagationTree());
            setScanResults(getScanResults());
        };
        refresh();
        const interval = setInterval(refresh, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleNodeClick = (
        node: PropagationNode | null,
        scan?: ScanResult
    ) => {
        if (!node) return;
        setSelectedNode(node);
        setSelectedScan(scan || null);
        setDialogOpen(true);
    };

    const implanted = tree.filter((n) => n.status === 'implanted');
    const exploited = tree.filter((n) => n.status === 'exploited');
    const scannedOnly = tree.filter((n) => n.status === 'scanned');
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
                        Dynamic visualization of network spread and exploitation
                        chain - click any node for details
                    </Typography>
                </Box>
            </Box>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    {
                        label: 'Total Hosts',
                        value: tree.length,
                        color: '#40C4FF',
                        detail: `${scannedOnly.length} scanned only`
                    },
                    {
                        label: 'Exploited',
                        value: exploited.length + implanted.length,
                        color: '#FFB74D'
                    },
                    {
                        label: 'Implanted',
                        value: implanted.length,
                        color: '#FF5252'
                    },
                    {
                        label: 'Failed',
                        value: failed.length,
                        color: '#555'
                    }
                ].map((stat) => (
                    <Grid key={stat.label} xs={6} sm={3}>
                        <Card>
                            <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                <Typography
                                    variant="h4"
                                    sx={{
                                        fontWeight: 800,
                                        color: stat.color
                                    }}>
                                    {stat.value}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{ color: 'text.secondary' }}>
                                    {stat.label}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
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
                            sx={{
                                color: 'text.secondary',
                                mt: 1,
                                maxWidth: 500,
                                mx: 'auto'
                            }}>
                            Run a network scan from the Dashboard to see the
                            propagation tree. The tree will show discovered
                            hosts, exploitation paths, and implanted agents in
                            real-time.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Dynamic Visual Tree */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent sx={{ p: 1 }}>
                            <DynamicTree
                                nodes={tree}
                                scanResults={scanResults}
                                onNodeClick={handleNodeClick}
                            />
                        </CardContent>
                    </Card>

                    {/* Legend */}
                    <Card>
                        <CardContent
                            sx={{
                                p: 2,
                                display: 'flex',
                                gap: 3,
                                flexWrap: 'wrap',
                                justifyContent: 'center'
                            }}>
                            {[
                                {
                                    status: 'Origin',
                                    color: STATUS_COLORS.origin,
                                    desc: 'Monkey Island'
                                },
                                {
                                    status: 'Scanned',
                                    color: STATUS_COLORS.scanned,
                                    desc: 'Ports scanned'
                                },
                                {
                                    status: 'Exploited',
                                    color: STATUS_COLORS.exploited,
                                    desc: 'Access gained'
                                },
                                {
                                    status: 'Implanted',
                                    color: STATUS_COLORS.implanted,
                                    desc: 'Agent deployed'
                                },
                                {
                                    status: 'Failed',
                                    color: STATUS_COLORS.failed,
                                    desc: 'No access'
                                }
                            ].map((item) => (
                                <Box
                                    key={item.status}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.8
                                    }}>
                                    <Box
                                        sx={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            backgroundColor: item.color
                                        }}
                                    />
                                    <Typography variant="caption">
                                        <strong>{item.status}</strong>
                                        {' - '}
                                        {item.desc}
                                    </Typography>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Node Details Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        backgroundColor: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }
                }}>
                {selectedNode && (
                    <>
                        <DialogTitle
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                <Box
                                    sx={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: '50%',
                                        backgroundColor:
                                            STATUS_COLORS[selectedNode.status]
                                    }}
                                />
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontFamily: 'monospace',
                                        fontWeight: 700
                                    }}>
                                    {selectedNode.ip}
                                </Typography>
                            </Box>
                            <IconButton
                                onClick={() => setDialogOpen(false)}
                                size="small">
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <Table size="small">
                                <TableBody>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 700,
                                                color: 'text.secondary',
                                                width: 140
                                            }}>
                                            Status
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={
                                                    STATUS_LABELS[
                                                        selectedNode.status
                                                    ] || selectedNode.status
                                                }
                                                size="small"
                                                sx={{
                                                    backgroundColor: `${
                                                        STATUS_COLORS[
                                                            selectedNode.status
                                                        ]
                                                    }20`,
                                                    color: STATUS_COLORS[
                                                        selectedNode.status
                                                    ],
                                                    fontWeight: 700
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 700,
                                                color: 'text.secondary'
                                            }}>
                                            Hostname
                                        </TableCell>
                                        <TableCell>
                                            {selectedNode.hostname || 'Unknown'}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 700,
                                                color: 'text.secondary'
                                            }}>
                                            OS
                                        </TableCell>
                                        <TableCell>
                                            {selectedNode.os || 'Unknown'}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 700,
                                                color: 'text.secondary'
                                            }}>
                                            Discovered
                                        </TableCell>
                                        <TableCell>
                                            {new Date(
                                                selectedNode.discoveredAt
                                            ).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                    {selectedNode.exploitUsed && (
                                        <TableRow>
                                            <TableCell
                                                sx={{
                                                    fontWeight: 700,
                                                    color: '#FF5252'
                                                }}>
                                                Exploit Used
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    color: '#FF5252'
                                                }}>
                                                {selectedNode.exploitUsed}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 700,
                                                color: 'text.secondary'
                                            }}>
                                            Open Ports
                                        </TableCell>
                                        <TableCell>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: 0.5
                                                }}>
                                                {selectedNode.openPorts
                                                    ?.length > 0
                                                    ? selectedNode.openPorts.map(
                                                          (p) => (
                                                              <Chip
                                                                  key={p.port}
                                                                  label={`${p.port}/${p.service}`}
                                                                  size="small"
                                                                  variant="outlined"
                                                                  sx={{
                                                                      fontSize:
                                                                          '0.65rem',
                                                                      height: 20
                                                                  }}
                                                              />
                                                          )
                                                      )
                                                    : 'None'}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                    {selectedScan &&
                                        selectedScan.vulnerabilities.length >
                                            0 && (
                                            <TableRow>
                                                <TableCell
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: '#FFB74D',
                                                        verticalAlign: 'top'
                                                    }}>
                                                    Vulnerabilities
                                                </TableCell>
                                                <TableCell>
                                                    {selectedScan.vulnerabilities.map(
                                                        (v, i) => (
                                                            <Typography
                                                                key={i}
                                                                variant="caption"
                                                                sx={{
                                                                    display:
                                                                        'block',
                                                                    color: '#FFB74D',
                                                                    mb: 0.3
                                                                }}>
                                                                - {v}
                                                            </Typography>
                                                        )
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                </TableBody>
                            </Table>

                            {selectedScan?.exploitMethod && (
                                <Alert
                                    severity="error"
                                    sx={{
                                        mt: 2,
                                        backgroundColor:
                                            'rgba(255, 82, 82, 0.08)'
                                    }}>
                                    <Typography variant="body2">
                                        <strong>Exploitation Method:</strong>{' '}
                                        {selectedScan.exploitMethod}
                                    </Typography>
                                    {selectedScan.implanted && (
                                        <Typography
                                            variant="body2"
                                            sx={{ mt: 0.5 }}>
                                            <strong>Agent Status:</strong>{' '}
                                            Implanted and active on this host
                                        </Typography>
                                    )}
                                </Alert>
                            )}

                            {/* ATT&CK Techniques */}
                            {selectedNode.attackTechniques &&
                                selectedNode.attackTechniques.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{
                                                fontWeight: 700,
                                                color: '#e91e63',
                                                mb: 1
                                            }}>
                                            MITRE ATT&CK Techniques
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 0.5
                                            }}>
                                            {selectedNode.attackTechniques.map(
                                                (t, i) => (
                                                    <Chip
                                                        key={i}
                                                        label={t}
                                                        size="small"
                                                        sx={{
                                                            bgcolor:
                                                                'rgba(233,30,99,0.15)',
                                                            color: '#e91e63',
                                                            fontSize: '0.65rem'
                                                        }}
                                                    />
                                                )
                                            )}
                                        </Box>
                                    </Box>
                                )}

                            {/* Tools Used */}
                            {selectedNode.toolsUsed &&
                                selectedNode.toolsUsed.length > 0 && (
                                    <Box sx={{ mt: 1.5 }}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{
                                                fontWeight: 700,
                                                color: '#2196f3',
                                                mb: 1
                                            }}>
                                            Tools Used
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 0.5
                                            }}>
                                            {selectedNode.toolsUsed.map(
                                                (t, i) => (
                                                    <Chip
                                                        key={i}
                                                        label={t}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            color: '#2196f3',
                                                            borderColor:
                                                                '#2196f3',
                                                            fontSize: '0.65rem'
                                                        }}
                                                    />
                                                )
                                            )}
                                        </Box>
                                    </Box>
                                )}

                            {/* Admin Badge */}
                            {selectedNode.admin && (
                                <Alert
                                    severity="warning"
                                    sx={{
                                        mt: 1.5,
                                        backgroundColor:
                                            'rgba(255, 152, 0, 0.08)'
                                    }}>
                                    <Typography variant="body2">
                                        <strong>ADMIN ACCESS</strong> - Full
                                        administrative privileges obtained
                                    </Typography>
                                </Alert>
                            )}
                        </DialogContent>
                    </>
                )}
            </Dialog>
        </Box>
    );
}
