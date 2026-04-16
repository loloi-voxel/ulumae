'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import {
    Archive,
    CheckCircle2,
    HardDrive,
    Image as ImageIcon,
    Lock,
    Shield,
    Video,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { isFamilyPlan, isPersonalPlan, useAuth } from '@/components/providers/AuthProvider';

const includedItems = [
    'All structured text fields: biography, life story, chapters, values, sayings, relationships, and witness stories',
    'All core metadata: names, dates, places, captions, years, labels, hashes, and archive structure',
    'Profile Photo and Cover Photo as included visual defaults',
    'Preservation manifest describing what belongs to the archive and how each asset is verified',
];

const metadataOnlyItems = [
    'Gallery photos beyond the included defaults when they are not explicitly packaged',
    'Interactive gallery assets not selected for preservation',
    'Voice recordings stored outside the preservation bundle',
    'Video files and large media assets not selected for preservation',
];

const optionalMediaItems = [
    'Full-resolution gallery photos can be added to the preservation bundle',
    'Voice recordings can be packaged when they fit inside the quota',
    'Videos can be preserved when explicitly included and counted toward the storage cap',
];

export default function DashboardPreservationPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const auth = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== userId) {
            router.replace(`/dashboard/preservation/${auth.user.id}`);
        }
    }, [auth.loading, auth.authenticated, auth.user, userId, router]);

    if (auth.loading || !auth.authenticated || auth.user?.id !== userId) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-warm-border/30 border-t-olive rounded-full animate-spin" />
            </div>
        );
    }

    const preservationUnlocked = isPersonalPlan(auth.plan) || isFamilyPlan(auth.plan);
    const workspaceLabel = isFamilyPlan(auth.plan) ? 'Family / Preserve' : 'Personal / Preserve';

    return (
        <DashboardShell userId={userId}>
            <div className="min-h-screen bg-surface-low">
                <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">{workspaceLabel}</p>
                        <h1 className="mt-3 font-serif text-4xl text-warm-dark">The Preservation Layer</h1>
                        <p className="mt-3 max-w-3xl text-sm text-warm-muted">
                            This page defines the preservation package clearly: what is stored directly in the durable layer, what remains metadata-only, and how media is handled under the 50 GB storage ceiling.
                        </p>
                    </div>

                    {!preservationUnlocked && (
                        <div className="mb-6 rounded-none border border-warm-brown/25 bg-warm-brown/5 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-none bg-white text-warm-brown">
                                    <Lock size={18} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="font-serif text-2xl text-warm-dark">Preservation is not active on this workspace yet</h2>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        You can review the package rules now, but permanent preservation activates only after moving from Draft into a paid Personal or Family plan.
                                    </p>
                                    <div className="mt-4">
                                        <Link href="/choice-pricing" className="glass-btn-primary inline-flex rounded-none px-4 py-2 text-sm font-medium text-white">
                                            Review Upgrade Options
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-olive/10 text-olive">
                                    <Archive size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Included in the Preservation Package</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Stored in the preservation layer</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {includedItems.map((item) => (
                                    <div key={item} className="rounded-none border border-warm-border/30 bg-white px-4 py-3 text-sm text-warm-dark/85">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 size={15} className="mt-0.5 text-olive flex-shrink-0" />
                                            <span>{item}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-warm-dark/10 text-warm-dark">
                                    <HardDrive size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Storage Rules</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Clear limits and media handling</p>
                                </div>
                            </div>
                            <div className="rounded-none border border-warm-border/30 bg-white px-5 py-5">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">Maximum Storage</p>
                                <p className="mt-2 font-serif text-3xl text-warm-dark">50 GB</p>
                                <p className="mt-2 text-sm text-warm-muted">
                                    The preservation bundle may include up to 50 GB total. Text, stories, metadata, Profile Photo, and Cover Photo are treated as core defaults. Larger media consumes the remaining quota when explicitly included.
                                </p>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-4">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <ImageIcon size={14} className="text-olive" />
                                        Images
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        Profile and Cover are included defaults. Other images are preserved only when explicitly packaged.
                                    </p>
                                </div>
                                <div className="rounded-none border border-warm-border/30 bg-white px-4 py-4">
                                    <div className="flex items-center gap-2 text-sm text-warm-dark">
                                        <Video size={14} className="text-olive" />
                                        Video & Audio
                                    </div>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        Full media files stay explicit and quota-bound. If not packaged, only their metadata is preserved.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="mt-6 grid gap-6 lg:grid-cols-2">
                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-warm-brown/10 text-warm-brown">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Metadata-Only References</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Tracked but not fully packaged</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {metadataOnlyItems.map((item) => (
                                    <div key={item} className="rounded-none border border-warm-border/30 bg-white px-4 py-3 text-sm text-warm-dark/85">
                                        <div className="flex items-start gap-2">
                                            <Lock size={15} className="mt-0.5 text-warm-brown flex-shrink-0" />
                                            <span>{item}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="glass-card rounded-none p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-olive/10 text-olive">
                                    <Archive size={20} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-2xl text-warm-dark">Optional Full Media Packaging</h2>
                                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Explicit and quota-aware</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {optionalMediaItems.map((item) => (
                                    <div key={item} className="rounded-none border border-warm-border/30 bg-white px-4 py-3 text-sm text-warm-dark/85">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 size={15} className="mt-0.5 text-olive flex-shrink-0" />
                                            <span>{item}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 rounded-none border border-warm-border/30 bg-surface-mid/40 px-4 py-4 text-sm text-warm-muted">
                                The preservation layer always keeps the memorial readable even when large media remains metadata-only. Titles, captions, years, relationships, hashes, and storage references remain part of the preserved record.
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
