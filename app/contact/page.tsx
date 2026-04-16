import type { Metadata } from 'next';
import { Mail, Sparkles } from 'lucide-react';
import { ExperiencePage, ExperienceHero, ExperiencePanel, ExperienceCard } from '@/components/ui/experience';

export const metadata: Metadata = {
  title: 'Contact — ULUMAE',
  description:
    'Get in touch with the ULUMAE team. First conversation offered, discreet and without obligation.',
};

export default function ContactPage() {
  return (
    <ExperiencePage>
      <ExperienceHero
        kicker={<span className="experience-kicker">Contact</span>}
        title={
          <>
            We are here
            <br />
            <span className="italic text-olive">for you</span>
          </>
        }
        subtitle="First conversation offered, discreet and without obligation. Whether you are exploring plans or need careful guidance, a real person will reply."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExperiencePanel>
          <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Reach Us</p>
          <h2 className="mt-3 font-serif text-3xl text-warm-dark">Direct email</h2>
          <a
            href="mailto:contact@ulumae.com"
            className="experience-link mt-6 inline-flex items-center gap-3 text-xl font-medium"
          >
            <Mail size={20} />
            contact@ulumae.com
          </a>
          <p className="mt-5 text-sm leading-relaxed text-warm-muted">
            We typically respond within 24 hours. For sensitive matters, we can move to more secure communication on request.
          </p>
        </ExperiencePanel>

        <ExperiencePanel>
          <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">What To Expect</p>
          <h2 className="mt-3 font-serif text-3xl text-warm-dark">A calm first conversation</h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-warm-muted">
            <p>Ask about plans, preservation details, or how to structure a memorial without pressure.</p>
            <p>Discuss Concierge support, family coordination, or anything that feels emotionally or practically difficult.</p>
            <p>No automation loop. No rushed sales script. Just a careful reply from our team.</p>
          </div>
        </ExperiencePanel>
      </div>

      <div className="experience-section">
        <ExperienceCard className="text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-none bg-olive/10">
            <Sparkles size={24} className="text-olive" />
          </div>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-warm-muted">
            ULUMAE is built on the principle that preserving memory is an act of respect. Every interaction with our team is meant to reflect that.
          </p>
        </ExperienceCard>
      </div>
    </ExperiencePage>
  );
}
