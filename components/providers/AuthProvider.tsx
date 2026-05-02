'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
    getOrCreateSessionFingerprint,
    SESSION_FINGERPRINT_HEADER,
} from '@/lib/sessionFingerprint';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface UserArchive {
    id: string;
    mode: 'draft' | 'personal' | 'family' | 'concierge';
    paid: boolean;
    status: 'draft' | 'published';
    fullName: string | null;
    profilePhotoUrl: string | null;
    updatedAt: string;
    paymentConfirmedAt: string | null;
}

export type UserPlan = 'none' | 'draft' | 'personal' | 'family' | 'concierge';

export interface AuthState {
    authenticated: boolean;
    loading: boolean;
    user: { id: string; email: string } | null;
    plan: UserPlan;
    hasPaid: boolean;
    archives: UserArchive[];
    revalidate: () => Promise<void>;
}

export function isFamilyPlan(plan: UserPlan) {
    return plan === 'family' || plan === 'concierge';
}

export function isPersonalPlan(plan: UserPlan) {
    return plan === 'personal';
}

export function getPlanDashboardPath(plan: UserPlan | string, userId: string) {
    if (plan === 'family' || plan === 'concierge') return `/dashboard/family/${userId}`;
    if (plan === 'personal') return `/dashboard/personal/${userId}`;
    return `/dashboard/draft/${userId}`;
}

const defaultState: AuthState = {
    authenticated: false,
    loading: true,
    user: null,
    plan: 'none',
    hasPaid: false,
    archives: [],
    revalidate: async () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

// ─── Anchor awareness ─────────────────────────────────────────────────────────
// Reads the anchor phase from the in-memory controller without importing it
// (avoids a circular dep). The worker stores phase in a custom event we fire.
function isAnchorBusy(): boolean {
    if (typeof window === 'undefined') return false;
    return window.__ulumaeAnchorBusy === true;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<Omit<AuthState, 'revalidate'>>({
        authenticated: false,
        loading: true,
        user: null,
        plan: 'none',
        hasPaid: false,
        archives: [],
    });
    const pathname = usePathname();
    const lastFetchRef = useRef<number>(0);
    const isFetchingRef = useRef(false);
    const lastHeartbeatRef = useRef<number>(0);
    // Track the last pathname that triggered a fetch so we don't re-fetch on
    // the same path (e.g. repeated renders while on /dashboard/family/...)
    const lastFetchedPathnameRef = useRef<string>('');

    const sendHeartbeat = useCallback(async () => {
        if (!state.authenticated || !state.user) return;
        const now = Date.now();
        if (now - lastHeartbeatRef.current < 5 * 60 * 1000) return;
        lastHeartbeatRef.current = now;
        await fetch('/api/user/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }).catch(() => undefined);
    }, [state.authenticated, state.user]);

    const fetchState = useCallback(async (force = false) => {
        const now = Date.now();
        // Debounce: skip non-forced calls within 2s of the last fetch
        if (!force && now - lastFetchRef.current < 2000) return;
        if (!force && isFetchingRef.current) return;

        isFetchingRef.current = true;
        try {
            const fingerprint = getOrCreateSessionFingerprint();
            const res = await fetch('/api/user/state', {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    ...(fingerprint ? { [SESSION_FINGERPRINT_HEADER]: fingerprint } : {}),
                },
            });
            const data = await res.json();

            if (res.status === 401 && (data?.session?.revoked || data?.session?.expired)) {
                const supabase = createClient();
                await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
                setState({ authenticated: false, loading: false, user: null, plan: 'none', hasPaid: false, archives: [] });
                lastFetchRef.current = Date.now();
                return;
            }

            if (!res.ok) throw new Error(data?.error || 'State fetch failed');

            setState({
                authenticated: data.authenticated,
                loading: false,
                user: data.user,
                plan: data.plan || 'none',
                hasPaid: data.hasPaid || false,
                archives: data.archives || [],
            });
            lastFetchRef.current = Date.now();
        } catch (err) {
            console.error('[AuthProvider] State fetch error:', err);
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setState(prev => ({ ...prev, loading: false, authenticated: true, user: { id: user.id, email: user.email || '' } }));
                } else {
                    setState(prev => ({ ...prev, loading: false }));
                }
            } catch {
                setState(prev => ({ ...prev, loading: false }));
            }
        } finally {
            isFetchingRef.current = false;
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchState(true);
    }, [fetchState]);

    // Re-fetch on critical path changes — but only when the path actually changes
    // and only on truly critical transitions (not every render on /dashboard/...)
    useEffect(() => {
        const CRITICAL = ['/payment', '/choice-pricing', '/personal-confirmation', '/family-confirmation', '/payment-success', '/preserve'];
        const isCritical = CRITICAL.some(p => pathname.startsWith(p));

        // For dashboard paths: only fetch when we first arrive, not on every render
        const isDashboard = pathname.startsWith('/dashboard');
        const pathnameChanged = pathname !== lastFetchedPathnameRef.current;

        if ((isCritical || (isDashboard && pathnameChanged))) {
            lastFetchedPathnameRef.current = pathname;
            fetchState(true);
        }
    }, [pathname, fetchState]);

    // Heartbeat on navigation
    useEffect(() => {
        void sendHeartbeat();
    }, [pathname, sendHeartbeat]);

    // Back/forward button
    useEffect(() => {
        const handlePopState = () => fetchState(true);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [fetchState]);

    // Supabase auth changes
    useEffect(() => {
        const supabase = createClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                fetchState(true);
            }
        });
        return () => subscription.unsubscribe();
    }, [fetchState]);

    // Visibility change — skip if anchor is running
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            // Don't interrupt a running anchor sync
            if (isAnchorBusy()) return;
            fetchState(true);
            void sendHeartbeat();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchState, sendHeartbeat]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (!event.key || event.key.startsWith('sb-') || event.key.startsWith('supabase.')) {
                fetchState(true);
            }
        };
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) fetchState(true);
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener('pageshow', handlePageShow);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [fetchState]);

    const contextValue: AuthState = {
        ...state,
        revalidate: () => fetchState(true),
    };

    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth(): AuthState {
    return useContext(AuthContext);
}

export function getDashboardPath(state: AuthState): string {
    if (!state.authenticated || !state.user) return '/login';
    if (isFamilyPlan(state.plan) || isPersonalPlan(state.plan)) {
        return getPlanDashboardPath(state.plan, state.user.id);
    }
    const draftArchive = state.archives.find(a => !a.paid);
    if (draftArchive) return getPlanDashboardPath('draft', state.user.id);
    return '/choice-pricing';
}