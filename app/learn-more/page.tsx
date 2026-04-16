import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Globe, Lock, Shield } from 'lucide-react';
import { ExperiencePage, ExperienceHero, ExperienceCard, ExperiencePanel } from '@/components/ui/experience';

export const metadata: Metadata = {
  title: 'Learn More — ULUMAE',
  description:
    'Discover why ULUMAE exists, the technology behind permanent preservation, and our commitment to future generations.',
};

const technology = [
  {
    icon: Globe,
    title: 'Arweave Network',
    description:
      'A decentralized storage protocol funded by a long-term endowment model, replicated across independent nodes worldwide.',
  },
  {
    icon: Shield,
    title: 'AES-256 Encryption',
    description:
      'Memorial data is encrypted before it leaves your browser so access stays tied to you and your designated successors.',
  },
  {
    icon: Lock,
    title: 'Multi-Gateway Access',
    description:
      'Archives remain reachable across multiple gateways, reducing dependence on any single provider or endpoint.',
  },
];

export default function LearnMorePage() {
  return (
    <ExperiencePage>
      <ExperienceHero
        kicker={<span className="experience-kicker">Learn More</span>}
        title={
          <>
            Why ULUMAE
            <br />
            <span className="italic text-olive">exists</span>
          </>
        }
        subtitle="A private, structured space to preserve the essence of a life — backed by technology designed to last for future generations."
      />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ExperiencePanel>
          <h2 className="font-serif text-3xl text-warm-dark">Why permanence matters</h2>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-warm-muted">
            <p>Most digital memories disappear within a generation because no system was built to keep them with care.</p>
            <p>ULUMAE exists to provide a respectful process for documenting a life, then pairing that work with durable preservation technology.</p>
          </div>
        </ExperiencePanel>

        <div className="grid gap-4 md:grid-cols-3">
          {technology.map(({ icon: Icon, title, description }) => (
            <ExperienceCard key={title}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-mid text-olive">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 font-serif text-2xl text-warm-dark">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-muted">{description}</p>
            </ExperienceCard>
          ))}
        </div>
      </div>

      <div className="experience-section">
        <ExperiencePanel className="text-center">
          <h2 className="font-serif text-3xl text-warm-dark">Start preserving what matters</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-warm-muted">
            Free to begin. Pay only when you are ready to preserve permanently.
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
