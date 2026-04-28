'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MemorialRelation } from '@/types/memorial';
import { Link2, Plus, X, Loader2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';

interface FamilyLinkerProps {
    currentMemorialId: string;
    userId: string;
    mode?: string;
}

export default function FamilyLinker({ currentMemorialId, userId, mode }: FamilyLinkerProps) {
    // Family linking is only available for family-mode memorials
    if (mode && mode !== 'family') {
        return null;
    }
    const [relations, setRelations] = useState<MemorialRelation[]>([]);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState('');
    const [selectedType, setSelectedType] = useState('parent');
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [currentMemorialId]);

    const loadData = async () => {
        setLoading(true);

        // 1. Fetch candidates (other memorials owned by user)
        const { data: others } = await supabase
            .from('memorials')
            .select('id, full_name')
            .eq('user_id', userId)
            .neq('id', currentMemorialId); // Exclude self

        setCandidates(others || []);

        // 2. Fetch existing relations
        // We fetch the relation rows first
        const { data: rels } = await supabase
            .from('memorial_relations')
            .select('*')
            .eq('from_memorial_id', currentMemorialId);

        if (rels && rels.length > 0) {
            // Then we fetch the names of the targets
            // (This manual join is safer than complex Supabase syntax for now)
            const targetIds = rels.map(r => r.to_memorial_id);
            const { data: targets } = await supabase
                .from('memorials')
                .select('id, full_name, profile_photo_url')
                .in('id', targetIds);

            const targetsMap = new Map(targets?.map(t => [t.id, t]));

            const formattedRels = rels.map(r => ({
                id: r.id,
                from_memorial_id: r.from_memorial_id,
                to_memorial_id: r.to_memorial_id,
                relationship_type: r.relationship_type,
                target_name: targetsMap.get(r.to_memorial_id)?.full_name || 'Unknown',
                target_photo: targetsMap.get(r.to_memorial_id)?.profile_photo_url
            }));

            setRelations(formattedRels as MemorialRelation[]);
        } else {
            setRelations([]);
        }

        setLoading(false);
    };

    const handleLink = async () => {
        if (!selectedCandidate) return;
        setLinking(true);
        try {
            const res = await fetch('/api/family/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromId: currentMemorialId,
                    toId: selectedCandidate,
                    type: selectedType
                })
            });

            if (!res.ok) throw new Error('Failed to link');

            await loadData(); // Refresh list
            setSelectedCandidate(''); // Reset form
            toast.success('Family connection saved.');
        } catch (e) {
            toast.error('Error linking memorials. Please try again.');
        } finally {
            setLinking(false);
        }
    };

    const unlink = async (relationId: string) => {
        const relation = relations.find((item) => item.id === relationId);
        if (!relation) return;

        try {
            const response = await fetch('/api/family/link', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromId: currentMemorialId,
                    toId: relation.to_memorial_id,
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to remove connection.');
            }

            await loadData();
            toast.success('Connection removed.');
        } catch (error: any) {
            toast.error(error.message || 'Error removing connection. Please try again.');
        }
    };

    if (loading) return <div className="p-4 text-center"><Loader2 className="animate-spin inline text-olive" /></div>;

    return (
        <div className="bg-warm-border/10 rounded-xl p-6 border border-warm-border/30">
            <h3 className="font-serif text-xl text-warm-dark mb-4 flex items-center gap-2">
                <Link2 size={20} className="text-warm-brown" />
                Family Connections
            </h3>

            {/* Existing Links */}
            {relations.length > 0 ? (
                <div className="space-y-3 mb-6">
                    {relations.map(rel => (
                        <div key={rel.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-warm-border/20">
                            <div className="flex items-center gap-3">
                                {rel.target_photo ? (
                                    <img src={rel.target_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 bg-olive/10 rounded-full flex items-center justify-center">
                                        <User size={16} className="text-olive" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-medium text-warm-dark">{rel.target_name}</p>
                                    <p className="text-xs text-warm-muted capitalize">{rel.relationship_type}</p>
                                </div>
                            </div>
                            <button onClick={() => setPendingUnlinkId(rel.id)} className="text-warm-outline hover:text-warm-brown p-2">
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-warm-outline italic mb-6">No connections yet. Link this memorial to others in your family plan.</p>
            )}

            {/* Add New Link Form */}
            {candidates.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium text-warm-muted uppercase tracking-wider">Add Connection</p>
                    <div className="flex gap-2">
                        <select
                            className="flex-1 p-2 rounded-lg border border-warm-border/30 text-sm focus:ring-olive"
                            value={selectedCandidate}
                            onChange={(e) => setSelectedCandidate(e.target.value)}
                        >
                            <option value="">Select family member...</option>
                            {candidates.map(c => (
                                <option key={c.id} value={c.id}>{c.full_name || 'Untitled'}</option>
                            ))}
                        </select>

                        <span className="self-center text-warm-outline font-serif italic">is</span>

                        <select
                            className="w-32 p-2 rounded-lg border border-warm-border/30 text-sm focus:ring-olive"
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                        >
                            <option value="parent">Parent</option>
                            <option value="child">Child</option>
                            <option value="spouse">Spouse</option>
                            <option value="sibling">Sibling</option>
                        </select>
                    </div>
                    <button
                        onClick={handleLink}
                        disabled={!selectedCandidate || linking}
                        className="w-full py-2 bg-warm-dark text-surface-low rounded-lg text-sm font-medium hover:bg-warm-dark/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {linking ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Connect Memorials
                    </button>
                </div>
            ) : (
                <div className="p-3 bg-white/50 rounded-lg text-center border border-dashed border-warm-border/30">
                    <p className="text-xs text-warm-muted">Create more memorials to start linking them.</p>
                </div>
            )}
            <ConfirmDialog
                open={pendingUnlinkId !== null}
                title="Remove this connection?"
                description={
                    pendingUnlinkId
                        ? `This will remove the family link to ${relations.find((item) => item.id === pendingUnlinkId)?.target_name || 'this person'}.`
                        : ''
                }
                confirmLabel="Remove connection"
                variant="danger"
                onConfirm={() => {
                    if (!pendingUnlinkId) return;
                    const relationId = pendingUnlinkId;
                    setPendingUnlinkId(null);
                    void unlink(relationId);
                }}
                onCancel={() => setPendingUnlinkId(null)}
            />
        </div>
    );
}
