'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MapIcon from '@mui/icons-material/Map';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ExtensionIcon from '@mui/icons-material/Extension';
import TuneIcon from '@mui/icons-material/Tune';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SecurityIcon from '@mui/icons-material/Security';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LogoutButton from '@/_components/logout-button/LogoutButton';
import { PATHS } from '@/constants/paths.constants';

interface SidebarNavProps {
    width: number;
}

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
    badge?: string;
}

const mainNavItems: NavItem[] = [
    { path: PATHS.DASHBOARD, label: 'Dashboard', icon: <DashboardIcon /> },
    { path: PATHS.CONFIGURE, label: 'Configure', icon: <TuneIcon /> },
    { path: PATHS.RUN, label: 'Run Monkey', icon: <PlayArrowIcon /> },
    { path: PATHS.NETWORK_MAP, label: 'Network Map', icon: <MapIcon /> },
    {
        path: PATHS.PROPAGATION_TREE,
        label: 'Propagation Tree',
        icon: <AccountTreeIcon />
    },
    { path: PATHS.EVENTS, label: 'Events', icon: <EventNoteIcon /> }
];

const analysisNavItems: NavItem[] = [
    { path: PATHS.REPORT, label: 'Reports', icon: <AssessmentIcon /> },
    { path: PATHS.PLUGINS, label: 'Plugins', icon: <ExtensionIcon /> }
];

const systemNavItems: NavItem[] = [
    { path: PATHS.SETTINGS, label: 'Settings', icon: <SettingsIcon /> },
    { path: PATHS.ABOUT, label: 'About', icon: <InfoIcon /> }
];

export default function AppSidebarNav({ width }: SidebarNavProps) {
    const router = useRouter();
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (!pathname) return false;
        if (path === PATHS.ROOT) return pathname === '/';
        return pathname.startsWith(path);
    };

    const renderNavSection = (title: string, items: NavItem[]) => (
        <Box sx={{ mb: 1 }}>
            <Typography
                variant="overline"
                sx={{
                    px: 2,
                    py: 1,
                    display: 'block',
                    color: 'text.secondary',
                    fontSize: '0.68rem',
                    letterSpacing: '0.08em',
                    fontWeight: 700
                }}>
                {title}
            </Typography>
            <List sx={{ px: 1.5, py: 0 }}>
                {items.map((item) => (
                    <ListItemButton
                        key={item.path}
                        selected={isActive(item.path)}
                        onClick={() => router.push(item.path)}
                        sx={{ py: 1, px: 1.5, mb: 0.3 }}>
                        <ListItemIcon
                            sx={{
                                minWidth: 36,
                                color: isActive(item.path)
                                    ? 'primary.main'
                                    : 'text.secondary'
                            }}>
                            {item.icon}
                        </ListItemIcon>
                        <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                                fontSize: '0.875rem',
                                fontWeight: isActive(item.path) ? 600 : 400
                            }}
                        />
                        {item.badge && (
                            <Chip
                                label={item.badge}
                                size="small"
                                color="primary"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                        )}
                    </ListItemButton>
                ))}
            </List>
        </Box>
    );

    return (
        <Drawer
            variant="permanent"
            sx={{
                width,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width,
                    boxSizing: 'border-box',
                    backgroundColor: '#0D1117',
                    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}>
            <Box
                sx={{
                    p: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer'
                }}
                onClick={() => router.push(PATHS.DASHBOARD)}>
                <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Box>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 800,
                            fontSize: '1.05rem',
                            lineHeight: 1.2,
                            background:
                                'linear-gradient(135deg, #00E676 0%, #40C4FF 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                        Infection Monkey
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                        Security Testing Platform
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ mx: 2, opacity: 0.5 }} />

            <Box sx={{ flex: 1, overflow: 'auto', mt: 1 }}>
                {renderNavSection('MAIN', mainNavItems)}
                {renderNavSection('ANALYSIS', analysisNavItems)}
                {renderNavSection('SYSTEM', systemNavItems)}
            </Box>

            <Divider sx={{ mx: 2, opacity: 0.5 }} />

            <Box sx={{ p: 2 }}>
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: 'rgba(0, 230, 118, 0.06)',
                        border: '1px solid rgba(0, 230, 118, 0.15)',
                        mb: 1.5
                    }}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'primary.main',
                            fontWeight: 600,
                            display: 'block'
                        }}>
                        System Status
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}>
                        Island Server: Online
                    </Typography>
                </Box>
                <LogoutButton />
            </Box>
        </Drawer>
    );
}
