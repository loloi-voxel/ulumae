// app/person/[id]/page.tsx
'use client';
import { useState, useEffect, use } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import MemorialRenderer from '@/components/MemorialRenderer';

export default function PersonMemorialPage({ params }: {
    params: Promise<{ id: string }>
}) {
    const unwrappedParams = use(params);
    const memorialId = unwrappedParams.id;

    const [memorialData, setMemorialData] = useState<any>(null);
    const [relations, setRelations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        loadMemorial();
    }, [memorialId]);

    const loadMemorial = async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('memorials')
                .select('*')
                .eq('id', memorialId)
                .single();

            if (error) throw error;

            if (!data) {
                setError('Archive not found');
                return;
            }

            // ── ACCESS CONTROL ──────────────────────────────────────────────
            // An archive is publicly readable if it has been paid for OR
            // if it belongs to a personal/family plan (user already paid).
            // Only draft archives are private to the owner.
            const { data: { user } } = await supabase.auth.getUser();
            const isOwner = user && user.id === data.user_id;
            const isPaidMode = data.mode === 'personal' || data.mode === 'family';

            if (!data.paid && !isPaidMode && !isOwner) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }
            // ────────────────────────────────────────────────────────────────

            setMemorialData({
                step1: data.step1,
                step2: data.step2,
                step3: data.step3,
                step4: data.step4,
                step5: data.step5,
                step6: data.step6,
                step7: data.step7,
                step8: data.step8,
                step9: data.step9 || { videos: [] },
            });

            // Fetch relations — only for family-mode memorials
            const { data: rels } = data.mode === 'family'
                ? await supabase
                    .from('memorial_relations')
                    .select('*')
                    .eq('from_memorial_id', memorialId)
                : { data: null };

            if (rels && rels.length > 0) {
                const targetIds = rels.map((r: any) => r.to_memorial_id);
                const { data: targets } = await supabase
                    .from('memorials')
                    .select('id, full_name')
                    .in('id', targetIds);

                const combinedRelations = rels.map((r: any) => {
                    const target = targets?.find((t: any) => t.id === r.to_memorial_id);
                    return { ...r, target_name: target?.full_name };
                }).filter((r: any) => r.target_name);

                setRelations(combinedRelations);
            }
        } catch (err: any) {
            console.error('Error loading archive:', err);
            setError(err.message || 'Failed to load archive');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="text-olive animate-spin mx-auto mb-4" />
                    <p className="text-warm-dark/60">Loading archive...</p>
                </div>
            </div>
        );
    }

    // Private archive — viewer is not the owner
    if (accessDenied) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center px-6">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-surface-mid rounded-full flex items-center justify-center mx-auto mb-6 border border-warm-border">
                        <Lock size={32} className="text-warm-dark/40" />
                    </div>
                    <h1 className="font-serif text-3xl text-warm-dark mb-3">This archive is private</h1>
                    <p className="text-warm-dark/60 mb-8 leading-relaxed">
                        This archive has not been published yet. Only its owner can view it.
                    </p>
                    <a
                        href="/"
                        className="inline-block px-6 py-3 border border-warm-dark text-warm-dark rounded-full text-sm font-medium hover:bg-warm-dark hover:text-surface-low transition-all"
                    >
                        Return home
                    </a>
                </div>
            </div>
        );
    }

    if (error || !memorialData) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">😔</span>
                    </div>
                    <h1 className="font-serif text-3xl text-warm-dark mb-3">Memorial Not Found</h1>
                    <p className="text-warm-dark/60 mb-6">{error || 'This memorial does not exist.'}</p>
                    <a href="/dashboard" className="glass-btn-primary inline-block px-6 py-3 bg-olive hover:bg-olive/90 text-surface-low rounded-lg font-medium transition-all">
                        Go to Dashboard
                    </a>
                </div>
            </div >
        );
    }

    return (
        <MemorialRenderer
            key={memorialId}
            data={memorialData}
            relations={relations}
            isPreview={false}
            compact={false}
        />
    );
}
