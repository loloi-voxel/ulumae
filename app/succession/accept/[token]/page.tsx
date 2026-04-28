'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Check, Loader2, AlertCircle, Scale } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuccessorAcceptancePage({ params }: { params: Promise<{ token: string }> }) {
    const unwrappedParams = use(params);
    const token = unwrappedParams.token;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [successorRecord, setSuccessorRecord] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchSuccessorDetails();
    }, [token]);

    const fetchSuccessorDetails = async () => {
        try {
            const response = await fetch(`/api/succession/accept/${token}`, {
                cache: 'no-store',
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Stewardship invitation not found or expired.');
            if (data.alreadyAccepted) throw new Error('You have already accepted this responsibility.');

            setSuccessorRecord(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        setProcessing(true);
        try {
            const response = await fetch(`/api/succession/accept/${token}`, {
                method: 'POST',
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Could not accept this responsibility.');

            toast.success('Responsibility accepted. You are now the designated Archive Steward.');
            router.push('/'); // Redirect to home or a success page

        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-surface-low flex items-center justify-center">
            <Loader2 className="animate-spin text-olive" size={32} />
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-surface-low flex items-center justify-center p-6 text-center">
            <div className="max-w-md">
                <AlertCircle className="mx-auto text-warm-muted mb-4" size={48} />
                <h1 className="font-serif text-2xl mb-2">Invitation Invalid</h1>
                <p className="text-warm-muted mb-6">{error}</p>
                <button onClick={() => router.push('/')} className="text-olive font-medium underline">Return to Home</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
            <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-warm-border/30">
                <div className="p-8 md:p-12">
                    <div className="w-16 h-16 bg-warm-dark text-olive rounded-full flex items-center justify-center mx-auto mb-8">
                        <Shield size={32} />
                    </div>

                    <h1 className="font-serif text-3xl text-center text-warm-dark mb-4">
                        Archive Stewardship
                    </h1>

                    <div className="prose prose-sm text-warm-dark/80 space-y-4 mb-8 text-center leading-relaxed">
                        <p className="text-base">
                            You have been designated as the <strong>Archive Steward</strong> for a ULUMAE account.
                        </p>
                        <p>
                            This means that in the event of the account owner's passing, you will be entrusted with the management, preservation, and control of all family archives associated with this account.
                        </p>
                        <div className="bg-warm-border/10 p-6 rounded-xl border border-warm-border/20 text-left space-y-3">
                            <h4 className="font-bold flex items-center gap-2 text-warm-dark">
                                <Scale size={16} /> Your Commitment:
                            </h4>
                            <ul className="list-disc pl-5 space-y-1 text-xs">
                                <li>I accept the duty to preserve the family history with integrity.</li>
                                <li>I agree to manage archive access for future descendants.</li>
                                <li>I understand that I will become the final arbiter for family disputes.</li>
                            </ul>
                        </div>
                    </div>

                    <button
                        onClick={handleAccept}
                        disabled={processing}
                        className="w-full py-4 glass-btn-dark rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {processing ? <Loader2 className="animate-spin" size={20} /> : "I Accept This Responsibility"}
                    </button>

                    <p className="text-center mt-6 text-xs text-warm-outline">
                        A confirmation has been sent to the account owner.
                    </p>
                </div>
            </div>
        </div>
    );
}
