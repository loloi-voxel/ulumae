import { redirect } from 'next/navigation';

export default async function ArchiveViewRedirectPage({
    params,
}: {
    params: Promise<{ memorialId: string }>;
}) {
    const { memorialId } = await params;
    redirect(`/person/${memorialId}`);
}
