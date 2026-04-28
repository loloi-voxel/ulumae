'use client';

import { useState } from 'react';
import { FileEdit, User, Users, Sparkles, Check, ArrowLeft, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPlanDashboardPath, useAuth } from '@/components/providers/AuthProvider';
import { DRAFT_MEDIA_LIMIT, DRAFT_VIDEO_LIMIT, PLAN_PRICES_USD } from '@/lib/constants';

const features = [
    { label: 'Archive builder', draft: 'Included', personal: 'Included', family: 'Included', concierge: 'Included' },
    { label: 'Permanent preservation', draft: '--', personal: 'Included', family: 'Included', concierge: 'Included' },
    { label: 'Preserved archives', draft: '--', personal: '1', family: 'Unlimited', concierge: 'Custom' },
    { label: 'Photo gallery', draft: `Up to ${DRAFT_MEDIA_LIMIT}`, personal: 'Included', family: 'Included', concierge: 'Handled for you' },
    { label: 'Interactive photo stories', draft: `Up to ${DRAFT_MEDIA_LIMIT}`, personal: 'Included', family: 'Included', concierge: 'Handled for you' },
    { label: 'Video memories', draft: `Up to ${DRAFT_VIDEO_LIMIT}`, personal: 'Included', family: 'Included', concierge: 'Handled for you' },
    { label: 'Witness invitations', draft: '--', personal: 'Included', family: 'Included', concierge: 'Included' },
    { label: 'Reader access', draft: '--', personal: 'Included', family: 'Included', concierge: 'Included' },
    { label: 'Preservation dashboard', draft: '--', personal: 'Included', family: 'Included', concierge: 'Included' },
    { label: 'Archive export', draft: '--', personal: 'Included', family: 'Included', concierge: 'Included' },
    { label: 'Successor designation', draft: '--', personal: 'Included', family: 'Included', concierge: 'Included' },
    { label: 'Linked family archives', draft: '--', personal: '--', family: 'Included', concierge: 'Included' },
    { label: 'Family tree', draft: '--', personal: '--', family: 'Included', concierge: 'Included' },
    { label: 'Co-guardian steward role', draft: '--', personal: '--', family: 'Included', concierge: 'Included' },
    { label: 'Concierge intake', draft: '--', personal: '--', family: '--', concierge: 'Request access' },
];

