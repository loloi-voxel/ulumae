// app/family-confirmation/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, ExternalLink, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPlanDashboardPath, useAuth } from '@/components/providers/AuthProvider';
import toast from 'react-hot-toast';
import {
    clearCurrentMemorialId,
    readCurrentMemorialId,
    writeCurrentMemorialId,
} from '@/lib/currentMemorialStorage';
import { ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';

export default function FamilyConfirmationPage() {
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOpeningAuth, setIsOpeningAuth] = useState(false);
    const [authorizationCompleted, setAuthorizationCompleted] = useState(false);
    const [currentMemorialId, setCurrentMemorialId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const router = useRouter();
    const auth = useAuth();

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/family-confirmation');
            return;
        }
        if (auth.hasPaid && (auth.plan === 'family' || auth.plan === 'concierge')) {
            router.replace(getPlanDashboardPath(auth.plan, auth.user!.id));
            return;
        }
    }, [auth.loading, auth.authenticated, auth.hasPaid, auth.plan, auth.user, router]);

    useEffect(() => {
        if (!auth.user?.id) return;

        const storedId = readCurrentMemorialId(auth.user.id, 'family');
        if (storedId && storedId !== 'null' && storedId !== 'undefined') {
            setCurrentMemorialId(storedId);
            if (localStorage.getItem(`lv-auth-${storedId}`) === 'done') {
                setAuthorizationCompleted(true);
            }
        }
    }, [auth.user?.id]);

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

    useEffect(() => {
        if (authorizationCompleted && pollRef.current) clearInterval(pollRef.current);
    }, [authorizationCompleted]);

    const creatingRef = useRef(false);

    const ensureMemorial = async (): Promise<string> => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Please sign in to continue.');
        const storageUserId = auth.user?.id || user.id;

        let memorialId: string | null = currentMemorialId;

        if (!memorialId || memorialId === 'null' || memorialId === 'undefined') {
            memorialId = readCurrentMemorialId(storageUserId, 'family');
        }

        if (memorialId && memorialId !== 'null' && memorialId !== 'undefined') {
            const { data: existing } = await supabase
                .from('memorials')
                .select('id')
                .eq('id', memorialId)
                .eq('user_id', user.id)
                .maybeSingle();
            if (existing) {
                setCurrentMemorialId(memorialId);
                writeCurrentMemorialId(storageUserId, 'family', memorialId);
                return memorialId;
            }
            memorialId = null;
            clearCurrentMemorialId(storageUserId, 'family');
        }

        if (creatingRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            if (currentMemorialId) return currentMemorialId;
            throw new Error('Memorial creation in progress. Please try again.');
        }

        creatingRef.current = true;
        try {
            const { data: existingUnpaid } = await supabase
                .from('memorials')
                .select('id')
                .eq('user_id', user.id)
                .eq('mode', 'family')
                .eq('paid', false)
                .eq('deleted', false)
                .limit(1)
                .maybeSingle();

            if (existingUnpaid) {
                memorialId = existingUnpaid.id;
            } else {
                const { data, error: insertError } = await supabase
                    .from('memorials')
                    .insert({ user_id: user.id, slug: `family-memorial-${Date.now()}`, mode: 'family', paid: false })
                    .select().single();
                if (insertError || !data) {
                    console.error('Memorial insert error:', insertError);
                    throw new Error(insertError?.message || 'Could not initialize your archive');
                }
                memorialId = data.id;
            }

            writeCurrentMemorialId(storageUserId, 'family', memorialId!);
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
            router.replace(`/payment?memorialId=${memorialId}&plan=family&amount=2940`);
        } catch (error: any) {
            console.error('Payment error:', error);
            toast.error(error.message || 'Payment failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenAuthorization = async () => {
        setIsOpeningAuth(true);
        try {
            const memorialId = await ensureMemorial();
            const url = `/authorization/${memorialId}?type=account&popup=true`;
            window.open(url, '_blank', 'width=960,height=820,scrollbars=yes,resizable=yes');
        } catch (err: any) {
            toast.error(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsOpeningAuth(false);
        }
    };

    const canPay = acceptedTerms && authorizationCompleted && !isProcessing;

    return (
        <ExperiencePage containerClassName="max-w-6xl">
            <Link
                href="/choice-pricing"
                className="experience-button experience-button-secondary mb-10 w-fit text-[11px] tracking-[0.22em]"
            >
                <ArrowLeft size={14} />
                Back to plans
            </Link>

            <div className="grid gap-8 lg:grid-cols-[0.92fr_0.78fr] lg:items-start">
                <div>
                    <ExperienceHero
                        kicker={<span className="experience-kicker">Family Preservation</span>}
                        title={
                            <>
                                Seal the
                                <br />
                                <span className="italic text-olive">family archive</span>
                            </>
                        }
                        subtitle="$2,940 is a one-time payment for a permanent family archive with no monthly fees, renewals, or storage surprises."
                    />

                    <div className="experience-card max-w-xl p-6">
                        <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">What happens here</p>
                        <div className="mt-5 space-y-4 text-sm leading-relaxed text-warm-muted">
                            <p>1. Confirm the legal and privacy terms for the family archive.</p>
                            <p>2. Complete the family authorization form in a separate window.</p>
                            <p>3. Continue to secure payment only after approval is in place.</p>
                        </div>
                    </div>
                </div>

                <ExperiencePanel className="mx-auto w-full max-w-2xl">
                    <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Before Payment</p>
                    <h2 className="mt-3 font-serif text-3xl text-warm-dark">Prepare the family archive</h2>

                    <label className="group mt-8 flex cursor-pointer items-start gap-4 rounded-none border border-warm-border/25 bg-white/72 p-5 transition-colors hover:bg-white">
                        <div className="relative mt-1 flex-shrink-0">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                                className="h-5 w-5 cursor-pointer rounded-none border-2 border-warm-border/40 accent-warm-dark"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm leading-relaxed text-warm-dark/65 group-hover:text-warm-dark">
                                I accept the{' '}
                                <Link href="/legal/terms" className="experience-link font-medium underline underline-offset-4" target="_blank">
                                    General Conditions
                                </Link>{' '}
                                and{' '}
                                <Link href="/legal/privacy" className="experience-link font-medium underline underline-offset-4" target="_blank">
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </div>
                    </label>

                    <div
                        className={`mt-5 rounded-none border p-6 transition-all ${
                            acceptedTerms
                                ? 'border-warm-border/30 bg-surface-mid/35'
                                : 'pointer-events-none border-warm-border/15 bg-warm-border/5 opacity-50'
                        }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className="mt-0.5 flex-shrink-0">
                                {authorizationCompleted ? (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-none bg-warm-dark">
                                        <Check size={15} className="text-surface-low" strokeWidth={2.5} />
                                    </div>
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-none bg-white/90">
                                        <ExternalLink size={14} className="text-warm-dark/35" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-warm-outline">Memorial Authorization</h3>
                                {authorizationCompleted ? (
                                    <p className="mt-3 text-sm leading-relaxed text-warm-muted">
                                        Authorization completed. You can continue directly to payment.
                                    </p>
                                ) : (
                                    <>
                                        <p className="mt-3 text-sm leading-relaxed text-warm-muted">
                                            Confirm your legal authority for this family archive in a separate window before payment begins.
                                        </p>
                                        <button
                                            onClick={handleOpenAuthorization}
                                            disabled={isOpeningAuth || !acceptedTerms}
                                            className={`experience-button mt-5 px-5 py-3 text-[11px] tracking-[0.22em] ${
                                                isOpeningAuth || !acceptedTerms
                                                    ? 'cursor-not-allowed border border-warm-border/30 bg-surface-mid/80 text-warm-outline'
                                                    : 'experience-button-secondary'
                                            }`}
                                        >
                                            {isOpeningAuth ? (
                                                <>
                                                    <div className="h-3.5 w-3.5 rounded-none border-2 border-warm-dark/20 border-t-warm-dark animate-spin" />
                                                    Opening form
                                                </>
                                            ) : (
                                                <>
                                                    <ExternalLink size={13} />
                                                    Open Authorization Form
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}

                                {currentMemorialId && !authorizationCompleted && !isOpeningAuth && (
                                    <p className="mt-4 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-warm-outline">
                                        <Loader2 size={10} className="animate-spin" />
                                        Waiting for authorization
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="experience-divider my-8" />

                    <button
                        onClick={handlePayment}
                        disabled={!canPay}
                        className={`experience-button w-full justify-center py-4 text-[11px] tracking-[0.22em] ${
                            canPay
                                ? 'experience-button-primary'
                                : 'cursor-not-allowed border border-warm-border/30 bg-surface-mid/80 text-warm-outline'
                        }`}
                    >
                        {isProcessing ? (
                            <>
                                <div className="h-4 w-4 rounded-none border-2 border-surface-low/30 border-t-surface-low animate-spin" />
                                Preparing payment
                            </>
                        ) : (
                            'Proceed to payment ($2,940)'
                        )}
                    </button>

                    {!authorizationCompleted && acceptedTerms && (
                        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.16em] text-warm-outline">
                            Complete authorization to enable payment
                        </p>
                    )}

                    <p className="mt-6 text-center text-xs leading-relaxed text-warm-outline">
                        Secure payment powered by Stripe. Your information remains encrypted throughout the process.
                    </p>
                </ExperiencePanel>
            </div>
        </ExperiencePage>
    );
}
