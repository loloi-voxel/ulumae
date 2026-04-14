import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact — ULUMAE',
  description:
    'Get in touch with the ULUMAE team. First conversation offered, discreet and without obligation.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface-low text-warm-dark font-serif">
      {/* Header */}
      <section className="py-20 md:py-28 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-sans tracking-widest uppercase text-warm-outline border border-warm-border/30 rounded-full px-4 py-1.5 mb-8 bg-surface-mid/50">
            Contact
          </span>
          <h1 className="text-4xl md:text-5xl font-light leading-tight mb-6">
            We are here for you.
          </h1>
          <p className="text-lg text-warm-muted font-sans leading-relaxed max-w-xl mx-auto">
            First conversation offered, discreet and without obligation.
          </p>
        </div>
      </section>

      <div className="border-t border-warm-border/30" />

      {/* Contact Details */}
      <section className="py-20 md:py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-12">
            {/* Email */}
            <div>
              <h2 className="text-xs font-sans uppercase tracking-widest text-warm-outline mb-3">
                Email
              </h2>
              <a
                href="mailto:contact@ulumae.com"
                className="text-lg text-warm-dark underline underline-offset-4 hover:text-olive transition-colors font-sans"
              >
                contact@ulumae.com
              </a>
              <p className="text-sm text-warm-muted font-sans mt-3 leading-relaxed">
                We typically respond within 24 hours. For sensitive matters,
                we offer encrypted communication upon request.
              </p>
            </div>

            {/* Response */}
            <div>
              <h2 className="text-xs font-sans uppercase tracking-widest text-warm-outline mb-3">
                What to expect
              </h2>
              <p className="text-sm text-warm-muted font-sans leading-relaxed">
                Whether you have questions about our plans, need guidance on
building a memorial, or are considering the Concierge service —
                we are here to help with care and discretion.
              </p>
              <p className="text-sm text-warm-muted font-sans leading-relaxed mt-3">
                No sales pressure. No automated responses.
                A real person, taking the time to understand your needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-warm-border/30" />

      {/* Trust note */}
      <section className="py-16 md:py-20 px-6 bg-surface-mid/30">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-warm-muted font-sans leading-relaxed">
            ULUMAE is built on the principle that preserving memory is an act of respect.
            Every interaction with our team reflects that commitment.
          </p>
        </div>
      </section>
    </div>
  );
}
