// app/personal-confirmation/page.tsx
// Seal confirmation page — handles authorization + payment flow
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { ArrowLeft, Check, ExternalLink, ArrowUpCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPlanDashboardPath, useAuth } from '@/components/providers/AuthProvider';
import {
    clearCurrentMemorialId,
    readCurrentMemorialId,
    writeCurrentMemorialId,
} from '@/lib/currentMemorialStorage';
import { PLAN_PRICES_USD } from '@/lib/constants';

function PersonalConfirmationContent() {
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOpeningAuth, setIsOpeningAuth] = useState(false);
    const [authorizationCompleted, setAuthorizationCompleted] = useState(false);
    const [currentMemorialId, setCurrentMemorialId] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const auth = useAuth();

    const upgradeMemorialId = searchParams.get('memorialId');
    const isPopup = searchParams.get('popup') === 'true';
    const isDraftUpgrade = !!upgradeMemorialId;

    // Auth guard: if user already has a personal paid plan, redirect to dashboard
    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/personal-confirmation');
            return;
        }
        // If user already has a paid personal or higher plan (not draft upgrade), redirect
        if (!isDraftUpgrade && auth.hasPaid && (auth.plan === 'personal' || auth.plan === 'family' || auth.plan === 'concierge')) {
            router.replace(getPlanDashboardPath(auth.plan, auth.user!.id));
            return;
        }
    }, [auth.loading, auth.authenticated, auth.hasPaid, auth.plan, auth.user, isDraftUpgrade, router]);

    // On mount: restore memorialId from URL/localStorage and check if auth was already completed
    useEffect(() => {
        if (!auth.user?.id) return;

        const storedId = upgradeMemorialId || readCurrentMemorialId(auth.user.id, 'personal');
        if (storedId && storedId !== 'null' && storedId !== 'undefined') {
            setCurrentMemorialId(storedId);
            if (localStorage.getItem(`lv-auth-${storedId}`) === 'done') {
                setAuthorizationCompleted(true);
            }
        }
    }, [auth.user?.id, upgradeMemorialId]);

    // Poll the DB every 3 s for auth completion, and listen for postMessage from popup
    useEffect(() => {
        if (!currentMemorialId || authorizationCompleted) return;

        const handleMessage = (event: MessageEvent) => {
            if (
                event.data?.type === 'lv-auth-complete' &&
                event.data?.memorialId === currentMemorialId
            ) {
                setAuthorizationCompleted(true);
            }
        };
        window.addEventListener('message', handleMessage);

        pollRef.current = setInterval(async () => {
            // Also check localStorage (set by the popup window)
            if (localStorage.getItem(`lv-auth-${currentMemorialId}`) === 'done') {
                setAuthorizationCompleted(true);
                return;
            }
            const { data } = await createClient()
                .from('memorial_authorizations')
                .select('id')
                .eq('memorial_id', currentMemorialId)
                .in('status', ['pending', 'approved'])
                .maybeSingle();
            if (data) setAuthorizationCompleted(true);
        }, 3000);

        return () => {
            window.removeEventListener('message', handleMessage);
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [currentMemorialId, authorizationCompleted]);

    // Stop polling once done
    useEffect(() => {
        if (authorizationCompleted && pollRef.current) {
            clearInterval(pollRef.current);
        }
    }, [authorizationCompleted]);

    // Mutex to prevent concurrent memorial creation
    const creatingRef = useRef(false);

    // Single source of truth for memorial creation — prevents duplicates
    const ensureMemorial = async (): Promise<string> => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Please sign in to continue.');
        const storageUserId = auth.user?.id || user.id;

        // 1. Check React state first (most reliable)
        let memorialId = upgradeMemorialId || currentMemorialId;

        // 2. Fallback to localStorage
        if (!memorialId || memorialId === 'null' || memorialId === 'undefined') {
            memorialId = readCurrentMemorialId(storageUserId, 'personal');
        }

        // 3. Validate the memorial still exists in the DB
        if (memorialId && memorialId !== 'null' && memorialId !== 'undefined') {
            const { data: existing } = await supabase
                .from('memorials')
                .select('id')
                .eq('id', memorialId)
                .eq('user_id', user.id)
                .maybeSingle();
            if (existing) {
                // Memorial exists — update state and return
                setCurrentMemorialId(memorialId);
                writeCurrentMemorialId(storageUserId, 'personal', memorialId);
                return memorialId;
            }
            // Memorial was deleted or invalid — clear stale reference
            memorialId = null;
            clearCurrentMemorialId(storageUserId, 'personal');
        }

        // 4. Prevent concurrent creation
        if (creatingRef.current) {
            // Wait briefly and re-check state (another call is creating)
            await new Promise(r => setTimeout(r, 1000));
            if (currentMemorialId) return currentMemorialId;
            throw new Error('Memorial creation in progress. Please try again.');
        }

        creatingRef.current = true;
        try {
            // 5. Check for an existing unpaid personal memorial (dedup)
            const { data: existingUnpaid } = await supabase
                .from('memorials')
                .select('id')
                .eq('user_id', user.id)
                .eq('mode', 'personal')
                .eq('paid', false)
                .eq('deleted', false)
                .limit(1)
                .maybeSingle();

            if (existingUnpaid) {
                memorialId = existingUnpaid.id;
            } else {
                // 6. Create only if truly none exists
                const { data, error: insertError } = await supabase
                    .from('memorials')
                    .insert({ user_id: user.id, slug: `memorial-${Date.now()}`, mode: 'personal', paid: false })
                    .select().single();
                if (insertError || !data) {
                    console.error('Memorial insert error:', insertError);
                    throw new Error(insertError?.message || 'Could not initialize your archive');
                }
                memorialId = data.id;
            }

            writeCurrentMemorialId(storageUserId, 'personal', memorialId!);
            setCurrentMemorialId(memorialId);
            return memorialId!;
        } finally {
            creatingRef.current = false;
        }
    };

    const handlePayment = async () => {
        setIsProcessing(true);
        try {
            const memorialId = await ensureMemorial();

            // replace: prevent back-button from returning to confirmation after going to payment
            const popupParam = isPopup ? '&popup=true' : '';
            router.replace(`/payment?memorialId=${memorialId}&plan=personal${popupParam}`);
        } catch (error: any) {
            console.error('Payment error:', error);
            alert(error.message || 'Payment failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenAuthorization = async () => {
        setIsOpeningAuth(true);
        try {
            const memorialId = await ensureMemorial();

            const url = `/authorization/${memorialId}?type=individual&popup=true`;
            window.open(url, '_blank', 'width=960,height=820,scrollbars=yes,resizable=yes');
        } catch (err: any) {
            alert(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsOpeningAuth(false);
        }
    };

    const canPay = acceptedTerms && authorizationCompleted && !isProcessing;

    return (
        <div className="min-h-screen bg-surface-low">
            <div className="border-b border-warm-border/20 bg-white/60 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <Link
                        href={isDraftUpgrade ? '/choice-pricing' : '/choice-pricing'}
                        className="inline-flex items-center gap-2 text-warm-dark/40 hover:text-warm-dark transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        <span>{isDraftUpgrade ? 'Back to my drafts' : 'Back to plans'}</span>
                    </Link>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="text-center mb-12">
                    {isDraftUpgrade ? (
                        <>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-olive/10 text-olive rounded-full text-sm font-semibold mb-4">
                                <ArrowUpCircle size={16} />
                                Upgrading from Draft to Personal
                            </div>
                            <h1 className="font-serif text-4xl text-warm-dark mb-4">Seal Your Archive</h1>
                            <p className="text-lg text-warm-dark/50">Your draft is ready. ${PLAN_PRICES_USD.personal.toLocaleString()} — A single payment for a permanent archive. No monthly fees. No renewals.</p>
                        </>
                    ) : (
                        <>
                            <h1 className="font-serif text-4xl text-warm-dark mb-4">Seal the Archive</h1>
                            <p className="text-lg text-warm-dark/50">${PLAN_PRICES_USD.personal.toLocaleString()} — A single payment for a permanent archive. No monthly fees. No renewals. No surprises.</p>
                        </>
                    )}
                </div>

                {/* Steps before payment */}
                <div className="bg-white rounded-2xl border border-warm-border/25 p-8 mb-8 max-w-2xl mx-auto">
                    <h3 className="text-sm font-medium text-warm-dark/40 uppercase tracking-wider mb-6">Before Payment</h3>

                    {/* Step 1 — Accept terms */}
                    <label className="flex items-start gap-4 cursor-pointer group mb-6">
                        <div className="relative flex-shrink-0 mt-1">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                                className="w-5 h-5 border-2 border-warm-border/40 rounded cursor-pointer accent-warm-dark"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-warm-dark/60 group-hover:text-warm-dark/80 transition-colors">
                                I accept the{' '}
                                <Link href="/legal/terms" className="text-warm-dark underline font-medium" target="_blank">General Conditions</Link>
                                {' '}and{' '}
                                <Link href="/legal/privacy" className="text-warm-dark underline font-medium" target="_blank">Privacy Policy</Link>
                            </p>
                        </div>
                    </label>

                    {/* Step 2 — Authorization form */}
                    <div className={`p-6 rounded-xl border transition-all ${acceptedTerms ? 'border-warm-border/30 bg-warm-border/5' : 'border-warm-border/15 bg-warm-border/5 opacity-40 pointer-events-none'}`}>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                {authorizationCompleted ? (
                                    <div className="w-7 h-7 bg-warm-dark rounded-full flex items-center justify-center">
                                        <Check size={14} className="text-surface-low" strokeWidth={2.5} />
                                    </div>
                                ) : (
                                    <div className="w-7 h-7 bg-warm-border/20 rounded-full flex items-center justify-center">
                                        <ExternalLink size={14} className="text-warm-dark/30" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-warm-dark text-sm mb-1">Memorial Authorization</h4>
                                {authorizationCompleted ? (
                                    <p className="text-xs text-warm-dark/40">
                                        Authorization completed. You may now proceed to payment.
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-xs text-warm-dark/40 mb-4">
                                            Confirm your legal authority to create this archive. The form opens in a new window.
                                        </p>
                                        <button
                                            onClick={handleOpenAuthorization}
                                            disabled={isOpeningAuth || !acceptedTerms}
                                            className="inline-flex items-center gap-2 px-4 py-2 glass-btn-dark rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                                        >
                                            {isOpeningAuth ? (
                                                <div className="w-3.5 h-3.5 border-2 border-surface-low/40 border-t-surface-low rounded-full animate-spin" />
                                            ) : (
                                                <ExternalLink size={13} />
                                            )}
                                            Open Authorization Form
                                        </button>
                                    </>
                                )}

                                {currentMemorialId && !authorizationCompleted && !isOpeningAuth && (
                                    <p className="text-[11px] text-warm-dark/25 mt-3 flex items-center gap-1.5">
                                        <Loader2 size={10} className="animate-spin" />
                                        Waiting for authorization...
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Button */}
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={handlePayment}
                        disabled={!canPay}
                        className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${canPay
                            ? 'glass-btn-dark'
                            : 'bg-warm-border/20 text-warm-dark/25 cursor-not-allowed'
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-surface-low/30 border-t-surface-low rounded-full animate-spin" />
                                Preparing payment...
                            </>
                        ) : (
                            'Proceed to payment'
                        )}
                    </button>

                    {!authorizationCompleted && acceptedTerms && (
                        <p className="text-center text-[11px] text-warm-dark/25 mt-3">
                            Complete the authorization form above to enable payment.
                        </p>
                    )}

                    <p className="text-center text-[11px] text-warm-dark/20 mt-6">
                        Secure payment powered by Stripe. Your information is encrypted.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function PersonalConfirmationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-full animate-spin" />
            </div>
        }>
            <PersonalConfirmationContent />
        </Suspense>
    );
}
