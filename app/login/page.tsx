'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Mail, Lock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ExperiencePage, ExperienceHero, ExperiencePanel } from '@/components/ui/experience';
import PasswordInput from '@/components/ui/PasswordInput';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    errorParam === 'auth_callback_failed'
      ? 'Authentication failed. Please try again.'
      : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) return;

    let cancelled = false;

    const restoreSessionFromHash = async () => {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (cancelled) return;

      if (sessionError) {
        setError(sessionError.message || 'Authentication failed. Please try again.');
        setLoading(false);
        return;
      }

      router.replace(next);
      router.refresh();
    };

    restoreSessionFromHash();

    return () => {
      cancelled = true;
    };
  }, [next, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Use replace to prevent back-button going to login after successful auth
    router.replace(next);
    router.refresh();
  };

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
            kicker={<span className="experience-kicker">Private Access</span>}
            title={
              <>
                Return to your
                <br />
                <span className="italic text-olive">archives</span>
              </>
            }
            subtitle="Sign in to continue where you left off, manage your preservation spaces, and keep every archive within reach."
          />

          <div className="experience-card hidden max-w-xl p-6 lg:block">
            <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">What happens next</p>
            <p className="mt-4 text-sm leading-relaxed text-warm-muted">
              We send you back to the exact space you were trying to reach, whether that is your dashboard,
              a secure archive route, or a pending invitation.
            </p>
          </div>
        </div>

        <ExperiencePanel className="mx-auto w-full max-w-xl">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-warm-outline">Sign In</p>
            <h2 className="mt-3 font-serif text-4xl text-warm-dark">Welcome back</h2>
            <p className="mt-3 text-sm leading-relaxed text-warm-muted">
              Use the account attached to your archive so your dashboard, invites, and preservation history stay in sync.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-none border border-red-200 bg-red-50/90 px-5 py-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
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
                placeholder="Your password"
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
                  Signing in
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="experience-divider my-6" />

          <p className="text-sm text-warm-muted">
            Don&apos;t have an account?{' '}
            <Link
              href={`/signup${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="experience-link font-medium"
            >
              Create one
            </Link>
          </p>
        </ExperiencePanel>
      </div>
    </ExperiencePage>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <ExperiencePage containerClassName="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 rounded-none border-2 border-warm-border/30 border-t-olive animate-spin" />
        </ExperiencePage>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
