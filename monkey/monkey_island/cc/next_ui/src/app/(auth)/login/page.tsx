'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';
import { useTheme } from '@mui/material/styles';
import { cardStyle, containerStyle } from '@/app/(auth)/login/style';
import { getApiUrl } from '@/lib/apiPort';

const LoginPage = () => {
    const router = useRouter();
    const theme = useTheme();
    const [formValues, setFormValues] = useState({
        username: '',
        password: ''
    });
    const [isRegistration, setIsRegistration] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [checkingStatus, setCheckingStatus] = useState(true);

    useEffect(() => {
        // Check if already logged in
        const token = localStorage.getItem('AuthenticationToken');
        if (token) {
            router.push(PATHS.DASHBOARD || '/dashboard');
            return;
        }

        // Check if registration is needed
        checkRegistrationStatus();
    }, []);

    const checkRegistrationStatus = async () => {
        try {
            const resp = await fetch(getApiUrl('/api/registration-status'));
            if (resp.ok) {
                const data = await resp.json();
                setIsRegistration(data.registration_needed);
            } else {
                // API not available - standalone mode, show registration
                setIsRegistration(
                    !localStorage.getItem('monkey_user_registered')
                );
            }
        } catch {
            // No API server - use localStorage auth
            setIsRegistration(!localStorage.getItem('monkey_user_registered'));
        }
        setCheckingStatus(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormValues({ ...formValues, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setError('');

        if (!formValues.username || !formValues.password) {
            setError('Please fill in all fields');
            setIsLoading(false);
            return;
        }

        if (isRegistration && formValues.password.length < 4) {
            setError('Password must be at least 4 characters');
            setIsLoading(false);
            return;
        }

        try {
            const endpoint = isRegistration ? '/api/register' : '/api/login';
            const resp = await fetch(getApiUrl(endpoint), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });

            if (resp.ok) {
                const data = await resp.json();
                localStorage.setItem('AuthenticationToken', data.token);
                localStorage.setItem(
                    'ExpirationTimestamp',
                    String(data.token_expiration_time)
                );
                localStorage.setItem(
                    'LastRefreshTimestamp',
                    String(Date.now())
                );
                localStorage.setItem('monkey_user_registered', 'true');
                localStorage.setItem('monkey_username', formValues.username);
                router.push(PATHS.DASHBOARD || '/dashboard');
            } else {
                const errData = await resp.json();
                setError(errData.error || 'Authentication failed');
            }
        } catch {
            // Fallback: local-only auth without API server
            if (isRegistration) {
                localStorage.setItem('monkey_user_registered', 'true');
                localStorage.setItem('monkey_username', formValues.username);
                localStorage.setItem(
                    'monkey_password_hash',
                    btoa(formValues.password)
                );
                localStorage.setItem(
                    'AuthenticationToken',
                    'local-' + Date.now()
                );
                localStorage.setItem(
                    'ExpirationTimestamp',
                    String(Date.now() + 86400000)
                );
                localStorage.setItem(
                    'LastRefreshTimestamp',
                    String(Date.now())
                );
                router.push(PATHS.DASHBOARD || '/dashboard');
            } else {
                const storedUser = localStorage.getItem('monkey_username');
                const storedPass = localStorage.getItem('monkey_password_hash');
                if (
                    storedUser === formValues.username &&
                    storedPass === btoa(formValues.password)
                ) {
                    localStorage.setItem(
                        'AuthenticationToken',
                        'local-' + Date.now()
                    );
                    localStorage.setItem(
                        'ExpirationTimestamp',
                        String(Date.now() + 86400000)
                    );
                    localStorage.setItem(
                        'LastRefreshTimestamp',
                        String(Date.now())
                    );
                    router.push(PATHS.DASHBOARD || '/dashboard');
                } else {
                    setError('Invalid username or password');
                }
            }
        }
        setIsLoading(false);
    };

    if (checkingStatus) {
        return (
            <Container component="main" maxWidth="xs" sx={containerStyle}>
                <Stack direction="column" alignItems="center" spacing={2}>
                    <CircularProgress sx={{ color: 'primary.main' }} />
                </Stack>
            </Container>
        );
    }

    return (
        <Container component="main" maxWidth="xs" sx={containerStyle}>
            <Stack direction="column" alignItems="center" spacing={2}>
                <Card variant="outlined" sx={cardStyle(theme)}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            mb: 3
                        }}>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 800,
                                background:
                                    'linear-gradient(135deg, #00E676, #7C4DFF)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 0.5
                            }}>
                            Infection Monkey
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: 'text.secondary'
                            }}>
                            Security Testing Platform
                        </Typography>
                    </Box>

                    <Typography sx={{ mb: 1 }} color="text.secondary">
                        {isRegistration
                            ? 'Create your account to get started:'
                            : 'Sign in to your account:'}
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box
                        component="form"
                        onSubmit={handleSubmit}
                        sx={{ mt: 1 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="username"
                            label="Username"
                            name="username"
                            autoComplete="username"
                            value={formValues.username}
                            onChange={handleChange}
                            autoFocus
                            sx={{
                                bgcolor: 'background.default'
                            }}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete={
                                isRegistration
                                    ? 'new-password'
                                    : 'current-password'
                            }
                            value={formValues.password}
                            onChange={handleChange}
                            sx={{
                                bgcolor: 'background.default'
                            }}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={isLoading}
                            sx={{
                                mt: 3,
                                mb: 2,
                                color: '#000',
                                fontWeight: 700,
                                py: 1.2
                            }}>
                            {isLoading ? (
                                <CircularProgress
                                    size={24}
                                    sx={{
                                        color: '#000'
                                    }}
                                />
                            ) : isRegistration ? (
                                'Create Account'
                            ) : (
                                'Sign In'
                            )}
                        </Button>

                        {!isRegistration && (
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'text.secondary',
                                    display: 'block',
                                    textAlign: 'center'
                                }}>
                                Sign in with the account you created
                            </Typography>
                        )}
                    </Box>
                </Card>

                <Typography
                    variant="caption"
                    sx={{
                        color: 'text.secondary',
                        opacity: 0.5
                    }}>
                    Infection Monkey v2.3.0 - Desktop Edition
                </Typography>
            </Stack>
        </Container>
    );
};

export default LoginPage;
