'use client';
import * as React from 'react';
import Button from '@mui/material/Button';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';

const LogoutButton = () => {
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem('AuthenticationToken');
        localStorage.removeItem('ExpirationTimestamp');
        localStorage.removeItem('LastRefreshTimestamp');
        router.push(PATHS.LOGIN);
    };

    return (
        <Button
            onClick={handleLogout}
            variant="outlined"
            startIcon={<LogoutIcon />}
            fullWidth
            size="small"
            sx={{
                borderColor: 'rgba(255, 82, 82, 0.3)',
                color: '#FF5252',
                '&:hover': {
                    borderColor: '#FF5252',
                    backgroundColor: 'rgba(255, 82, 82, 0.08)'
                }
            }}>
            Logout
        </Button>
    );
};

export default LogoutButton;
