'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PLAN_PRICES_USD } from '@/lib/constants';
import { ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';

const UPGRADE_DIFFERENCE = `$${(PLAN_PRICES_USD.family - PLAN_PRICES_USD.personal).toLocaleString()}`;

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-warm-border/30 pb-4 last:border-none last:pb-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 py-2 text-left">
        <span className="font-medium text-warm-dark">{question}</span>
        <ChevronDown size={18} className={`flex-shrink-0 text-warm-outline transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <p className="pt-3 text-sm leading-relaxed text-warm-muted">{answer}</p> : null}
    </div>
  );
}

const faqItems = [
  {
    question: 'What happens if ULUMAE shuts down?',
    answer:
      'Your memorial lives on Arweave, not on our servers. Even if ULUMAE ceased to exist, your data remains permanently accessible through independent gateways.',
  },
  {
    question: 'Why a one-time payment instead of a subscription?',
    answer:
      'Subscriptions can be forgotten or interrupted. The one-time payment funds the long-term preservation layer instead.',
  },
  {
    question: 'Can I upgrade from Personal to Family later?',
    answer: `Yes. You only pay the difference (${UPGRADE_DIFFERENCE}). Your existing memorial is automatically included in the family archive with no data loss.`,
  },
  {
    question: 'Is my data private?',
    answer:
      'Memorial data is encrypted before it leaves your browser, and access stays tied to you and the successors or members you choose.',
  },
  {
    question: 'Can multiple family members contribute?',
    answer:
      'Yes. Witnesses and invited family members can contribute memories and photos, with review controls depending on the archive role and plan.',
  },
  {
    question: 'Are there hidden fees?',
    answer:
      'No. The displayed price is final. No storage fees, annual fees, or export fees.',
  },
];

export default function FAQPage() {
  return (
    <ExperiencePage>
      <ExperienceHero
        kicker={<span className="experience-kicker">Support</span>}
        title={
          <>
            Frequently
            <br />
            <span className="italic text-olive">asked</span>
          </>
        }
        subtitle="Everything you need to know about preserving a life with ULUMAE."
      />

      <ExperiencePanel className="mx-auto max-w-3xl">
        <div className="space-y-5">
          {faqItems.map((item) => (
            <FAQItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </ExperiencePanel>
    </ExperiencePage>
  );
}
