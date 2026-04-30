// app/api/authorization/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto'; // For SHA-256 hashing
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();
        const { 
            memorialId, 
            identity, 
            agreements, 
            signature, 
            fingerprint,
            authorizationType,
            videoContent // Base64 string from frontend
        } = body;

        if (!memorialId || !signature.content || !identity.fullName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (!hasPermission(permission.context, 'export_archive')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const normalizedAuthorizationType = authorizationType === 'account' ? 'account' : 'individual';

        const { data: existingAuthorization } = await supabaseAdmin
            .from('memorial_authorizations')
            .select('id, status')
            .eq('memorial_id', memorialId)
            .eq('user_id', user.id)
            .eq('authorization_type', normalizedAuthorizationType)
            .in('status', ['pending', 'approved'])
            .maybeSingle();

        if (existingAuthorization) {
            return NextResponse.json(
                {
                    error: 'This authorization has already been recorded and cannot be submitted again.',
                    code: 'ALREADY_AUTHORIZED',
                },
                { status: 409 }
            );
        }

        // 1. Fetch Deceased Info (Legacy Logic)
        const { data: memorial } = await supabaseAdmin
            .from('memorials')
            .select('step1')
            .eq('id', memorialId)
            .single();
        
        const deceasedName = memorial?.step1?.fullName || 'Family Account';
        const deceasedDob = memorial?.step1?.birthDate || '1900-01-01';

        // 2. Capture Technical Metadata
        const headerList = await headers();
        const ip = headerList.get('x-forwarded-for') || 'unknown';
        const userAgent = headerList.get('user-agent') || 'unknown';
        const country = headerList.get('x-vercel-ip-country') || 'Unknown';
        const city = headerList.get('x-vercel-ip-city') || '';
        const geolocation = city ? `${city}, ${country}` : country;

        // 3. Process Video Signature (if present)
        let videoPath = null;
        let videoHash = null;

        if (videoContent) {
            console.log('[Security] Processing video signature...');
            
            // Convert Base64 to Buffer
            const base64Data = videoContent.split(';base64,').pop();
            const videoBuffer = Buffer.from(base64Data, 'base64');

            // --- Generate SHA-256 Hash ---
            videoHash = crypto
                .createHash('sha256')
                .update(videoBuffer)
                .digest('hex');

            // Define secure path: authorizations/{memorial_id}/{timestamp}.mp4
            const fileName = `${Date.now()}_video_signature.mp4`;
            videoPath = `${memorialId}/${fileName}`;

            // Upload to Private Bucket 'authorizations'
            const { error: uploadError } = await supabaseAdmin.storage
                .from('authorizations')
                .upload(videoPath, videoBuffer, {
                    contentType: 'video/mp4',
                    upsert: false
                });

            if (uploadError) {
                console.error('[Storage Error]', uploadError);
                throw new Error('Failed to secure video evidence.');
            }
            
            console.log(`[Security] Video stored: ${videoHash.substring(0, 8)}...`);
        }

        // 4. Insert Comprehensive Record
        const { data: authRecord, error: insertError } = await supabaseAdmin
            .from('memorial_authorizations')
            .insert([{
                memorial_id: memorialId,
                user_id: user.id,
                authorization_type: normalizedAuthorizationType,
                creator_full_name: identity.fullName,
                creator_email: identity.email,
                relationship_to_deceased: identity.relationship || 'Account Holder',
                deceased_full_name: deceasedName,
                deceased_dob: deceasedDob,
                agree_legal_authority: agreements.legal_authority,
                agree_good_faith: agreements.good_faith,
                agree_permanence: agreements.permanence,
                agree_indemnification: agreements.indemnification,
                signature_type: signature.type,
                electronic_signature: signature.content,
                signature_date: new Date().toISOString(),
                signature_ip_address: ip,
                signature_user_agent: userAgent,
                device_fingerprint: fingerprint,
                geolocation: geolocation,
                video_storage_path: videoPath,
                video_hash: videoHash,
                status: 'approved'
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'authorization_submitted',
            summary: 'A memorial authorization was submitted.',
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            details: {
                authorizationId: authRecord.id,
                authorizationType: normalizedAuthorizationType,
                hasVideoEvidence: !!videoHash,
            },
        });

        return NextResponse.json({ 
            success: true, 
            id: authRecord.id,
            log: videoHash ? `Video signature recorded - Hash: ${videoHash.substring(0, 8)}` : null
        });

    } catch (error: any) {
        console.error('Authorization Submission Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
