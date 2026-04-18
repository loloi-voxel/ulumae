import { SupabaseClient } from '@supabase/supabase-js';

function isMissingCreationRequestTableError(error: any) {
    const message = String(error?.message || '');
    return message.includes('memorial_creation_requests');
}

export interface FamilyWorkspaceMemorial {
    id: string;
    full_name: string | null;
    birth_date: string | null;
    death_date: string | null;
    profile_photo_url: string | null;
    status: string | null;
    paid: boolean | null;
    updated_at: string;
}

export interface MemorialCreationRequestRecord {
    id: string;
    owner_user_id: string;
    requester_user_id: string;
    source_memorial_id: string;
    proposed_name: string | null;
    request_message: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_memorial_id: string | null;
    created_at: string;
    decided_at: string | null;
    decided_by: string | null;
}

export async function getOwnerFamilyMemorials(
    supabaseAdmin: SupabaseClient,
    ownerUserId: string
) {
    const { data, error } = await supabaseAdmin
        .from('memorials')
        .select('id, full_name, birth_date, death_date, profile_photo_url, status, paid, updated_at')
        .eq('user_id', ownerUserId)
        .eq('mode', 'family')
        .eq('deleted', false)
        .order('updated_at', { ascending: false });

    if (error) {
        throw error;
    }

    return (data || []) as FamilyWorkspaceMemorial[];
}

export async function syncCoGuardianAcrossOwnerFamily(
    supabaseAdmin: SupabaseClient,
    ownerUserId: string,
    coGuardianUserId: string
) {
    const memorials = await getOwnerFamilyMemorials(supabaseAdmin, ownerUserId);

    if (memorials.length === 0) {
        return [];
    }

    const joinedAt = new Date().toISOString();
    const rows = memorials.map((memorial) => ({
        user_id: coGuardianUserId,
        memorial_id: memorial.id,
        role: 'co_guardian',
        joined_at: joinedAt,
    }));

    const { error } = await supabaseAdmin
        .from('user_memorial_roles')
        .upsert(rows, { onConflict: 'user_id,memorial_id' });

    if (error) {
        throw error;
    }

    return memorials;
}

export async function syncAllCoGuardiansToMemorial(
    supabaseAdmin: SupabaseClient,
    ownerUserId: string,
    memorialId: string
) {
    const familyMemorials = await getOwnerFamilyMemorials(supabaseAdmin, ownerUserId);
    const familyMemorialIds = familyMemorials.map((memorial) => memorial.id);

    if (familyMemorialIds.length === 0) {
        return;
    }

    const { data: coGuardianRows, error } = await supabaseAdmin
        .from('user_memorial_roles')
        .select('user_id')
        .eq('role', 'co_guardian')
        .in('memorial_id', familyMemorialIds);

    if (error) {
        throw error;
    }

    const uniqueIds = Array.from(
        new Set((coGuardianRows || []).map((row: any) => row.user_id))
    );

    if (uniqueIds.length === 0) {
        return;
    }

    const joinedAt = new Date().toISOString();
    const rows = uniqueIds.map((userId) => ({
        user_id: userId,
        memorial_id: memorialId,
        role: 'co_guardian',
        joined_at: joinedAt,
    }));

    const { error: upsertError } = await supabaseAdmin
        .from('user_memorial_roles')
        .upsert(rows, { onConflict: 'user_id,memorial_id' });

    if (upsertError) {
        throw upsertError;
    }
}

export async function updateFamilyCoGuardianRole(
    supabaseAdmin: SupabaseClient,
    ownerUserId: string,
    targetUserId: string,
    role: 'co_guardian' | 'witness' | 'reader'
) {
    const memorials = await getOwnerFamilyMemorials(supabaseAdmin, ownerUserId);
    const memorialIds = memorials.map((memorial) => memorial.id);

    if (memorialIds.length === 0) {
        return;
    }

    const { error } = await supabaseAdmin
        .from('user_memorial_roles')
        .update({ role })
        .eq('user_id', targetUserId)
        .in('memorial_id', memorialIds);

    if (error) {
        throw error;
    }
}

export async function removeFamilyCoGuardianAccess(
    supabaseAdmin: SupabaseClient,
    ownerUserId: string,
    targetUserId: string
) {
    const memorials = await getOwnerFamilyMemorials(supabaseAdmin, ownerUserId);
    const memorialIds = memorials.map((memorial) => memorial.id);

    if (memorialIds.length === 0) {
        return;
    }

    const { error } = await supabaseAdmin
        .from('user_memorial_roles')
        .delete()
        .eq('user_id', targetUserId)
        .in('memorial_id', memorialIds);

    if (error) {
        throw error;
    }
}

export async function getPendingMemorialCreationRequest(
    supabaseAdmin: SupabaseClient,
    ownerUserId: string,
    requesterUserId: string
) {
    const { data, error } = await supabaseAdmin
        .from('memorial_creation_requests')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('requester_user_id', requesterUserId)
        .eq('status', 'pending')
        .maybeSingle();

    if (error) {
        if (isMissingCreationRequestTableError(error)) {
            return null;
        }
        throw error;
    }

    return data as MemorialCreationRequestRecord | null;
}

export async function getMemorialCreationRequestCount(
    supabaseAdmin: SupabaseClient,
    ownerUserId: string
) {
    const { count, error } = await supabaseAdmin
        .from('memorial_creation_requests')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'pending');

    if (error) {
        if (isMissingCreationRequestTableError(error)) {
            return 0;
        }
        throw error;
    }

    return count || 0;
}
