import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, FileText, Clock, Mail } from 'lucide-react';

export default function PrivacyPage() {
    // Read the markdown file
    const filePath = path.join(process.cwd(), 'content/legal/privacy.md');
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse the markdown content to extract sections for the TOC
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
            <div className="bg-gradient-to-br from-olive/10 via-surface-low to-warm-brown/10 border-b border-warm-border/30">
                <div className="max-w-4xl mx-auto px-6 py-16 text-center">
                    <div className="mb-6 inline-flex items-center justify-center gap-2 border border-olive/30 bg-olive/20 px-4 py-2 text-olive rounded-none">
                        <Shield size={16} />
                        <span className="text-sm font-medium">Your Data is Sacred</span>
                    </div>
                    <h1 className="font-serif text-5xl md:text-6xl text-warm-dark mb-4">
                        Privacy Policy
                    </h1>
                    <p className="text-lg text-warm-muted max-w-2xl mx-auto leading-relaxed">
                        We treat your memorial data with the same care and reverence that you would give to a family archive.
                        Transparency and trust are the foundation of our service.
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-6 text-sm text-warm-muted">
                        <span className="flex items-center gap-2">
                            <Clock size={16} className="text-olive" />
                            Updated Feb 2026
                        </span>
                        <span className="flex items-center gap-2">
                            <FileText size={16} className="text-warm-brown" />
                            GDPR & CCPA Compliant
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Table of Contents - Sticky Sidebar */}
                    <div className="hidden lg:block lg:col-span-1">
                        <div className="sticky top-24 space-y-2">
                            <h3 className="font-serif text-lg text-warm-dark mb-4">Contents</h3>
                            <nav className="space-y-1">
                                {sections.map((section, idx) => (
                                    <a
                                        key={idx}
                                        href={`#${section.id}`}
                                        className="block text-sm text-warm-muted hover:text-olive hover:pl-2 transition-all py-1 border-l-2 border-transparent hover:border-olive"
                                    >
                                        {section.title}
                                    </a>
                                ))}
                            </nav>

                            <div className="mt-8 border border-warm-border/30 bg-gradient-to-br from-olive/5 to-warm-brown/5 p-4 rounded-none">
                                <h4 className="font-medium text-warm-dark mb-2 flex items-center gap-2">
                                    <Mail size={16} className="text-olive" />
                                    Questions?
                                </h4>
                                <p className="text-xs text-warm-muted mb-3">
                                    Contact our Data Protection Officer for privacy-specific inquiries.
                                </p>
                                <a
                                    href="mailto:privacy@ulumae.com"
                                    className="text-xs text-olive hover:text-olive/80 underline"
                                >
                                    privacy@ulumae.com
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="lg:col-span-3">
                        <article className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-warm-dark prose-p:text-warm-dark/80 prose-p:leading-relaxed prose-a:text-olive hover:prose-a:text-olive/80 prose-strong:text-warm-dark">
                            {/* Process the content manually for better styling */}
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
                                                    // Handle tables
                                                    if (paragraph.includes('|')) {
                                                        const rows = paragraph.split('\\n').filter(row => row.trim().startsWith('|'));
                                                        if (rows.length > 2) {
                                                            return (
                                                                <div key={pidx} className="my-6 overflow-x-auto">
                                                                    <table className="w-full text-sm border-collapse">
                                                                        <thead>
                                                                            <tr className="border-b-2 border-olive/30">
                                                                                {rows[0].split('|').filter(Boolean).map((cell, cidx) => (
                                                                                    <th key={cidx} className="text-left py-2 px-4 font-semibold text-warm-dark bg-olive/5">
                                                                                        {cell.trim().replace(/\\*\\*/g, '')}
                                                                                    </th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {rows.slice(2).map((row, ridx) => (
                                                                                <tr key={ridx} className="border-b border-warm-border/30 hover:bg-olive/5">
                                                                                    {row.split('|').filter(Boolean).map((cell, cidx) => (
                                                                                        <td key={cidx} className="py-2 px-4 text-warm-muted">
                                                                                            {cell.trim().replace(/\\*\\*/g, '')}
                                                                                        </td>
                                                                                    ))}
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            );
                                                        }
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
                                                                            __html: item.replace(/^[-\\*]\\s*/, '').replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
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
                        <div className="mt-16 border border-warm-border/30 bg-gradient-to-br from-olive/10 to-warm-brown/10 p-8 text-center rounded-none">
                            <Lock className="mx-auto mb-4 text-olive" size={32} />
                            <h3 className="font-serif text-2xl text-warm-dark mb-3">Your Privacy Matters</h3>
                            <p className="text-warm-muted mb-6 max-w-md mx-auto">
                                If you have any questions about how we handle your data or wish to exercise your privacy rights,
                                our team is here to help.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <a
                                    href="mailto:privacy@ulumae.com"
                                    className="inline-flex items-center justify-center gap-2 bg-olive px-6 py-3 font-medium text-surface-low transition-all hover:bg-olive/90 rounded-none"
                                >
                                    <Mail size={18} />
                                    Contact DPO
                                </a>
                                <Link
                                    href="/legal/terms"
                                    className="inline-flex items-center justify-center gap-2 border-2 border-warm-border/40 px-6 py-3 font-medium text-warm-dark transition-all hover:border-olive rounded-none"
                                >
                                    <FileText size={18} />
                                    View Terms of Service
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
