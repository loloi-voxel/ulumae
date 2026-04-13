import type { User } from '@supabase/supabase-js';
import { WitnessRole } from '@/types/roles';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { INVITATION_EXPIRATION_DAYS } from '@/lib/constants';

export interface InviteMemorialPreview {
    id: string;
    fullName: string;
    birthDate: string | null;
    deathDate: string | null;
    profilePhotoUrl: string | null;
}

export interface InvitePreviewData {
    id: string;
    inviterName: string;
    inviteeEmail: string;
    role: WitnessRole;
    personalMessage: string | null;
    plan: 'personal' | 'family';
    status: string;
    isExpired: boolean;
    memorial: InviteMemorialPreview;
}

export type InviteLookupResult =
    | { state: 'NOT_FOUND' }
    | { state: 'MEMORIAL_DELETED'; inviterName: string; inviteeEmail: string }
    | { state: 'EXPIRED'; inviterName: string; inviteeEmail: string }
    | { state: 'DECLINED'; inviterName: string; inviteeEmail: string }
    | { state: 'USED_BY_OTHER'; inviterName: string; inviteeEmail: string }
    | { state: 'ALREADY_JOINED'; memorialId: string; role: WitnessRole | 'owner' }
    | { state: 'PENDING'; invitation: InvitePreviewData };

type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

type InvitationRecord = {
    id: string;
    inviter_name: string;
    invitee_email: string;
    role: WitnessRole;
    personal_message: string | null;
    plan: 'personal' | 'family';
    status: InvitationStatus;
    expires_at: string;
    memorial_id: string;
    accepted_by_user_id: string | null;
    memorials: {
        id: string;
        user_id: string;
        full_name: string;
        birth_date: string | null;
        death_date: string | null;
        profile_photo_url: string | null;
        deleted_at: string | null;
        mode: 'personal' | 'family';
    } | null;
};

export interface ExistingMemorialMember {
    role: WitnessRole | 'owner';
    userId: string;
}

export interface InvitationUpsertResult {
    invitation: {
        id: string;
        memorialId: string;
        inviteeEmail: string;
        role: WitnessRole;
        personalMessage: string | null;
        plan: 'personal' | 'family';
        expiresAt: string;
    };
    memorial: {
        id: string;
        fullName: string | null;
        mode: 'personal' | 'family';
        ownerUserId: string;
    };
    created: boolean;
}

export interface InvitationAcceptResult {
    success: boolean;
    memorialId?: string;
    role?: WitnessRole | 'owner';
    plan?: 'personal' | 'family';
    joinedNow?: boolean;
    alreadyMember?: boolean;
    code?:
        | 'INVITATION_NOT_FOUND'
        | 'INVITATION_EXPIRED'
        | 'INVITATION_DECLINED'
        | 'MEMORIAL_DELETED'
        | 'EMAIL_MISMATCH'
        | 'USED_BY_OTHER'
        | 'ALREADY_MEMBER';
    error?: string;
}

const VALID_INVITE_ROLES: WitnessRole[] = ['witness', 'co_guardian', 'reader'];

const INVITATION_SELECT = `
    id,
    inviter_name,
    invitee_email,
    role,
    personal_message,
    plan,
    status,
    expires_at,
    memorial_id,
    accepted_by_user_id,
    memorials!inner (
        id,
        user_id,
        full_name,
        birth_date,
        death_date,
        profile_photo_url,
        deleted_at,
        mode
    )
`;

export function isValidInviteRole(role: string): role is WitnessRole {
    return VALID_INVITE_ROLES.includes(role as WitnessRole);
}

export function normalizeInviteEmail(email: string) {
    return email.trim().toLowerCase();
}

function getInvitationExpirationIso() {
    return new Date(
        Date.now() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
}

async function loadInvitationRecord(token: string) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
        .from('witness_invitations')
        .select(INVITATION_SELECT)
        .eq('id', token)
        .maybeSingle();

    if (error || !data) return null;
    return data as unknown as InvitationRecord;
}

