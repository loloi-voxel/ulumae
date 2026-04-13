'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Mail, Lock, User,
    Loader2, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { InvitationData } from '../page';

type AuthMode = 'signup' | 'login';

interface Props {
    invitation: InvitationData;
    token: string;
    onAuthenticated: () => void;
}

export default function InviteAuthStep({
    invitation,
    token,
    onAuthenticated
}: Props) {
    const [mode, setMode] =
        useState<AuthMode>('signup');
    const [name, setName] = useState('');
    const [email] = useState(
        invitation.inviteeEmail || ''
    );
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] =
        useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(
        null
    );
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const [awaitingConfirmation, setAwaitingConfirmation] =
        useState(false);

    const supabase = createClient();

    const handleSubmit = async (
        e: React.FormEvent
    ) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                if (!name.trim()) {
                    setError('Please enter your name.');
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters.');
                    setLoading(false);
                    return;
                }
                if (!agreeTerms || !agreePrivacy) {
                    setError('Please confirm the terms and privacy policy to create your account.');
                    setLoading(false);
                    return;
                }

                // The emailRedirectTo sends the user to the auth callback, which
                // will exchange the code and redirect back to the invite page.
                // This ensures the invite token survives signup + email confirmation.
                // After redirect, InviteShell re-checks auth and proceeds to acceptance.
                const { data, error: signUpError } =
                    await supabase.auth.signUp({
                        email: email.trim(),
                        password,
                        options: {
                            data: { full_name: name.trim() },
                            emailRedirectTo: `${window.location.origin}/auth/callback?next=/invite/${token}`,
                        }
                    });

                if (signUpError) throw signUpError;

                if (!data.session) {
                    setAwaitingConfirmation(true);
                    setLoading(false);
                    return;
                }

                onAuthenticated();
            } else {
                const { error: signInError } =
                    await supabase.auth.signInWithPassword({
                        email: email.trim(),
                        password
                    });

                if (signInError) throw signInError;
                onAuthenticated();
            }
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('already registered')) {
                setError('This email already has an account. Try logging in instead.');
                setMode('login');
            } else if (msg.includes('Invalid login')) {
                setError('Incorrect email or password. Please try again.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (awaitingConfirmation) {
        return (
            <div className="min-h-screen bg-gradient-to-br
      from-olive/10 via-surface-low to-warm-muted/10">
                <div className="border-b border-warm-border/20
        bg-white/60 backdrop-blur-sm">
                    <div className="max-w-2xl mx-auto px-6
          py-4 flex items-center justify-between">
                        <button
                            onClick={() => setAwaitingConfirmation(false)}
                            className="inline-flex items-center
              gap-2 text-warm-dark/40
              hover:text-warm-dark transition-colors
              text-sm"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>
                        <span className="text-xs tracking-widest
            uppercase text-warm-dark/30 font-sans">
                            ULUMAE
                        </span>
                    </div>
                </div>

                <div className="max-w-md mx-auto px-6 py-16">
                    <div className="rounded-3xl border border-olive/20 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-olive/10">
                            <CheckCircle2 size={28} className="text-olive" />
                        </div>
                        <h1 className="mb-3 font-serif text-3xl text-warm-dark">
                            Check your email
                        </h1>
                        <p className="mb-4 text-sm leading-relaxed text-warm-dark/60">
                            We sent a confirmation link to <strong>{email.trim()}</strong>.
                            After you confirm, this invitation will reopen so you can finish joining without starting over.
                        </p>
                        <p className="text-xs leading-relaxed text-warm-dark/40">
                            If you do not see it, check your spam folder and keep this tab for when you return.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br
      from-olive/10 via-surface-low to-warm-muted/10">
            <div className="border-b border-warm-border/20
        bg-white/60 backdrop-blur-sm">
                <div className="max-w-2xl mx-auto px-6
          py-4 flex items-center justify-between">
                    <button
                        onClick={() => window.history.back()}
                        className="inline-flex items-center
              gap-2 text-warm-dark/40
              hover:text-warm-dark transition-colors
              text-sm"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                    <span className="text-xs tracking-widest
            uppercase text-warm-dark/30 font-sans">
                        ULUMAE
                    </span>
                </div>
            </div>

            <div className="max-w-md mx-auto px-6
        py-16">
                <div className="text-center mb-10">
                    <h1 className="font-serif text-3xl
            text-warm-dark mb-3">
                        {mode === 'signup'
                            ? `Create your space to join
                 ${invitation.memorial.fullName}
                 's archive`
                            : 'Welcome back'
                        }
                    </h1>
                    <p className="text-warm-dark/50 text-sm">
                        {mode === 'signup'
                            ? 'Create your account with the invited email so you can join this archive in one clear flow.'
                            : `Log in to continue to ${invitation.memorial.fullName}'s archive.`
                        }
                    </p>
                </div>

                <div className="mb-6 p-4 bg-warm-border/20
            border border-warm-border/40 rounded-xl">
                    <p className="text-xs
              text-warm-dark/60 leading-relaxed">
                        This invitation is addressed to{' '}
                        <strong>{invitation.inviteeEmail}</strong>.
                        Use this same email so the archive access stays linked to the right person.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50
            border border-red-200 rounded-xl">
                        <p className="text-sm text-red-700">
                            {error}
                        </p>
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    {mode === 'signup' && (
                        <div>
                            <label className="block text-xs
                font-medium text-warm-dark/50
                uppercase tracking-wider mb-2">
                                Your name
                            </label>
                            <div className="relative">
                                <User size={16} className="absolute
                  left-4 top-1/2 -translate-y-1/2
                  text-warm-dark/30" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e =>
                                        setName(e.target.value)}
                                    placeholder="e.g. Margaret Chen"
                                    required
                                    className="w-full pl-11 pr-4
                    py-3 glass-input"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs
              font-medium text-warm-dark/50
              uppercase tracking-wider mb-2">
                            Email address
                        </label>
                        <div className="relative">
                            <Mail size={16} className="absolute
                left-4 top-1/2 -translate-y-1/2
                text-warm-dark/30" />
                            <input
                                type="email"
                                value={email}
                                readOnly
                                placeholder="you@example.com"
                                required
                                className="w-full cursor-not-allowed rounded-xl border border-warm-border/40 bg-warm-border/10 py-3 pl-11 pr-4 text-warm-dark/60"
                            />
                        </div>
                        <p className="text-xs
                text-warm-dark/30 mt-1">
                            Pre-filled from your invitation.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs
              font-medium text-warm-dark/50
              uppercase tracking-wider mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Lock size={16} className="absolute
                left-4 top-1/2 -translate-y-1/2
                text-warm-dark/30" />
                            <input
                                type={
                                    showPassword ? 'text' : 'password'
                                }
                                value={password}
                                onChange={e =>
                                    setPassword(e.target.value)}
                                placeholder={
                                    mode === 'signup'
                                        ? 'At least 6 characters'
                                        : 'Your password'
                                }
                                required
                                className="w-full pl-11 pr-12
                  py-3 glass-input"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPassword(p => !p)}
                                className="absolute right-4
                  top-1/2 -translate-y-1/2
                  text-warm-dark/30
                  hover:text-warm-dark/60"
                            >
                                {showPassword
                                    ? <EyeOff size={16} />
                                    : <Eye size={16} />
                                }
                            </button>
                        </div>
                    </div>

                    {mode === 'signup' && (
                        <div className="space-y-3 rounded-2xl border border-warm-border/30 bg-white/70 p-4">
                            <label className="flex items-start gap-3 text-sm text-warm-dark/60">
                                <input
                                    type="checkbox"
                                    checked={agreeTerms}
                                    onChange={e => setAgreeTerms(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-warm-border/50"
                                />
                                <span>
                                    I agree to the <Link href="/legal/terms" className="text-olive underline underline-offset-4">Terms</Link> and understand this access is for a private memorial archive.
                                </span>
                            </label>
                            <label className="flex items-start gap-3 text-sm text-warm-dark/60">
                                <input
                                    type="checkbox"
                                    checked={agreePrivacy}
                                    onChange={e => setAgreePrivacy(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-warm-border/50"
                                />
                                <span>
                                    I have read the <Link href="/legal/privacy" className="text-olive underline underline-offset-4">Privacy Policy</Link> and understand my participation is tied to this invited email.
                                </span>
                            </label>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3.5 rounded-xl
              font-medium transition-all flex
              items-center justify-center gap-2
              ${loading
                                ? 'bg-warm-border/20 text-warm-dark/30 cursor-not-allowed'
                                : 'glass-btn-dark'
                            }`}
                    >
                        {loading
                            ? <>
                                <Loader2 size={18}
                                    className="animate-spin" />
                                {mode === 'signup'
                                    ? 'Creating your account...'
                                    : 'Logging in...'
                                }
                            </>
                            : mode === 'signup'
                                ? 'Create account to join'
                                : 'Log in and continue'
                        }
                    </button>
                </form>

                <div className="mt-6 text-center">
                    {mode === 'signup' ? (
                        <p className="text-sm text-warm-dark/50">
                            Already have an account?{' '}
                            <button
                                onClick={() => {
                                    setMode('login');
                                    setError(null);
                                }}
                                className="text-olive font-medium
                  hover:underline"
                            >
                                Log in instead
                            </button>
                        </p>
                    ) : (
                        <p className="text-sm text-warm-dark/50">
                            Don&apos;t have an account?{' '}
                            <button
                                onClick={() => {
                                    setMode('signup');
                                    setError(null);
                                }}
                                className="text-olive font-medium
                  hover:underline"
                            >
                                Create one
                            </button>
                        </p>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t
          border-warm-border/20 text-center">
                    <p className="text-xs text-warm-dark/30 mb-3 leading-relaxed">
                        This invite stays attached to <strong>{invitation.inviteeEmail}</strong> so the archive can resume automatically after login, signup, and email confirmation.
                    </p>
                </div>
            </div>
        </div>
    );
}
