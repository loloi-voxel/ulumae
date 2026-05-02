import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'ulumae',
  name: 'ULUMAE',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export interface MemorialSealRequestedEventData {
  memorialId: string;
  selectedAssetIds: string[];
  ownerEmail: string | null;
  certificatePassword: string;
}
