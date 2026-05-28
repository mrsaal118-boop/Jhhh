'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';

const RegisterPage = () => {
    const router = useRouter();

    useEffect(() => {
        // Redirect to login page which handles both registration and login
        router.push(PATHS.LOGIN || '/login');
    }, [router]);

    return null;
};

export default RegisterPage;
