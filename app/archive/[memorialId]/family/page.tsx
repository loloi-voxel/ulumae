'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    Network, ArrowLeft, User,
    Loader2, Lock, ChevronRight
} from 'lucide-react';
import { useArchiveRole } from
    '../_hooks/useArchiveRole';
import AccessRequestButton from '@/components/role/AccessRequestButton';
import { useRoleSync } from '../_hooks/useRoleSync';

interface LinkedMemorial {
    id: string;
    fullName: string;
    birthDate: string | null;
    deathDate: string | null;
    profilePhotoUrl: string | null;
    relation: string | null;
    userHasAccess: boolean;
}

export default function FamilyMapPage({
    params
}: {
    params: Promise<{ memorialId: string }>
}) {
    const { memorialId } = use(params);
    const router = useRouter();
    const { data: roleData, loading: roleLoading, status: roleStatus } =
        useArchiveRole(memorialId);

    useRoleSync(memorialId, roleData, roleStatus);

    const [linked, setLinked] =
        useState<LinkedMemorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        if (!roleData) return;

        // Guard: only Family plan has this page
        if (roleData.plan !== 'family') {
            router.replace(`/archive/${memorialId}`);
            return;
        }

        fetch(
            `/api/archive/${memorialId}/family-map`
        )
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setLinked(d.linked);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [roleData, memorialId]);

    if (roleLoading || loading) {
        return (
            <div className="min-h-screen bg-surface-low
        flex items-center justify-center">
                <Loader2 size={32}
                    className="text-olive animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface-low
        flex items-center justify-center p-6">
                <p className="text-warm-dark/50 text-sm
          font-sans">{error}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-low">
            {/* Header */}
            <div className="border-b border-warm-border/20
        bg-white sticky top-0 z-10">
                <div className="max-w-3xl mx-auto
          px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() =>
                            router.push(`/archive/${memorialId}`)
                        }
                        className="p-2 hover:bg-warm-border/10
              rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20}
                            className="text-warm-dark/60" />
                    </button>
                    <div>
                        <h1 className="font-serif text-xl
              text-warm-dark">
                            Family Vault
                        </h1>
                        <p className="text-xs
              text-warm-dark/40 font-sans">
                            {linked.length} connected archive
                            {linked.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto
        px-6 py-10">

                {linked.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-warm-border/20
              rounded-full flex items-center
              justify-center mx-auto mb-4">
                            <Network size={28}
                                className="text-warm-dark/20" />
                        </div>
                        <p className="font-serif text-xl
              text-warm-dark mb-2">
                            No linked archives yet
                        </p>
                        <p className="text-sm
              text-warm-dark/40 font-sans">
                            The owner is still connecting
                            family members.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm
              text-warm-dark/50 font-sans
              leading-relaxed mb-8 max-w-lg">
                            These are the other archives
                            connected to this family vault.
                            Archives you have access to can
                            be visited directly.
                        </p>

                        <div className="space-y-3">
                            {linked.map(m => (
                                <LinkedMemorialCard
                                    key={m.id}
                                    memorial={m}
                                    onClick={() => {
                                        if (m.userHasAccess) {
                                            router.push(`/archive/${m.id}`);
                                        }
                                    }}
                                    roleCanRequest={roleData?.capabilities.canRequestAccess ?? false}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function LinkedMemorialCard({
    memorial: m,
    onClick,
    roleCanRequest = false,
}: {
    memorial: LinkedMemorial;
    onClick: () => void;
    roleCanRequest?: boolean;
}) {
    const formatYear = (d: string | null) =>
        d ? new Date(d).getFullYear() : null;

    const birthYear = formatYear(m.birthDate);
    const deathYear = formatYear(m.deathDate);

    return (
        <div
            onClick={onClick}
            className={`bg-white border border-warm-border/30
        rounded-2xl p-5 flex items-center gap-4
        shadow-sm transition-all ${m.userHasAccess
                    ? 'cursor-pointer hover:border-olive/30 hover:shadow-md'
                    : 'opacity-60 cursor-default'
                }`}
        >
            {/* Photo */}
            {m.profilePhotoUrl ? (
                <img
                    src={m.profilePhotoUrl}
                    alt={m.fullName}
                    className="w-14 h-14 rounded-full
            object-cover border-2 border-warm-border/30
            flex-shrink-0"
                />
            ) : (
                <div className="w-14 h-14 rounded-full
          bg-gradient-to-br from-olive/20
          to-warm-muted/20 border-2 border-warm-border/30
          flex items-center justify-center
          flex-shrink-0">
                    <User size={22}
                        className="text-warm-dark/20" />
                </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="font-serif text-base
          text-warm-dark truncate">
                    {m.fullName}
                </p>
                {(birthYear || deathYear) && (
                    <p className="text-xs italic
            text-warm-dark/40 font-serif mt-0.5">
                        {birthYear && deathYear
                            ? `${birthYear} — ${deathYear}`
                            : birthYear
                                ? `Born ${birthYear}`
                                : ''}
                    </p>
                )}
                {m.relation && (
                    <p className="text-xs text-warm-dark/30
            font-sans mt-1">
                        {m.relation}
                    </p>
                )}
            </div>

            {/* Access indicator */}
            {m.userHasAccess ? (
                <ChevronRight size={18}
                    className="text-warm-dark/25
          flex-shrink-0" />
            ) : (
                <div className="flex-shrink-0">
                    {roleCanRequest ? (
                        <AccessRequestButton
                            memorialId={m.id}
                            memorialName={m.fullName}
                        />
                    ) : (
                        <Lock size={16}
                            className="text-warm-dark/20
          flex-shrink-0" />
                    )}
                </div>
            )}
        </div>
    );
}
