'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { ArchiveRoleData } from './useArchiveRole';

export function useRoleSync(
    memorialId: string,
    roleData: ArchiveRoleData | null,
    status?: 'idle' | 'loading' | 'ready' | 'unauthorized' | 'forbidden' | 'not_found' | 'error'
) {
    const router = useRouter();
    const pathname = usePathname();
    const redirectKeyRef = useRef<string | null>(null);
    const canContribute = roleData?.capabilities.canContribute ?? false;
    const canReview = roleData?.capabilities.canReview ?? false;
    const permissionSignature = roleData?.permissionSignature ?? null;
    const plan = roleData?.plan ?? null;

    useEffect(() => {
        if (!memorialId) return;

        let redirectKey: string | null = null;
        let message: string | null = null;
        let href: string | null = null;

        if (status === 'unauthorized') {
            redirectKey = `login:${memorialId}`;
            message = 'Your session expired. Please sign in again.';
            href = `/login?next=${encodeURIComponent(pathname || `/archive/${memorialId}`)}`;
        } else if (status === 'not_found') {
            redirectKey = `missing:${memorialId}`;
            message = 'This archive is no longer available.';
            href = '/dashboard';
        } else if (status === 'forbidden' && !pathname.includes('/revoked')) {
            redirectKey = `revoked:${memorialId}`;
            message = 'Your access to this archive has been removed.';
            href = `/archive/${memorialId}/revoked`;
        } else if (permissionSignature) {
            if (pathname.includes('/steward') && !canReview) {
                redirectKey = `steward:${permissionSignature}`;
                message = 'Your current permissions no longer allow steward access.';
                href = `/archive/${memorialId}`;
            } else if (pathname.includes('/contribute') && !canContribute) {
                redirectKey = `contribute:${permissionSignature}`;
                message = 'Your current permissions no longer allow contributions here.';
                href = `/archive/${memorialId}`;
            } else if (pathname.includes('/family') && plan !== 'family') {
                redirectKey = `family:${permissionSignature}`;
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
    }, [canContribute, canReview, memorialId, pathname, permissionSignature, plan, router, status]);
}
