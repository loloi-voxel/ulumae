import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, CreditCard, AlertCircle, Mail, FileText, DollarSign, Shield } from 'lucide-react';

export default function RefundPolicyPage() {
    const filePath = path.join(process.cwd(), 'content/legal/refund-policy.md');
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse sections for TOC
    const sections = content.split('## ').slice(1).map(section => {
        const lines = section.split('\\n');
        const title = lines[0].trim();
        return {
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50),
            title: title.replace(/\\*\\*/g, '').replace(/\\d+\\.\\d+\\s*/, '').trim()
        };
    });

    return (
        <div className="min-h-screen bg-surface-low">
            {/* Header */}
            <div className="border-b border-warm-border/30 bg-surface-low/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-warm-muted hover:text-warm-dark transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span>Back to Home</span>
                    </Link>
                </div>
            </div>

            {/* Hero Section */}
            <div className="bg-gradient-to-br from-plum/10 via-surface-low to-warm-brown/10 border-b border-warm-border/30">
                <div className="max-w-4xl mx-auto px-6 py-16 text-center">
                    <div className="mb-6 inline-flex items-center justify-center gap-2 border border-plum/30 bg-plum/20 px-4 py-2 text-plum rounded-none">
                        <RotateCcw size={16} />
                        <span className="text-sm font-medium">Fair & Transparent</span>
                    </div>
                    <h1 className="font-serif text-5xl md:text-6xl text-warm-dark mb-4">
                        Refund Policy
                    </h1>
                    <p className="text-lg text-warm-muted max-w-2xl mx-auto leading-relaxed">
                        Clear guidelines for cancellations and refunds. We balance fairness with the
                        permanent nature of memorialization services.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-warm-muted">
                        <span className="flex items-center gap-2">
                            <DollarSign size={16} className="text-plum" />
                            30-Day Cooling Off
                        </span>
                        <span className="flex items-center gap-2">
                            <Shield size={16} className="text-warm-brown" />
                            Family Dispute Protection
                        </span>
                        <span className="flex items-center gap-2">
                            <CreditCard size={16} className="text-plum" />
                            No Chargeback Fees
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Table of Contents */}
                    <div className="hidden lg:block lg:col-span-1">
                        <div className="sticky top-24 space-y-2">
                            <h3 className="font-serif text-lg text-warm-dark mb-4">Contents</h3>
                            <nav className="space-y-1">
                                {sections.map((section, idx) => (
                                    <a
                                        key={idx}
                                        href={`#${section.id}`}
                                        className="block text-sm text-warm-muted hover:text-plum hover:pl-2 transition-all py-1 border-l-2 border-transparent hover:border-plum"
                                    >
                                        {section.title}
                                    </a>
                                ))}
                            </nav>

                            <div className="mt-8 border border-warm-border/30 bg-gradient-to-br from-plum/5 to-warm-brown/5 p-4 rounded-none">
                                <h4 className="font-medium text-warm-dark mb-2 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-warm-brown" />
                                    Request Refund
                                </h4>
                                <p className="text-xs text-warm-muted mb-3">
                                    Contact our refunds team for cancellations.
                                </p>
                                <a
                                    href="mailto:refunds@ulumae.com"
                                    className="text-xs text-plum hover:text-plum/80 underline font-medium"
                                >
                                    refunds@ulumae.com
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="lg:col-span-3">
                        {/* Quick Reference Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                            <div className="border border-warm-border/30 bg-surface-low p-6 shadow-sm rounded-none">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-plum/10 p-2 rounded-none">
                                        <DollarSign className="text-plum" size={20} />
                                    </div>
                                    <h3 className="font-serif text-lg text-warm-dark">Personal Plan</h3>
                                </div>
                                <ul className="space-y-2 text-sm text-warm-muted">
                                    <li className="flex items-start gap-2">
                                        <span className="text-plum">✓</span>
                                        Full refund before publication
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-warm-brown">✗</span>
                                        No refund after publication
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-plum">30</span>
                                        Day cooling-off period
                                    </li>
                                </ul>
                            </div>

                            <div className="border border-warm-border/30 bg-surface-low p-6 shadow-sm rounded-none">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-warm-brown/10 p-2 rounded-none">
                                        <DollarSign className="text-warm-brown" size={20} />
                                    </div>
                                    <h3 className="font-serif text-lg text-warm-dark">Family Plan</h3>
                                </div>
                                <ul className="space-y-2 text-sm text-warm-muted">
                                    <li className="flex items-start gap-2">
                                        <span className="text-plum">100%</span>
                                        Before work starts
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-warm-brown">50%</span>
                                        During curation work
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-warm-brown">0%</span>
                                        After publication
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <article className="prose prose-lg max-w-none">
                            <div className="space-y-8">
                                {content.split('## ').slice(1).map((section, idx) => {
                                    const lines = section.split('\\n');
                                    const title = lines[0].replace(/\\*\\*/g, '').trim();
                                    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);

                                    return (
                                        <section key={idx} id={id} className="scroll-mt-24">
                                            <h2 className="font-serif text-2xl md:text-3xl text-warm-dark mb-4 flex items-start gap-3">
                                                <span className="text-warm-brown mt-1">§</span>
                                                {title.replace(/\\d+\\.\\d+\\s*/, '').replace(/\\d+\\.\\s*/, '')}
                                            </h2>
                                            <div className="text-warm-dark/80 leading-relaxed space-y-4 text-base md:text-lg">
                                                {lines.slice(1).join('\\n').split('\\n\\n').map((paragraph, pidx) => {
                                                    // Handle subheadings
                                                    if (paragraph.startsWith('### ')) {
                                                        const subheading = paragraph.replace('### ', '').replace(/\\*\\*/g, '');
                                                        return (
                                                            <h3 key={pidx} className="font-serif text-xl text-warm-dark mt-6 mb-3">
                                                                {subheading}
                                                            </h3>
                                                        );
                                                    }

                                                    // Handle bullet points
                                                    if (paragraph.trim().startsWith('-') || paragraph.trim().startsWith('*')) {
                                                        const items = paragraph.split('\\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'));
                                                        return (
                                                            <ul key={pidx} className="space-y-2 my-4">
                                                                {items.map((item, iidx) => (
                                                                    <li key={iidx} className="flex items-start gap-3 text-warm-dark/80">
                                                                        <span className="text-olive mt-1.5">•</span>
                                                                        <span dangerouslySetInnerHTML={{
                                                                            __html: item.replace(/^[-\\*]\\s*/, '').replace(/\\*\\*(.+?)\\*\\*/g, '<strong class="text-warm-dark">$1</strong>')
                                                                        }} />
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        );
                                                    }

                                                    // Regular paragraph
                                                    if (paragraph.trim()) {
                                                        return (
                                                            <p key={pidx} className="text-warm-dark/80" dangerouslySetInnerHTML={{
                                                                __html: paragraph
                                                                    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong class="text-warm-dark">$1</strong>')
                                                                    .replace(/\\[(.+?)\\]\\((.+?)\\)/g, '<a href="$2" class="text-olive hover:underline">$1</a>')
                                                                    .replace(/^\\s*##?\\s*/, '')
                                                            }} />
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </article>

                        {/* Contact CTA */}
                        <div className="mt-16 border border-warm-border/30 bg-gradient-to-br from-plum/10 to-warm-brown/10 p-8 rounded-none">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                                <div>
                                    <RotateCcw className="mx-auto mb-3 text-plum" size={28} />
                                    <h4 className="font-medium text-warm-dark mb-1">Refund Requests</h4>
                                    <a href="mailto:refunds@ulumae.com" className="text-sm text-plum hover:underline">
                                        refunds@ulumae.com
                                    </a>
                                </div>
                                <div>
                                    <FileText className="mx-auto mb-3 text-warm-brown" size={28} />
                                    <h4 className="font-medium text-warm-dark mb-1">Family Disputes</h4>
                                    <a href="mailto:disputes@ulumae.com" className="text-sm text-warm-brown hover:underline">
                                        disputes@ulumae.com
                                    </a>
                                </div>
                                <div>
                                    <CreditCard className="mx-auto mb-3 text-plum" size={28} />
                                    <h4 className="font-medium text-warm-dark mb-1">Billing Issues</h4>
                                    <a href="mailto:billing@ulumae.com" className="text-sm text-plum hover:underline">
                                        billing@ulumae.com
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Cross-link */}
                        <div className="mt-8 text-center">
                            <p className="text-warm-outline text-sm">
                                Also see:{' '}
                                <Link href="/legal/terms" className="text-olive hover:underline">Terms of Service</Link>
                                {' • '}
                                <Link href="/legal/content-policy" className="text-olive hover:underline">Content Policy</Link>
                                {' • '}
                                <Link href="/legal/privacy" className="text-olive hover:underline">Privacy Policy</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
