// app/payment/page.tsx
// Stripe Elements payment page (on-site, no redirect)
// ARCHITECTURAL: Auth-guarded, prevents re-submission on back-button
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ArrowLeft, Shield, Lock, RefreshCw, CheckCircle } from 'lucide-react';
import { getDashboardPath, useAuth } from '@/components/providers/AuthProvider';

// Load Stripe outside of component to avoid re-creating on every render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ============================================
// PAYMENT FORM COMPONENT (inside Elements)
// ============================================
function PaymentForm({ memorialId, amount, fullName, plan, isPopup }: {
    memorialId: string;
    amount: number;
    fullName: string;
    plan: string;
    isPopup: boolean;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();

    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsProcessing(true);
        setPaymentError(null);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/payment-success?id=${memorialId}&plan=${plan}${isPopup ? '&popup=true' : ''}`,
                },
                redirect: 'if_required',
            });

            if (error) {
                // Step 2.2.3: Graceful error messages
                let friendlyMessage: string;

                switch (error.type) {
                    case 'card_error':
                        friendlyMessage = 'The payment could not be processed. This happens sometimes. Please check your card details or try another card.';
                        break;
                    case 'validation_error':
                        friendlyMessage = 'Please check the information you entered and try again.';
                        break;
                    default:
                        friendlyMessage = 'The payment could not be processed. This happens sometimes. Please try again in a moment.';
                }

                setPaymentError(friendlyMessage);
                setIsProcessing(false);
                return;
            }

            // Payment succeeded without redirect (no 3DS required)
            if (paymentIntent && paymentIntent.status === 'succeeded') {
                // replace: prevent back-button from returning to payment form
                router.replace(
                    `/payment-success?id=${memorialId}&plan=${plan}&payment_intent=${paymentIntent.id}${isPopup ? '&popup=true' : ''}`
                );
            }
        } catch (err: any) {
            setPaymentError('An unexpected error occurred. Your draft is saved, and you can return at any time.');
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Step 2.2.2: Trust header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-medium text-warm-dark/50 uppercase tracking-wider">Payment</h2>
                    <div className="flex items-center gap-1.5 text-xs text-warm-dark/25">
                        <Lock size={11} />
                        Encrypted
                    </div>
                </div>
                <p className="text-2xl font-serif text-warm-dark">
                    ${amount.toLocaleString()}.00
                </p>
                <p className="text-xs text-warm-dark/30 mt-1">
                    Permanent archive for {fullName}
                </p>
            </div>

            {/* Stripe Payment Element — Step 2.2.1 */}
            <div className="mb-6 p-5 bg-surface-low/50 rounded-xl border border-warm-border/20">
                <PaymentElement
                    options={{
                        layout: 'tabs',
                    }}
                />
            </div>

            {/* Step 2.2.3: Payment error display */}
            {paymentError && (
                <div className="mb-6 p-5 bg-warm-border/8 border border-warm-border/20 rounded-xl">
                    <p className="text-sm text-warm-dark/60 leading-relaxed mb-3">
                        {paymentError}
                    </p>
                    <p className="text-xs text-warm-dark/30">
                        Your draft is saved, and you can return at any time.
                        Need help? Contact us at <a href="mailto:support@ulumae.com" className="underline hover:text-warm-dark/50">support@ulumae.com</a>
                    </p>
                </div>
            )}

            {/* Trust elements */}
            <div className="mb-6 space-y-2">
                <div className="flex items-center gap-2 text-xs text-warm-dark/25">
                    <div className="w-1 h-1 rounded-full bg-warm-dark/15" />
                    A single payment for a permanent archive — No subscription — No hidden fees
                </div>
                <div className="flex items-center gap-2 text-xs text-warm-dark/25">
                    <div className="w-1 h-1 rounded-full bg-warm-dark/15" />
                    Secure payment powered by Stripe — Your banking details are never stored on our servers
                </div>
                <div className="flex items-center gap-2 text-xs text-warm-dark/25">
                    <div className="w-1 h-1 rounded-full bg-warm-dark/15" />
                    Permanent archive + Independent export + Lifetime access + Dedicated support
                </div>
            </div>

            {/* Refund policy reminder */}
            <div className="mb-6 p-4 bg-warm-border/5 border border-warm-border/15 rounded-xl">
                <p className="text-xs text-warm-dark/40 leading-relaxed">
                    After payment, your archive will be active. You may request a full refund as long as it has not been published. Once published, the archive is no longer eligible for refund.
                </p>
            </div>

            {/* Submit button */}
            <button
                type="submit"
                disabled={!stripe || isProcessing}
                className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${isProcessing || !stripe
                    ? 'bg-warm-border/20 text-warm-dark/30 cursor-not-allowed'
                    : 'glass-btn-dark'
                    }`}
            >
                {isProcessing ? (
                    <>
                        <RefreshCw size={18} className="animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Shield size={18} />
                        Seal the archive — ${amount.toLocaleString()}.00
                    </>
                )}
            </button>
        </form>
    );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
function PaymentPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const auth = useAuth();
    const memorialId = searchParams.get('memorialId');
    const planParam = searchParams.get('plan') || 'personal';
    const popupParam = searchParams.get('popup') === 'true';
    const amountParam = parseInt(searchParams.get('amount') || '1470', 10);
    const hasInitialized = useRef(false);

    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [amount, setAmount] = useState(amountParam);
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [alreadyPaid, setAlreadyPaid] = useState(false);

    // Auth guard
    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/choice-pricing');
            return;
        }
    }, [auth.loading, auth.authenticated, router]);

    // Check if this memorial is already paid (back-button scenario)
    useEffect(() => {
        if (auth.loading || !memorialId) return;
        const archive = auth.archives.find(a => a.id === memorialId);
        if (archive?.paid) {
            setAlreadyPaid(true);
            setLoading(false);
        }
    }, [auth.loading, auth.archives, memorialId]);

    useEffect(() => {
        if (!memorialId || alreadyPaid || hasInitialized.current) {
            if (!memorialId) {
                setError('No memorial specified.');
                setLoading(false);
            }
            return;
        }
        hasInitialized.current = true;

        const createIntent = async () => {
            try {
                const res = await fetch('/api/create-payment-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memorialId, amount: amountParam, plan: planParam }),
                });

                const data = await res.json();

                if (!res.ok) {
                    if (data.code === 'LEGAL_AUTH_REQUIRED') {
                        router.replace(`/authorization/${memorialId}?type=individual&redirect=payment`);
                        return;
                    }
                    // If the API says it's already paid, show the already-paid screen
                    if (data.code === 'ALREADY_PAID') {
                        setAlreadyPaid(true);
                        setLoading(false);
                        return;
                    }
                    throw new Error(data.error || 'Failed to initialize payment');
                }

                setClientSecret(data.clientSecret);
                setAmount(data.amount);
                setFullName(data.fullName);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        createIntent();
    }, [memorialId, router, amountParam, planParam, alreadyPaid]);

    // If user navigated back to this page but the memorial is already paid,
    // show a confirmation screen instead of the payment form
    if (alreadyPaid) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <div className="w-16 h-16 bg-warm-dark/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={32} className="text-warm-dark/60" />
                    </div>
                    <h2 className="font-serif text-2xl text-warm-dark mb-3">Payment already completed</h2>
                    <p className="text-sm text-warm-dark/50 mb-8">
                        This archive has already been activated. You can access it from your dashboard.
                    </p>
                    <button
                        onClick={() => router.replace(getDashboardPath(auth))}
                        className="px-6 py-3 glass-btn-dark rounded-xl font-medium transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-xs text-warm-dark/30">Preparing secure payment...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <p className="text-warm-dark/50 mb-4">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="text-sm text-warm-dark/30 hover:text-warm-dark transition-colors underline"
                    >
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    if (!clientSecret) return null;

    return (
        <div className="min-h-screen bg-surface-low">
            {/* Header */}
            <div className="border-b border-warm-border/20 bg-white/60 backdrop-blur-sm">
                <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-warm-dark/40 hover:text-warm-dark transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-warm-dark/25">
                        <Shield size={12} />
                        Secure payment
                    </div>
                </div>
            </div>

            {/* Step 2.2.1: Payment form with Stripe Elements */}
            <div className="max-w-lg mx-auto px-6 py-16">
                <Elements
                    stripe={stripePromise}
                    options={{
                        clientSecret,
                        appearance: {
                            theme: 'flat',
                            variables: {
                                colorPrimary: '#5a6b78',
                                colorBackground: '#fdf6f0',
                                colorText: '#5a6b78',
                                colorDanger: '#d4958a',
                                fontFamily: 'Georgia, serif',
                                borderRadius: '12px',
                                spacingUnit: '4px',
                            },
                            rules: {
                                '.Input': {
                                    border: '1px solid #e8d8cc',
                                    boxShadow: 'none',
                                    padding: '12px 16px',
                                },
                                '.Input:focus': {
                                    border: '1px solid #8AABB4',
                                    boxShadow: '0 0 0 2px rgba(138,171,180,0.1)',
                                },
                                '.Label': {
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: '#5a6b78',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                },
                                '.Tab': {
                                    border: '1px solid #e8d8cc',
                                    borderRadius: '8px',
                                    color: '#5a6b78',
                                },
                                '.Tab:hover': {
                                    color: '#3d4a54',
                                    border: '1px solid #c5b5a8',
                                },
                                '.Tab--selected': {
                                    backgroundColor: '#fdf6f0',
                                    border: '1px solid #5a6b78',
                                    color: '#3d4a54',
                                },
                                '.Tab--selected:hover': {
                                    color: '#3d4a54',
                                },
                                '.TabLabel': {
                                    color: '#5a6b78',
                                },
                                '.TabIcon': {
                                    fill: '#5a6b78',
                                },
                            },
                        },
                    }}
                >
                    <PaymentForm
                        memorialId={memorialId!}
                        amount={amount}
                        fullName={fullName}
                        plan={planParam}
                        isPopup={popupParam}
                    />
                </Elements>
            </div>
        </div>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-full animate-spin" />
            </div>
        }>
            <PaymentPageContent />
        </Suspense>
    );
}
