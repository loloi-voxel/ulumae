'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    CheckCircle2,
    Download,
    ExternalLink,
    Loader2,
    Lock,
    Mail,
    Shield,
} from 'lucide-react';

import DashboardShell from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { downloadCertificate, type CertificateData } from '@/lib/certificate/certificateGenerator';
import type { MemorialSealState } from '@/types/memorial';

const CERTIFICATE_WARNING =
    'This password cannot be recovered. If it is lost, the sealed memorial cannot be decrypted.';

interface CertificatePayload {
    fullName: string;
    birthDate: string;
    deathDate: string | null;
    preservationDate: string | null;
    transactionId: string;
    gatewayUrls: string[];
    memorialId: string;
    planType: string;
    sealStatus?: string | null;
}

interface SealStatePayload {
    success: boolean;
    memorial?: {
        id: string;
        fullName: string | null;
        mode: string | null;
        preservationState: string | null;
        preservationDate: string | null;
    };
    sealState?: MemorialSealState;
    error?: string;
}

function buildGatewayUrl(payload: CertificatePayload) {
    return payload.gatewayUrls[0] || `https://arweave.net/${payload.transactionId}`;
}

export default function SuccessPage() {
    const auth = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const memorialId = searchParams.get('memorialId');

    const [certificateData, setCertificateData] = useState<CertificatePayload | null>(null);
    const [sealState, setSealState] = useState<MemorialSealState | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [hasPassword, setHasPassword] = useState(false);

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            const next = memorialId ? `/success?memorialId=${memorialId}` : '/success';
            router.replace(`/login?next=${encodeURIComponent(next)}`);
        }
    }, [auth.loading, auth.authenticated, memorialId, router]);

    useEffect(() => {
        if (!memorialId || typeof window === 'undefined') {
            setHasPassword(false);
            return;
        }

        setHasPassword(Boolean(window.sessionStorage.getItem(`ulumae-seal-password:${memorialId}`)));
    }, [memorialId]);

    useEffect(() => {
        if (auth.loading || !auth.authenticated) return;
        if (!memorialId) {
            setErrorMessage('A memorial ID is required to view the seal confirmation.');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                const [certificateRes, sealRes] = await Promise.all([
                    fetch(`/api/arweave/certificate?memorialId=${encodeURIComponent(memorialId)}`, {
                        cache: 'no-store',
                    }),
                    fetch(`/api/seal/state?memorialId=${encodeURIComponent(memorialId)}`, {
                        cache: 'no-store',
                    }),
                ]);

                const certificatePayload = await certificateRes.json().catch(() => null);
                const sealPayload = (await sealRes.json().catch(() => null)) as SealStatePayload | null;

                if (!certificateRes.ok || !certificatePayload) {
                    throw new Error(certificatePayload?.error || 'Could not load the seal certificate.');
                }

                if (!sealRes.ok || !sealPayload?.success || !sealPayload.sealState) {
                    throw new Error(sealPayload?.error || 'Could not load the seal state.');
                }

                if (cancelled) return;
                setCertificateData(certificatePayload as CertificatePayload);
                setSealState(sealPayload.sealState);
                setErrorMessage(null);
            } catch (error: any) {
                if (cancelled) return;
                setErrorMessage(error?.message || 'Could not load the seal confirmation.');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [auth.loading, auth.authenticated, memorialId]);

    const gatewayUrl = useMemo(
        () => (certificateData ? buildGatewayUrl(certificateData) : null),
        [certificateData]
    );

    const handleDownload = async () => {
        if (!certificateData || !memorialId || typeof window === 'undefined') return;
        const password = window.sessionStorage.getItem(`ulumae-seal-password:${memorialId}`);
        if (!password) {
            setHasPassword(false);
            return;
        }

        const payload: CertificateData = {
            fullName: certificateData.fullName,
            birthDate: certificateData.birthDate,
            deathDate: certificateData.deathDate,
            preservationDate: certificateData.preservationDate || new Date().toISOString(),
            transactionId: certificateData.transactionId,
            gatewayUrls: certificateData.gatewayUrls,
            gatewayUrl,
            memorialId: certificateData.memorialId,
            planType: certificateData.planType,
            password,
            warning: CERTIFICATE_WARNING,
        };

        await downloadCertificate(payload);
    };

    if (auth.loading || !auth.authenticated || !auth.user?.id || loading) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-warm-muted/50" />
            </div>
        );
    }

    return (
        <DashboardShell userId={auth.user.id}>
            <div className="min-h-screen bg-surface-low">
                <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
                    <div className="rounded-none border border-warm-border/30 bg-white p-8 shadow-sm md:p-12">
                        {errorMessage ? (
                            <div className="rounded-none border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                                {errorMessage}
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-olive/10 text-olive">
                                        <CheckCircle2 size={40} />
                                    </div>
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">
                                        Seal Forever
                                    </p>
                                    <h1 className="mt-3 font-serif text-4xl text-warm-dark md:text-5xl">
                                        The memorial is now sealed.
                                    </h1>
                                    <p className="mt-4 max-w-2xl text-sm text-warm-muted">
                                        {certificateData?.fullName || 'This memorial'} has been written to Arweave and locked against further editing. A PDF certificate has been emailed to the memorial owner.
                                    </p>
                                </div>

                                <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                                    <section className="rounded-none border border-warm-border/30 bg-surface-mid/30 p-6">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">
                                            Arweave Record
                                        </p>
                                        <code className="mt-3 block break-all text-sm text-olive">
                                            {certificateData?.transactionId}
                                        </code>
                                        {gatewayUrl && (
                                            <a
                                                href={gatewayUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-4 inline-flex items-center gap-2 text-sm text-olive hover:text-olive/80"
                                            >
                                                <ExternalLink size={15} />
                                                View the permanent record
                                            </a>
                                        )}

                                        <div className="mt-6 space-y-3 text-sm text-warm-dark/80">
                                            <div className="rounded-none border border-warm-border/25 bg-white px-4 py-3">
                                                Status: {sealState?.status === 'completed' ? 'Completed' : sealState?.status || 'Unknown'}
                                            </div>
                                            <div className="rounded-none border border-warm-border/25 bg-white px-4 py-3">
                                                Sealed on: {certificateData?.preservationDate
                                                    ? new Date(certificateData.preservationDate).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })
                                                    : 'Unknown date'}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-none border border-warm-border/30 bg-surface-mid/30 p-6">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-none bg-white text-warm-brown">
                                                <Lock size={18} />
                                            </div>
                                            <div>
                                                <h2 className="font-serif text-2xl text-warm-dark">
                                                    Certificate & password
                                                </h2>
                                                <p className="mt-2 text-sm text-warm-muted">
                                                    The decryption password is never stored by ULUMAE. Keep the PDF certificate safe. If the password is lost, the sealed data cannot be decrypted.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-3">
                                            <button
                                                type="button"
                                                onClick={() => void handleDownload()}
                                                disabled={!hasPassword}
                                                className={`inline-flex w-full items-center justify-center gap-2 rounded-none px-5 py-3 text-sm font-medium transition-colors ${
                                                    hasPassword
                                                        ? 'bg-warm-dark text-white hover:bg-warm-dark/90'
                                                        : 'cursor-not-allowed border border-warm-border/30 bg-white text-warm-muted'
                                                }`}
                                            >
                                                <Download size={16} />
                                                Download PDF certificate
                                            </button>

                                            {!hasPassword && (
                                                <div className="rounded-none border border-warm-border/25 bg-white px-4 py-3 text-sm text-warm-muted">
                                                    The browser no longer has the one-time password for this memorial. Use the certificate attached to the confirmation email.
                                                </div>
                                            )}

                                            <div className="rounded-none border border-warm-border/25 bg-white px-4 py-3 text-sm text-warm-dark/80">
                                                <div className="flex items-start gap-2">
                                                    <Mail size={16} className="mt-0.5 text-warm-brown" />
                                                    <span>
                                                        The seal completion email includes the PDF certificate attachment so you can keep an offline copy.
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                <div className="mt-8 flex flex-wrap gap-3">
                                    <Link
                                        href={`/dashboard/preservation/${auth.user.id}${memorialId ? `?memorialId=${memorialId}` : ''}`}
                                        className="inline-flex items-center gap-2 rounded-none border border-warm-border/30 bg-white px-5 py-3 text-sm text-warm-dark hover:bg-surface-mid/40"
                                    >
                                        <Shield size={16} />
                                        View preservation details
                                    </Link>
                                    <Link
                                        href={`/dashboard/personal/${auth.user.id}`}
                                        className="inline-flex items-center gap-2 rounded-none border border-warm-border/30 bg-white px-5 py-3 text-sm text-warm-dark hover:bg-surface-mid/40"
                                    >
                                        Back to dashboard
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
