import { inngest, type MemorialSealRequestedEventData } from '@/lib/inngest/client';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { processMemorialSealRun } from '@/lib/sealService';

export const memorialSealRequested = inngest.createFunction(
  { id: 'memorial-seal-requested', retries: 2 },
  { event: 'memorial/seal.requested' },
  async ({ event, step }) => {
    const data = event.data as MemorialSealRequestedEventData;

    return step.run('seal-memorial-on-arweave', async () => {
      return processMemorialSealRun({
        admin: getSupabaseAdmin(),
        memorialId: data.memorialId,
        selectedAssetIds: data.selectedAssetIds,
        ownerEmail: data.ownerEmail,
        certificatePassword: data.certificatePassword,
        jobId: event.id ?? '',
      });
    });
  }
);

export const inngestFunctions = [memorialSealRequested];
