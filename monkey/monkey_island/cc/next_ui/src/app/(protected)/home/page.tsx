'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PATHS } from '@/constants/paths.constants';

const HomePage = () => {
    const router = useRouter();
    useEffect(() => {
        router.replace(PATHS.DASHBOARD);
    }, [router]);
    return null;
};

export default HomePage;
