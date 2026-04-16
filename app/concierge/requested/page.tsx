'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Check, Mail, ArrowRight, FileText, Calendar } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { ExperiencePage, ExperiencePanel } from '@/components/ui/experience';

function RequestedContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const projectId = searchParams.get('id');
    const [contactPreference, setContactPreference] = useState<'email' | 'call'>('email');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (projectId) {
            localStorage.setItem('concierge-project-id', projectId);
            const fetchProject = async () => {
                const { data } = await createClient()
                    .from('concierge_projects')
                    .select('contact_preference')
                    .eq('id', projectId)
                    .single();

                if (data) {
                    setContactPreference(data.contact_preference || 'email');
                }
                setLoading(false);
            };

            fetchProject();
        } else {
            router.push('/concierge/request');
        }
    }, [projectId, router]);

    if (loading) {
        return (
            <ExperiencePage containerClassName="flex min-h-screen items-center justify-center">
                <div className="w-16 h-16 border-4 border-olive/10 border-t-olive rounded-full animate-spin" />
            </ExperiencePage>
        );
    }

    return (
        <ExperiencePage>
            <div className="mx-auto max-w-3xl">
                <ExperiencePanel className="text-center">
                    <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-olive/10">
                        <Check size={42} className="text-olive" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Request Received</p>
                    <h1 className="mt-3 font-serif text-5xl text-warm-dark">Thank you</h1>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-warm-muted">
                        We’ve received your Concierge request and will respond within 24 hours with the next step.
                    </p>

                    <div className="mt-8 rounded-[1.5rem] border border-warm-border/25 bg-surface-mid/35 p-6 text-left">
                        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-warm-outline">
                            {contactPreference === 'email' ? <Mail size={16} /> : <Calendar size={16} />}
                            What happens next
                        </h2>
                        <div className="mt-4 space-y-3 text-sm leading-relaxed text-warm-muted">
                            {contactPreference === 'email' ? (
                                <>
                                    <p>1. We send a detailed email plan tailored to your request.</p>
                                    <p>2. You receive access to your private space for materials and follow-up.</p>
                                    <p>3. We guide the process step by step as the archive takes shape.</p>
                                </>
                            ) : (
                                <>
                                    <p>1. We email you within 24 hours to arrange a call.</p>
                                    <p>2. During the conversation we review needs, materials, and scope.</p>
                                    <p>3. We then open your private project space and continue from there.</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 rounded-[1.5rem] border border-olive/20 bg-olive/5 p-6 text-left">
                        <div className="flex items-start gap-3">
                            <FileText size={20} className="mt-0.5 text-olive" />
                            <div>
                                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-warm-outline">Your Personal Space</h3>
                                <p className="mt-3 text-sm leading-relaxed text-warm-muted">
                                    We&apos;ve already created a dedicated space for your project. You can access it now or wait for our guidance.
                                </p>
                                <Link href={`/concierge/${projectId}`} className="experience-button experience-button-primary mt-5">
                                    Visit Your Space
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </div>

                    <p className="mt-8 text-xs uppercase tracking-[0.16em] text-warm-outline">
                        Request ID: <span className="font-mono text-warm-dark/70">{projectId?.slice(0, 8)}</span>
                    </p>
                </ExperiencePanel>
            </div>
        </ExperiencePage>
    );
}

export default function RequestedPage() {
    return (
        <Suspense
            fallback={
                <ExperiencePage containerClassName="flex min-h-screen items-center justify-center">
                    <div className="w-16 h-16 border-4 border-warm-border/30 border-t-olive rounded-full animate-spin" />
                </ExperiencePage>
            }
        >
            <RequestedContent />
        </Suspense>
    );
}
