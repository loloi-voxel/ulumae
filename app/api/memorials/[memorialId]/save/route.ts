import { NextRequest, NextResponse } from 'next/server';
import { MemorialData } from '@/types/memorial';
import {
    buildEditorActorLabel,
    createVersionFromDiff,
} from '@/lib/versioningServer';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { requireMemorialAccess } from '@/lib/apiAuth';
import {
    collectMemorialMediaAssetIds,
    normalizeMemorialMediaData,
    softDeleteMemorialMediaAssets,
} from '@/lib/mediaManager';
import { assertMemorialWritable } from '@/lib/sealService';

function generateSlug(name: string) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildMemorialData(record: any): MemorialData {
    return {
        step1: record.step1 || {},
        step2: record.step2 || {},
        step3: record.step3 || {},
        step4: record.step4 || {},
        step5: record.step5 || {},
        step6: record.step6 || {},
        step7: record.step7 || {},
        step8: record.step8 || {},
        step9: record.step9 || {},
        currentStep: 1,
        paid: record.paid ?? false,
        lastSaved: record.updated_at || null,
        completedSteps: record.completed_steps || [],
    } as MemorialData;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const { memorialId } = await params;
        const access = await requireMemorialAccess({
            memorialId,
            action: 'edit_archive',
        });
        if (!access.ok) return access.response;

        const { user, admin: supabaseAdmin, context } = access;
        await assertMemorialWritable(supabaseAdmin, memorialId);

        const body = await request.json();
        const memorialData = body?.memorialData as MemorialData | undefined;

        if (!memorialData?.step1?.fullName) {
            return NextResponse.json(
                { error: 'A memorial name is required before saving.' },
                { status: 400 }
            );
        }

        const { data: memorial, error: memorialError } = await supabaseAdmin
            .from('memorials')
            .select('id, user_id, mode, status, slug, paid, updated_at, completed_steps, step1, step2, step3, step4, step5, step6, step7, step8, step9')
            .eq('id', memorialId)
            .single();

        if (memorialError || !memorial) {
            return NextResponse.json({ error: 'Memorial not found.' }, { status: 404 });
        }

        const isOwner = context.role === 'owner';

        const oldData = buildMemorialData(memorial);
        const normalizedData = await normalizeMemorialMediaData({
            admin: supabaseAdmin,
            memorialId,
            userId: user.id,
            data: memorialData,
        });
        const now = new Date().toISOString();

        const updatePayload = {
            step1: normalizedData.step1,
            step2: normalizedData.step2,
            step3: normalizedData.step3,
            step4: normalizedData.step4,
            step5: normalizedData.step5,
            step6: normalizedData.step6,
            step7: normalizedData.step7,
            step8: normalizedData.step8,
            step9: normalizedData.step9,
            completed_steps: normalizedData.completedSteps || [],
            full_name: normalizedData.step1.fullName,
            birth_date: normalizedData.step1.birthDate || null,
            death_date: normalizedData.step1.deathDate || null,
            profile_photo_url: normalizedData.step1.profilePhotoPreview || null,
            cover_photo_url: normalizedData.step8?.coverPhotoPreview || null,
            slug: generateSlug(memorialData.step1.fullName) || memorial.slug || memorialId,
            mode: memorial.mode,
            status: memorial.status || 'draft',
            user_id: memorial.user_id,
            paid: normalizedData.paid ?? memorial.paid ?? false,
            updated_at: now,
        };

        const { data: updatedMemorial, error: updateError } = await supabaseAdmin
            .from('memorials')
            .update(updatePayload)
            .eq('id', memorialId)
            .select('*')
            .single();

        if (updateError) {
            throw updateError;
        }

        const removedAssetIds = [...collectMemorialMediaAssetIds(oldData)].filter(
            (assetId) => !collectMemorialMediaAssetIds(normalizedData).has(assetId)
        );

        if (removedAssetIds.length > 0) {
            await softDeleteMemorialMediaAssets(
                supabaseAdmin,
                memorialId,
                removedAssetIds,
                user.id
            );
        }

        let historyRecorded = false;
        let versionError: string | null = null;

        try {
            const actorName = buildEditorActorLabel(
                isOwner ? 'owner' : 'co_guardian',
                user.email
            );

            const { version } = await createVersionFromDiff({
                supabaseAdmin,
                memorialId,
                oldData,
                newData: normalizedData,
                createdBy: user.id,
                createdByName: actorName,
                changeReason: isOwner ? 'owner_edit' : 'co_guardian_edit',
                changeType: 'manual',
            });

            historyRecorded = !!version;

            // Log activity for both Family and Personal plans
            if (historyRecorded && version) {
                await safeLogMemorialActivity(supabaseAdmin, {
                    memorialId,
                    action: 'memorial_edited',
                    summary: version.change_summary || 'Memorial updated',
                    actorUserId: user.id,
                    actorEmail: user.email,
                    details: {
                        plan: memorial.mode,
                        stepsModified: version.steps_modified,
                    },
                });
            }
        } catch (error: any) {
            console.error('[memorial-save] Version creation failed:', error);
            versionError = error.message || 'Version snapshot failed.';
        }

        return NextResponse.json({
            success: true,
            memorial: updatedMemorial,
            historyRecorded,
            versionError,
        });
    } catch (error: any) {
        console.error('[memorial-save]', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