const faqs = [
    {
        question: 'Why a one-time payment instead of a subscription?',
        answer: 'Because subscriptions can be forgotten, canceled, or interrupted. Memory should not depend on a monthly charge.',
    },
    {
        question: 'Does the price include storage?',
        answer: 'Yes. Unlimited storage for the lifetime of the archive. No additional fees.',
    },
    {
        question: 'What happens if ULUMAE shuts down?',
        answer: 'Your data is exportable at any time. In addition, an escrow arrangement guarantees continuity.',
    },
    {
        question: 'Can I upgrade from Personal to Family later?',
        answer: `Yes. You only pay the difference ($${(PLAN_PRICES_USD.family - PLAN_PRICES_USD.personal).toLocaleString()}). Your existing archive is automatically integrated.`,
    },
    {
        question: 'Are there hidden fees?',
        answer: 'No. The displayed price is final. No storage fees. No annual fees. No export fees.',
    },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-warm-border/30 pb-4">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center font-semibold text-left cursor-pointer text-warm-dark"
            >
                {question}
                <ChevronDown
                    size={20}
                    className={`text-warm-outline transition-transform flex-shrink-0 ml-4 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <p className="mt-4 text-sm text-warm-muted leading-relaxed">
                    {answer}
                </p>
            )}
        </div>
    );
}

export default function ChoicePricingPage() {
    const router = useRouter();
    const auth = useAuth();
    const userId = auth.user?.id || null;
    const ready = !auth.loading;

    const hasPaidPlan = auth.hasPaid;
    const currentDashboardPath = userId ? getPlanDashboardPath(auth.plan, userId) : '/choice-pricing';
    const activePlanLabel =
        auth.plan === 'concierge'
            ? 'Concierge'
            : auth.plan.charAt(0).toUpperCase() + auth.plan.slice(1);

    const requireAuth = (nextPath: string): boolean => {
        if (userId) return true;
        router.push(`/signup?next=${encodeURIComponent(nextPath)}`);
        return false;
    };

    const handleDraftStart = () => {
        if (!requireAuth('/choice-pricing')) return;
        router.replace(`/dashboard/draft/${userId}`);
    };

    const handleModeSelection = (mode: 'personal' | 'family') => {
        if (hasPaidPlan && userId) {
            const alreadyInFamilyWorkspace = auth.plan === 'family' || auth.plan === 'concierge';
            if ((mode === 'personal' && auth.plan === 'personal') || alreadyInFamilyWorkspace) {
                router.replace(currentDashboardPath);
                return;
            }
        }
        if (hasPaidPlan && auth.plan === mode) {
            router.replace(currentDashboardPath);
            return;
        }
        const confirmPath = mode === 'personal' ? '/personal-confirmation' : '/family-confirmation';
        if (!requireAuth(confirmPath)) return;
        router.replace(confirmPath);
    };

    const handleConciergeSelection = () => {
        if (auth.plan === 'concierge' && userId) {
            router.replace(currentDashboardPath);
            return;
        }
        router.push('/concierge/request');
    };

    return (
        <main className="pt-16 pb-24 px-8 max-w-7xl mx-auto">
            <header className="mb-16">
                <Link
                    href="/"
                    className="inline-flex items-center px-4 py-2 bg-surface-mid/50 border border-warm-border/20 rounded-full text-xs uppercase tracking-widest text-warm-muted hover:text-warm-dark transition-all mb-8 group hover-grow"
                >
                    <ArrowLeft
                        size={14}
                        className="mr-2 group-hover:-translate-x-1 transition-transform"
                    />
                    Back to Home
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-6xl md:text-8xl font-serif text-warm-dark leading-none mb-4">
                            Choose Your <br />
                            <span className="italic text-olive">Experience</span>
                        </h1>
                        <p className="max-w-xl text-lg text-warm-muted leading-relaxed">
                            Each path offers a different way to preserve your legacy.
                            A single payment for permanent memory.
                        </p>
                    </div>

                    {hasPaidPlan && auth.plan !== 'none' && (
                        <div className="bg-surface-high p-6 flex items-start gap-4 border-l-4 border-warm-brown max-w-sm">
                            <div>
                                <p className="text-xs uppercase tracking-widest text-warm-brown font-bold mb-1">
                                    Current Plan
                                </p>
                                <p className="text-sm text-warm-dark">
                                    You have an active <strong>{activePlanLabel}</strong> plan.{' '}
                                    {auth.plan === 'personal'
                                        ? 'Secure their legacy for future generations by expanding to Family.'
                                        : auth.plan === 'family'
                                            ? 'Ensure every memory endures with our fully managed Concierge preservation.'
                                            : 'You are on the highest level of preservation.'}
                                </p>
                                <button
                                    onClick={() => router.replace(currentDashboardPath)}
                                    className="mt-3 px-4 py-2 glass-btn-primary text-xs uppercase tracking-widest hover-grow"
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-32 gap-8">
                <button
                    onClick={handleDraftStart}
                    disabled={!ready}
                    className="bg-white p-8 flex flex-col border border-warm-border/30 hover:bg-surface-low transition-colors text-left disabled:opacity-50 group"
                >
                    <div className="mb-12">
                        <div className="w-14 h-14 bg-gradient-to-br from-warm-dark/80 to-warm-dark/60 flex items-center justify-center mb-4">
                            <FileEdit size={28} className="text-warm-bg" />
                        </div>
                        <h3 className="font-serif text-3xl text-warm-dark mb-1">Private Preview</h3>
                        <p className="text-xs uppercase tracking-widest text-warm-outline">
                            Exclusive Start
                        </p>
                    </div>
                    <div className="mb-12">
                        <span className="font-serif text-5xl text-warm-dark">$0</span>
                        <span className="text-warm-outline ml-2">/ forever</span>
                    </div>
                    <ul className="space-y-4 mb-16 flex-grow text-sm text-warm-muted">
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Full archive builder access
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Save your progress anytime
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Private live preview with watermark
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Preserve as Personal whenever you are ready
                        </li>
                    </ul>
                    <div className="w-full py-4 glass-btn border border-warm-border/30 text-warm-dark text-xs uppercase tracking-widest text-center hover-grow">
                        Start for Free
                    </div>
                </button>

                <button
                    onClick={() => handleModeSelection('personal')}
                    disabled={!ready}
                    className="bg-surface-mid p-8 flex flex-col border border-warm-border/30 hover:bg-surface-high transition-colors text-left disabled:opacity-50 relative group"
                >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-plum text-white px-3 py-1 text-[10px] uppercase tracking-widest whitespace-nowrap">
                        Most Chosen
                    </div>
                    <div className="mb-12">
                        <div className="w-14 h-14 bg-gradient-to-br from-olive to-olive/80 flex items-center justify-center mb-4">
                            <User size={28} className="text-warm-bg" />
                        </div>
                        <h3 className="font-serif text-3xl text-warm-dark mb-1">Personal</h3>
                        <p className="text-xs uppercase tracking-widest text-warm-outline">
                            Dedicated Archive
                        </p>
                    </div>
                    <div className="mb-12">
                        <span className="font-serif text-5xl text-warm-dark">${PLAN_PRICES_USD.personal.toLocaleString()}</span>
                        <span className="text-warm-outline ml-2">/ one time</span>
                    </div>
                    <ul className="space-y-4 mb-16 flex-grow text-sm text-warm-muted">
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            One complete preserved archive
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Structured biography, images, stories, and video memories
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Witness invitations and reader access
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Preservation dashboard and archive export
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                            Successor designation
                        </li>
                    </ul>
                    <div className="w-full py-4 glass-btn-primary text-xs uppercase tracking-widest text-center hover-grow">
                        Select Plan
                    </div>
                </button>

                <button
                    onClick={() => handleModeSelection('family')}
                    disabled={!ready}
                    className="bg-surface-low p-8 flex flex-col border border-warm-border/30 hover:bg-surface-mid transition-colors text-left disabled:opacity-50 group"
                >
                    <div className="mb-12">
                        <div className="w-14 h-14 bg-gradient-to-br from-warm-brown to-warm-brown/80 flex items-center justify-center mb-4">
                            <Users size={28} className="text-warm-bg" />
                        </div>
                        <h3 className="font-serif text-3xl text-warm-dark mb-1">Family</h3>
                        <p className="text-xs uppercase tracking-widest text-warm-outline">
                            Shared Heritage
                        </p>
                    </div>
                    <div className="mb-12">
                        <span className="font-serif text-5xl text-warm-dark">${PLAN_PRICES_USD.family.toLocaleString()}</span>
                        <span className="text-warm-outline ml-2">/ one time</span>
                    </div>
                    <ul className="space-y-4 mb-16 flex-grow text-sm text-warm-muted">
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-warm-brown mt-0.5 flex-shrink-0" />
                            Unlimited preserved archives
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-warm-brown mt-0.5 flex-shrink-0" />
                            Everything in Personal
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-warm-brown mt-0.5 flex-shrink-0" />
                            Linked archives and family tree
                        </li>
                        <li className="flex items-start gap-2">
                            <Check size={16} className="text-warm-brown mt-0.5 flex-shrink-0" />
                            Co-guardian stewardship across the family space
                        </li>
                    </ul>
                    <div className="w-full py-4 glass-btn-dark text-xs uppercase tracking-widest text-center hover-grow">
                        Select Plan
                    </div>
                </button>

                <button
                    onClick={handleConciergeSelection}
                    className="bg-surface-highest p-8 flex flex-col border border-warm-border/30 hover:bg-surface-high transition-colors text-left relative group"
                >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-warm-dark text-white px-3 py-1 text-[10px] uppercase tracking-widest whitespace-nowrap">
                        Full Preservation
                    </div>
                    <div className="mb-12">
                        <div className="w-14 h-14 bg-gradient-to-br from-olive via-warm-brown to-olive/80 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Sparkles size={28} className="text-warm-bg" />
                        </div>
                        <h3 className="font-serif text-3xl text-warm-dark mb-1">Concierge</h3>
                        <p className="text-xs uppercase tracking-widest text-warm-outline">
                            Estate Preservation
                        </p>
                    </div>
                    <div className="mb-12">
                        <span className="font-serif text-5xl text-warm-dark">${PLAN_PRICES_USD.concierge.toLocaleString()}</span>
                        <span className="text-warm-outline ml-2">/ per memorial</span>
                    </div>
                    <div className="mb-16 flex-grow text-sm text-warm-muted">
                        <p className="mb-4 italic leading-relaxed">
                            A human-led preservation service. The current intake is handled by request while we refine the offering.
                        </p>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-2">
                                <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                                Everything in Family
                            </li>
                            <li className="flex items-start gap-2">
                                <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                                White-glove onboarding
                            </li>
                            <li className="flex items-start gap-2">
                                <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                                Human curation and preservation support
                            </li>
                            <li className="flex items-start gap-2">
                                <Check size={16} className="text-olive mt-0.5 flex-shrink-0" />
                                Request-based intake
                            </li>
                        </ul>
                    </div>
                    <div className="w-full py-4 glass-btn-primary text-xs uppercase tracking-widest text-center hover-grow">
                        Enquire Now
                    </div>
                </button>
            </section>

            <section className="mb-32">
                <h2 className="font-serif text-4xl text-warm-dark mb-12 text-center">
                    Compare Plans
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="uppercase tracking-widest text-[10px] text-warm-outline border-b border-warm-border/20">
                                <th className="py-6 px-4">Feature</th>
                                <th className="py-6 px-4">Private Preview</th>
                                <th className="py-6 px-4">Personal</th>
                                <th className="py-6 px-4">Family</th>
                                <th className="py-6 px-4">Concierge</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-warm-muted">
                            {features.map((f, i) => (
                                <tr
                                    key={f.label}
                                    className={`border-b border-warm-border/10 ${i % 2 === 0 ? 'bg-surface-low/30' : ''}`}
                                >
                                    <td className="py-6 px-4 font-semibold text-warm-dark">{f.label}</td>
                                    <td className="py-6 px-4">{f.draft}</td>
                                    <td className="py-6 px-4">{f.personal}</td>
                                    <td className="py-6 px-4">{f.family}</td>
                                    <td className="py-6 px-4">{f.concierge}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                <div>
                    <h3 className="font-serif text-3xl text-warm-dark mb-8">Our Guarantee</h3>
                    <div className="bg-surface-mid p-10 border-t-8 border-olive relative overflow-hidden">
                        <p className="text-lg text-warm-dark mb-6 italic leading-relaxed">
                            &ldquo;Independent archive export + 30-day satisfaction guarantee.
                            If you are not satisfied, contact us within 30 days of payment
                            for a full refund, as long as the archive has not been published.
                            Your private preview remains accessible.&rdquo;
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-warm-outline flex items-center justify-center">
                                <Sparkles size={20} className="text-warm-bg" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-widest font-bold text-warm-dark">
                                    ULUMAE
                                </p>
                                <p className="text-xs text-warm-outline">
                                    Permanent Digital Memorials
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="font-serif text-3xl text-warm-dark mb-8">Frequently Asked</h3>
                    <div className="space-y-6">
                        {faqs.map((faq) => (
                            <FAQItem
                                key={faq.question}
                                question={faq.question}
                                answer={faq.answer}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <div className="mt-16 text-center">
                <p className="text-sm text-warm-outline">
                    Not sure which to choose? <strong>Private Preview</strong> is free to start and can move into Personal at any time.
                    Personal and Family are self-service tools. Concierge currently opens through a request-led intake.
                </p>
            </div>
        </main>
    );
}
