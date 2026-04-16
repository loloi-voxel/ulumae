import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ExperiencePage, ExperienceHero, ExperienceCard, ExperiencePanel } from '@/components/ui/experience';

export const metadata: Metadata = {
  title: 'How It Works — ULUMAE',
  description:
    'Learn how ULUMAE preserves life stories permanently on Arweave in four simple steps.',
};

const steps = [
  {
    step: '01',
    title: 'Build',
    description:
      'Use our structured editor to document a life — biography, photos, videos, stories, and values. Save whenever you need. Memory does not require urgency.',
  },
  {
    step: '02',
    title: 'Review',
    description:
      'Preview the memorial, invite family members or witnesses, and enrich the archive with shared memories and verification.',
  },
  {
    step: '03',
    title: 'Preserve',
    description:
      'A single payment permanently stores the memorial on Arweave through an endowment-backed preservation layer.',
  },
  {
    step: '04',
    title: 'Share',
    description:
      'Open the archive to the people who matter, anchor access over time, and designate successors for continuity.',
  },
];

export default function HowItWorksPage() {
  return (
    <ExperiencePage>
      <ExperienceHero
        kicker={<span className="experience-kicker">How It Works</span>}
        title={
          <>
            Four steps to
            <br />
            <span className="italic text-olive">permanence</span>
          </>
        }
        subtitle="Creating a lasting memorial is a deliberate, structured process. Every step is designed to honour the depth of a life."
      />

      <div className="grid gap-5">
        {steps.map((item) => (
          <ExperienceCard key={item.step} className="grid gap-6 md:grid-cols-[140px_1fr] md:items-start">
            <span className="font-serif text-5xl text-warm-border/80">{item.step}</span>
            <div>
              <h2 className="font-serif text-3xl text-warm-dark">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-warm-muted">{item.description}</p>
            </div>
          </ExperienceCard>
        ))}
      </div>

      <div className="experience-section">
        <ExperiencePanel className="text-center">
          <h2 className="font-serif text-3xl text-warm-dark">Ready to begin?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-warm-muted">
            Start building a memorial at your own pace. Free to begin, with no obligation.
          </p>
          <Link href="/choice-pricing" className="experience-button experience-button-primary mt-8">
            Build a Memorial
            <ArrowRight size={16} />
          </Link>
        </ExperiencePanel>
      </div>
    </ExperiencePage>
  );
}
