'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

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
    // Core auth
    authenticated: boolean;
    loading: boolean;
    user: { id: string; email: string } | null;

    // Plan & archives (server-validated)
    plan: UserPlan;
    hasPaid: boolean;
    archives: UserArchive[];

    // Actions
    revalidate: () => Promise<void>;
}

export function isFamilyPlan(plan: UserPlan) {
    return plan === 'family' || plan === 'concierge';
}

export function isPersonalPlan(plan: UserPlan) {
    return plan === 'personal';
}

export function getPlanDashboardPath(plan: UserPlan | string, userId: string) {
    if (plan === 'family' || plan === 'concierge') {
        return `/dashboard/family/${userId}`;
    }

    if (plan === 'personal') {
        return `/dashboard/personal/${userId}`;
    }

    return `/dashboard/draft/${userId}`;
}

const defaultState: AuthState = {
    authenticated: false,
    loading: true,
    user: null,
    plan: 'none',
    hasPaid: false,
    archives: [],
    revalidate: async () => { },
};

const AuthContext = createContext<AuthState>(defaultState);

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

    const fetchState = useCallback(async (force = false) => {
        // Debounce non-forced calls to avoid spam
        const now = Date.now();
        if (!force && now - lastFetchRef.current < 2000) return;
        // Never block forced calls (back-button, payment completion, etc.)
        // Only skip if a non-forced call and already fetching
        if (!force && isFetchingRef.current) return;

        isFetchingRef.current = true;
        try {
            const res = await fetch('/api/user/state', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            const data = await res.json();

            if (
                res.status === 401 &&
                (data?.session?.revoked || data?.session?.expired)
            ) {
                const supabase = createClient();
                await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

                setState({
                    authenticated: false,
                    loading: false,
                    user: null,
                    plan: 'none',
                    hasPaid: false,
                    archives: [],
                });
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
            // Fallback: check Supabase client auth directly so we at least
            // know if the user is authenticated (prevents false redirects to /login)
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setState(prev => ({
                        ...prev,
                        loading: false,
                        authenticated: true,
                        user: { id: user.id, email: user.email || '' },
                        // Keep existing plan/archives — don't overwrite with empty
                    }));
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

    // Re-fetch when navigating to critical pages
    useEffect(() => {
        const criticalPaths = ['/dashboard', '/payment', '/choice-pricing', '/personal-confirmation', '/family-confirmation', '/payment-success', '/preserve'];
        const isCritical = criticalPaths.some(p => pathname.startsWith(p));
        if (isCritical) {
            fetchState(true);
        }
    }, [pathname, fetchState]);

    // Listen for browser back/forward button (popstate event)
    // This is the KEY fix: when the user hits back, the browser fires popstate
    // BEFORE React re-renders, so we force a revalidation immediately
    useEffect(() => {
        const handlePopState = () => {
            fetchState(true);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [fetchState]);

    // Listen for Supabase auth state changes (login/logout)
    useEffect(() => {
        const supabase = createClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                fetchState(true);
            }
        });
        return () => subscription.unsubscribe();
    }, [fetchState]);

    // Listen for visibility change — force revalidate when tab becomes visible
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchState(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchState]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (!event.key || event.key.startsWith('sb-') || event.key.startsWith('supabase.')) {
                fetchState(true);
            }
        };

        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                fetchState(true);
            }
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

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth(): AuthState {
    return useContext(AuthContext);
}

// ─── Utility: Get the dashboard path for a user based on their real state ────
export function getDashboardPath(state: AuthState): string {
    if (!state.authenticated || !state.user) return '/login';

    // Prioritize the highest plan level from the server-validated plan field
    if (isFamilyPlan(state.plan) || isPersonalPlan(state.plan)) {
        return getPlanDashboardPath(state.plan, state.user.id);
    }

    const draftArchive = state.archives.find(a => !a.paid);
    if (draftArchive) {
        return getPlanDashboardPath('draft', state.user.id);
    }

    return '/choice-pricing';
}
