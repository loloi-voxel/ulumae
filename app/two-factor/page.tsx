'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, Shield, Smartphone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';

interface TwoFactorFactorSummary {
    id: string;
    friendlyName: string;
    status: 'pending' | 'verified';
}

interface TwoFactorState {
    enabled: boolean;
    requiresChallenge: boolean;
    factors: TwoFactorFactorSummary[];
    recoveryCodesRemaining: number;
}

function TwoFactorChallengeScreen() {
    const auth = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get('next') || '/dashboard';
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [state, setState] = useState<TwoFactorState | null>(null);
    const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
    const [selectedFactorId, setSelectedFactorId] = useState('');
    const [code, setCode] = useState('');
    const [recoveryCode, setRecoveryCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadState = async () => {
            if (auth.loading) return;

            if (!auth.authenticated) {
                router.replace(`/login?next=${encodeURIComponent(`/two-factor?next=${encodeURIComponent(next)}`)}`);
                return;
            }

            try {
                const response = await fetch('/api/security/two-factor/state', {
                    cache: 'no-store',
                });
                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(payload.error || 'Could not load two-factor settings.');
                }

                if (cancelled) return;

                setState(payload);

                const verifiedFactors = (payload.factors || []).filter((factor: TwoFactorFactorSummary) => factor.status === 'verified');
                setSelectedFactorId(verifiedFactors[0]?.id || '');

                if (!payload.enabled || !payload.requiresChallenge) {
                    router.replace(next);
                }
            } catch (loadError: any) {
                if (!cancelled) {
                    setError(loadError.message || 'Could not load the two-factor challenge.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadState();

        return () => {
            cancelled = true;
        };
    }, [auth.authenticated, auth.loading, next, router]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/security/two-factor/challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    mode === 'totp'
                        ? { method: 'totp', factorId: selectedFactorId, code }
                        : { method: 'recovery', recoveryCode }
                ),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Could not verify the second factor.');
            }

            await auth.revalidate();
            router.replace(next);
            router.refresh();
        } catch (submitError: any) {
            setError(submitError.message || 'Could not verify this two-factor challenge.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut({ scope: 'local' });
        window.location.href = '/login';
    };

    if (loading || auth.loading) {
        return (
            <ExperiencePage containerClassName="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <Loader2 size={28} className="mx-auto mb-3 animate-spin text-olive" />
                    <p className="text-sm text-warm-muted">Loading two-factor challenge...</p>
                </div>
            </ExperiencePage>
        );
    }

    const verifiedFactors = (state?.factors || []).filter((factor) => factor.status === 'verified');

    return (
        <ExperiencePage containerClassName="max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_0.75fr] lg:items-center">
                <div>
                    <Link
                        href="/dashboard"
                        className="experience-button experience-button-secondary mb-10 w-fit text-[11px] tracking-[0.22em]"
                    >
                        <ArrowLeft size={14} />
                        Back
                    </Link>

                    <ExperienceHero
                        kicker={<span className="experience-kicker">Security Check</span>}
                        title={
                            <>
                                Verify your
                                <br />
                                <span className="italic text-olive">sign-in</span>
                            </>
                        }
                        subtitle="This extra step protects archive access, settings, and preservation controls. Use your authenticator app or one of your recovery codes."
                    />
                </div>

                <ExperiencePanel className="mx-auto w-full max-w-xl">
                    <div className="mb-6 flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-none bg-olive/10 text-olive">
                            <Shield size={22} />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Verification</p>
                            <h2 className="mt-2 font-serif text-4xl text-warm-dark">Second factor</h2>
                            <p className="mt-2 text-sm leading-relaxed text-warm-muted">
                                Confirm it is really you before we reopen the requested space.
                            </p>
                        </div>
                    </div>

                    <div className="mb-5 grid grid-cols-2 gap-2 rounded-none bg-surface-mid/50 p-1.5">
                        <button
                            onClick={() => setMode('totp')}
                            className={`rounded-none px-4 py-3 text-sm transition-colors ${mode === 'totp' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-muted'}`}
                        >
                            Authenticator
                        </button>
                        <button
                            onClick={() => setMode('recovery')}
                            className={`rounded-none px-4 py-3 text-sm transition-colors ${mode === 'recovery' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-muted'}`}
                        >
                            Recovery code
                        </button>
                    </div>

                    {mode === 'totp' ? (
                        <>
                            {verifiedFactors.length > 1 && (
                                <div className="mb-4">
                                    <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-warm-outline">
                                        Authenticator
                                    </label>
                                    <select
                                        value={selectedFactorId}
                                        onChange={(event) => setSelectedFactorId(event.target.value)}
                                        className="experience-input w-full"
                                    >
                                        {verifiedFactors.map((factor) => (
                                            <option key={factor.id} value={factor.id}>
                                                {factor.friendlyName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-warm-outline">
                                    Verification code
                                </label>
                                <div className="relative">
                                    <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" />
                                    <input
                                        value={code}
                                        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="123456"
                                        className="experience-input w-full py-3 pl-11 pr-4 tracking-[0.22em]"
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="mb-4">
                            <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-warm-outline">
                                Recovery code
                            </label>
                            <input
                                value={recoveryCode}
                                onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                                autoComplete="one-time-code"
                                placeholder="ABCD-EFGH-IJKL-MNOP"
                                className="experience-input w-full tracking-[0.12em]"
                            />
                            <p className="mt-2 text-xs text-warm-outline">
                                {state?.recoveryCodesRemaining || 0} recovery code{state?.recoveryCodesRemaining !== 1 ? 's' : ''} remaining
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            onClick={handleSignOut}
                            className="experience-button experience-button-secondary w-full justify-center py-3 text-[11px] tracking-[0.22em]"
                        >
                            Sign Out
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || (mode === 'totp' ? code.trim().length < 6 : recoveryCode.trim().length < 8)}
                            className={`experience-button w-full justify-center py-3 text-[11px] tracking-[0.22em] ${
                                submitting || (mode === 'totp' ? code.trim().length < 6 : recoveryCode.trim().length < 8)
                                    ? 'cursor-not-allowed border border-warm-border/30 bg-surface-mid/80 text-warm-outline'
                                    : 'experience-button-primary'
                            }`}
                        >
                            {submitting ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 size={15} className="animate-spin" />
                                    Verifying
                                </span>
                            ) : (
                                'Continue'
                            )}
                        </button>
                    </div>
                </ExperiencePanel>
            </div>
        </ExperiencePage>
    );
}

export default function TwoFactorPage() {
    return (
        <Suspense
            fallback={
                <ExperiencePage containerClassName="flex min-h-screen items-center justify-center">
                    <div className="h-10 w-10 rounded-none border-2 border-warm-border/30 border-t-olive animate-spin" />
                </ExperiencePage>
            }
        >
            <TwoFactorChallengeScreen />
        </Suspense>
    );
}
