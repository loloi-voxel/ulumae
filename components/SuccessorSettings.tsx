'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Shield, Mail, Loader2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface SuccessorSettingsProps {
    userId: string;
}

export default function SuccessorSettings({ userId }: SuccessorSettingsProps) {
    const [successor, setSuccessor] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        relationship: ''
    });

    useEffect(() => {
        fetchSuccessor();
    }, [userId]);

    const fetchSuccessor = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('user_successors')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (data) setSuccessor(data);
        setLoading(false);
    };

    const handleDesignate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch('/api/succession/designate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    ownerName: "The Account Owner", // We can improve this with real user data
                    successorName: formData.name,
                    successorEmail: formData.email,
                    relationship: formData.relationship
                })
            });

            if (!res.ok) throw new Error('Failed to designate');

            toast.success('Designation sent. They will receive an email to accept the responsibility.');
            fetchSuccessor(); // Refresh UI
        } catch (err) {
            toast.error('Could not send the designation request.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline text-olive" /></div>;

    return (
        <div className="bg-white rounded-none border border-warm-border/30 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-warm-border/20 bg-warm-dark text-surface-low">
                <h3 className="font-serif text-xl flex items-center gap-2">
                    <Shield size={22} className="text-olive" />
                    Archive Steward
                </h3>
                <p className="text-surface-low/60 text-xs mt-1">Designate a successor to manage your family archives if you pass away.</p>
            </div>

            <div className="p-6">
                {successor ? (
                    <div className="space-y-6">
                        <div className={`p-4 rounded-none border-2 flex items-start gap-4 ${successor.status === 'accepted' ? 'bg-olive/5 border-olive/20' : 'bg-warm-border/5 border-warm-border/20'
                            }`}>
                            {successor.status === 'accepted' ? (
                                <CheckCircle className="text-olive mt-1" size={20} />
                            ) : (
                                <Clock className="text-warm-outline mt-1" size={20} />
                            )}
                            <div className="flex-1">
                                <p className="font-medium text-warm-dark">{successor.successor_name}</p>
                                <p className="text-sm text-warm-muted">{successor.successor_email} • {successor.relationship}</p>
                                <div className="mt-3">
                                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-none ${successor.status === 'accepted' ? 'bg-olive text-surface-low' : 'bg-warm-border text-warm-muted'
                                        }`}>
                                        {successor.status === 'accepted' ? 'Steward Active' : 'Waiting for Acceptance'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-warm-outline italic">
                            * To change your steward, please contact support for security verification.
                        </p>

                        <div className="mt-8 pt-6 border-t border-warm-border/20">
                            <div className="rounded-none border border-warm-border/20 bg-surface-mid/40 p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-warm-dark">
                                    <Clock size={16} className="text-warm-brown" />
                                    Dead Man Switch
                                </div>
                                {successor.status === 'accepted' ? (
                                    <>
                                        <p className="mt-2 text-xs text-warm-muted leading-relaxed">
                                            Stewardship is now active. Configure the inactivity timer, transfer date, and proof-of-life confirmations from the dedicated Dead Man Switch page.
                                        </p>
                                        <Link
                                            href={`/dashboard/dead-man-switch/${userId}`}
                                            className="mt-4 inline-flex items-center justify-center rounded-none bg-warm-dark px-4 py-2 text-xs font-medium text-surface-low transition-colors hover:bg-warm-dark/90"
                                        >
                                            Open Dead Man Switch
                                        </Link>
                                    </>
                                ) : (
                                    <p className="mt-2 text-xs text-warm-muted leading-relaxed">
                                        This page unlocks as soon as your steward accepts the invitation. Until then, the account cannot schedule an automatic transfer.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleDesignate} className="space-y-4">
                        <div className="p-4 bg-warm-brown/5 border border-warm-brown/10 rounded-none flex items-start gap-3 mb-4">
                            <AlertTriangle className="text-warm-brown shrink-0 mt-0.5" size={16} />
                            <p className="text-xs text-warm-muted leading-relaxed">
                                Choose someone you trust implicitly. They will have full access to view, edit, and export all family archives in your account.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-warm-muted mb-1">Full Name</label>
                            <input
                                required
                                type="text"
                                className="w-full p-2.5 rounded-none border border-warm-border/30 text-sm focus:ring-olive"
                                placeholder="e.g., Sarah Thompson"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-warm-muted mb-1">Email Address</label>
                            <input
                                required
                                type="email"
                                className="w-full p-2.5 rounded-none border border-warm-border/30 text-sm focus:ring-olive"
                                placeholder="sarah@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-warm-muted mb-1">Relationship</label>
                            <input
                                required
                                type="text"
                                className="w-full p-2.5 rounded-none border border-warm-border/30 text-sm focus:ring-olive"
                                placeholder="e.g., Daughter / Attorney"
                                value={formData.relationship}
                                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                            />
                        </div>

                        <button
                            disabled={submitting}
                            type="submit"
                            className="w-full py-3 bg-warm-dark text-surface-low rounded-none font-medium text-sm hover:bg-warm-dark/90 transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                            Send Stewardship Request
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