async function findAuthUserByEmail(email: string) {
    const admin = getSupabaseAdmin();
    let page = 1;

    while (true) {
        const { data, error } = await admin.auth.admin.listUsers({
            page,
            perPage: 200,
        });

        if (error) {
            throw error;
        }

        const users = data?.users || [];
        const match = users.find(
            (candidate) => normalizeInviteEmail(candidate.email || '') === email
        );

        if (match) {
            return match;
        }

        if (users.length < 200) {
            return null;
        }

        page += 1;
    }
}

async function expireInvitationIfNeeded(invitation: InvitationRecord) {
    if (
        invitation.status === 'pending' &&
        new Date(invitation.expires_at).getTime() < Date.now()
    ) {
        const admin = getSupabaseAdmin();
        await admin
            .from('witness_invitations')
            .update({ status: 'expired' })
            .eq('id', invitation.id)
            .eq('status', 'pending');
        return true;
    }

    return invitation.status === 'expired';
}

export async function getMembershipForUser(
    memorialId: string,
    userId: string,
    ownerUserId?: string | null
): Promise<ExistingMemorialMember | null> {
    const admin = getSupabaseAdmin();

    if (ownerUserId && ownerUserId === userId) {
        return { role: 'owner', userId };
    }

    const { data } = await admin
        .from('user_memorial_roles')
        .select('role')
        .eq('memorial_id', memorialId)
        .eq('user_id', userId)
        .maybeSingle();

    if (!data?.role) return null;

    return {
        role: data.role as WitnessRole,
        userId,
    };
}

export async function getExistingMemorialMemberByEmail(
    memorialId: string,
    email: string,
    ownerUserId?: string | null
): Promise<ExistingMemorialMember | null> {
    const normalizedEmail = normalizeInviteEmail(email);
    const existingUser = await findAuthUserByEmail(normalizedEmail);
    if (!existingUser) return null;

    return getMembershipForUser(memorialId, existingUser.id, ownerUserId);
}

export async function upsertMemorialInvitation(options: {
    memorialId: string;
    inviteeEmail: string;
    role: WitnessRole;
    personalMessage: string | null;
    inviterName: string;
    inviterEmail: string;
}): Promise<InvitationUpsertResult> {
    const admin = getSupabaseAdmin();
    const normalizedEmail = normalizeInviteEmail(options.inviteeEmail);

    if (!isValidInviteRole(options.role)) {
        throw new Error('Invalid role');
    }

    const { data: memorial, error: memorialError } = await admin
        .from('memorials')
        .select('id, user_id, mode, full_name')
        .eq('id', options.memorialId)
        .single();

    if (memorialError || !memorial) {
        throw new Error('Memorial not found');
    }

    if (normalizedEmail === normalizeInviteEmail(options.inviterEmail)) {
        throw new Error('You already have access to this archive.');
    }

    if (options.role === 'co_guardian' && memorial.mode !== 'family') {
        throw new Error('Co-Guardian is a Family plan role only.');
    }

    const existingMember = await getExistingMemorialMemberByEmail(
        memorial.id,
        normalizedEmail,
        memorial.user_id
    );

    if (existingMember) {
        throw new Error(
            existingMember.role === 'owner'
                ? 'This person already owns this archive.'
                : `This person already has archive access as ${existingMember.role}.`
        );
    }

    const expiresAt = getInvitationExpirationIso();

    const { data: existingInvite } = await admin
        .from('witness_invitations')
        .select('id')
        .eq('memorial_id', memorial.id)
        .eq('invitee_email', normalizedEmail)
        .eq('status', 'pending')
        .maybeSingle();

    if (existingInvite?.id) {
        const { data: updated, error: updateError } = await admin
            .from('witness_invitations')
            .update({
                role: options.role,
                personal_message: options.personalMessage,
                inviter_name: options.inviterName,
                plan: memorial.mode,
                expires_at: expiresAt,
            })
            .eq('id', existingInvite.id)
            .select(
                'id, memorial_id, invitee_email, role, personal_message, plan, expires_at'
            )
            .single();

        if (updateError || !updated) {
            throw updateError || new Error('Failed to update invitation');
        }

        return {
            created: false,
            invitation: {
                id: updated.id,
                memorialId: updated.memorial_id,
                inviteeEmail: updated.invitee_email,
                role: updated.role as WitnessRole,
                personalMessage: updated.personal_message,
                plan: updated.plan === 'family' ? 'family' : 'personal',
                expiresAt: updated.expires_at,
            },
            memorial: {
                id: memorial.id,
                fullName: memorial.full_name,
                mode: memorial.mode === 'family' ? 'family' : 'personal',
                ownerUserId: memorial.user_id,
            },
        };
    }

    const { data: created, error: insertError } = await admin
        .from('witness_invitations')
        .insert({
            memorial_id: memorial.id,
            inviter_name: options.inviterName,
            invitee_email: normalizedEmail,
            role: options.role,
            personal_message: options.personalMessage,
            plan: memorial.mode,
            expires_at: expiresAt,
        })
        .select(
            'id, memorial_id, invitee_email, role, personal_message, plan, expires_at'
        )
        .single();

    if (insertError || !created) {
        throw insertError || new Error('Failed to create invitation');
    }

    return {
        created: true,
        invitation: {
            id: created.id,
            memorialId: created.memorial_id,
            inviteeEmail: created.invitee_email,
            role: created.role as WitnessRole,
            personalMessage: created.personal_message,
            plan: created.plan === 'family' ? 'family' : 'personal',
            expiresAt: created.expires_at,
        },
        memorial: {
            id: memorial.id,
            fullName: memorial.full_name,
            mode: memorial.mode === 'family' ? 'family' : 'personal',
            ownerUserId: memorial.user_id,
        },
    };
}

