'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/utils/supabase/client';
import type { ArchiveRoleData } from './useArchiveRole';
import { invalidateArchiveRole } from './archiveRoleStore';

export function useRoleSync(
    memorialId: string,
    roleData: ArchiveRoleData | null,
    status?: 'idle' | 'loading' | 'ready' | 'unauthorized' | 'forbidden' | 'not_found' | 'error'
) {
    const router = useRouter();
    const pathname = usePathname();
    const redirectKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const userId = roleData?.currentUserId;
        if (!memorialId || !userId) return;
        const supabase = createClient();

        const refresh = (reason: string) =>
            invalidateArchiveRole(memorialId, {
                reason,
                broadcast: true,
            });

        const membershipChannel = supabase
            .channel(`role-sync:membership:${memorialId}:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_memorial_roles',
                    filter: `memorial_id=eq.${memorialId}`,
                },
                (payload) => {
                    const nextUserId =
                        payload.eventType === 'DELETE'
                            ? payload.old.user_id
                            : payload.new.user_id;

                    const roleChanged =
                        payload.eventType !== 'UPDATE' ||
                        payload.old?.role !== payload.new?.role;

                    if (nextUserId === userId && roleChanged) {
                        refresh(`realtime:user_memorial_roles:${payload.eventType}`);
                    }
                }
            )
            .subscribe();

        const memorialChannel = supabase
            .channel(`role-sync:memorial:${memorialId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'memorials',
                    filter: `id=eq.${memorialId}`,
                },
                (payload) => {
                    refresh(`realtime:memorials:${payload.eventType}`);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(membershipChannel);
            supabase.removeChannel(memorialChannel);
        };
    }, [memorialId, roleData?.currentUserId]);

    useEffect(() => {
        if (!memorialId) return;

        let redirectKey: string | null = null;
        let message: string | null = null;
        let href: string | null = null;

        if (status === 'forbidden' && !pathname.includes('/revoked')) {
            redirectKey = `revoked:${memorialId}`;
            message = 'Your access to this archive has been removed.';
            href = `/archive/${memorialId}/revoked`;
        } else if (roleData) {
            if (pathname.includes('/steward') && !roleData.capabilities.canReview) {
                redirectKey = `steward:${roleData.permissionSignature}`;
                message = 'Your current permissions no longer allow steward access.';
                href = `/archive/${memorialId}`;
            } else if (pathname.includes('/contribute') && !roleData.capabilities.canContribute) {
                redirectKey = `contribute:${roleData.permissionSignature}`;
                message = 'Your current permissions no longer allow contributions here.';
                href = `/archive/${memorialId}`;
            } else if (pathname.includes('/family') && roleData.plan !== 'family') {
                redirectKey = `family:${roleData.permissionSignature}`;
                message = 'This archive no longer has family-vault access.';
                href = `/archive/${memorialId}`;
            }
        }

        if (!redirectKey || !message || !href) {
            redirectKeyRef.current = null;
            return;
        }

        if (redirectKeyRef.current === redirectKey) {
            return;
        }

        if (pathname === href) {
            redirectKeyRef.current = redirectKey;
            return;
        }

        redirectKeyRef.current = redirectKey;
        toast.error(message);
        router.replace(href);
    }, [memorialId, pathname, roleData, router, status]);
}
