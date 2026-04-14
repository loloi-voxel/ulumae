'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PLAN_PRICES_USD } from '@/lib/constants';

const UPGRADE_DIFFERENCE = `$${(PLAN_PRICES_USD.family - PLAN_PRICES_USD.personal).toLocaleString()}`;

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-warm-border/30 last:border-none">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="font-semibold text-warm-dark pr-4">{question}</span>
        <ChevronDown
          size={18}
          className={`text-warm-outline flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="text-sm text-warm-muted leading-relaxed pb-5 -mt-1">{answer}</p>
      )}
    </div>
  );
}

const faqItems: { question: string; answer: string }[] = [
  {
    question: 'What happens if ULUMAE shuts down?',
    answer:
      'Your memorial lives on Arweave, not on our servers. Even if ULUMAE ceased to exist, your data remains permanently accessible through any Arweave gateway. Additionally, Family plan users have local copies via our Anchor technology.',
  },
  {
    question: 'Why a one-time payment instead of a subscription?',
    answer:
      'Because subscriptions can be forgotten, canceled, or interrupted. Memory should not depend on a monthly charge. The one-time payment funds a 200-year storage endowment on Arweave.',
  },
  {
    question: 'Can I upgrade from Personal to Family later?',
    answer:
      'Yes. You only pay the difference (${UPGRADE_DIFFERENCE}). Your existing memorial is automatically included in the family archive with no data loss.',
  },
  {
    question: 'What is Arweave?',
    answer:
      'Arweave is a decentralized storage network designed for permanent data preservation. Unlike cloud storage, data on Arweave is funded by a one-time endowment that pays for storage in perpetuity, replicated across 800+ independent nodes worldwide.',
  },
  {
    question: 'Is my data private?',
    answer:
      'All memorial data is encrypted with AES-256-GCM before leaving your browser. Only you and your designated successors hold the keys. Not even ULUMAE can read your content.',
  },
  {
    question: 'Can I edit after preservation?',
    answer:
      'Yes, you can update your memorial at any time. Each update creates a new version on Arweave. Previous versions remain accessible for the complete historical record.',
  },
  {
    question: 'Does the price include storage?',
    answer:
      'Yes. Unlimited storage for the lifetime of the archive. No additional fees, no annual charges, no export fees.',
  },
  {
    question: 'What file formats are supported?',
    answer:
      'ULUMAE supports photos (JPEG, PNG, HEIC, WebP), videos (MP4, MOV, WebM), audio recordings, and text. All media is exportable in standard formats at any time.',
  },
  {
    question: 'How does succession planning work?',
    answer:
      'You designate one or more successors who will inherit access to the memorial. A dead man\'s switch can be configured to automatically transfer access after a period of inactivity, ensuring continuity across generations.',
  },
  {
    question: 'Can multiple family members contribute?',
    answer:
      'Yes. Through the witness invitation system, family members and friends can contribute their own memories, photos, and stories. Each contribution goes through an approval process before being added.',
  },
  {
    question: 'Are there hidden fees?',
    answer:
      'No. The displayed price is final. No storage fees. No annual fees. No export fees. One payment, permanent preservation.',
  },
  {
question: 'What is the Concierge service?',
    answer:
'Our Concierge service is a fully managed, human-led service. We conduct interviews, digitize documents, and professionally write the biography. The memorial is delivered within 60 days, with two revision cycles included.',
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-surface-low text-warm-dark font-serif">
      {/* Header */}
      <section className="py-20 md:py-28 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-sans tracking-widest uppercase text-warm-outline border border-warm-border/30 rounded-full px-4 py-1.5 mb-8 bg-surface-mid/50">
            Support
          </span>
          <h1 className="text-4xl md:text-5xl font-light leading-tight mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-warm-muted font-sans leading-relaxed max-w-xl mx-auto">
            Everything you need to know about preserving a life with ULUMAE.
          </p>
        </div>
      </section>

      <div className="border-t border-warm-border/30" />

      {/* FAQ List */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-2xl mx-auto">
          {faqItems.map((item) => (
            <FAQItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      <div className="border-t border-warm-border/30" />

      {/* Contact CTA */}
      <section className="py-16 md:py-20 px-6 text-center bg-surface-mid/30">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-light mb-4">Still have questions?</h2>
          <p className="text-warm-muted font-sans mb-6 leading-relaxed">
            We are available for a first conversation — discreet and without obligation.
          </p>
          <a
            href="mailto:contact@ulumae.com"
            className="inline-flex items-center gap-2 px-8 py-3 text-sm font-sans font-medium text-warm-dark border border-warm-border/30 rounded-lg hover:bg-surface-mid transition-all"
          >
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
}
