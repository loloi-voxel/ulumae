'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Network,
  Shield,
  User,
  MessageCircle,
} from 'lucide-react';
import { ArchiveCapabilities } from '@/lib/archivePermissions';

interface WelcomeData {
  memorial: {
    id: string;
    fullName: string;
    birthDate: string | null;
    deathDate: string | null;
    profilePhotoUrl: string | null;
  };
  userRole: 'witness' | 'co_guardian' | 'reader' | 'owner';
  roleLabel: string;
  plan: 'personal' | 'family';
  capabilities: ArchiveCapabilities;
  archiveRichness: 'empty' | 'partial' | 'rich';
  stats: {
    photoCount: number;
    memoryCount: number;
    videoCount: number;
    hasBiography: boolean;
  };
  linkedCount: number;
  joinedAt: string;
}

function WelcomeContent({ memorialId }: { memorialId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get('role') as WelcomeData['userRole'] | null;

  const [data, setData] = useState<WelcomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/archive/${memorialId}/welcome-data`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        setData(payload);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [memorialId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-warm-dark/50 mb-4">{error || 'This archive could not be loaded.'}</p>
          <button onClick={() => router.replace('/')} className="text-olive underline text-sm">
            Return home
          </button>
        </div>
      </div>
    );
  }

  const { memorial, userRole, roleLabel, plan, capabilities, archiveRichness, stats, linkedCount } = data;
  const role = roleFromUrl || userRole;
  const birthYear = memorial.birthDate ? new Date(memorial.birthDate).getFullYear() : null;
  const deathYear = memorial.deathDate ? new Date(memorial.deathDate).getFullYear() : null;

  const roleBadgeClass =
    role === 'co_guardian'
      ? 'bg-warm-muted/10 text-warm-muted border-warm-muted/20'
      : role === 'reader'
        ? 'bg-warm-border/25 text-warm-dark/60 border-warm-border/40'
        : role === 'owner'
          ? 'bg-plum/10 text-plum border-plum/20'
          : 'bg-olive/10 text-olive border-olive/20';

  return (
    <div className="min-h-screen bg-gradient-to-br from-olive/10 via-surface-low to-warm-muted/10">
      <div className="border-b border-warm-border/20 bg-white/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xs tracking-widest uppercase text-warm-dark/30 font-sans">ULUMAE</span>
          <span className={`text-xs px-3 py-1 rounded-full font-medium border font-sans ${roleBadgeClass}`}>
            {roleLabel}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <WelcomeHero
          memorial={memorial}
          birthYear={birthYear}
          deathYear={deathYear}
          role={role}
          plan={plan}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <ActionCard
            icon={BookOpen}
            iconColor="text-olive"
            iconBg="bg-olive/10"
            title="Read the archive"
            description={
              archiveRichness === 'empty'
                ? 'The owner is still building this. Check back soon.'
                : archiveRichness === 'partial'
                  ? `${stats.hasBiography ? 'A biography is written. ' : ''}${stats.photoCount > 0 ? `${stats.photoCount} photos added.` : 'More moments are still being gathered.'}`
                  : `${stats.photoCount} photos, ${stats.memoryCount} memories, ${stats.videoCount} videos.`
            }
            ctaLabel="View archive"
            ctaDisabled={archiveRichness === 'empty'}
            disabledNote="Content coming soon"
            onClick={() => router.push(`/person/${memorialId}`)}
            primary={archiveRichness !== 'empty'}
          />

          {capabilities.canContribute && (
            <ActionCard
              icon={MessageCircle}
              iconColor="text-warm-muted"
              iconBg="bg-warm-muted/10"
              title="Share a memory"
              description={
                capabilities.contributionsRequireReview
                  ? 'Share a story or memory. A guardian will review it before it appears.'
                  : 'Add a memory directly. As a guardian, your contribution appears right away.'
              }
              ctaLabel="Add a memory"
              onClick={() => router.push(`/archive/${memorialId}/contribute`)}
              primary={archiveRichness === 'empty'}
            />
          )}

          {plan === 'family' && (
            <ActionCard
              icon={Network}
              iconColor="text-warm-dark/50"
              iconBg="bg-warm-border/20"
              title="See the family map"
              description={
                linkedCount > 0
                  ? `${linkedCount} linked archive${linkedCount !== 1 ? 's' : ''} in this family vault.`
                  : 'The owner is still connecting family archives.'
              }
              ctaLabel="View family map"
              ctaDisabled={linkedCount === 0}
              disabledNote="No links yet"
              onClick={() => router.push(`/archive/${memorialId}/family`)}
            />
          )}

          {capabilities.canReview && (
            <ActionCard
              icon={Shield}
              iconColor="text-warm-muted"
              iconBg="bg-warm-muted/10"
              title="Review contributions"
              description="See and approve memories submitted by witnesses."
              ctaLabel="Open steward tools"
              onClick={() => router.push(`/archive/${memorialId}/steward`)}
            />
          )}

          {capabilities.canContribute && (
            <ActionCard
              icon={ImageIcon}
              iconColor="text-warm-dark/40"
              iconBg="bg-warm-border/20"
              title="Share a photo"
              description={
                capabilities.contributionsRequireReview
                  ? 'Share a photo you own. A guardian will review it before it appears.'
                  : 'Share a photo directly into the archive.'
              }
              ctaLabel="Share a photo"
              onClick={() => router.push(`/archive/${memorialId}/contribute?type=photo`)}
            />
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-warm-dark/25 leading-relaxed max-w-md mx-auto">
            {capabilities.canContribute
              ? capabilities.contributionsRequireReview
                ? 'Your contributions stay private to this archive until a guardian reviews them. You can track everything you submit from your archive dashboard.'
                : 'You can read, contribute, and help steward this archive from your dashboard.'
              : 'You have reading access to this archive. If the owner wants you to contribute later, they can update your role.'}
          </p>
          <button
            onClick={() => router.push(`/archive/${memorialId}`)}
            className="mt-4 text-sm text-warm-dark/30 hover:text-warm-dark/50 transition-colors flex items-center gap-1.5 mx-auto"
          >
            Go to your archive dashboard
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeHero({
  memorial,
  birthYear,
  deathYear,
  role,
  plan,
}: {
  memorial: WelcomeData['memorial'];
  birthYear: number | null;
  deathYear: number | null;
  role: WelcomeData['userRole'];
  plan: WelcomeData['plan'];
}) {
  const headline =
    plan === 'family'
      ? `You have joined the ${memorial.fullName} family vault`
      : `You have joined the archive of ${memorial.fullName}`;

  const subline =
    role === 'co_guardian'
      ? 'As a Co-Guardian, you can help review witness contributions and make direct additions to the archive.'
      : role === 'reader'
        ? 'As a Reader, you can explore the archive exactly as it has been shared with you. You cannot contribute or edit content.'
        : role === 'owner'
          ? 'You have full responsibility for this archive, including its members, contributions, and long-term stewardship.'
          : 'As a Witness, your memories and photos will be reviewed by the archive guardians before they appear.';

  return (
    <div className="text-center mb-12">
      <div className="mb-8">
        {memorial.profilePhotoUrl ? (
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl mx-auto">
            <img src={memorial.profilePhotoUrl} alt={memorial.fullName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-olive/20 to-warm-muted/20 border-4 border-white shadow-xl flex items-center justify-center mx-auto">
            <User size={40} className="text-warm-dark/20" />
          </div>
        )}
      </div>

      <h1 className="font-serif text-4xl text-warm-dark mb-2">{memorial.fullName}</h1>
      {(birthYear || deathYear) && (
        <p className="font-serif italic text-warm-dark/40 text-lg mb-8">
          {birthYear && deathYear ? `${birthYear} - ${deathYear}` : birthYear ? `Born ${birthYear}` : ''}
        </p>
      )}

      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-warm-border/30 shadow-sm p-8">
        <div className="w-12 h-12 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Shield size={24} className="text-olive" />
        </div>
        <h2 className="font-serif text-2xl text-warm-dark mb-3">{headline}</h2>
        <p className="text-sm text-warm-dark/50 leading-relaxed">{subline}</p>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  ctaLabel,
  ctaDisabled = false,
  disabledNote,
  onClick,
  primary = false,
}: {
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
  disabledNote?: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col transition-all ${primary ? 'border-olive/30 ring-1 ring-olive/10' : 'border-warm-border/30 hover:border-warm-border/50'
        }`}
    >
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center mb-4`}>
        <Icon size={20} className={iconColor} />
      </div>

      <h3 className="font-serif text-lg text-warm-dark mb-2">{title}</h3>
      <p className="text-sm text-warm-dark/50 leading-relaxed mb-5 flex-1">{description}</p>

      {ctaDisabled ? (
        <div className="text-xs text-warm-dark/25 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-warm-dark/20" />
          {disabledNote}
        </div>
      ) : (
        <button
          onClick={onClick}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${primary ? 'glass-btn-dark' : 'border border-warm-border/40 text-warm-dark/70 hover:bg-warm-border/10'
            }`}
        >
          {ctaLabel}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

export default function WelcomePage({ params }: { params: Promise<{ memorialId: string }> }) {
  const unwrapped = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-low flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-warm-border/30 border-t-warm-dark/40 rounded-full animate-spin" />
        </div>
      }
    >
      <WelcomeContent memorialId={unwrapped.memorialId} />
    </Suspense>
  );
}
