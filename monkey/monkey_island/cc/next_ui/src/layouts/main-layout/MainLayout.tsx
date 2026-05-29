'use client';

import React from 'react';
import Box from '@mui/material/Box';
import AppSidebarNav from '@/_components/app-nav/app-sidebar-nav/AppSidebarNav';

const SIDEBAR_WIDTH = 260;

export default function MainLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <AppSidebarNav width={SIDEBAR_WIDTH} />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    overflow: 'auto',
                    backgroundColor: 'background.default',
                    p: 3,
                    ml: `${SIDEBAR_WIDTH}px`
                }}>
                {children}
            </Box>
        </Box>
    );
}
