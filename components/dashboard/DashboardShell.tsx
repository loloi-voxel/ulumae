'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    Archive,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    LayoutDashboard,
    Mail,
    Menu,
    Settings,
    Shield,
    UserCheck,
    Workflow,
    X,
} from 'lucide-react';
import {
    getPlanDashboardPath,
    isFamilyPlan,
    isPersonalPlan,
    useAuth,
} from '@/components/providers/AuthProvider';
import NotificationCenter from '@/components/NotificationCenter';

interface DashboardShellProps {
    userId: string;
    children: ReactNode;
}

interface NavItem {
    key: string;
    label: string;
    description: string;
    href: string;
    icon: typeof Archive;
    active: boolean;
}

function planLabel(plan: string) {
    switch (plan) {
        case 'family':
            return 'Family Plan';
        case 'concierge':
            return 'Family Plan';
        case 'personal':
            return 'Personal Plan';
        case 'draft':
            return 'Draft Workspace';
        default:
            return 'Workspace';
    }
}

function buildItems(options: {
    pathname: string;
    userId: string;
    plan: string;
}): NavItem[] {
    const { pathname, userId, plan } = options;

    if (isPersonalPlan(plan as any)) {
        return [
            {
                key: 'overview',
                label: 'Overview',
                description: 'Personal dashboard and progress',
                href: `/dashboard/personal/${userId}`,
                icon: LayoutDashboard,
                active: pathname === `/dashboard/personal/${userId}`,
            },
            {
                key: 'preserve',
                label: 'Preserve',
                description: 'Export and preservation details',
                href: `/dashboard/preservation/${userId}`,
                icon: Shield,
                active: pathname.startsWith(`/dashboard/preservation/${userId}`),
            },
            {
                key: 'succession',
                label: 'Succession',
                description: 'Designate who takes over your archive',
                href: `/dashboard/succession/${userId}`,
                icon: UserCheck,
                active: pathname.startsWith(`/dashboard/succession/${userId}`),
            },
            {
                key: 'settings',
                label: 'Settings',
                description: 'Profile, billing, and security',
                href: `/dashboard/settings/${userId}`,
                icon: Settings,
                active: pathname.startsWith(`/dashboard/settings/${userId}`),
            },
        ];
    }

    if (isFamilyPlan(plan as any)) {
        return [
            {
                key: 'overview',
                label: 'Overview',
                description: 'Family dashboard, members, and activity',
                href: `/dashboard/family/${userId}`,
                icon: LayoutDashboard,
                active: pathname === `/dashboard/family/${userId}`,
            },
            {
                key: 'relations',
                label: 'Family Tree',
                description: 'Relations and linked memorials',
                href: `/dashboard/family/${userId}/tree`,
                icon: Workflow,
                active: pathname.startsWith(`/dashboard/family/${userId}/tree`),
            },
            {
                key: 'succession',
                label: 'Succession',
                description: 'Long-term stewardship planning',
                href: `/dashboard/succession/${userId}`,
                icon: UserCheck,
                active: pathname.startsWith(`/dashboard/succession/${userId}`),
            },
            {
                key: 'settings',
                label: 'Settings',
                description: 'Profile, billing, and security',
                href: `/dashboard/settings/${userId}`,
                icon: Settings,
                active: pathname.startsWith(`/dashboard/settings/${userId}`),
            },
        ];
    }

    return [
        {
            key: 'overview',
            label: 'Overview',
            description: 'Current workspace and next steps',
            href: getPlanDashboardPath('draft', userId),
            icon: LayoutDashboard,
            active: pathname.startsWith(`/dashboard/draft/${userId}`),
        },
        {
            key: 'settings',
            label: 'Settings',
            description: 'Profile, billing, and security',
            href: `/dashboard/settings/${userId}`,
            icon: Settings,
            active: pathname.startsWith(`/dashboard/settings/${userId}`),
        },
    ];
}

