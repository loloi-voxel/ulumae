// app/seal-confirmation/page.tsx
// Step 2.1.3: Pre-payment confirmation page — calm archive summary
// Flow: CTA "Seal this archive" → THIS PAGE → Authorization → Payment
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, Check, Clock, Infinity as InfinityIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MemorialData } from '@/types/memorial';
import { calculateCompletion } from '@/lib/completionLogic';
import { countFragments } from '@/lib/emotionalState';

function SealConfirmationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const memorialId = searchParams.get('memorialId');

    const [loading, setLoading] = useState(true);
    const [memorial, setMemorial] = useState<MemorialData | null>(null);
    const [archiveStats, setArchiveStats] = useState({
        photos: 0,
        videos: 0,
        biographyWords: 0,
        pathsExplored: 0,
        totalPaths: 5,
        fragments: 0,
    });

    useEffect(() => {
        if (!memorialId) {
            setLoading(false);
            return;
        }

        const loadMemorial = async () => {
            try {
                const { data, error } = await supabase
                    .from('memorials')
                    .select('*')
                    .eq('id', memorialId)
                    .single();

                if (error) throw error;
                if (!data) return;

                setMemorial(data as MemorialData);

                // Calculate archive stats for the summary
                const completion = calculateCompletion(data as MemorialData);
                const photoCount = data.step8?.gallery?.length || 0;
                const videoCount = data.step9?.videos?.length || 0;
                const bioWords = data.step6?.biography?.trim().split(/\s+/).filter(Boolean).length || 0;
                const explored = completion.steps.filter(s => s.completed).length;
                const fragments = countFragments(data as MemorialData);

                setArchiveStats({
                    photos: photoCount,
                    videos: videoCount,
                    biographyWords: bioWords,
                    pathsExplored: explored,
                    totalPaths: completion.steps.length,
                    fragments,
                });
            } catch (err) {
                console.error('Error loading memorial:', err);
            } finally {
                setLoading(false);
            }
        };

        loadMemorial();
    }, [memorialId]);

    const handleProceed = () => {
        // Step 2.3.1: Authorization comes BEFORE payment
        // Navigate to authorization page, which then redirects to payment
        router.push(`/authorization/${memorialId}?type=individual&redirect=payment`);
    };

    const handleGoBack = () => {
        if (memorialId) {
            const memorialMode = (memorial as (MemorialData & { mode?: string }) | null)?.mode || 'draft';
            router.push(`/create?id=${memorialId}&mode=${memorialMode}`);
        } else {
            router.back();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="h-12 w-12 rounded-none border-3 border-warm-border/30 border-t-warm-dark/40 animate-spin" />
            </div>
        );
    }

    const fullName = memorial?.step1?.fullName || 'this person';
    const birthDate = memorial?.step1?.birthDate || '';
    const deathDate = memorial?.step1?.deathDate || '';
    const slug = memorial?.step1?.fullName
        ? memorial.step1.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        : memorialId;

    return (
        <div className="min-h-screen bg-surface-low">
            {/* Header */}
            <div className="border-b border-warm-border/20 bg-white/60 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto px-6 py-5">
                    <button
                        onClick={handleGoBack}
                        className="inline-flex items-center gap-2 text-warm-dark/40 hover:text-warm-dark transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        Return to draft
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-16">
                {/* Archive declaration — narrative tone */}
                <div className="text-center mb-14">
                    <h1 className="font-serif text-4xl text-warm-dark mb-4">
                        You are about to seal the archive of
                    </h1>
                    <p className="font-serif text-3xl italic text-warm-dark/70 mb-2">{fullName}</p>
                    {birthDate && (
                        <p className="text-warm-dark/30 text-sm">
                            {birthDate}{deathDate ? ` — ${deathDate}` : ''}
                        </p>
                    )}
                </div>

                {/* Narrative summary — replaces raw stats */}
                <div className="mb-8 border border-warm-border/25 bg-white p-10 text-center rounded-none">
                    <p className="font-serif text-5xl text-warm-dark mb-2">{archiveStats.fragments}</p>
                    <p className="text-warm-dark/50 text-lg font-serif italic mb-8">
                        fragments of their life have been gathered
                    </p>
                    <div className="space-y-2 text-sm text-warm-dark/40 leading-relaxed">
                        {archiveStats.photos > 0 && (
                            <p>{archiveStats.photos} image{archiveStats.photos !== 1 ? 's' : ''} preserving their world</p>
                        )}
                        {archiveStats.biographyWords > 0 && (
                            <p>{archiveStats.biographyWords} words carrying their story</p>
                        )}
                        {archiveStats.videos > 0 && (
                            <p>{archiveStats.videos} moment{archiveStats.videos !== 1 ? 's' : ''} captured in motion</p>
                        )}
                        {archiveStats.pathsExplored > 0 && (
                            <p>{archiveStats.pathsExplored} of {archiveStats.totalPaths} paths explored</p>
                        )}
                    </div>
                    <div className="mt-8 pt-6 border-t border-warm-border/15">
                        <p className="font-serif text-lg text-warm-dark/60 italic">
                            You are now the guardian of this legacy.
                        </p>
                    </div>
                </div>

                {/* Timeline of Immortality */}
                <div className="mb-8 border border-warm-border/15 bg-gradient-to-br from-olive/5 to-warm-brown/5 p-8 rounded-none">
                    <h2 className="text-sm font-medium text-warm-dark/40 uppercase tracking-wider mb-8 text-center">
                        Timeline of Immortality
                    </h2>
                    <div className="flex items-center justify-between max-w-md mx-auto">
                        {/* Step 1: Gathered */}
                        <div className="flex flex-col items-center">
                            <div className="mb-2 flex h-12 w-12 items-center justify-center border-2 border-olive bg-olive/20 rounded-none">
                                <Check size={20} className="text-olive" />
                            </div>
                            <p className="text-xs font-medium text-olive">Gathered</p>
                            <p className="text-[10px] text-warm-dark/30">Fragments collected</p>
                        </div>
                        {/* Connector */}
                        <div className="flex-1 h-0.5 bg-gradient-to-r from-olive to-warm-brown/40 mx-3 mt-[-20px]" />
                        {/* Step 2: Sealed */}
                        <div className="flex flex-col items-center">
                            <div className="mb-2 flex h-12 w-12 items-center justify-center border-2 border-dashed border-warm-brown/40 bg-warm-brown/10 animate-pulse rounded-none">
                                <Clock size={20} className="text-warm-brown/50" />
                            </div>
                            <p className="text-xs font-medium text-warm-brown/60">Sealed</p>
                            <p className="text-[10px] text-warm-dark/30">Made permanent</p>
                        </div>
                        {/* Connector */}
                        <div className="flex-1 h-0.5 bg-warm-border/20 mx-3 mt-[-20px]" />
                        {/* Step 3: Eternal */}
                        <div className="flex flex-col items-center">
                            <div className="mb-2 flex h-12 w-12 items-center justify-center border-2 border-warm-border/20 bg-warm-border/10 rounded-none">
                                <InfinityIcon size={20} className="text-warm-dark/20" />
                            </div>
                            <p className="text-xs font-medium text-warm-dark/30">Eternal</p>
                            <p className="text-[10px] text-warm-dark/20">Beyond time</p>
                        </div>
                    </div>
                </div>

                {/* What sealing means — solemn narrative */}
                <div className="mb-8 border border-warm-border/15 bg-warm-border/8 p-8 rounded-none">
                    <h2 className="text-sm font-medium text-warm-dark/40 uppercase tracking-wider mb-5">
                        What this means
                    </h2>
                    <ul className="space-y-3 text-sm text-warm-dark/50 leading-relaxed">
                        <li className="flex items-start gap-3">
                            <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-none bg-warm-dark/20" />
                            Their presence becomes permanent — accessible forever at
                            <span className="text-warm-dark/70 font-medium ml-1">ulumae.com/person/{slug}</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-none bg-warm-dark/20" />
                            This legacy can be shared, passed to your heirs, and carried forward through generations.
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-none bg-warm-dark/20" />
                            The draft watermark will be lifted. What remains is the pure archive, exactly as you shaped it.
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-none bg-warm-dark/20" />
                            You remain the guardian — you may continue enriching this archive after sealing.
                        </li>
                    </ul>
                </div>

                {/* Trust elements */}
                <div className="flex items-center justify-center gap-6 mb-10 text-xs text-warm-dark/25">
                    <div className="flex items-center gap-1.5">
                        <Shield size={12} />
                        <span>One-time payment</span>
                    </div>
                    <div className="w-px h-3 bg-warm-border/30" />
                    <span>No subscription</span>
                    <div className="w-px h-3 bg-warm-border/30" />
                    <span>Lifetime access</span>
                </div>

                {/* Action buttons — solemn tone */}
                <div className="space-y-3 max-w-md mx-auto">
                    <button
                        onClick={handleProceed}
                        className="flex w-full items-center justify-center gap-2 py-4 glass-btn-dark font-medium transition-all rounded-none"
                    >
                        Seal this legacy forever
                    </button>
                    <button
                        onClick={handleGoBack}
                        className="w-full border border-warm-border/30 bg-white py-4 font-medium text-warm-dark/50 transition-all hover:bg-warm-border/5 rounded-none"
                    >
                        I need more time with their story
                    </button>
                </div>

                <p className="text-center text-xs text-warm-dark/20 mt-6">
                    Your work is preserved. You can return to this moment at any time.
                </p>
            </div>
        </div>
    );
}

export default function SealConfirmationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="h-12 w-12 rounded-none border-3 border-warm-border/30 border-t-warm-dark/40 animate-spin" />
            </div>
        }>
            <SealConfirmationContent />
        </Suspense>
    );
}
