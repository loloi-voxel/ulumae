import { redirect } from 'next/navigation';
import InviteShell from './_components/InviteShell';
import InviteTerminal from './_components/InviteTerminal';
import { WitnessRole } from '@/types/roles';
import { createClient } from '@/utils/supabase/server';
import { getInvitationLookup } from '@/lib/invitations';
import { getInviteWelcomePath } from '@/lib/inviteFlow';

export interface InvitationData {
    id: string;
    inviterName: string;
    inviteeEmail: string;
    role: WitnessRole;
    personalMessage: string | null;
    plan: 'personal' | 'family';
    status: string;
    isExpired: boolean;
    memorial: {
        id: string;
        fullName: string;
        birthDate: string | null;
        deathDate: string | null;
        profilePhotoUrl: string | null;
    };
}

export type TerminalReason =
    | 'NOT_FOUND'
    | 'EXPIRED'
    | 'DECLINED'
    | 'USED_BY_OTHER'
    | 'MEMORIAL_DELETED'
    | 'ALREADY_JOINED';

export default async function InvitePage({
    params
}: {
    params: Promise<{ token: string }>
}) {
    const { token } = await params;
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();

    const lookup = await getInvitationLookup(token, user?.id);

    if (lookup.state === 'ALREADY_JOINED') {
        redirect(getInviteWelcomePath(lookup.memorialId, lookup.role));
    }

    if (lookup.state !== 'PENDING') {
        return (
            <InviteTerminal
                reason={lookup.state}
                meta={{
                    inviterName:
                        'inviterName' in lookup
                            ? lookup.inviterName
                            : '',
                    inviteeEmail:
                        'inviteeEmail' in lookup
                            ? lookup.inviteeEmail
                            : ''
                }}
            />
        );
    }

    return (
        <InviteShell
            initialData={{
                invitation: lookup.invitation,
                isAuthenticated: !!user,
                currentUserEmail: user?.email ?? null
            }}
            token={token}
        />
    );
}
