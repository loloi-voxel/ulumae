import Link from 'next/link';
import { BellDot, Loader2, MessageSquareText, Shield, Sparkles, User } from 'lucide-react';
import type { NotificationItem } from '@/lib/notifications';

function iconForType(type: NotificationItem['type']) {
  switch (type) {
    case 'pending_access_request':
      return User;
    case 'pending_creation_request':
      return Sparkles;
    default:
      return MessageSquareText;
  }
}

interface NotificationCenterProps {
  pendingItems: NotificationItem[];
  loading: boolean;
  error: string | null;
}

export default function NotificationCenter({
  pendingItems,
  loading,
  error,
}: NotificationCenterProps) {
  return (
    <section
      id="pending"
      className="bg-white border border-warm-border/30 rounded-xl p-8 mb-12 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-olive/10 flex items-center justify-center">
            <BellDot size={20} className="text-olive" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Pending</p>
            <h2 className="font-serif text-2xl text-warm-dark">
              {pendingItems.length > 0 ? `${pendingItems.length} pending` : 'No pending reviews'}
            </h2>
          </div>
        </div>
        <div className="px-3 py-1 bg-warm-brown/10 border border-warm-brown/20 rounded-full text-warm-brown text-xs font-sans font-semibold">
          {pendingItems.length > 0 ? 'Needs attention' : 'All clear'}
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 size={24} className="mx-auto text-olive animate-spin mb-3" />
          <p className="text-sm text-warm-muted font-sans">Loading pending work...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : pendingItems.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-warm-border/35 bg-surface-low/40 px-6 py-10 text-center">
          <Shield size={24} className="mx-auto mb-3 text-warm-muted" />
          <p className="font-serif text-xl text-warm-dark">Nothing is waiting on you</p>
          <p className="mt-2 text-sm text-warm-muted font-sans">
            Access requests, contribution approvals, and family memorial requests will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pendingItems.map((item) => {
            const Icon = iconForType(item.type);
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group p-6 rounded-2xl border border-warm-border/20 bg-surface-low/30 hover:bg-white hover:border-warm-border/40 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-warm-brown/10 text-warm-brown">
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-warm-outline mb-2 font-semibold">
                        <BellDot size={12} />
                        {item.groupLabel}
                      </div>
                      <h3 className="font-serif text-lg text-warm-dark group-hover:text-black transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-warm-muted mt-2 font-sans leading-relaxed">
                        {item.body}
                      </p>
                      <p className="text-xs text-warm-outline mt-3 font-sans">
                        {item.memorialName} • {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-warm-brown">
                  {item.actionLabel || 'Open review'}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
