// app/success/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, Share2, Mail, Copy, Eye, Home, CheckCircle } from 'lucide-react';

export default function SuccessPage() {
    const [copied, setCopied] = useState(false);

    // Simulated memorial URL (in real app, this would come from database)
    const memorialUrl = 'https://ulumae.com/memorial/eleanor-thompson';

    const copyToClipboard = () => {
        navigator.clipboard.writeText(memorialUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareViaEmail = () => {
        const subject = encodeURIComponent('Memorial for [Name]');
        const body = encodeURIComponent(`I've created a memorial page. View it here: ${memorialUrl}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-olive/10 via-surface-low to-warm-muted/10 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Main Content */}
            <div className="relative z-10 w-full max-w-2xl border border-warm-border/30 bg-white p-8 shadow-2xl md:p-12 rounded-none">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="flex h-24 w-24 items-center justify-center bg-gradient-to-br from-olive to-olive/80 shadow-lg rounded-none">
                        <Shield size={48} className="text-surface-low" strokeWidth={2} />
                    </div>
                </div>

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="font-serif text-4xl md:text-5xl text-warm-dark mb-3">
                        Their story is now protected.
                    </h1>
                    <p className="text-lg text-warm-dark/70">
                        What you have built will endure. Share it with those who carry their memory.
                    </p>
                </div>

                {/* Memorial URL Card */}
                <div className="mb-8 border-2 border-warm-border/30 bg-gradient-to-br from-olive/5 to-warm-muted/5 p-6 rounded-none">
                    <label className="block text-sm font-medium text-warm-dark/70 mb-2">
                        Memorial Page URL
                    </label>
                    <div className="flex gap-2">
                        <div className="flex-1 border border-warm-border/40 bg-white px-4 py-3 text-sm text-warm-dark break-all rounded-none">
                            {memorialUrl}
                        </div>
                        <button
                            onClick={copyToClipboard}
                            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all rounded-none ${copied
                                ? 'bg-olive/10 text-olive'
                                : 'bg-white border border-warm-border/40 text-warm-dark hover:bg-warm-border/10'
                                }`}
                        >
                            {copied ? (
                                <>
                                    <CheckCircle size={18} />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy size={18} />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mb-8">
                    <Link
                        href={memorialUrl}
                        className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-olive/10 to-olive/10 py-4 font-semibold transition-all hover:shadow-lg glass-btn-dark rounded-none"
                    >
                        <Eye size={20} />
                        Visit the archive
                    </Link>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={shareViaEmail}
                            className="flex items-center justify-center gap-2 border-2 border-warm-border/40 bg-white py-3 font-medium text-warm-dark transition-all hover:border-olive hover:bg-olive/5 rounded-none"
                        >
                            <Mail size={18} />
                            Invite others to remember
                        </button>

                        <button
                            onClick={copyToClipboard}
                            className="flex items-center justify-center gap-2 border-2 border-warm-border/40 bg-white py-3 font-medium text-warm-dark transition-all hover:border-warm-brown hover:bg-warm-brown/5 rounded-none"
                        >
                            <Share2 size={18} />
                            Share their legacy
                        </button>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="space-y-4 mb-8">
                    <div className="border border-olive/30 bg-olive/10 p-4 rounded-none">
                        <h3 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                            <Shield size={18} className="text-olive" />
                            What this means
                        </h3>
                        <ul className="text-sm text-warm-dark/70 space-y-1.5 ml-6">
                            <li>Their memorial is preserved and accessible</li>
                            <li>You can return to tend it anytime from your dashboard</li>
                            <li>Pass the link to family and those who knew them</li>
                            <li>Others may add their own memories</li>
                        </ul>
                    </div>

                    <div className="border border-warm-muted/30 bg-warm-muted/10 p-4 rounded-none">
                        <h3 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                            <Shield size={18} className="text-warm-muted" />
                            Tending their memorial
                        </h3>
                        <ul className="text-sm text-warm-dark/70 space-y-1.5 ml-6">
                            <li>Add more photos and stories as they surface</li>
                            <li>Invite others to contribute what they remember</li>
                            <li>Adjust the design and layout over time</li>
                            <li>Download a PDF version for safekeeping</li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                        href="/"
                        className="flex flex-1 items-center justify-center gap-2 border-2 border-warm-border/40 py-3 font-medium text-warm-dark transition-all hover:bg-warm-border/10 rounded-none"
                    >
                        <Home size={18} />
                        Back to Home
                    </Link>

                    <Link
                        href="/create"
                        className="flex flex-1 items-center justify-center gap-2 border-2 border-warm-brown/30 bg-warm-brown/10 py-3 font-medium text-warm-brown transition-all hover:bg-warm-brown/20 rounded-none"
                    >
                        <Shield size={18} />
                        Protect Another
                    </Link>
                </div>
            </div>
        </div>
    );
}
