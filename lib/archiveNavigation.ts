import { getPlanDashboardPath } from '@/components/providers/AuthProvider';

export type ArchiveRoleForExit = 'owner' | 'co_guardian' | 'witness' | 'reader';

export function getArchiveExitPath(args: {
    role: ArchiveRoleForExit;
    plan: string;
    userId: string;
    memorialId: string;
}): string {
    if (args.role === 'owner') {
        return getPlanDashboardPath(args.plan, args.userId);
    }
    return `/archive/${args.memorialId}`;
}
