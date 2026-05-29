import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { RootProvider } from '@/providers/RootProvider';
import React from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Infection Monkey | Security Testing Platform',
    description:
        'Open-source adversary emulation platform for network security testing'
};

export default function RootLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <RootProvider>{children}</RootProvider>
            </body>
        </html>
    );
}
