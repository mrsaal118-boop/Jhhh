'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';
import { getEvents, type MonkeyEvent } from '@/lib/appState';

export default function EventsPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [allEvents, setAllEvents] = useState<MonkeyEvent[]>([]);

    const refreshEvents = useCallback(() => {
        setAllEvents(getEvents());
    }, []);

    useEffect(() => {
        refreshEvents();
        const interval = setInterval(refreshEvents, 2000);
        return () => clearInterval(interval);
    }, [refreshEvents]);

    const filteredEvents = allEvents.filter((evt) => {
        const matchesSearch =
            searchQuery === '' ||
            evt.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            evt.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
            evt.target.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter =
            activeFilter === 'All' ||
            evt.type.toLowerCase() === activeFilter.toLowerCase();
        return matchesSearch && matchesFilter;
    });

    const events = filteredEvents;

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
                        Agent Events
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Real-time log of all agent activities and security
                        events
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Export events">
                        <IconButton
                            size="small"
                            sx={{ color: 'text.secondary' }}
                            onClick={() => {
                                const blob = new Blob(
                                    [JSON.stringify(allEvents, null, 2)],
                                    { type: 'application/json' }
                                );
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'monkey-events.json';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}>
                            <DownloadIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <IconButton
                            size="small"
                            sx={{ color: 'text.secondary' }}
                            onClick={refreshEvents}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Card sx={{ mb: 2.5 }}>
                <CardContent
                    sx={{
                        p: 2,
                        display: 'flex',
                        gap: 2,
                        alignItems: 'center'
                    }}>
                    <TextField
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon
                                        sx={{
                                            color: 'text.secondary',
                                            fontSize: 20
                                        }}
                                    />
                                </InputAdornment>
                            ),
                            sx: { backgroundColor: 'rgba(255, 255, 255, 0.03)' }
                        }}
                    />
                    <Button
                        variant="outlined"
                        startIcon={<FilterListIcon />}
                        size="small"
                        sx={{
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            color: 'text.secondary'
                        }}>
                        Filters
                    </Button>
                    {[
                        'All',
                        'Exploitation',
                        'Scan',
                        'Credentials',
                        'Propagation'
                    ].map((filter) => (
                        <Chip
                            key={filter}
                            label={filter}
                            size="small"
                            variant={
                                filter === activeFilter ? 'filled' : 'outlined'
                            }
                            onClick={() => setActiveFilter(filter)}
                            sx={{
                                cursor: 'pointer',
                                ...(filter === activeFilter && {
                                    backgroundColor: 'rgba(0, 230, 118, 0.12)',
                                    color: 'primary.main'
                                })
                            }}
                        />
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardContent sx={{ p: 0 }}>
                    {events.length === 0 ? (
                        <Box
                            sx={{
                                textAlign: 'center',
                                py: 8
                            }}>
                            <EventNoteIcon
                                sx={{
                                    fontSize: 64,
                                    color: 'text.secondary',
                                    mb: 2,
                                    opacity: 0.3
                                }}
                            />
                            <Typography
                                variant="h6"
                                sx={{ mb: 1, color: 'text.secondary' }}>
                                No Events Recorded
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.secondary',
                                    mb: 3,
                                    maxWidth: 400,
                                    mx: 'auto'
                                }}>
                                Events will appear here in real-time as the
                                agents scan, exploit, and propagate through the
                                network.
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PlayArrowIcon />}
                                onClick={() => router.push(PATHS.RUN)}
                                sx={{ color: '#000' }}>
                                Start Simulation
                            </Button>
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Timestamp</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Source</TableCell>
                                        <TableCell>Target</TableCell>
                                        <TableCell>Details</TableCell>
                                        <TableCell>Tags</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {events.map((event) => (
                                        <TableRow key={event.id}>
                                            <TableCell
                                                sx={{ whiteSpace: 'nowrap' }}>
                                                {new Date(
                                                    event.timestamp
                                                ).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={event.type}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        textTransform:
                                                            'capitalize'
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {event.source}
                                            </TableCell>
                                            <TableCell>
                                                {event.target}
                                            </TableCell>
                                            <TableCell>
                                                {event.message}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={event.severity}
                                                    size="small"
                                                    sx={{
                                                        textTransform:
                                                            'capitalize',
                                                        backgroundColor:
                                                            event.severity ===
                                                            'error'
                                                                ? 'rgba(255,82,82,0.15)'
                                                                : event.severity ===
                                                                    'success'
                                                                  ? 'rgba(0,230,118,0.15)'
                                                                  : event.severity ===
                                                                      'warning'
                                                                    ? 'rgba(255,183,77,0.15)'
                                                                    : 'rgba(158,158,158,0.15)',
                                                        color:
                                                            event.severity ===
                                                            'error'
                                                                ? '#FF5252'
                                                                : event.severity ===
                                                                    'success'
                                                                  ? '#00E676'
                                                                  : event.severity ===
                                                                      'warning'
                                                                    ? '#FFB74D'
                                                                    : 'text.secondary'
                                                    }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
