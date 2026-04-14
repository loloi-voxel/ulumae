// app/payment-success/page.tsx
// Phase 1: The Post-Payment Ritual — Threshold Page + Three Doors
// ARCHITECTURAL: Revalidates auth state after payment, prevents back-button issues
'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, BookOpen, Circle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getPlanDashboardPath, useAuth } from '@/components/providers/AuthProvider';

// ─── Memorial data we need for the Threshold Page ────────────────────────────
interface ThresholdMemorial {
    full_name: string | null;
    birth_date: string | null;
    death_date: string | null;
    profile_photo_url: string | null;
    user_id: string;
    step1: any;
}

// ─── Helper: format a date string as readable year or full date ───────────────
function formatDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return null;
    }
}

// ─── Main inner component (needs Suspense wrapper for useSearchParams) ────────
function PaymentSuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { revalidate } = useAuth();
    const memorialId = searchParams.get('id');
    const planParam = searchParams.get('plan') || 'personal';
    const isUpgrade = searchParams.get('upgrade') === 'true';
    const sessionId = searchParams.get('session_id');
    const paymentIntentId = searchParams.get('payment_intent');
    const hasFinalized = useRef(false);

    // Phases: finalizing → threshold → doors → redirecting
    const [phase, setPhase] = useState<'finalizing' | 'threshold' | 'doors' | 'redirecting'>('finalizing');
    const [memorial, setMemorial] = useState<ThresholdMemorial | null>(null);
    const [buttonVisible, setButtonVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Prevent double-finalization (e.g., from StrictMode or re-renders)
        if (hasFinalized.current) return;
        hasFinalized.current = true;

        // Replace current history entry so the back button goes to dashboard, not back here
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        const run = async () => {
            if (!memorialId || memorialId === 'null' || memorialId === 'undefined') {
                setError('Their legacy is now protected, but no archive was found. Please contact support with your payment confirmation.');
                return;
            }

            try {
                if (isUpgrade) {
                    if (!sessionId) {
                        throw new Error('Your payment was received, but the upgrade session could not be verified.');
                    }

                    // UPGRADE FLOW: Use finalize-upgrade to preserve data (idempotent)
                    const response = await fetch('/api/finalize-upgrade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ memorialId, targetPlan: planParam, sessionId }),
                    });
                    const result = await response.json();
                    if (result.error) throw new Error(result.error);
                } else {
                    if (!sessionId && !paymentIntentId) {
                        throw new Error('Your payment was received, but the payment confirmation could not be verified.');
                    }

                    // NEW PAYMENT FLOW: Standard finalization
                    const response = await fetch('/api/finalize-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            memorialId,
                            ...(sessionId ? { sessionId } : { paymentIntentId }),
                        }),
                    });
                    const result = await response.json();
                    if (result.error) throw new Error(result.error);
                }

                // Revalidate auth state so the entire app reflects the new payment status
                await revalidate();

                // UPGRADE FLOW: Go straight to family dashboard with welcome message.
                // Uses replace() so payment-success is removed from browser history —
                // back button from family dashboard will land on personal dashboard,
                // which already redirects to family if plan is 'family'.
                if (isUpgrade) {
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    const uid = user?.id || '';
                    window.location.replace(
                        uid ? `${getPlanDashboardPath(planParam, uid)}?welcome=true` : '/dashboard'
                    );
                    return;
                }

                // STANDARD (non-upgrade) FLOW: Check if memorial has content
                const supabase = createClient();
                const { data, error: fetchError } = await supabase
                    .from('memorials')
                    .select('full_name, birth_date, death_date, profile_photo_url, user_id, step1')
                    .eq('id', memorialId)
                    .single();

                // FRESH PROTECTION (no content yet): Go straight to dashboard
                // This handles the choice-pricing → pay → empty dashboard flow
                if (!data?.full_name) {
                    const uid = data?.user_id || '';
                    window.location.replace(
                        uid ? `${getPlanDashboardPath(planParam, uid)}?welcome=true` : '/dashboard'
                    );
                    return;
                }

                // DRAFT→PERSONAL SEAL FLOW (has content): Show threshold experience
                if (!fetchError && data) {
                    setMemorial(data as ThresholdMemorial);
                }

                // Transition to the Threshold Page
                setPhase('threshold');

                // After 9 seconds, reveal the button (1s fade-in handled by CSS)
                setTimeout(() => {
                    setButtonVisible(true);
                }, 9000);

            } catch (err: any) {
                console.error('Finalization failed:', err);
                setError(
                    `Their legacy is now protected, but finalization encountered an issue: ${err.message}. ` +
                    `Your archive is safe. Please contact support.`
                );
            }
        };

        run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memorialId, paymentIntentId, planParam, isUpgrade, revalidate, sessionId]);

    // ── Derived data ──────────────────────────────────────────────────────────
    const isSelfArchive = memorial?.step1?.isSelfArchive === true;
    const name = memorial?.full_name || 'this person';
    const birthFormatted = formatDate(memorial?.birth_date ?? null);
    const deathFormatted = formatDate(memorial?.death_date ?? null);
    const dateRange = birthFormatted
        ? deathFormatted
            ? `${birthFormatted} — ${deathFormatted}`
            : birthFormatted
        : null;
    const workspaceMode = planParam === 'family' || planParam === 'concierge' ? 'family' : 'personal';

    // ── Door action handler ───────────────────────────────────────────────────
    // Uses router.replace to prevent the back button from returning to payment-success
    const handleDoor = async (door: 'photograph' | 'story' | 'silence') => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || memorial?.user_id;

        setPhase('redirecting');

        setTimeout(() => {
            if (door === 'silence') {
                const dashPath = userId
                    ? `${getPlanDashboardPath(planParam, userId)}?welcome=true`
                    : '/dashboard';
                router.replace(dashPath);
            } else if (door === 'photograph') {
                router.replace(`/create?id=${memorialId}&mode=${workspaceMode}&step=8`);
            } else {
                // story
                router.replace(`/create?id=${memorialId}&mode=${workspaceMode}&step=6`);
            }
        }, 600);
    };

    // ── Error state ───────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <p className="text-warm-dark/60 mb-6 leading-relaxed">{error}</p>
                    <a
                        href="mailto:support@ulumae.com"
                        className="text-sm text-warm-dark/40 underline hover:text-warm-dark transition-colors"
                    >
                        Contact support@ulumae.com
                    </a>
                </div>
            </div>
        );
    }

    // ── Phase: finalizing ─────────────────────────────────────────────────────
    if (phase === 'finalizing') {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
                <div className="text-center max-w-md animate-fadeIn">
                    <div className="w-16 h-16 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-full animate-spin mx-auto mb-8" />
                    <p className="text-warm-dark/40 text-sm">Consecrating the archive...</p>
                </div>
            </div>
        );
    }

    // ── Phase: redirecting ────────────────────────────────────────────────────
    if (phase === 'redirecting') {
        return (
            <div
                className="min-h-screen flex items-center justify-center"
                style={{ backgroundColor: '#1a2332' }}
            >
                <div className="w-8 h-8 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
            </div>
        );
    }

    // ── Phase: threshold ──────────────────────────────────────────────────────
    if (phase === 'threshold') {
        const thresholdMessage = isSelfArchive
            ? 'You have chosen to shape your own memory. What you create here will outlive you.'
            : `You have chosen to preserve the memory of ${name}. This archive will endure.`;
        const buttonLabel = isSelfArchive ? 'Begin writing' : 'Enter the archive';

        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden"
                style={{ backgroundColor: '#1a2332' }}
            >
                {/* Organic light — digital candle glow */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(253,246,240,0.06) 0%, transparent 70%)',
                    }}
                >
                    <div
                        className="absolute inset-0 animate-organic-light"
                        style={{
                            background: 'radial-gradient(ellipse 40% 35% at 50% 38%, rgba(253,246,240,0.12) 0%, transparent 65%)',
                        }}
                    />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto animate-fadeIn">

                    {/* Portrait photo */}
                    {memorial?.profile_photo_url && (
                        <div
                            className="mb-10 overflow-hidden flex-shrink-0"
                            style={{
                                width: 180,
                                height: 180,
                                borderRadius: '50%',
                                border: '2px solid rgba(253,246,240,0.15)',
                                boxShadow: '0 0 60px rgba(253,246,240,0.07)',
                            }}
                        >
                            <img
                                src={memorial.profile_photo_url}
                                alt={name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                    )}

                    {/* Main message */}
                    <h1
                        className="font-serif leading-snug mb-6"
                        style={{
                            fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
                            color: '#fdf6f0',
                            letterSpacing: '0.01em',
                        }}
                    >
                        {thresholdMessage}
                    </h1>

                    {/* Date range */}
                    {dateRange && (
                        <p
                            className="mb-16"
                            style={{
                                color: 'rgba(253,246,240,0.45)',
                                fontSize: '1rem',
                                letterSpacing: '0.04em',
                            }}
                        >
                            {dateRange}
                        </p>
                    )}

                    {/* Button — appears after 9s with 1s fade-in */}
                    {buttonVisible ? (
                        <button
                            onClick={() => setPhase('doors')}
                            className="animate-fade-in-gentle"
                            style={{
                                padding: '14px 40px',
                                borderRadius: 4,
                                border: '1px solid rgba(253,246,240,0.25)',
                                background: 'transparent',
                                color: 'rgba(253,246,240,0.85)',
                                fontSize: '0.85rem',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(253,246,240,0.08)';
                                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(253,246,240,0.45)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(253,246,240,0.25)';
                            }}
                        >
                            {buttonLabel}
                        </button>
                    ) : (
                        // Invisible placeholder so layout doesn't shift
                        <div style={{ height: 50 }} />
                    )}
                </div>
            </div>
        );
    }

    // ── Phase: doors — The Three Doors ───────────────────────────────────────
    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-8"
            style={{ backgroundColor: '#1e2d3d' }}
        >
            <div className="w-full max-w-4xl animate-fadeIn">
                <p
                    className="text-center mb-12"
                    style={{
                        color: 'rgba(253,246,240,0.5)',
                        fontSize: '0.8rem',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                    }}
                >
                    How would you like to begin?
                </p>

                {/* Three door cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <DoorCard
                        icon={<Camera size={28} strokeWidth={1.2} />}
                        title="Start with a photograph"
                        subtext={`Choose the image that defines ${isSelfArchive ? 'you' : name} for you.`}
                        onClick={() => handleDoor('photograph')}
                    />
                    <DoorCard
                        icon={<BookOpen size={28} strokeWidth={1.2} />}
                        title="Start with a story"
                        subtext={`Tell a moment that captures who ${isSelfArchive ? 'you are' : `${name} was`}.`}
                        onClick={() => handleDoor('story')}
                    />
                    <DoorCard
                        icon={<Circle size={28} strokeWidth={1} />}
                        title="Start with silence"
                        subtext="Take a moment. The archive is waiting."
                        onClick={() => handleDoor('silence')}
                        muted
                    />
                </div>
            </div>
        </div>
    );
}

// ── Door card component ───────────────────────────────────────────────────────
function DoorCard({
    icon,
    title,
    subtext,
    onClick,
    muted = false,
}: {
    icon: React.ReactNode;
    title: string;
    subtext: string;
    onClick: () => void;
    muted?: boolean;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="text-left w-full"
            style={{
                padding: '36px 28px',
                borderRadius: 8,
                border: `1px solid ${hovered ? 'rgba(253,246,240,0.25)' : 'rgba(253,246,240,0.10)'}`,
                background: hovered
                    ? 'rgba(253,246,240,0.05)'
                    : 'rgba(253,246,240,0.02)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}
        >
            <div style={{ color: muted ? 'rgba(253,246,240,0.30)' : 'rgba(253,246,240,0.60)' }}>
                {icon}
            </div>
            <div>
                <p
                    className="font-serif mb-2"
                    style={{
                        fontSize: '1.25rem',
                        color: muted ? 'rgba(253,246,240,0.50)' : 'rgba(253,246,240,0.85)',
                    }}
                >
                    {title}
                </p>
                <p
                    style={{
                        fontSize: '0.82rem',
                        color: 'rgba(253,246,240,0.35)',
                        lineHeight: 1.6,
                    }}
                >
                    {subtext}
                </p>
            </div>
        </button>
    );
}

// ── Page export with Suspense boundary ───────────────────────────────────────
export default function PaymentSuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-surface-low flex items-center justify-center">
                    <div className="w-12 h-12 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-full animate-spin" />
                </div>
            }
        >
            <PaymentSuccessContent />
        </Suspense>
    );
}
