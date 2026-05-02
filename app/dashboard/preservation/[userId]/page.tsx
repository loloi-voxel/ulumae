'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Loader2,
  Lock,
  Shield,
  Sparkles,
} from 'lucide-react';

import DashboardShell from '@/components/dashboard/DashboardShell';
import { isFamilyPlan, isPersonalPlan, useAuth } from '@/components/providers/AuthProvider';
import type { MemorialSealState, SealableMemorialAsset } from '@/types/memorial';
import { createClient } from '@/utils/supabase/client';

const SEAL_MAX_BYTES = 50 * 1024 * 1024 * 1024;
const ROTATING_PHRASES = [
  'This soul will never be forgotten',
  'This archive is becoming permanent',
  'Their story is being written into eternity',
  'A life preserved forever on the blockchain',
];

interface SealPageMemorial {
  id: string;
  userId: string;
  fullName: string | null;
  mode: string | null;
  deleted: boolean;
  deletedAt: string | null;
  preservationState: string | null;
  preservationDate: string | null;
}

function formatBytes(value: number) {
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / Math.pow(1024, power);
  return `${amount.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

async function buildGeneratedPassword() {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(exported), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

export default function DashboardPreservationPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [memorialId, setMemorialId] = useState<string | null>(
    searchParams.get('memorialId')
  );
  const [memorial, setMemorial] = useState<SealPageMemorial | null>(null);
  const [sealState, setSealState] = useState<MemorialSealState | null>(null);
  const [assets, setAssets] = useState<SealableMemorialAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const sessionPasswordKey = memorialId
    ? `ulumae-seal-password:${memorialId}`
    : null;

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

  useEffect(() => {
    if (!sealState || (sealState.status !== 'pending' && sealState.status !== 'in_progress')) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % ROTATING_PHRASES.length);
    }, 2600);

    return () => window.clearInterval(intervalId);
  }, [sealState]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds]
  );
  const selectedBytes = useMemo(
    () => selectedAssets.reduce((sum, asset) => sum + asset.fileSize, 0),
    [selectedAssets]
  );
  const overLimit = selectedBytes > SEAL_MAX_BYTES;

  const resolveMemorialId = async () => {
    if (memorialId) {
      return memorialId;
    }

    if (!auth.user?.id) {
      return null;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('memorials')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('mode', 'personal')
      .eq('deleted', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Could not locate your memorial.');
    }

    if (!data?.id) {
      return null;
    }

    setMemorialId(data.id);
    return data.id;
  };

  const loadSealState = async (targetMemorialId?: string | null) => {
    const nextMemorialId = targetMemorialId || (await resolveMemorialId());
    if (!nextMemorialId) {
      setMemorial(null);
      setSealState(null);
      setAssets([]);
      setSelectedIds([]);
      setLoading(false);
      return;
    }

    const response = await fetch(
      `/api/seal/state?memorialId=${encodeURIComponent(nextMemorialId)}`,
      { cache: 'no-store' }
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Could not load preservation data.');
    }

    const nextMemorial = payload.memorial as SealPageMemorial;
    const nextSealState = payload.sealState as MemorialSealState;
    const nextAssets = (payload.assets || []) as SealableMemorialAsset[];
    const nextSelectedIds =
      nextSealState.selectedAssetIds.length > 0
        ? nextSealState.selectedAssetIds
        : nextAssets.map((asset) => asset.id);

    setMemorial(nextMemorial);
    setSealState(nextSealState);
    setAssets(nextAssets);
    setSelectedIds(nextSelectedIds);
    setMemorialId(nextMemorial.id);
  };

  useEffect(() => {
    if (auth.loading || !auth.authenticated || !auth.user?.id) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadSealState()
      .catch((error: any) => {
        if (cancelled) return;
        setErrorMessage(error?.message || 'Could not load preservation data.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.loading, auth.authenticated, auth.user?.id, memorialId]);

  useEffect(() => {
    if (!memorialId || !sealState || (sealState.status !== 'pending' && sealState.status !== 'in_progress')) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        await loadSealState(memorialId);
      } catch (error: any) {
        setErrorMessage(error?.message || 'Could not refresh the seal state.');
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [memorialId, sealState]);

  useEffect(() => {
    if (!memorialId || sealState?.status !== 'completed') {
      return;
    }

    router.replace(`/success?memorialId=${encodeURIComponent(memorialId)}`);
  }, [memorialId, router, sealState]);

  const canUseSeal = isPersonalPlan(auth.plan);
  const sealCompleted = sealState?.status === 'completed';
  const sealInFlight =
    sealState?.status === 'pending' || sealState?.status === 'in_progress';
  const hasMemorial = !!memorial?.id && !!memorial?.fullName;
  const canSealNow = canUseSeal && hasMemorial && !sealCompleted && !sealInFlight;

  const toggleSelected = (assetId: string) => {
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((value) => value !== assetId)
        : [...current, assetId]
    );
  };

  const handleStartSeal = async () => {
    if (!memorialId || !canSealNow || overLimit) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const password = await buildGeneratedPassword();
      if (sessionPasswordKey) {
        sessionStorage.setItem(sessionPasswordKey, password);
      }

      const response = await fetch('/api/seal/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memorialId,
          selectedAssetIds: selectedIds,
          certificatePassword: password,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Could not start the seal process.');
      }

      setSealState(payload.sealState as MemorialSealState);
      setShowPicker(false);
      await loadSealState(memorialId);
    } catch (error: any) {
      if (sessionPasswordKey) {
        sessionStorage.removeItem(sessionPasswordKey);
      }
      setErrorMessage(error?.message || 'Could not start the seal process.');
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.loading || !auth.authenticated || auth.user?.id !== userId || loading) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-warm-muted/50" />
      </div>
    );
  }

  return (
    <DashboardShell userId={userId}>
      <div className="min-h-screen bg-surface-low">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">
              Preservation / Seal Forever
            </p>
            <h1 className="mt-3 font-serif text-4xl text-warm-dark">
              The Permanent Seal
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-warm-muted">
              Choose the photos and videos that should accompany the memorial forever. Once sealing begins, the memorial is locked immediately and cannot be edited again.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 rounded-none border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {!canUseSeal && (
            <div className="mb-6 rounded-none border border-warm-brown/25 bg-warm-brown/5 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-none bg-white text-warm-brown">
                  <Lock size={18} />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-2xl text-warm-dark">
                    Seal Forever is available only on Personal plans
                  </h2>
                  <p className="mt-2 text-sm text-warm-muted">
                    {isFamilyPlan(auth.plan)
                      ? 'Family plans keep their videos and audio in Cloudflare R2, but blockchain sealing remains exclusive to Personal memorials.'
                      : 'Create the memorial first, then move it onto a Personal plan when you are ready for permanent sealing.'}
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/choice-pricing"
                      className="glass-btn-primary inline-flex rounded-none px-4 py-2 text-sm font-medium text-white"
                    >
                      Review plan options
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sealInFlight ? (
            <div className="rounded-none border border-olive/20 bg-white px-8 py-10 text-center shadow-sm">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-olive/10 text-olive">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <p className="font-serif text-3xl text-warm-dark">
                {ROTATING_PHRASES[phraseIndex]}
              </p>
              <p className="mt-4 text-sm text-warm-muted">
                You will be notified by email when the seal is complete. You can safely leave this page.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-none border border-warm-border/30 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">
                        Memorial
                      </p>
                      <h2 className="mt-2 font-serif text-3xl text-warm-dark">
                        {memorial?.fullName || 'No memorial yet'}
                      </h2>
                      <p className="mt-3 text-sm text-warm-muted">
                        {hasMemorial
                          ? 'The final memorial JSON, selected photos, and selected videos will be encrypted and uploaded to Arweave through the background seal job.'
                          : 'Create the memorial first. Once it exists, you can return here and choose what should be sealed forever.'}
                      </p>
                    </div>
                    {sealCompleted ? (
                      <span className="inline-flex items-center gap-2 rounded-none border border-olive/25 bg-olive/10 px-4 py-2 text-sm text-olive">
                        <CheckCircle2 size={16} />
                        Sealed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPicker((current) => !current)}
                        disabled={!canSealNow || submitting}
                        className={`inline-flex items-center gap-2 rounded-none px-4 py-2 text-sm font-medium transition-colors ${
                          canSealNow
                            ? 'bg-warm-dark text-white hover:bg-warm-dark/90'
                            : 'cursor-not-allowed border border-warm-border/30 bg-surface-mid text-warm-muted'
                        }`}
                      >
                        <Shield size={16} />
                        Seal Forever
                      </button>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-none border border-warm-border/30 bg-surface-mid/40 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">
                        Selectable assets
                      </p>
                      <p className="mt-2 font-serif text-2xl text-warm-dark">
                        {assets.length}
                      </p>
                    </div>
                    <div className="rounded-none border border-warm-border/30 bg-surface-mid/40 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">
                        Selected size
                      </p>
                      <p className={`mt-2 font-serif text-2xl ${overLimit ? 'text-red-600' : 'text-warm-dark'}`}>
                        {formatBytes(selectedBytes)}
                      </p>
                    </div>
                    <div className="rounded-none border border-warm-border/30 bg-surface-mid/40 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">
                        Limit
                      </p>
                      <p className="mt-2 font-serif text-2xl text-warm-dark">
                        50 GB
                      </p>
                    </div>
                  </div>

                  {sealCompleted && sealState?.arweaveTxId && (
                    <div className="mt-6 rounded-none border border-olive/20 bg-olive/5 px-5 py-4 text-sm text-warm-dark">
                      <p className="font-medium">This memorial has already been sealed.</p>
                      <a
                        href={`https://arweave.net/${sealState.arweaveTxId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-olive hover:text-olive/80"
                      >
                        View the Arweave record
                      </a>
                    </div>
                  )}
                </section>

                <section className="rounded-none border border-warm-border/30 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-none bg-olive/10 text-olive">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h2 className="font-serif text-2xl text-warm-dark">
                        What the seal includes
                      </h2>
                      <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">
                        Encrypted before upload
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 text-sm text-warm-dark/85">
                    <div className="rounded-none border border-warm-border/30 bg-surface-mid/30 px-4 py-3">
                      The full memorial JSON, including text, metadata, and references to sealed asset URLs.
                    </div>
                    <div className="rounded-none border border-warm-border/30 bg-surface-mid/30 px-4 py-3">
                      Any selected photos and videos, up to a combined total of 50 GB.
                    </div>
                    <div className="rounded-none border border-warm-border/30 bg-surface-mid/30 px-4 py-3">
                      A PDF certificate generated after completion and attached to the confirmation email.
                    </div>
                  </div>
                </section>
              </div>

              {showPicker && (
                <section className="mt-6 rounded-none border border-warm-border/30 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-warm-outline">
                        Select Media For The Seal
                      </p>
                      <h2 className="mt-2 font-serif text-3xl text-warm-dark">
                        Choose what travels into permanence
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm text-warm-muted">
                        Photos and videos can be included individually. The size counter updates in real time and the total cannot exceed 50 GB.
                      </p>
                    </div>
                    <div className="text-sm text-warm-dark">
                      <span className={overLimit ? 'text-red-600' : 'text-olive'}>
                        {formatBytes(selectedBytes)}
                      </span>{' '}
                      of {formatBytes(SEAL_MAX_BYTES)}
                    </div>
                  </div>

                  {assets.length === 0 ? (
                    <div className="mt-6 rounded-none border border-dashed border-warm-border/30 bg-surface-mid/30 px-6 py-10 text-center text-sm text-warm-muted">
                      No sealable photos or videos are attached to this memorial yet.
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {assets.map((asset) => {
                        const selected = selectedIds.includes(asset.id);
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => toggleSelected(asset.id)}
                            className={`overflow-hidden rounded-none border text-left transition-colors ${
                              selected
                                ? 'border-olive bg-olive/5'
                                : 'border-warm-border/30 bg-white hover:border-warm-border/60'
                            }`}
                          >
                            <div className="relative h-48 bg-surface-mid/50">
                              {asset.previewUrl ? (
                                <img
                                  src={asset.previewUrl}
                                  alt={asset.label}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-warm-muted">
                                  {asset.kind === 'video' ? <Film size={24} /> : <ImageIcon size={24} />}
                                </div>
                              )}
                              <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-none bg-white/90 px-3 py-1.5 text-xs text-warm-dark">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => undefined}
                                  className="pointer-events-none"
                                />
                                Include
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-warm-dark">{asset.label}</p>
                                  <p className="mt-1 text-sm text-warm-muted">{asset.detail}</p>
                                </div>
                                <span className="text-xs text-warm-outline">
                                  {formatBytes(asset.fileSize)}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className={`text-sm ${overLimit ? 'text-red-600' : 'text-warm-muted'}`}>
                      {overLimit
                        ? 'The current selection is too large. Deselect some media before sealing.'
                        : 'The memorial locks immediately after confirmation and stays read-only while the background job runs.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleStartSeal}
                      disabled={submitting || overLimit || !canSealNow}
                      className={`inline-flex items-center justify-center gap-2 rounded-none px-5 py-3 text-sm font-medium transition-colors ${
                        submitting || overLimit || !canSealNow
                          ? 'cursor-not-allowed border border-warm-border/30 bg-surface-mid text-warm-muted'
                          : 'bg-warm-dark text-white hover:bg-warm-dark/90'
                      }`}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield size={16} />}
                      Confirm Seal Forever
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
