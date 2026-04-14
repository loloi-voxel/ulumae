// components/wizard/Step7Memories.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Star, Plus, X, Trash2, Shield, Check, Loader2, AlertTriangle } from 'lucide-react';
import { MemoriesStories, WitnessRole } from '@/types/memorial';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Step7Props {
    data: MemoriesStories;
    onUpdate: (data: MemoriesStories) => void;
    onNext: () => void;
    onBack: () => void;
    isPaid?: boolean;
    readOnly?: boolean;
    userRole: WitnessRole;
    memorialId: string | null;
    onSubmitContribution?: (type: 'memory' | 'photo' | 'video', content: any) => Promise<any>;
}

export default function Step7Memories({ data, onUpdate, onNext, onBack, readOnly, userRole, memorialId }: Step7Props) {
    const [pendingContributions, setPendingContributions] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [disputingId, setDisputingId] = useState<string | null>(null);

    // --- 1. APPROVAL LOGIC (Kept until Steward Page is built) ---
    const fetchPending = useCallback(async () => {
        if (userRole !== 'owner' && userRole !== 'co_guardian') return;
        setIsFetching(true);
        const { data: pending, error } = await supabase
            .from('memorial_contributions')
            .select('*')
            .eq('memorial_id', memorialId)
            .eq('status', 'pending_approval');

        if (!error && pending) setPendingContributions(pending);
        setIsFetching(false);
    }, [memorialId, userRole]);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    const handleDecision = async (contribution: any, decision: 'approved' | 'rejected', overrideContent?: string) => {
        try {
            if (!memorialId) {
                throw new Error('Missing memorial id');
            }

            const response = await fetch(
                `/api/archive/${memorialId}/contributions/${contribution.id}/review`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        decision,
                        ...(decision === 'rejected'
                            ? { adminNotes: 'This contribution was not approved for publication.' }
                            : {}),
                    }),
                }
            );

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to process contribution');
            }

            if (decision === 'approved') {
                const newMemory = {
                    id: `witness-${contribution.id}`,
                    title: contribution.content.title,
                    content: overrideContent || contribution.content.content,
                    author: contribution.witness_name,
                    relationship: contribution.content.relationship || 'Friend',
                    date: new Date().toISOString().split('T')[0]
                };
                onUpdate({ ...data, sharedMemories: [...(data.sharedMemories || []), newMemory] });
            }

            setPendingContributions(prev => prev.filter(item => item.id !== contribution.id));
            setDisputingId(null);
            toast.success(decision === 'approved' ? "Memory published" : "Contribution set aside");
        } catch (err: any) {
            toast.error("Failed to process decision");
        }
    };

    // --- 2. CONTENT EDITING LOGIC ---
    const handleChange = (field: keyof MemoriesStories, value: any) => {
        if (readOnly) return;
        onUpdate({ ...data, [field]: value });
    };

    const updateMemory = (id: string, field: string, value: string) => {
        handleChange('sharedMemories', data.sharedMemories.map(m => (m.id === id ? { ...m, [field]: value } : m)));
    };

    const updateImpactStory = (id: string, field: string, value: string) => {
        handleChange('impactStories', data.impactStories.map(s => (s.id === id ? { ...s, [field]: value } : s)));
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="mb-12">
                <h2 className="font-serif text-4xl text-warm-dark mb-3 text-center sm:text-left">Memories & Stories</h2>
                <p className="text-warm-dark/60 text-lg text-center sm:text-left">Add your own stories or review those shared by others.</p>
            </div>

            {/* SECTION A: REVIEW QUEUE (Only for Owners/Co-Guardians) */}
            {(userRole === 'owner' || userRole === 'co_guardian') && pendingContributions.length > 0 && (
                <div className="mb-16 animate-fadeIn">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-serif text-xl text-warm-dark flex items-center gap-2">
                            <Shield size={20} className="text-warm-brown" />
                            Pending Review
                        </h3>
                        <span className="text-xs bg-warm-brown/10 text-warm-brown px-3 py-1 rounded-full font-bold uppercase tracking-tighter">
                            {pendingContributions.length} NEW
                        </span>
                    </div>

                    <div className="space-y-4">
                        {pendingContributions.map((item) => (
                            <div key={item.id} className="bg-white p-5 rounded-xl border border-warm-border/30 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-warm-dark">{item.content.title}</p>
                                        <p className="text-xs text-warm-dark/40">From {item.witness_name}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleDecision(item, 'approved')} className="px-3 py-1.5 bg-olive text-white text-xs rounded-lg font-medium hover:bg-olive/90">Approve</button>
                                        <button onClick={() => handleDecision(item, 'rejected')} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg font-medium hover:bg-red-100">Ignore</button>
                                    </div>
                                </div>
                                <p className="text-sm text-warm-dark/70 italic line-clamp-3">"{item.content.content}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION B: SHARED MEMORIES EDITOR */}
            <div className="space-y-12">
                <section>
                    <label className="flex items-center gap-2 text-sm font-bold text-warm-dark mb-6 uppercase tracking-widest">
                        <MessageCircle size={18} className="text-olive" />
                        Shared Memories
                    </label>
                    <div className="space-y-6 mb-6">
                        {(data.sharedMemories || []).map((memory) => (
                            <div key={memory.id} className="p-6 bg-white rounded-xl border border-warm-border/30 shadow-sm relative animate-fadeIn">
                                {!readOnly && (
                                    <button onClick={() => handleChange('sharedMemories', data.sharedMemories.filter(m => m.id !== memory.id))} className="absolute top-4 right-4 p-2 text-warm-dark/20 hover:text-red-500 transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <div className="space-y-4 pr-8">
                                    <input type="text" value={memory.title} onChange={(e) => updateMemory(memory.id, 'title', e.target.value)} placeholder="Memory Title" className="w-full glass-input font-medium" disabled={readOnly} />
                                    <textarea value={memory.content} onChange={(e) => updateMemory(memory.id, 'content', e.target.value)} placeholder="Tell the story..." rows={4} className="w-full glass-input text-sm resize-none" disabled={readOnly} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="text" value={memory.author} onChange={(e) => updateMemory(memory.id, 'author', e.target.value)} placeholder="Written by" className="w-full glass-input text-sm" disabled={readOnly} />
                                        <input type="text" value={memory.relationship} onChange={(e) => updateMemory(memory.id, 'relationship', e.target.value)} placeholder="Relationship" className="w-full glass-input text-sm" disabled={readOnly} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {!readOnly && (
                        <button onClick={() => handleChange('sharedMemories', [...(data.sharedMemories || []), { id: `m-${Date.now()}`, title: '', content: '', author: '', relationship: '' }])} className="w-full py-4 border-2 border-dashed border-warm-border/30 rounded-xl text-sm font-medium text-warm-dark/40 hover:border-olive hover:text-olive transition-all flex items-center justify-center gap-2">
                            <Plus size={18} /> Add Memory
                        </button>
                    )}
                </section>

                {/* SECTION C: IMPACT STORIES EDITOR */}
                <section>
                    <label className="flex items-center gap-2 text-sm font-bold text-warm-dark mb-6 uppercase tracking-widest">
                        <Star size={18} className="text-warm-brown" />
                        Impact Stories
                    </label>
                    <div className="space-y-6 mb-6">
                        {(data.impactStories || []).map((story) => (
                            <div key={story.id} className="p-6 bg-white rounded-xl border border-warm-border/30 shadow-sm relative animate-fadeIn">
                                {!readOnly && (
                                    <button onClick={() => handleChange('impactStories', data.impactStories.filter(s => s.id !== story.id))} className="absolute top-4 right-4 p-2 text-warm-dark/20 hover:text-red-500 transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <div className="space-y-4 pr-8">
                                    <input type="text" value={story.title} onChange={(e) => updateImpactStory(story.id, 'title', e.target.value)} placeholder="Impact Title" className="w-full glass-input font-medium" disabled={readOnly} />
                                    <textarea value={story.content} onChange={(e) => updateImpactStory(story.id, 'content', e.target.value)} placeholder="Describe their impact..." rows={4} className="w-full glass-input text-sm resize-none" disabled={readOnly} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {!readOnly && (
                        <button onClick={() => handleChange('impactStories', [...(data.impactStories || []), { id: `s-${Date.now()}`, title: '', content: '', author: '' }])} className="w-full py-4 border-2 border-dashed border-warm-border/30 rounded-xl text-sm font-medium text-warm-dark/40 hover:border-warm-brown hover:text-warm-brown transition-all flex items-center justify-center gap-2">
                            <Plus size={18} /> Add Impact Story
                        </button>
                    )}
                </section>
            </div>

            <div className="mt-12 flex gap-4">
                <button onClick={onBack} className="px-6 py-4 border border-warm-border/40 rounded-xl hover:bg-warm-border/10 transition-all font-medium text-warm-dark/60">← Return</button>
                <button onClick={onNext} className="flex-1 bg-olive hover:bg-olive/90 text-warm-bg py-4 px-6 rounded-xl font-bold transition-all shadow-lg active:scale-[0.99]">Preserve & continue →</button>
            </div>
        </div>
    );
}