export async function acceptInvitationForUser(
    token: string,
    user: User
): Promise<InvitationAcceptResult> {
    const admin = getSupabaseAdmin();
    const invitation = await loadInvitationRecord(token);

    if (!invitation) {
        return {
            success: false,
            code: 'INVITATION_NOT_FOUND',
            error: 'This invitation does not exist.',
        };
    }

    const memorial = invitation.memorials;
    if (!memorial || memorial.deleted_at) {
        return {
            success: false,
            code: 'MEMORIAL_DELETED',
            error: 'This archive is no longer available.',
        };
    }

    const invitedEmail = normalizeInviteEmail(invitation.invitee_email);
    const currentEmail = normalizeInviteEmail(user.email || '');
    if (!currentEmail || invitedEmail !== currentEmail) {
        return {
            success: false,
            code: 'EMAIL_MISMATCH',
            error: 'This invitation was sent to a different email address.',
        };
    }

    const existingMembership = await getMembershipForUser(
        memorial.id,
        user.id,
        memorial.user_id
    );

    if (existingMembership) {
        return {
            success: true,
            memorialId: memorial.id,
            role: existingMembership.role,
            plan: invitation.plan === 'family' ? 'family' : 'personal',
            alreadyMember: true,
            joinedNow: false,
        };
    }

    if (await expireInvitationIfNeeded(invitation)) {
        return {
            success: false,
            code: 'INVITATION_EXPIRED',
            error: 'This invitation has expired.',
        };
    }

    if (invitation.status === 'declined') {
        return {
            success: false,
            code: 'INVITATION_DECLINED',
            error: 'This invitation was previously declined.',
        };
    }

    if (invitation.status === 'accepted') {
        if (invitation.accepted_by_user_id === user.id) {
            await admin
                .from('user_memorial_roles')
                .upsert(
                    {
                        user_id: user.id,
                        memorial_id: memorial.id,
                        role: invitation.role,
                        invited_via_invitation_id: invitation.id,
                        joined_at: new Date().toISOString(),
                    },
                    {
                        onConflict: 'user_id,memorial_id',
                        ignoreDuplicates: true,
                    }
                );

            return {
                success: true,
                memorialId: memorial.id,
                role: invitation.role,
                plan: invitation.plan === 'family' ? 'family' : 'personal',
                alreadyMember: true,
                joinedNow: false,
            };
        }

        return {
            success: false,
            code: 'USED_BY_OTHER',
            error: 'This invitation has already been used.',
        };
    }

    if (invitation.status !== 'pending') {
        return {
            success: false,
            code: 'INVITATION_NOT_FOUND',
            error: 'This invitation is no longer available.',
        };
    }

    const { data, error } = await admin.rpc('accept_invitation', {
        p_invitation_id: token,
        p_user_id: user.id,
    });

    if (error) {
        throw error;
    }

    if (!data?.success) {
        const postAcceptMembership = await getMembershipForUser(
            memorial.id,
            user.id,
            memorial.user_id
        );

        if (postAcceptMembership) {
            return {
                success: true,
                memorialId: memorial.id,
                role: postAcceptMembership.role,
                plan: invitation.plan === 'family' ? 'family' : 'personal',
                alreadyMember: true,
                joinedNow: false,
            };
        }

        const refreshed = await loadInvitationRecord(token);
        if (
            refreshed?.status === 'accepted' &&
            refreshed.accepted_by_user_id === user.id
        ) {
            return {
                success: true,
                memorialId: memorial.id,
                role: refreshed.role,
                plan: refreshed.plan === 'family' ? 'family' : 'personal',
                alreadyMember: true,
                joinedNow: false,
            };
        }

        if (data?.error === 'INVITATION_EXPIRED') {
            return {
                success: false,
                code: 'INVITATION_EXPIRED',
                error: 'This invitation has expired.',
            };
        }

        return {
            success: false,
            code: refreshed?.status === 'accepted' ? 'USED_BY_OTHER' : 'INVITATION_NOT_FOUND',
            error:
                refreshed?.status === 'accepted'
                    ? 'This invitation has already been used.'
                    : 'Could not join this archive.',
        };
    }

    return {
        success: true,
        memorialId: data.memorial_id,
        role: data.role as WitnessRole,
        plan: data.plan === 'family' ? 'family' : 'personal',
        joinedNow: true,
        alreadyMember: false,
    };
}

