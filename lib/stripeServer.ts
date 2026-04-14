import Stripe from 'stripe';

export type StripePlan = 'personal' | 'family' | 'concierge';

let stripeSingleton: Stripe | null = null;

export function getStripeServer() {
  if (stripeSingleton) {
    return stripeSingleton;
  }

  stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as any,
  });

  return stripeSingleton;
}

export function normalizeStripePlan(value: string | null | undefined): StripePlan | null {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes('concierge')) {
    return 'concierge';
  }

  if (normalized.includes('family')) {
    return 'family';
  }

  if (normalized.includes('personal') || normalized.includes('draft')) {
    return 'personal';
  }

  return null;
}
