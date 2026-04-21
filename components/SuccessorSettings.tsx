'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Mail, User, Loader2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface SuccessorSettingsProps {
    userId: string;
}

export default function SuccessorSettings({ userId }: SuccessorSettingsProps) {
    const [successor, setSuccessor] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isSwitchEnabled, setIsSwitchEnabled] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        relationship: ''
    });

    useEffect(() => {
        fetchSuccessor();
    }, [userId]);

    useEffect(() => {
        const fetchUserStatus = async () => {
            const { data } = await supabase.from('users').select('dead_mans_switch_enabled').eq('id', userId).single();
            if (data) setIsSwitchEnabled(data.dead_mans_switch_enabled);
        };
        fetchUserStatus();
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

            alert("Designation sent! They will receive an email to accept the responsibility.");
            fetchSuccessor(); // Refresh UI
        } catch (err) {
            alert("Error: Could not send designation.");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleDeadMansSwitch = async () => {
        const newValue = !isSwitchEnabled;
        const { error } = await supabase
            .from('users')
            .update({ dead_mans_switch_enabled: newValue })
            .eq('id', userId);

        if (!error) {
            setIsSwitchEnabled(newValue);
            alert(newValue ? "Dead Man's Switch activated. We will ping you once a year." : "Safety switch deactivated.");
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

                        {/* Dead Man's Switch Toggle */}
                        <div className="mt-8 pt-6 border-t border-warm-border/20">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 pr-8">
                                    <h4 className="text-sm font-bold text-warm-dark flex items-center gap-2">
                                        <Clock size={16} className="text-warm-brown" />
                                        Dead Man's Switch
                                    </h4>
                                    <p className="text-xs text-warm-muted mt-1 leading-relaxed">
                                        If enabled, we will email you once a year to confirm you are still managing the account. If you don't respond within 90 days, we will automatically notify your steward to begin the succession process.
                                    </p>
                                </div>
                                <button
                                    onClick={toggleDeadMansSwitch}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-none transition-colors focus:outline-none ${isSwitchEnabled ? 'bg-olive' : 'bg-warm-border'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-none bg-white transition-transform ${isSwitchEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
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
