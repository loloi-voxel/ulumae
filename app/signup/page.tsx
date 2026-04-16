'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Mail, Lock, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import { ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setConfirmationSent(true);
    setLoading(false);
  };

  if (confirmationSent) {
    return (
      <ExperiencePage containerClassName="flex min-h-screen items-center justify-center">
        <ExperiencePanel className="mx-auto w-full max-w-xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-none bg-olive/10">
            <Check size={32} className="text-olive" />
          </div>
          <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Account Created</p>
          <h1 className="mt-3 font-serif text-4xl text-warm-dark">Check your email</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-warm-muted">
            We sent a confirmation link to <strong className="text-warm-dark">{email}</strong>. Open it to
            activate your account, then you&apos;ll return to the flow that brought you here.
          </p>
          <p className="mt-5 text-xs text-warm-outline">
            Didn&apos;t receive it? Check spam, or{' '}
            <button onClick={() => setConfirmationSent(false)} className="experience-link rounded-none underline underline-offset-4">
              try again
            </button>
            .
          </p>
        </ExperiencePanel>
      </ExperiencePage>
    );
  }

  return (
    <ExperiencePage containerClassName="max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_0.75fr] lg:items-center">
        <div>
          <Link
            href="/"
            className="experience-button experience-button-secondary mb-10 w-fit text-[11px] tracking-[0.22em]"
          >
            <ArrowLeft size={14} />
            Back
          </Link>

          <ExperienceHero
            kicker={<span className="experience-kicker">New Account</span>}
            title={
              <>
                Begin your
                <br />
                <span className="italic text-olive">preservation</span>
              </>
            }
            subtitle="Create a single account to manage memorials, invitations, preservation steps, and long-term access across the entire ULUMAE experience."
          />

          <div className="experience-card hidden max-w-xl p-6 lg:block">
            <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Why create an account</p>
            <p className="mt-4 text-sm leading-relaxed text-warm-muted">
              Your archive history, access rights, and payment state all stay tied to one identity so you can resume securely at any time.
            </p>
          </div>
        </div>

        <ExperiencePanel className="mx-auto w-full max-w-xl">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Sign Up</p>
            <h2 className="mt-3 font-serif text-4xl text-warm-dark">Create your account</h2>
            <p className="mt-3 text-sm leading-relaxed text-warm-muted">
              Use the email you want connected to your archives, family invitations, and preservation records.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-none border border-red-200 bg-red-50/90 px-5 py-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-warm-outline">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-border" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="experience-input w-full pl-11 pr-4"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-warm-outline">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-border" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="experience-input w-full pl-11 pr-4"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-warm-outline">
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-border" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  className="experience-input w-full pl-11 pr-4"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`experience-button w-full justify-center py-4 text-[11px] tracking-[0.22em] ${
                loading
                  ? 'cursor-not-allowed border border-warm-border/30 bg-surface-mid/80 text-warm-outline'
                  : 'experience-button-primary'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating account
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="experience-divider my-6" />

          <p className="text-sm text-warm-muted">
            Already have an account?{' '}
            <Link
              href={`/login${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="experience-link font-medium"
            >
              Sign in
            </Link>
          </p>
        </ExperiencePanel>
      </div>
    </ExperiencePage>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <ExperiencePage containerClassName="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 rounded-none border-2 border-warm-border/30 border-t-olive animate-spin" />
        </ExperiencePage>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
