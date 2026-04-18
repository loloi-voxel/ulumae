'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Eye,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  Network,
  Plus,
  Shield,
  X,
} from 'lucide-react';
import { useRoleSync } from '../_hooks/useRoleSync';
import RoleBanner from './RoleBanner';
import type { ArchiveRoleSnapshot } from '@/lib/archivePermissions';
import ConnectedSpacesPanel from '@/components/dashboard/ConnectedSpacesPanel';

interface ArchiveHubClientProps {
  roleData: ArchiveRoleSnapshot;
  memorialId: string;
  userId: string;
}

const STATUS_CONFIG = {
  pending_approval: {
    icon: Clock,
    label: 'Awaiting review',
    color: 'text-warm-muted bg-warm-muted/10 border-warm-muted/20',
  },
  approved: {
    icon: Check,
    label: 'Published',
    color: 'text-olive bg-olive/10 border-olive/20',
  },
  rejected: {
    icon: X,
    label: 'Not published',
    color: 'text-warm-dark/40 bg-warm-border/20 border-warm-border/30',
  },
  needs_changes: {
    icon: AlertCircle,
    label: 'Needs changes',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
  },
} as const;

const TYPE_ICONS = {
  memory: MessageCircle,
  photo: ImageIcon,
  video: AlertCircle,
} as const;

