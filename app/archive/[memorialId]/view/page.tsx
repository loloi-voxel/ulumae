'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Shield } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import MemorialRenderer from '@/components/MemorialRenderer';
import { useArchiveRole } from '../_hooks/useArchiveRole';
import { useRoleSync } from '../_hooks/useRoleSync';
import { DrawerProvider, useDrawer } from './_context/DrawerContext';
import ContributionDrawer from './_components/ContributionDrawer';

function ArchiveViewContent({ memorialId }: { memorialId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { data: roleData, loading: roleLoading, status: roleStatus } = useArchiveRole(memorialId);
  useRoleSync(memorialId, roleData, roleStatus);
  const { openDrawer, setContributions } = useDrawer();

  const [viewData, setViewData] = useState<{ memorialData: any; relations: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/archive/${memorialId}/render-data`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        setViewData(payload);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [memorialId]);

  useEffect(() => {
    if (!roleData?.capabilities.canReview) return;

    const fetchPending = () => {
      supabase
        .from('memorial_contributions')
        .select('*')
        .eq('memorial_id', memorialId)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          setContributions(data || []);
        });
    };

    fetchPending();

    const channel = supabase
      .channel(`view-pending-${memorialId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memorial_contributions',
          filter: `memorial_id=eq.${memorialId}`,
        },
        fetchPending
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memorialId, roleData?.capabilities.canReview, setContributions, supabase]);

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <Loader2 size={32} className="text-olive animate-spin" />
      </div>
    );
  }

  if (error || !viewData || !roleData) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-warm-dark/50 mb-4">{error || 'This archive could not be loaded.'}</p>
          <button onClick={() => router.push(`/archive/${memorialId}`)} className="text-olive underline text-sm">
            Return to archive dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-low">
      <div className="border-b border-warm-border/20 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => router.push(`/archive/${memorialId}`)}
              className="p-2 hover:bg-warm-border/10 transition-colors rounded-none"
            >
              <ArrowLeft size={20} className="text-warm-dark/60" />
            </button>
            <div className="min-w-0">
              <p className="font-serif text-base text-warm-dark truncate">{roleData.memorial.fullName}</p>
              <p className="text-xs text-warm-dark/40 font-sans">{roleData.roleLabel}</p>
            </div>
          </div>

          {roleData.capabilities.canReview && (
            <button
              onClick={() => openDrawer('all')}
              className="inline-flex items-center gap-2 border border-warm-border/30 px-4 py-2 text-sm font-sans text-warm-dark/70 transition-colors hover:bg-warm-border/10 rounded-none"
            >
              <Shield size={16} />
              Review pending contributions
            </button>
          )}
        </div>
      </div>

      <MemorialRenderer
        data={viewData.memorialData}
        relations={viewData.relations}
        isPreview={false}
        compact={false}
      />

      {roleData.capabilities.canReview && <ContributionDrawer memorialId={memorialId} />}
    </div>
  );
}

export default function ArchiveViewPage({ params }: { params: Promise<{ memorialId: string }> }) {
  const { memorialId } = use(params);

  return (
    <DrawerProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-surface-low flex items-center justify-center">
            <Loader2 size={32} className="text-olive animate-spin" />
          </div>
        }
      >
        <ArchiveViewContent memorialId={memorialId} />
      </Suspense>
    </DrawerProvider>
  );
}
