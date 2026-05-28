'use client';
import { useRouter } from 'next/navigation';
import { tokenIsStored } from '@/lib/authenticationToken';
import { PATHS } from '@/constants/paths.constants';
import { useEffect } from 'react';

export default function useRedirectionWhenUnauthenticated() {
    const router = useRouter();

    useEffect(() => {
        if (!tokenIsStored()) {
            router.push(PATHS.LOGIN);
        }
    }, [router]);
}
