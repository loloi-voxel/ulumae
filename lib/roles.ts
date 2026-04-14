// lib/roles.ts
import { WitnessRole, RoleConfig } from '@/types/roles';
import {
    getAssignableRolesForPlan,
    getRoleLabel,
    type ArchivePlan,
} from '@/lib/archivePermissions';

export const ROLE_CONFIG: Record<WitnessRole, RoleConfig> = {
    owner: {
        label: getRoleLabel('owner'),
        description: 'Full control over the memorial, including members, billing, and permanent sealing.',
        colorClass: 'text-plum',
        bgClass: 'bg-plum/10 border-plum/20',
        iconName: 'Shield',
        capabilities: [
            'Full edit access',
            'Approve/Reject all contributions',
            'Manage all members and roles',
            'Manage billing and plans',
            'Delete or transfer archive'
        ],
        restrictions: [
            'Cannot delete preserved (Arweave) archives',
            'Cannot reassign own role'
        ]
    },
    co_guardian: {
        label: getRoleLabel('co_guardian'),
        description: 'Trusted family steward for Family plans. Can edit content, invite members, and review witness contributions across the family archive.',
        colorClass: 'text-warm-brown',
        bgClass: 'bg-warm-brown/10 border-warm-brown/20',
        iconName: 'Edit',
        capabilities: [
            'View and edit memorial content',
            'Approve/Reject witness contributions',
            'Invite members and manage archive roles',
            'Request new memorial creation from the owner'
        ],
        restrictions: [
            'Cannot delete the archive',
            'Cannot change billing or plans',
            'Cannot reassign the Owner',
            'Personal plans do not allow collaboration'
        ]
    },
    witness: {
        label: getRoleLabel('witness'),
        description: 'Can contribute personal stories and photos to be reviewed by the guardians.',
        colorClass: 'text-olive',
        bgClass: 'bg-olive/10 border-olive/20',
        iconName: 'MessageCircle',
        capabilities: [
            'View full archive',
            'Submit memory and photo contributions',
            'Request access to other family memorials',
            'View own contribution history'
        ],
        restrictions: [
            'Cannot edit content directly',
            'Cannot approve others contributions',
            'Cannot invite others',
            'Contributions must be approved to appear'
        ]
    },
    reader: {
        label: getRoleLabel('reader'),
        description: 'Can view the published archive content but cannot contribute or edit.',
        colorClass: 'text-warm-dark/50',
        bgClass: 'bg-surface-mid border-warm-border/30',
        iconName: 'Eye',
        capabilities: [
            'View published archive content'
        ],
        restrictions: [
            'Cannot contribute or suggest content',
            'Cannot interact with steward tools',
            'Cannot see member list',
            'No dashboard access'
        ]
    }
};

/**
 * Presentation-only role copy. Permission enforcement comes from
 * lib/archivePermissions.ts, which is the backend source of truth.
 */
export const getAssignableRoles = (planType: ArchivePlan): WitnessRole[] => {
    return getAssignableRolesForPlan(planType);
};
