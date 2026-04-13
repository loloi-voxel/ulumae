import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { DEFAULT_ACTIVITY_LIMIT } from '@/lib/constants';
import { buildActivityNotification } from '@/lib/notifications';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const { memorialId } = await params;

        // AUTH: Use centralized permission layer — require view_activity permission
        const access = await requireMemorialAccess({
            memorialId,
            action: 'view_activity',
        });
        if (!access.ok) return access.response;

        const { admin } = access;

        const rawLimit = Number(req.nextUrl.searchParams.get('limit') || DEFAULT_ACTIVITY_LIMIT);
        const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 100)) : DEFAULT_ACTIVITY_LIMIT;

        const [{ data: data, error }, { data: memorial }] = await Promise.all([
            admin
            .from('memorial_activity_log')
            .select('id, action, summary, actor_email, subject_email, details, created_at')
            .eq('memorial_id', memorialId)
            .order('created_at', { ascending: false })
            .limit(limit),
            admin
                .from('memorials')
                .select('id, full_name')
                .eq('id', memorialId)
                .maybeSingle(),
        ]);

        if (error) throw error;

        return NextResponse.json({
            activity: (data || []).map((item) => ({
                id: item.id,
                action: item.action,
                type: buildActivityNotification({
                    activity: item,
                    memorialId,
                    memorialName: memorial?.full_name || 'Untitled memorial',
                    userId: access.user.id,
                    unread: false,
                })?.type || null,
                summary: item.summary,
                actorEmail: item.actor_email,
                subjectEmail: item.subject_email,
                details: item.details || {},
                createdAt: item.created_at,
                href:
                    buildActivityNotification({
                        activity: item,
                        memorialId,
                        memorialName: memorial?.full_name || 'Untitled memorial',
                        userId: access.user.id,
                        unread: false,
                    })?.href || `/archive/${memorialId}`,
            })),
        });
    } catch (error: any) {
        console.error('[memorial-activity]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
