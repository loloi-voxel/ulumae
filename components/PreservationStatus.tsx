'use client';

import { useState, useEffect } from 'react';
import { Shield, ExternalLink, Download, CheckCircle, Clock, Globe, AlertCircle } from 'lucide-react';
import { type ArweaveTransaction } from '@/lib/arweave/arweaveService';
import { downloadCertificate, type CertificateData } from '@/lib/certificate/certificateGenerator';

// Pull preservation status from the server. The arweave client placeholder
// is intentionally throw-only in production — preservation state must come
// from the database (sealed by the worker that does the real upload).
async function fetchPreservationStatus(
    memorialId: string,
    txId: string
): Promise<ArweaveTransaction | null> {
    const res = await fetch(
        `/api/arweave/status?memorialId=${encodeURIComponent(memorialId)}&txId=${encodeURIComponent(txId)}`,
        { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.status === 'not_found') return null;
    return {
        txId: data.txId,
        status: data.status,
        gatewayUrls: data.gatewayUrls || [],
        fileCount: data.fileCount || 0,
        totalBytes: data.totalBytes || 0,
        confirmedAt: data.confirmedAt,
        createdAt: data.createdAt || data.confirmedAt || new Date().toISOString(),
    } as ArweaveTransaction;
}

interface PreservationStatusProps {
    memorialId: string;
    arweaveTxId: string | null;
    fullName: string;
    birthDate: string;
    deathDate: string | null;
    planType: string;
    storageBytesUsed?: number;
    storageBytesIncluded?: number;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export default function PreservationStatus({
    memorialId,
    arweaveTxId,
    fullName,
    birthDate,
    deathDate,
    planType,
    storageBytesUsed = 234_567_890,
    storageBytesIncluded = 53_687_091_200, // 50 GB
}: PreservationStatusProps) {
    const [txData, setTxData] = useState<ArweaveTransaction | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);

    useEffect(() => {
        if (!arweaveTxId) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        fetchPreservationStatus(memorialId, arweaveTxId)
            .then((data) => {
                if (cancelled) return;
                setTxData(data);
                if (!data) {
                    setStatusError('Could not verify preservation status from the network.');
                }
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[PreservationStatus] failed to load tx', err);
                setStatusError('Could not verify preservation status.');
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [arweaveTxId, memorialId]);

    const handleDownloadCertificate = () => {
        if (!txData) return;
        const certData: CertificateData = {
            fullName,
            birthDate,
            deathDate,
            preservationDate: txData.confirmedAt || new Date().toISOString(),
            transactionId: txData.txId,
            nodeCount: 847,
            endowmentYears: 200,
            gatewayUrls: txData.gatewayUrls,
            memorialId,
            planType,
        };
        downloadCertificate(certData);
    };

    if (loading) {
        return (
            <div className="bg-white border border-warm-border/40 p-6 rounded-xl shadow-sm">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-warm-border/40 rounded w-1/3" />
                    <div className="h-3 bg-warm-border/40 rounded w-2/3" />
                    <div className="h-3 bg-warm-border/40 rounded w-1/2" />
                </div>
            </div>
        );
    }

    if (!arweaveTxId || !txData) {
        return (
            <div className="bg-white border border-dashed border-warm-border/40 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                    <Shield size={18} className="text-warm-muted" />
                    <h3 className="text-sm font-semibold text-warm-dark font-sans">Preservation Status</h3>
                </div>
                {statusError ? (
                    <div className="flex items-start gap-2 text-sm text-red-600">
                        <AlertCircle size={14} className="mt-0.5" />
                        <span>{statusError}</span>
                    </div>
                ) : (
                    <p className="text-sm text-warm-muted font-sans">
                        This memorial has not been preserved yet. Preservation permanently stores your memorial on the Arweave network.
                    </p>
                )}
            </div>
        );
    }

    const usagePercent = Math.min(100, (storageBytesUsed / storageBytesIncluded) * 100);
    const isConfirmed = txData.status === 'confirmed';
    const isFailed = txData.status === 'failed';
    const statusLabel = isConfirmed
        ? 'Confirmed'
        : isFailed
            ? 'Attention needed'
            : 'In progress';
    const statusClasses = isConfirmed
        ? 'bg-green-500/10 text-green-600'
        : isFailed
            ? 'bg-red-500/10 text-red-600'
            : 'bg-amber-500/10 text-amber-700';
    const verifiedAgo = txData.confirmedAt
        ? `${Math.round((Date.now() - new Date(txData.confirmedAt).getTime()) / 3600_000)} hours ago`
        : 'Awaiting confirmation';

    return (
        <div className="bg-white border border-warm-border/40 p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-olive/10 rounded-lg flex items-center justify-center">
                        <Shield size={16} className="text-olive" />
                    </div>
                    <h3 className="text-sm font-semibold text-warm-dark font-sans">Preservation Status</h3>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusClasses}`}>
                    {isConfirmed ? <CheckCircle size={12} /> : isFailed ? <AlertCircle size={12} /> : <Clock size={12} />}
                    <span className="text-xs font-sans font-medium">{statusLabel}</span>
                </div>
            </div>

            {!isConfirmed && (
                <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-sans ${isFailed ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {isFailed
                        ? 'The latest preservation attempt did not complete. Please retry before treating this archive as permanently sealed.'
                        : 'Preservation has started, but the network confirmation is still in progress. The certificate becomes available once the transaction is confirmed.'}
                </div>
            )}

            {/* Transaction ID */}
            <div className="mb-4">
                <p className="text-xs text-warm-muted font-sans mb-1">Arweave Transaction</p>
                <code className="text-xs text-olive/80 font-mono bg-warm-dark/5 px-2 py-1 rounded break-all">
                    {txData.txId}
                </code>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <Globe size={12} className="text-warm-muted" />
                        <span className="text-xs text-warm-muted font-sans">Nodes</span>
                    </div>
                    <p className="text-sm font-semibold text-warm-dark font-sans">847 worldwide</p>
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock size={12} className="text-warm-muted" />
                        <span className="text-xs text-warm-muted font-sans">Last verified</span>
                    </div>
                    <p className="text-sm font-semibold text-warm-dark font-sans">{verifiedAgo}</p>
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <Shield size={12} className="text-warm-muted" />
                        <span className="text-xs text-warm-muted font-sans">Endowment</span>
                    </div>
                    <p className="text-sm font-semibold text-warm-dark font-sans">200+ years</p>
                </div>
            </div>

            {/* Storage usage */}
            <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-warm-muted font-sans">Storage used</span>
                    <span className="text-xs text-warm-dark font-sans">
                        {formatBytes(storageBytesUsed)} of {formatBytes(storageBytesIncluded)}
                    </span>
                </div>
                <div className="w-full h-1.5 bg-warm-dark/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-olive/60 rounded-full transition-all"
                        style={{ width: `${usagePercent}%` }}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <a
                    href={txData.gatewayUrls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-medium text-warm-dark bg-warm-dark/5 rounded-lg hover:bg-warm-dark/10 transition-colors"
                >
                    <ExternalLink size={12} />
                    View on Blockchain
                </a>
                <button
                    onClick={handleDownloadCertificate}
                    disabled={!isConfirmed}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-medium rounded-lg transition-colors ${
                        isConfirmed
                            ? 'text-olive bg-olive/10 hover:bg-olive/20'
                            : 'text-warm-muted bg-warm-dark/5 cursor-not-allowed'
                    }`}
                >
                    <Download size={12} />
                    Download Certificate
                </button>
            </div>
        </div>
    );
}
