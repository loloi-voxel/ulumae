// components/role/InviteComposer.tsx
'use client';

import { useEffect, useState } from 'react';
import { Send, ChevronDown, Loader2, Check, Info } from 'lucide-react';
import { WitnessRole } from '@/types/roles';
import { ROLE_CONFIG, getAssignableRoles } from '@/lib/roles';
import toast from 'react-hot-toast';

interface InviteComposerProps {
    memorialId: string;
    planType: 'personal' | 'family';
    onSuccess?: (email: string, role: WitnessRole) => void;
    allowedRoles?: WitnessRole[];
}

export default function InviteComposer({
    memorialId,
    planType,
    onSuccess,
    allowedRoles,
}: InviteComposerProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<WitnessRole>('witness');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRoleDetails, setShowRoleDetails] = useState(false);

    const availableRoles = (allowedRoles?.length ? allowedRoles : getAssignableRoles(planType)).filter((availableRole, index, array) =>
        array.indexOf(availableRole) === index
    );

    useEffect(() => {
        if (!availableRoles.includes(role) && availableRoles[0]) {
            setRole(availableRoles[0]);
        }
    }, [availableRoles, role]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !email.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/memorials/${memorialId}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    role,
                    personalMessage: message.trim() || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to send');

            toast.success(`Invitation sent to ${email}`, {
                icon: '✉️',
                style: { borderRadius: '12px', background: '#393830', color: '#fff' }
            });

            setEmail('');
            setMessage('');
            setRole('witness');
            if (onSuccess) onSuccess(email, role);

        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleSend} className="space-y-4">
                {/* Row 1: Email + Role selector inline */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Email address"
                            required
                            className="w-full glass-input h-[48px]"
                        />
                    </div>

                    <div className="relative min-w-[160px]">
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value as WitnessRole)}
                            className="w-full h-[48px] pl-4 pr-10 appearance-none glass-input text-sm font-medium cursor-pointer"
                        >
                            {availableRoles.map(r => (
                                <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-warm-dark/40" />
                    </div>
                </div>

                {/* Row 2: Personal message */}
                <div className="relative">
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Add a personal note (optional)..."
                        rows={3}
                        maxLength={500}
                        className="w-full glass-input resize-none text-sm py-3 px-4 min-h-[100px]"
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] text-warm-dark/20 font-mono">
                        {message.length}/500
                    </div>
                </div>

                {/* Info Toggle */}
                <button
                    type="button"
                    onClick={() => setShowRoleDetails(!showRoleDetails)}
                    className="flex items-center gap-1.5 text-[11px] text-warm-dark/40 hover:text-warm-dark transition-colors uppercase tracking-wider font-semibold"
                >
                    <Info size={12} />
                    {showRoleDetails ? 'Hide permissions details' : 'What can they do?'}
                </button>

                {showRoleDetails && (
                    <div className="p-4 bg-surface-mid rounded-xl border border-warm-border/20 animate-fadeIn">
                        <p className="text-xs font-bold text-warm-dark mb-1">{ROLE_CONFIG[role].label} Permissions:</p>
                        <p className="text-xs text-warm-dark/60 leading-relaxed">{ROLE_CONFIG[role].description}</p>
                        <ul className="mt-2 space-y-1">
                            {ROLE_CONFIG[role].capabilities.slice(0, 2).map((cap, i) => (
                                <li key={i} className="text-[10px] flex items-center gap-1.5 text-olive">
                                    <Check size={10} /> {cap}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full py-3.5 glass-btn-dark rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Send size={18} />
                    )}
                    <span>{loading ? 'Sending Request...' : 'Send Invitation'}</span>
                </button>
            </form>
        </div>
    );
}
