'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

interface RoleBannerNotice {
  memorialId: string;
  type: 'role_changed' | 'permissions_changed' | 'access_revoked' | 'account_switched';
  message: string;
}

const NOTICE_STYLES: Record<
  RoleBannerNotice['type'],
  {
    icon: typeof Shield;
    container: string;
    iconWrap: string;
    iconClass: string;
    actionLabel: string;
  }
> = {
  role_changed: {
    icon: Shield,
    container: 'bg-warm-dark text-surface-low border-olive/30',
    iconWrap: 'bg-olive/20',
    iconClass: 'text-olive',
    actionLabel: 'Dismiss',
  },
  permissions_changed: {
    icon: Shield,
    container: 'bg-warm-dark text-surface-low border-olive/30',
    iconWrap: 'bg-olive/20',
    iconClass: 'text-olive',
    actionLabel: 'Dismiss',
  },
  account_switched: {
    icon: Shield,
    container: 'bg-warm-dark text-surface-low border-olive/30',
    iconWrap: 'bg-olive/20',
    iconClass: 'text-olive',
    actionLabel: 'Dismiss',
  },
  access_revoked: {
    icon: AlertTriangle,
    container: 'bg-red-950 text-red-50 border-red-400/25',
    iconWrap: 'bg-red-500/15',
    iconClass: 'text-red-200',
    actionLabel: 'Close',
  },
};

export default function RoleBanner() {
  const [notice, setNotice] = useState<RoleBannerNotice | null>(null);

  useEffect(() => {
    const handleNotice = (event: Event) => {
      const detail = (event as CustomEvent<RoleBannerNotice>).detail;
      if (!detail?.message) return;
      setNotice(detail);
    };

    window.addEventListener('ulumae:archive-role-notice', handleNotice);
    return () => {
      window.removeEventListener('ulumae:archive-role-notice', handleNotice);
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.type === 'access_revoked') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice((current) =>
        current?.message === notice.message ? null : current
      );
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  if (!notice) return null;

  const style = NOTICE_STYLES[notice.type];
  const Icon = style.icon;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] animate-fadeIn px-4 pt-4">
      <div
        className={`mx-auto flex max-w-4xl items-center justify-between gap-4 rounded-2xl border px-5 py-3 shadow-2xl ${style.container}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}
          >
            <Icon size={18} className={style.iconClass} />
          </div>
          <div>
            <p className="text-sm font-medium">{notice.message}</p>
            <p className="text-xs opacity-70">
              The archive view has been revalidated against the latest backend permissions.
            </p>
          </div>
        </div>

        <button
          onClick={() => setNotice(null)}
          className="rounded-lg border border-current/15 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5"
        >
          {style.actionLabel}
        </button>
      </div>
    </div>
  );
}
