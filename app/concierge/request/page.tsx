'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Hammer, Mail } from 'lucide-react';
import { ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';

export default function ConciergeRequestPage() {
    const [email, setEmail] = useState('');
    const [notified, setNotified] = useState(false);

    const handleNotify = (e: React.FormEvent) => {
        e.preventDefault();
        setNotified(true);
    };

    return (
        <ExperiencePage>
            <Link href="/choice-pricing" className="experience-button experience-button-secondary mb-10 w-fit text-[11px] tracking-[0.22em]">
                <ArrowLeft size={14} />
                Back to options
            </Link>

            <ExperienceHero
                kicker={<span className="experience-kicker">Concierge Service</span>}
                title={
                    <>
                        A white-glove
                        <br />
                        <span className="italic text-olive">experience</span>
                    </>
                }
                subtitle="We are currently refining the Concierge offering. You can join the priority list now and we’ll reach out as soon as the service reopens."
            />

            <div className="grid gap-6 lg:grid-cols-[0.92fr_0.78fr]">
                <ExperiencePanel>
                    <div className="mb-6 flex items-center gap-3 text-warm-muted">
                        <Hammer size={20} />
                        <span className="text-sm font-medium uppercase tracking-[0.16em]">Currently under construction</span>
                    </div>
                    <p className="text-sm leading-relaxed text-warm-muted">
                        Due to demand and active improvements, we are not accepting new Concierge projects at this exact moment. Personal and Family archives remain available immediately through self-service tools.
                    </p>
                </ExperiencePanel>

                <ExperiencePanel>
                    {!notified ? (
                        <form onSubmit={handleNotify}>
                            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-warm-outline">
                                Notify me when Concierge reopens
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="experience-input w-full"
                            />
                            <button type="submit" className="experience-button experience-button-primary mt-5 w-full justify-center">
                                Notify Me
                            </button>
                        </form>
                    ) : (
                        <div className="rounded-[1.4rem] border border-olive/20 bg-olive/10 px-5 py-5 text-sm text-olive">
                            <div className="flex items-center gap-2">
                                <Mail size={18} />
                                Thank you. We&apos;ve added you to the priority list.
                            </div>
                        </div>
                    )}
                </ExperiencePanel>
            </div>
        </ExperiencePage>
    );
}
