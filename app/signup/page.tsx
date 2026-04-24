'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Mail, Lock, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import { ExperienceCard, ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';
import PasswordInput from '@/components/ui/PasswordInput';

function SignupForm() {
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

    const normalizedEmail = email.trim().toLowerCase();

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        next,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error || 'Could not create your account.');
      setLoading(false);
      return;
    }

    setEmail(normalizedEmail);
    setConfirmationSent(true);
    setLoading(false);
  };

  if (confirmationSent) {
    return (
      <ExperiencePage containerClassName="max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_0.85fr] lg:items-center">
          <div>
            <ExperienceHero
              kicker={<span className="experience-kicker">Account Created</span>}
              title={
                <>
                  Confirm your
                  <br />
                  <span className="italic text-olive">sign up</span>
                </>
              }
              subtitle="Your ULUMAE account is almost ready. Confirm the email we just sent, and we will return you to the archive flow that brought you here."
            />

            <ExperienceCard className="max-w-xl">
              <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">What happens next</p>
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-olive/10 text-olive">
                    <Mail size={15} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-dark">Open the confirmation email</p>
                    <p className="mt-1 text-sm leading-relaxed text-warm-muted">
                      Use the message sent to your inbox to verify this address and activate your account.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-warm-brown/10 text-warm-brown">
                    <Check size={15} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-dark">Return to the same flow</p>
                    <p className="mt-1 text-sm leading-relaxed text-warm-muted">
                      Once confirmed, you&apos;ll come back into ULUMAE with your archive context intact.
                    </p>
                  </div>
                </div>
              </div>
            </ExperienceCard>
          </div>

          <ExperiencePanel className="mx-auto w-full max-w-xl overflow-hidden">
            <div className="rounded-[1.75rem] border border-warm-border/20 bg-gradient-to-br from-white via-surface-low to-warm-border/10 p-6 md:p-7">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-olive/10 text-olive shadow-sm">
                  <Check size={30} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Confirmation Sent</p>
                  <h1 className="mt-2 font-serif text-3xl text-warm-dark md:text-4xl">Check your inbox</h1>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-warm-muted md:text-[15px]">
                We sent a confirmation link to your email address. Open it to activate your account and continue the preservation journey.
              </p>

              <div className="mt-6 rounded-2xl border border-warm-border/25 bg-white/85 px-5 py-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.22em] text-warm-outline">Email Address</p>
                <p className="mt-2 break-all text-base text-warm-dark">{email}</p>
              </div>

              <div className="mt-6 space-y-3 rounded-2xl border border-warm-border/20 bg-warm-border/10 p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-warm-outline">If you don&apos;t see it</p>
                <p className="text-sm leading-relaxed text-warm-muted">
                  Check spam or promotions, then return here if you need to send the confirmation again.
                </p>
              </div>

              <div className="experience-divider my-6" />

              <p className="text-sm text-warm-muted">
                Didn&apos;t receive it?{' '}
                <button onClick={() => setConfirmationSent(false)} className="experience-link rounded-none underline underline-offset-4">
                  Try again
                </button>
                .
              </p>
            </div>
          </ExperiencePanel>
        </div>
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
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="experience-input w-full"
                leftIcon={<Lock size={16} />}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-warm-outline">
                Confirm Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm your password"
                className="experience-input w-full"
                leftIcon={<Lock size={16} />}
              />
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
