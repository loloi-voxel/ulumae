'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';

export default function ConciergeConfirmationPage() {
    return (
        <ExperiencePage>
            <Link href="/choice-pricing" className="experience-button experience-button-secondary mb-10 w-fit text-[11px] tracking-[0.22em]">
                <ArrowLeft size={14} />
                Back to plans
            </Link>

            <ExperienceHero
                kicker={<span className="experience-kicker">Concierge</span>}
                title={
                    <>
                        Concierge begins
                        <br />
                        <span className="italic text-olive">with a consultation</span>
                    </>
                }
                subtitle="Concierge preservation is arranged with our team, not through self-serve checkout. We confirm scope, timing, and needs before anything moves forward."
            />

            <ExperiencePanel className="mx-auto max-w-3xl text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-none bg-olive/10">
                    <Sparkles size={28} className="text-olive" />
                </div>
                <p className="mx-auto max-w-2xl text-sm leading-relaxed text-warm-muted">
                    This keeps the process calm and prevents a payment from being taken before the archive, timeline, and preservation requirements have been carefully reviewed with you.
                </p>
                <Link href="/concierge/request" className="experience-button experience-button-primary mt-8">
                    Continue to Concierge Request
                </Link>
            </ExperiencePanel>
        </ExperiencePage>
    );
}
