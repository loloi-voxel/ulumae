'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, ArrowRight, ArrowLeft, Clock, Globe, Lock, Users, HardDrive, Pencil } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { PLAN_PRICES_USD } from '@/lib/constants';
import ArweaveEducation from '@/components/ArweaveEducation';
import { estimateStorageCost } from '@/lib/arweave/arweaveService';

export default function PreservationGatePage() {
    return (
        <Suspense fallback={<div className="bg-surface-low min-h-screen" />}>
            <PreservationGateContent />
        </Suspense>
    );
}

function PreservationGateContent() {
    const router = useRouter();
    const auth = useAuth();
    const searchParams = useSearchParams();
    const memorialId = searchParams.get('memorialId');
    const [estimatedCost, setEstimatedCost] = useState<ReturnType<typeof estimateStorageCost> | null>(null);

    useEffect(() => {
        // Estimate based on typical memorial size (500MB)
        setEstimatedCost(estimateStorageCost(500_000_000));
    }, []);

    const handlePreservePersonal = () => {
        if (!auth.authenticated) {
            router.push(`/signup?next=${encodeURIComponent('/preserve' + (memorialId ? `?memorialId=${memorialId}` : ''))}`);
            return;
        }
        router.replace(`/personal-confirmation${memorialId ? `?memorialId=${memorialId}` : ''}`);
    };

    const handlePreserveFamily = () => {
        if (!auth.authenticated) {
            router.push(`/signup?next=${encodeURIComponent('/preserve' + (memorialId ? `?memorialId=${memorialId}` : ''))}`);
            return;
        }
        router.replace(`/family-confirmation${memorialId ? `?memorialId=${memorialId}` : ''}`);
    };

    const handleContinueEditing = () => {
        if (memorialId) {
            router.push(`/create?id=${memorialId}`);
        } else {
            router.back();
        }
    };

    return (
        <div className="bg-surface-low min-h-screen">
            {/* Header */}
            <div className="border-b border-warm-border/30">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-warm-muted hover:text-warm-dark transition-colors mb-4 text-sm font-sans"
                    >
                        <ArrowLeft size={16} /> Back to editor
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center bg-olive/10 rounded-none">
                            <Shield size={20} className="text-olive" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-serif text-white">Preserve This Memorial</h1>
                            <p className="text-sm text-warm-muted font-sans">Permanent storage on the Arweave network</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-10">
                {/* Current status */}
                <div className="mb-8 border border-dashed border-warm-border/30 bg-white p-6 rounded-none">
                    <div className="flex items-start gap-3">
                        <Clock size={18} className="text-amber-400 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-sans font-semibold text-warm-dark mb-1">
                                This memorial is private and temporary
                            </h3>
                            <p className="text-sm text-warm-muted font-sans leading-relaxed">
                                Your memorial is saved on our servers but has not been permanently preserved.
                                It can be edited, deleted, and is not yet accessible to anyone else.
                                To make it permanent, choose a preservation plan below.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Preservation plans */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Personal Archive */}
                    <div className="group cursor-pointer border border-warm-border/30 bg-white p-6 transition-all hover:border-warm-border/50 hover:shadow-lg rounded-none" onClick={handlePreservePersonal}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-serif text-white">Personal Archive</h3>
                            <span className="text-2xl font-sans font-bold text-olive">${PLAN_PRICES_USD.personal.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-warm-muted font-sans mb-1">One-time payment</p>
                        <p className="text-sm text-warm-muted font-sans leading-relaxed mb-5">
                            Permanently preserve one complete memorial on the Arweave blockchain.
                        </p>
                        <ul className="space-y-2.5 mb-6 text-sm font-sans text-warm-dark/80">
                            {[
                                { icon: Shield, text: 'Permanent Arweave preservation' },
                                { icon: Lock, text: 'Client-side AES-256 encryption' },
                                { icon: Globe, text: '847 nodes, 3+ gateways' },
                                { icon: Clock, text: '200-year endowment' },
                                { icon: Users, text: 'Successor designation' },
                            ].map(item => (
                                <li key={item.text} className="flex items-center gap-2">
                                    <item.icon size={14} className="text-warm-muted" />
                                    {item.text}
                                </li>
                            ))}
                        </ul>
                        <div className="flex items-center gap-2 text-olive text-sm font-sans font-medium group-hover:gap-3 transition-all">
                            Preserve as Personal <ArrowRight size={16} />
                        </div>
                    </div>

                    {/* Family Legacy Network */}
                    <div className="group cursor-pointer border border-warm-border/30 border-olive/20 bg-white p-6 transition-all hover:border-warm-border/50 hover:shadow-lg rounded-none" onClick={handlePreserveFamily}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-serif text-white">Family Legacy Network</h3>
                            <span className="text-2xl font-sans font-bold text-olive">${PLAN_PRICES_USD.family.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-warm-muted font-sans mb-1">One-time payment</p>
                        <p className="text-sm text-warm-muted font-sans leading-relaxed mb-5">
                            Unlimited family memorials with local device sync and offline access.
                        </p>
                        <ul className="space-y-2.5 mb-6 text-sm font-sans text-warm-dark/80">
                            {[
                                { icon: Shield, text: 'Everything in Personal' },
                                { icon: Users, text: 'Unlimited linked memorials' },
                                { icon: HardDrive, text: 'Anchor: local device sync' },
                                { icon: Globe, text: 'Visual family constellation' },
                                { icon: Lock, text: 'Offline access guarantee' },
                            ].map(item => (
                                <li key={item.text} className="flex items-center gap-2">
                                    <item.icon size={14} className="text-warm-muted" />
                                    {item.text}
                                </li>
                            ))}
                        </ul>
                        <div className="flex items-center gap-2 text-olive text-sm font-sans font-medium group-hover:gap-3 transition-all">
                            Preserve as Family <ArrowRight size={16} />
                        </div>
                    </div>
                </div>

                {/* Arweave Education */}
                <div className="mb-8">
                    <ArweaveEducation />
                </div>

                {/* Estimated cost */}
                {estimatedCost && (
                    <div className="mb-8 border border-warm-border/30 bg-white p-5 rounded-none">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-warm-muted font-sans mb-0.5">Estimated preservation size</p>
                                <p className="text-sm font-sans text-warm-dark">
                                    ~500 MB across {estimatedCost.nodeCount} nodes for {estimatedCost.endowmentYears}+ years
                                </p>
                            </div>
                            <p className="text-xs text-warm-muted font-sans">
                                Included in plan price
                            </p>
                        </div>
                    </div>
                )}

                {/* Continue editing escape hatch */}
                <div className="text-center">
                    <button
                        onClick={handleContinueEditing}
                        className="inline-flex items-center gap-2 text-sm font-sans text-warm-muted hover:text-warm-dark transition-colors"
                    >
                        <Pencil size={14} />
                        Continue editing without preserving
                    </button>
                    <p className="text-xs text-warm-muted/60 font-sans mt-2">
                        Your draft will remain saved on our servers for 30 days.
                    </p>
                </div>
            </div>
        </div>
    );
}
