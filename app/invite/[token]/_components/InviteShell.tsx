'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InviteAuthStep from './InviteAuthStep';
import InviteAcceptance from './InviteAcceptance';
import InviteTerminal from './InviteTerminal';
import { InvitationData } from '../page';
import { createClient } from '@/utils/supabase/client';
import {
    clearPendingInviteToken,
    getInviteWelcomePath,
    persistPendingInviteToken,
} from '@/lib/inviteFlow';

type TerminalState =
    | 'NOT_FOUND'
    | 'EXPIRED'
    | 'DECLINED'
    | 'USED_BY_OTHER'
    | 'MEMORIAL_DELETED';

type ShellState = 'loading' | 'auth_required' | 'preview' | 'success' | 'terminal';

interface InviteShellProps {
    initialData: {
        invitation: InvitationData;
        isAuthenticated: boolean;
        currentUserEmail: string | null;
    };
    token: string;
}

export default function InviteShell({
    initialData,
    token
}: InviteShellProps) {
    const router = useRouter();
    const supabase = createClient();
    const [authState, setAuthState] = useState<{
        isAuthenticated: boolean;
        currentUserEmail: string | null;
    }>({
        isAuthenticated: initialData.isAuthenticated,
        currentUserEmail: initialData.currentUserEmail,
    });
    const [invitation, setInvitation] = useState(initialData.invitation);
    const [view, setView] = useState<ShellState>('loading');
    const [terminalReason, setTerminalReason] = useState<TerminalState | null>(null);
    const [successState, setSuccessState] = useState<{ memorialId: string; role: string } | null>(null);

    const handleTerminal = useCallback((reason: TerminalState) => {
        setTerminalReason(reason);
        setView('terminal');
    }, []);

    const refreshInvite = useCallback(async (currentUserId?: string | null) => {
        const res = await fetch(`/api/invite/${token}`, {
            cache: 'no-store',
        });
        const lookup = await res.json();

        if (lookup.state === 'PENDING') {
            setInvitation(lookup.invitation);
            setTerminalReason(null);
            setView(currentUserId ? 'preview' : 'auth_required');
            return;
        }

        if (lookup.state === 'ALREADY_JOINED') {
            clearPendingInviteToken();
            router.replace(getInviteWelcomePath(lookup.memorialId, lookup.role));
            return;
        }

        handleTerminal(lookup.state as TerminalState);
    }, [handleTerminal, router, token]);

    const checkAuth = useCallback(async () => {
        setView('loading');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setAuthState({
                isAuthenticated: !!user,
                currentUserEmail: user?.email ?? null,
            });
            await refreshInvite(user?.id ?? null);
        } catch {
            setAuthState({
                isAuthenticated: false,
                currentUserEmail: null,
            });
            await refreshInvite(null);
        }
    }, [refreshInvite, supabase.auth]);

    useEffect(() => {
        persistPendingInviteToken(token);
        checkAuth();
    }, [checkAuth, token]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            checkAuth();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [checkAuth, supabase.auth]);

    useEffect(() => {
        if (!successState) return;

        const timeout = window.setTimeout(() => {
            router.replace(getInviteWelcomePath(successState.memorialId, successState.role));
        }, 1200);

        return () => window.clearTimeout(timeout);
    }, [router, successState]);

    if (view === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-olive/10 via-surface-low to-warm-muted/10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-warm-border/30 border-t-olive rounded-full animate-spin" />
            </div>
        );
    }

    if (view === 'terminal' && terminalReason) {
        return (
            <InviteTerminal
                reason={terminalReason}
                meta={{
                    inviterName: invitation.inviterName,
                    inviteeEmail: invitation.inviteeEmail,
                }}
            />
        );
    }

    if (view === 'success' && successState) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-olive/10 via-surface-low to-warm-muted/10 flex items-center justify-center px-6">
                <div className="w-full max-w-lg rounded-3xl border border-olive/20 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-olive/10">
                        <div className="h-6 w-6 rounded-full bg-olive" />
                    </div>
                    <h1 className="mb-3 font-serif text-3xl text-warm-dark">
                        You are in
                    </h1>
                    <p className="text-sm leading-relaxed text-warm-dark/55">
                        Your access has been confirmed. We are taking you into the archive now.
                    </p>
                </div>
            </div>
        );
    }

    if (!authState.isAuthenticated || view === 'auth_required') {
        return (
            <InviteAuthStep
                invitation={invitation}
                token={token}
                onAuthenticated={() => {
                    checkAuth();
                }}
            />
        );
    }

    return (
        <InviteAcceptance
            invitation={invitation}
            token={token}
            currentUserEmail={authState.currentUserEmail}
            onSwitchAccount={async () => {
                await supabase.auth.signOut();
                setAuthState({
                    isAuthenticated: false,
                    currentUserEmail: null,
                });
                setView('auth_required');
            }}
            onSuccess={(memorialId: string, role: string) => {
                clearPendingInviteToken();
                setSuccessState({ memorialId, role });
                setView('success');
            }}
        />
    );
}