function SidebarContent({
    items,
    plan,
    email,
    onNavigate,
}: {
    items: NavItem[];
    plan: string;
    email?: string;
    onNavigate?: () => void;
}) {
    return (
        <div className="flex h-full flex-col bg-white/92 backdrop-blur-sm">
            <div className="border-b border-warm-border/20 px-6 py-6">
                <Link href="/" className="inline-flex items-center gap-3" onClick={onNavigate}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-none bg-warm-dark text-surface-low shadow-[0_14px_30px_rgba(57,56,48,0.14)]">
                        <Archive size={18} />
                    </div>
                    <div>
                        <p className="font-serif text-lg text-warm-dark">ULUMAE</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">
                            Dashboard
                        </p>
                    </div>
                </Link>
            </div>

            <div className="px-4 py-5">
                <div className="rounded-none border border-warm-border/28 bg-surface-mid/45 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-warm-outline">Current Plan</p>
                    <p className="mt-2 font-serif text-xl text-warm-dark">{planLabel(plan)}</p>
                    {email && <p className="mt-1 truncate text-xs text-warm-muted">{email}</p>}
                </div>
            </div>

            <nav className="flex-1 px-3 pb-4 flex flex-col">
                <div className="space-y-2">
                    {items.map((item) => {
                        const Icon = item.icon;
                        const baseClass = item.active
                            ? 'border-olive/30 bg-olive/10 text-warm-dark shadow-sm'
                            : 'border-transparent bg-transparent text-warm-dark/75 hover:border-warm-border/30 hover:bg-surface-mid/40';

                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                onClick={onNavigate}
                                className={`group flex items-center gap-3 rounded-none border px-4 py-3 transition-all ${baseClass}`}
                            >
                                <div
                                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-none ${
                                        item.active ? 'bg-white text-olive' : 'bg-white/80 text-warm-muted'
                                    }`}
                                >
                                    <Icon size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{item.label}</p>
                                    <p className="mt-0.5 text-xs text-warm-outline">{item.description}</p>
                                </div>
                                <ChevronRight
                                    size={16}
                                    className={`flex-shrink-0 transition-transform ${
                                        item.active ? 'text-olive' : 'text-warm-outline group-hover:translate-x-0.5'
                                    }`}
                                />
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-auto pt-6 border-t border-warm-border/20">
                    <p className="px-4 mb-2 text-[10px] uppercase tracking-[0.18em] text-warm-outline">Need help?</p>
                    <div className="space-y-1">
                        <Link
                            href="/faq"
                            onClick={onNavigate}
                            className="flex items-center gap-3 px-4 py-2 text-xs text-warm-dark/70 transition-colors hover:bg-surface-mid/40 rounded-none"
                        >
                            <HelpCircle size={14} className="text-warm-outline" />
                            FAQ
                        </Link>
                        <Link
                            href="/contact"
                            onClick={onNavigate}
                            className="flex items-center gap-3 px-4 py-2 text-xs text-warm-dark/70 transition-colors hover:bg-surface-mid/40 rounded-none"
                        >
                            <Mail size={14} className="text-warm-outline" />
                            Contact support
                        </Link>
                    </div>
                </div>
            </nav>
        </div>
    );
}

export default function DashboardShell({ userId, children }: DashboardShellProps) {
    const auth = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname, searchParams]);

    const items = useMemo(
        () =>
            buildItems({
                pathname,
                userId,
                plan: auth.plan,
            }),
        [pathname, userId, auth.plan]
    );

    return (
        <div className="experience-shell">
            <div
                className={`lg:grid lg:min-h-screen ${
                    desktopCollapsed
                        ? 'lg:grid-cols-[88px_minmax(0,1fr)]'
                        : 'lg:grid-cols-[280px_minmax(0,1fr)]'
                }`}
            >
                <aside className="hidden border-r border-warm-border/20 bg-white/70 backdrop-blur-sm lg:sticky lg:top-0 lg:block lg:h-screen">
                    <div className="relative h-full">
                        <button
                            onClick={() => setDesktopCollapsed((value) => !value)}
                            aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-none border border-warm-border/30 bg-white/90 text-warm-dark shadow-sm transition-colors hover:bg-surface-mid/70"
                        >
                            {desktopCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>

                        {desktopCollapsed ? (
                            <div className="flex h-full flex-col items-center bg-white/92 px-3 py-16 backdrop-blur-sm">
                                <Link
                                    href="/"
                                    className="mb-8 flex h-12 w-12 items-center justify-center rounded-none bg-warm-dark text-surface-low shadow-[0_16px_36px_rgba(57,56,48,0.14)]"
                                >
                                    <Archive size={18} />
                                </Link>

                                <nav className="flex flex-1 flex-col items-center gap-3">
                                    {items.map((item) => {
                                        const Icon = item.icon;

                                        return (
                                            <Link
                                                key={item.key}
                                                href={item.href}
                                                title={item.label}
                                                className={`flex h-12 w-12 items-center justify-center rounded-none border transition-all ${
                                                    item.active
                                                        ? 'border-olive/25 bg-olive/10 text-olive shadow-sm'
                                                        : 'border-transparent bg-transparent text-warm-dark/75 hover:border-warm-border/30 hover:bg-surface-mid/45'
                                                }`}
                                            >
                                                <Icon size={17} />
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>
                        ) : (
                            <SidebarContent items={items} plan={auth.plan} email={auth.user?.email || undefined} />
                        )}
                    </div>
                </aside>

                <div className="min-w-0">
                    <div className="sticky top-0 z-40 border-b border-warm-border/20 bg-white/80 backdrop-blur-sm lg:hidden">
                        <div className="flex items-center justify-between px-4 py-3">
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="inline-flex items-center gap-2 rounded-none border border-warm-border/30 bg-white/90 px-3 py-2 text-sm text-warm-dark transition-colors hover:bg-surface-mid/60"
                            >
                                <Menu size={16} />
                                Menu
                            </button>
                            <div className="flex items-center gap-3">
                                <NotificationCenter />
                                <div className="text-right">
                                    <p className="font-serif text-base text-warm-dark">ULUMAE</p>
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-warm-outline">
                                        {planLabel(auth.plan)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="sticky top-0 z-40 hidden border-b border-warm-border/20 bg-white/78 backdrop-blur-sm lg:block">
                        <div className="flex items-center justify-end px-8 py-3">
                            <NotificationCenter />
                        </div>
                    </div>

                    <main>{children}</main>
                </div>
            </div>

            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        aria-label="Close navigation"
                        className="absolute inset-0 bg-warm-dark/55 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    <div className="absolute inset-y-0 left-0 w-[88vw] max-w-sm overflow-y-auto border-r border-warm-border/30 bg-white/95 shadow-2xl backdrop-blur-sm">
                        <div className="flex items-center justify-end border-b border-warm-border/30 px-4 py-3">
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="rounded-none border border-warm-border/30 p-2 text-warm-dark transition-colors hover:bg-surface-mid/50"
                                aria-label="Close navigation"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <SidebarContent
                            items={items}
                            plan={auth.plan}
                            email={auth.user?.email || undefined}
                            onNavigate={() => setMobileOpen(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