export default function ArchiveHubClient({ roleData, memorialId, userId }: ArchiveHubClientProps) {
  const router = useRouter();
  useRoleSync(memorialId, roleData, 'ready');
  const [spacesOpen, setSpacesOpen] = useState(false);
  const spacesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!spacesOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!spacesRef.current) return;
      if (!spacesRef.current.contains(event.target as Node)) {
        setSpacesOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [spacesOpen]);

  const {
    userRole,
    plan,
    memorial,
    myContributions,
    pendingCount,
    pendingContributionCount = 0,
    pendingAccessRequestCount = 0,
    pendingCreationRequestCount = 0,
  } = roleData;
  const capabilities = roleData.capabilities;
  const roleLabel = roleData.roleLabel;
  const totalStewardCount = pendingCount;

  return (
    <div className="experience-shell">
      <RoleBanner />

      <div className="sticky top-0 z-10 border-b border-warm-border/20 bg-white/82 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {memorial.profilePhotoUrl ? (
              <img
                src={memorial.profilePhotoUrl}
                alt={memorial.fullName}
                className="w-10 h-10 rounded-full object-cover border-2 border-warm-border/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-olive/20 to-warm-muted/20 border-2 border-warm-border/30 flex items-center justify-center">
                <span className="text-warm-dark/30 text-sm font-serif">{memorial.fullName?.charAt(0) || 'M'}</span>
              </div>
            )}
            <div>
              <p className="font-serif text-base text-warm-dark leading-none mb-0.5">{memorial.fullName}</p>
              <p className="text-xs text-warm-dark/40 font-sans">
                {roleLabel} • {plan} Archive
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={spacesRef}>
              <button
                type="button"
                onClick={() => setSpacesOpen((open) => !open)}
                aria-expanded={spacesOpen}
                aria-haspopup="menu"
                className="experience-button experience-button-secondary text-[11px] tracking-[0.2em]"
              >
                <Layers size={16} />
                Switch space
              </button>
              {spacesOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,90vw)] border border-warm-border/30 bg-white/95 backdrop-blur-sm shadow-lg p-4"
                >
                  <ConnectedSpacesPanel
                    variant="list"
                    emptyMessage="You are not connected to any other archives yet."
                  />
                </div>
              )}
            </div>
            <Link href={`/person/${memorialId}`} className="experience-button experience-button-secondary text-[11px] tracking-[0.2em]">
              <Eye size={16} />
              View archive
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {capabilities.canReview && (
          <section className="experience-panel p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-warm-muted/10">
                  <Shield size={18} className="text-warm-muted" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-warm-outline">Pending</p>
                  <h2 className="mt-1 text-lg font-semibold text-warm-dark">
                    {totalStewardCount > 0 ? `${totalStewardCount} pending` : 'No pending reviews'}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => router.push(`/archive/${memorialId}/steward`)}
                className="experience-button experience-button-secondary text-[11px] tracking-[0.2em]"
              >
                Open queue
                <ChevronRight size={16} />
              </button>
            </div>

            {totalStewardCount > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PendingCard
                  label="Contributions"
                  count={pendingContributionCount}
                  onClick={() => router.push(`/archive/${memorialId}/steward?tab=contributions`)}
                />
                <PendingCard
                  label="Access requests"
                  count={pendingAccessRequestCount}
                  onClick={() => router.push(`/archive/${memorialId}/steward?tab=requests`)}
                />
                {userRole === 'owner' && (
                  <PendingCard
                    label="Memorial requests"
                    count={pendingCreationRequestCount}
                    onClick={() => router.push(`/archive/${memorialId}/steward?tab=creation`)}
                  />
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-warm-dark/50">
                New contributions, access requests, and memorial requests will show up here automatically.
              </p>
            )}
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-warm-dark/40 uppercase tracking-wider mb-4 font-sans">Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <QuickAction icon={Eye} label="View archive" onClick={() => router.push(`/person/${memorialId}`)} primary />
            {capabilities.canContribute && (
              <QuickAction icon={MessageCircle} label="Share memory" onClick={() => router.push(`/archive/${memorialId}/contribute`)} />
            )}
            {capabilities.canContribute && (
              <QuickAction icon={ImageIcon} label="Add a photo" onClick={() => router.push(`/archive/${memorialId}/contribute?type=photo`)} />
            )}
            {plan === 'family' && (
              <QuickAction icon={Network} label="Family map" onClick={() => router.push(`/archive/${memorialId}/family`)} />
            )}
            {capabilities.canReview && (
              <QuickAction
                icon={Shield}
                label="Review queue"
                badge={totalStewardCount > 0 ? totalStewardCount : undefined}
                onClick={() => router.push(`/archive/${memorialId}/steward`)}
              />
            )}
          </div>
        </section>

        {capabilities.canContribute ? (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-warm-dark/40 uppercase tracking-wider font-sans">My Contributions</h2>
              <button
                onClick={() => router.push(`/archive/${memorialId}/contribute`)}
                className="flex items-center gap-1 text-xs text-olive hover:text-olive/80 transition-colors font-sans"
              >
                <Plus size={12} />
                Add new
              </button>
            </div>

            {myContributions.length === 0 ? (
              <div className="experience-panel border-2 border-dashed border-warm-border/35 p-10 text-center">
                <MessageCircle size={24} className="text-warm-dark/20 mx-auto mb-4" />
                <p className="text-sm text-warm-dark/40 mb-4 font-sans">You have not contributed anything yet.</p>
                <button
                  onClick={() => router.push(`/archive/${memorialId}/contribute`)}
                  className="experience-button experience-button-primary"
                >
                  <Plus size={16} />
                  Share your first memory
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myContributions.map((contribution: any) => (
                  <ContributionRow key={contribution.id} contribution={contribution} memorialId={memorialId} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="experience-panel p-6">
            <h2 className="text-xs font-semibold text-warm-dark/40 uppercase tracking-wider font-sans mb-3">Your Access</h2>
            <p className="text-sm text-warm-dark/50 font-sans leading-relaxed">
              This role is read-only. You can explore the archive and, on family vaults, move through linked memorials, but you cannot add or review content.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function PendingCard({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="experience-card px-4 py-4 text-left"
    >
      <p className="text-xs uppercase tracking-[0.16em] text-warm-outline">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-warm-dark">{count}</p>
      <p className="mt-1 text-xs text-warm-dark/50">Open exact review queue</p>
    </button>
  );
}

function QuickAction({ icon: Icon, label, onClick, primary = false, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-[1.35rem] border p-4 font-sans transition-all ${
        primary ? 'experience-button-primary text-white' : 'bg-white/92 text-warm-dark/70 border-warm-border/30 hover:border-warm-border/60 hover:bg-warm-border/5'
      }`}
    >
      {badge !== undefined && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-warm-muted text-white text-xs rounded-full flex items-center justify-center font-semibold font-sans">
          {badge}
        </span>
      )}
      <Icon size={20} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ContributionRow({ contribution, memorialId }: { contribution: any; memorialId: string }) {
  const statusConfig = STATUS_CONFIG[contribution.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = TYPE_ICONS[contribution.type as keyof typeof TYPE_ICONS];

  return (
    <div className="experience-card p-4">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 bg-warm-border/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <TypeIcon size={16} className="text-warm-dark/40" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-warm-dark truncate font-sans">{contribution.title}</p>
          <p className="text-xs text-warm-dark/40 font-sans mt-0.5">
            {new Date(contribution.createdAt).toLocaleDateString()}
            {contribution.revisionCount > 0 ? ` • revision ${contribution.revisionCount}` : ''}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border font-sans flex-shrink-0 ${statusConfig.color}`}>
          <StatusIcon size={10} />
          {statusConfig.label}
        </span>
      </div>

      {contribution.status === 'needs_changes' && contribution.adminNotes && (
        <div className="mt-4 pt-4 border-t border-warm-border/20 space-y-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider font-sans">Requested changes</p>
          <p className="text-sm text-warm-dark/65 font-sans leading-relaxed">{contribution.adminNotes}</p>
          <Link
            href={`/archive/${memorialId}/contribute?revise=${contribution.id}`}
            className="inline-flex items-center gap-2 text-sm text-amber-800 hover:text-amber-900 transition-colors font-sans"
          >
            <ChevronRight size={14} />
            Revise and resubmit
          </Link>
        </div>
      )}
    </div>
  );
}
