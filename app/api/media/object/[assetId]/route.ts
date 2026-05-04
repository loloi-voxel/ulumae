import { NextRequest, NextResponse } from 'next/server';

import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { getSupabaseAdmin, requireUser } from '@/lib/apiAuth';
import { downloadR2Object } from '@/lib/r2Storage';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { user } = auth;
    const { assetId } = await params;
    const admin = getSupabaseAdmin();

    const { data: asset, error: assetError } = await admin
      .from('memorial_media_assets')
      .select('id, memorial_id, bucket, storage_path, mime_type, deleted_at, sealed_at')
      .eq('id', assetId)
      .maybeSingle();

    if (assetError || !asset || asset.deleted_at) {
      return NextResponse.json({ error: 'Media asset not found.' }, { status: 404 });
    }

    const permission = await resolveArchivePermissionContext(
      admin,
      asset.memorial_id,
      user.id,
      { includeDeleted: true }
    );

    if (!permission.memorialExists || !permission.context) {
      return NextResponse.json({ error: 'Memorial not found.' }, { status: 404 });
    }

    if (!hasPermission(permission.context, 'view_archive')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (asset.bucket !== 'r2') {
      return NextResponse.json({ error: 'This asset is not stored in R2.' }, { status: 400 });
    }

    const range = request.headers.get('range');
    const object = await downloadR2Object({
      key: asset.storage_path,
      range,
    });

    return new NextResponse(Buffer.from(object.bytes), {
      status: object.contentRange ? 206 : 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': asset.sealed_at
          ? 'private, max-age=31536000, immutable'
          : 'private, max-age=300',
        'Content-Disposition': 'inline',
        'Content-Length': String(object.contentLength),
        'Content-Type': asset.mime_type || object.contentType,
        ...(object.contentRange ? { 'Content-Range': object.contentRange } : {}),
        ...(object.eTag ? { ETag: object.eTag } : {}),
        ...(object.lastModified ? { 'Last-Modified': object.lastModified } : {}),
      },
    });
  } catch (error: any) {
    console.error('[media-object]', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
