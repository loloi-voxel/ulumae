// components/role/RoleManagementTable.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, Trash2, RefreshCw, Mail, ShieldAlert } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { WitnessRole } from '@/types/roles';
import { getAssignableRoles } from '@/lib/roles';
import RoleBadge from './RoleBadge';
import RoleDropdown from './RoleDropdown';
import toast from 'react-hot-toast';

interface MemberRecord {
    invitationId?: string | null;
    userId: string | null;
    email: string;
    role: WitnessRole;
    status: 'active' | 'pending';
    joinedAt: string | null;
}

interface RoleManagementTableProps {
    memorialId: string;
    isOwner?: boolean;
    planType: 'personal' | 'family';
    inviteHref?: string;
    allowedRoles?: WitnessRole[];
    title?: string;
    emptyStateTitle?: string;
    emptyStateDescription?: string;
}

export default function RoleManagementTable({
    memorialId,
    planType,
    inviteHref,
    allowedRoles,
    title,
    emptyStateTitle = 'No members yet',
    emptyStateDescription = 'Invited people and accepted members will appear here.',
}: RoleManagementTableProps) {
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);
    const [supabase] = useState(() => createClient());
    const visibleMembers = allowedRoles?.length
        ? members.filter((member) => allowedRoles.includes(member.role))
        : members;
    const editableRoles = (allowedRoles?.length ? allowedRoles : getAssignableRoles(planType)).filter(
        (role, index, array) => array.indexOf(role) === index
    );

    const fetchMembers = useCallback(async () => {
        try {
            const res = await fetch(`/api/memorials/${memorialId}/members`);
            if (!res.ok) throw new Error('Failed to fetch members');
            const data = await res.json();
            setMembers(data.members || []);
            setIsOwner(data.callerRole === 'owner');
        } catch (err: any) {
            console.error(err);
            toast.error('Could not load member list');
        } finally {
            setLoading(false);
        }
    }, [memorialId]);

    useEffect(() => {
        fetchMembers();

        const channel = supabase
            .channel(`members-sync-${memorialId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_memorial_roles',
                    filter: `memorial_id=eq.${memorialId}`,
                },
                () => fetchMembers()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'witness_invitations',
                    filter: `memorial_id=eq.${memorialId}`,
                },
                () => fetchMembers()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [memorialId, fetchMembers, supabase]);

    const handleRoleChange = async (targetUserId: string, newRole: WitnessRole, email: string) => {
        const previousMembers = [...members];
        setMembers((prev) => prev.map((member) => (member.userId === targetUserId ? { ...member, role: newRole } : member)));

        try {
            const res = await fetch(`/api/memorials/${memorialId}/members/${targetUserId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newRole }),
            });

            if (!res.ok) throw new Error('Failed to update role');
            toast.success(`${email} is now a ${newRole}`);
        } catch {
            setMembers(previousMembers);
            toast.error('Role update failed');
        }
    };

    const handleRemoveMember = async (targetUserId: string, email: string) => {
        if (!window.confirm(`Are you sure you want to revoke access for ${email}?`)) return;

        setMembers((prev) => prev.filter((member) => member.userId !== targetUserId));
        try {
            const res = await fetch(`/api/memorials/${memorialId}/members/${targetUserId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to remove');
            toast.success(`${email} has been removed`);
        } catch {
            fetchMembers();
            toast.error('Removal failed');
        }
    };

    const handleReinvite = async (email: string, role: WitnessRole) => {
        try {
            const res = await fetch(`/api/memorials/${memorialId}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Invitation re-sent to ${email}`);
        } catch {
            toast.error('Failed to re-send invitation');
        }
    };

    const handleCancelInvite = async (invitationId: string, email: string) => {
        if (!window.confirm(`Cancel the pending invitation for ${email}?`)) return;

        setMembers((prev) => prev.filter((member) => member.invitationId !== invitationId));
        try {
            const res = await fetch(`/api/memorials/${memorialId}/invitations/${invitationId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to cancel invitation');
            toast.success(`Invitation cancelled for ${email}`);
        } catch (err: any) {
            fetchMembers();
            toast.error(err.message || 'Cancellation failed');
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-8 flex justify-center">
                <Loader2 className="animate-spin text-warm-dark/20" />
            </div>
        );
    }

    return (
        <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-warm-border/20 flex items-center justify-between bg-surface-low/30">
                <div className="flex items-center gap-3">
                    <Users size={20} className="text-warm-dark/40" />
                    <h3 className="font-serif text-xl text-warm-dark italic">
                        {title || (planType === 'family' ? 'Family & Contributors' : 'Archive Witnesses')}
                    </h3>
                </div>
                {inviteHref ? (
                    <a href={inviteHref} className="text-xs text-warm-outline hover:text-warm-dark">
                        Invite new
                    </a>
                ) : null}
            </div>

            {visibleMembers.length === 0 ? (
                <div className="px-6 py-10 text-center">
                    <p className="font-serif text-lg text-warm-dark">{emptyStateTitle}</p>
                    <p className="mt-2 text-sm text-warm-muted">{emptyStateDescription}</p>
                </div>
            ) : (
                <div className="divide-y divide-warm-border/10">
                    {visibleMembers.map((member) => {
                        const isOwnerRow = member.role === 'owner';
                        const isPending = member.status === 'pending';
                        const canEdit = isOwner && !isOwnerRow && !isPending;

                        return (
                            <div
                                key={member.userId || member.email}
                                className="p-4 flex items-center justify-between hover:bg-surface-low/50 transition-colors"
                            >
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${
                                            isPending ? 'border-dashed border-warm-border/40 bg-transparent' : 'border-warm-border/20 bg-white'
                                        }`}
                                    >
                                        {isPending ? <Mail size={16} className="text-warm-dark/20" /> : <Users size={18} className="text-warm-dark/40" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium text-warm-dark truncate ${isPending ? 'italic opacity-60' : ''}`}>
                                            {member.email}
                                        </p>
                                        <p className="text-[10px] text-warm-dark/30 uppercase tracking-tighter font-bold">
                                            {isPending ? 'Pending Invitation' : `Joined ${new Date(member.joinedAt!).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 ml-4">
                                    {isPending ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleReinvite(member.email, member.role)}
                                                className="p-2 text-warm-dark/40 hover:text-olive transition-colors"
                                                title="Re-send invitation"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                            {isOwner && member.invitationId ? (
                                                <button
                                                    onClick={() => handleCancelInvite(member.invitationId!, member.email)}
                                                    className="p-2 text-warm-dark/20 hover:text-red-500 transition-colors"
                                                    title="Cancel invitation"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            ) : null}
                                            <RoleBadge role={member.role} />
                                        </div>
                                    ) : (
                                        <>
                                            {canEdit ? (
                                                <RoleDropdown
                                                    currentRole={member.role}
                                                    availableRoles={editableRoles}
                                                    onChange={(newRole) => handleRoleChange(member.userId!, newRole, member.email)}
                                                />
                                            ) : (
                                                <RoleBadge role={member.role} />
                                            )}

                                            {canEdit ? (
                                                <button
                                                    onClick={() => handleRemoveMember(member.userId!, member.email)}
                                                    className="p-2 text-warm-dark/20 hover:text-red-500 transition-colors"
                                                    title="Revoke access"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            ) : null}
                                            {isOwnerRow ? (
                                                <span title="Primary Owner">
                                                    <ShieldAlert size={14} className="text-warm-dark/10 mr-2" />
                                                </span>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
