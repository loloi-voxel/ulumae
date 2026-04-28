'use client';

import { useState, useRef } from 'react';
import { secureUpload } from '@/lib/uploadService';
import { ShieldAlert, FileText, CheckCircle, Loader2, ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SuccessionRequestPage() {
    const [email, setEmail] = useState('');
    const [files, setFiles] = useState<{ deathCert: File | null, idProof: File | null }>({ deathCert: null, idProof: null });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const deathCertRef = useRef<HTMLInputElement>(null);
    const idProofRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files.deathCert || !files.idProof) {
            toast.error('Please provide both required documents.');
            return;
        }
        setSubmitting(true);

        try {
            // 1. Upload Documents
            const activationKey = email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const deathCertRes = await secureUpload(files.deathCert, 'legal-documents', `activations/${activationKey}/death_cert_${Date.now()}`);
            const idProofRes = await secureUpload(files.idProof, 'legal-documents', `activations/${activationKey}/id_proof_${Date.now()}`);

            if (!deathCertRes.success || !idProofRes.success) throw new Error("File upload failed.");

            // 2. Create Activation Request
            const response = await fetch('/api/succession/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    deathCertificateUrl: deathCertRes.url,
                    idProofUrl: idProofRes.url,
                }),
            });
            const payload = await response.json();

            if (!response.ok) throw new Error(payload.error || 'Could not submit the succession request.');

            setSubmitted(true);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center p-6 text-center">
                <div className="max-w-md bg-white p-10 rounded-2xl shadow-xl border border-warm-border/30">
                    <CheckCircle className="mx-auto text-olive mb-6" size={64} />
                    <h1 className="font-serif text-3xl mb-4">Request Received</h1>
                    <p className="text-warm-dark/70 mb-8">
                        The verification process has begun. Our legal team will review the documents within 48 hours.
                        <br /><br />
                        By law, a <strong>30-day notice period</strong> will now follow to allow for any family contestations. You will receive an email once the transfer is complete.
                    </p>
                    <Link href="/" className="glass-btn-dark px-8 py-3 rounded-lg font-medium block">Return to Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-low py-20 px-6">
            <div className="max-w-2xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-warm-outline hover:text-warm-dark mb-8 transition-colors">
                    <ArrowLeft size={18} /> Back to Home
                </Link>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-warm-border/30">
                    <div className="p-8 bg-warm-muted/10 border-b border-warm-muted/20 flex items-center gap-4">
                        <ShieldAlert className="text-warm-muted" size={32} />
                        <div>
                            <h1 className="font-serif text-2xl text-warm-dark">Account Succession Request</h1>
                            <p className="text-warm-muted/70 text-sm">Formal activation of Stewardship</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <section>
                            <h2 className="text-sm font-bold text-warm-dark uppercase tracking-widest mb-4">1. Identification</h2>
                            <label className="block text-xs font-medium text-warm-muted mb-2">Your Steward Email Address</label>
                            <input
                                required
                                type="email"
                                className="w-full p-3 rounded-xl border border-warm-border/30 focus:ring-olive"
                                placeholder="The email where you received the invitation"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </section>

                        <section className="space-y-6">
                            <h2 className="text-sm font-bold text-warm-dark uppercase tracking-widest mb-4">2. Legal Documentation</h2>

                            {/* Death Certificate */}
                            <div className="p-4 border-2 border-dashed border-warm-border/40 rounded-xl">
                                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                    <FileText size={16} className="text-warm-outline" />
                                    Official Death Certificate
                                </p>
                                <input
                                    type="file"
                                    ref={deathCertRef}
                                    className="hidden"
                                    onChange={(e) => setFiles({ ...files, deathCert: e.target.files?.[0] || null })}
                                />
                                <button
                                    type="button"
                                    onClick={() => deathCertRef.current?.click()}
                                    className={`w-full py-3 rounded-lg text-sm transition-all ${files.deathCert ? 'bg-olive/10 text-olive' : 'bg-warm-border/10 text-warm-muted hover:bg-warm-border/20'}`}
                                >
                                    {files.deathCert ? `Selected: ${files.deathCert.name}` : "Provide Certificate (PDF/JPG)"}
                                </button>
                            </div>

                            {/* ID Proof */}
                            <div className="p-4 border-2 border-dashed border-warm-border/40 rounded-xl">
                                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                    <User size={16} className="text-warm-outline" />
                                    Your Government Photo ID
                                </p>
                                <input
                                    type="file"
                                    ref={idProofRef}
                                    className="hidden"
                                    onChange={(e) => setFiles({ ...files, idProof: e.target.files?.[0] || null })}
                                />
                                <button
                                    type="button"
                                    onClick={() => idProofRef.current?.click()}
                                    className={`w-full py-3 rounded-lg text-sm transition-all ${files.idProof ? 'bg-olive/10 text-olive' : 'bg-warm-border/10 text-warm-muted hover:bg-warm-border/20'}`}
                                >
                                    {files.idProof ? `Selected: ${files.idProof.name}` : "Provide ID Proof (PDF/JPG)"}
                                </button>
                            </div>
                        </section>

                        <button
                            disabled={submitting}
                            type="submit"
                            className="w-full py-4 glass-btn-dark rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : "Offer Formal Request"}
                        </button>

                        <p className="text-[10px] text-center text-warm-outline uppercase tracking-tighter">
                            Legal Verification Process • 30 Day Statutory Wait Period Apply
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
