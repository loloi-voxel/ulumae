'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function ConciergeConfirmationPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-olive/10 via-surface-low to-warm-muted/10">
            <div className="border-b border-warm-border/30 bg-white/80 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <Link
                        href="/choice-pricing"
                        className="inline-flex items-center gap-2 text-warm-dark/60 hover:text-warm-dark transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span>Back to plans</span>
                    </Link>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-16">
                <div className="bg-white rounded-2xl border border-warm-border/30 shadow-sm p-10 text-center">
                    <div className="w-16 h-16 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles size={28} className="text-olive" />
                    </div>

                    <h1 className="font-serif text-4xl text-warm-dark mb-4">Concierge starts with a consultation</h1>
                    <p className="text-lg text-warm-dark/60 leading-relaxed mb-8">
                        Concierge preservation is arranged with our team, not through self-serve checkout.
                        We review the memorial, confirm scope, and then guide you through the next step personally.
                    </p>

                    <div className="bg-surface-low rounded-xl border border-warm-border/20 p-6 mb-8 text-left">
                        <p className="text-sm text-warm-dark/70 leading-relaxed">
                            This keeps the process clear and prevents a payment from being taken before the archive,
                            timing, and preservation needs have been confirmed with you.
                        </p>
                    </div>

                    <Link
                        href="/concierge/request"
                        className="inline-flex items-center justify-center px-8 py-4 glass-btn-dark rounded-xl font-medium"
                    >
                        Continue to Concierge Request
                    </Link>
                </div>
            </div>
        </div>
    );
}
