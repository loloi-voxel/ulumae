'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ConnectedSpacesPanel from '@/components/dashboard/ConnectedSpacesPanel';
import { useConnectedSpaces } from '@/hooks/useConnectedSpaces';

export default function ConnectedSpacesPage() {
    const router = useRouter();
    const auth = useAuth();
    const userId = auth.user?.id;
    const { spaces, loading, error } = useConnectedSpaces();

    useEffect(() => {
        if (!auth.loading && !auth.authenticated) {
            router.replace('/login');
        }
    }, [auth.loading, auth.authenticated, router]);

    if (auth.loading || !userId) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <Loader2 size={28} className="text-olive animate-spin" />
            </div>
        );
    }

    return (
        <DashboardShell userId={userId}>
            <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
                <header className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-warm-outline">
                        Your access
                    </p>
                    <h1 className="font-serif text-3xl text-warm-dark">Connected spaces</h1>
                    <p className="text-sm text-warm-muted font-sans max-w-xl">
                        Archives you have been invited into as a co-guardian, witness, or reader.
                    </p>
                </header>
                <ConnectedSpacesPanel
                    spaces={spaces}
                    loading={loading}
                    error={error}
                    title="All spaces"
                    hideWhenEmpty={false}
                    emptyMessage="You are not connected to any external archives yet. Invited spaces will appear here."
                />
            </div>
        </DashboardShell>
    );
}