export async function getInvitationLookup(
    token: string,
    currentUserId?: string | null
): Promise<InviteLookupResult> {
    const invitation = await loadInvitationRecord(token);

    if (!invitation) {
        return { state: 'NOT_FOUND' };
    }

    const memorial = invitation.memorials;
    if (!memorial) {
        return { state: 'NOT_FOUND' };
    }

    if (memorial.deleted_at) {
        return {
            state: 'MEMORIAL_DELETED',
            inviterName: invitation.inviter_name,
            inviteeEmail: invitation.invitee_email,
        };
    }

    if (await expireInvitationIfNeeded(invitation)) {
        return {
            state: 'EXPIRED',
            inviterName: invitation.inviter_name,
            inviteeEmail: invitation.invitee_email,
        };
    }

    if (invitation.status === 'declined') {
        return {
            state: 'DECLINED',
            inviterName: invitation.inviter_name,
            inviteeEmail: invitation.invitee_email,
        };
    }

    if (currentUserId) {
        const membership = await getMembershipForUser(
            memorial.id,
            currentUserId,
            memorial.user_id
        );

        if (membership) {
            return {
                state: 'ALREADY_JOINED',
                memorialId: memorial.id,
                role: membership.role,
            };
        }
    }

    if (invitation.status === 'accepted') {
        if (currentUserId && invitation.accepted_by_user_id === currentUserId) {
            return {
                state: 'ALREADY_JOINED',
                memorialId: memorial.id,
                role: invitation.role,
            };
        }

        return {
            state: 'USED_BY_OTHER',
            inviterName: invitation.inviter_name,
            inviteeEmail: invitation.invitee_email,
        };
    }

    return {
        state: 'PENDING',
        invitation: {
            id: invitation.id,
            inviterName: invitation.inviter_name,
            inviteeEmail: invitation.invitee_email,
            role: invitation.role,
            personalMessage: invitation.personal_message,
            plan: invitation.plan === 'family' ? 'family' : 'personal',
            status: invitation.status,
            isExpired: false,
            memorial: {
                id: memorial.id,
                fullName: memorial.full_name,
                birthDate: memorial.birth_date,
                deathDate: memorial.death_date,
                profilePhotoUrl: memorial.profile_photo_url,
            },
        },
    };
}
