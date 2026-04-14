'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    KeyRound,
    Loader2,
    Mail,
    Shield,
    Smartphone,
    UserRoundCheck,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';

interface SecurityCenterProps {
    userId: string;
}

interface SessionSummary {
    sessionId: string | null;
    expiresAt: string | null;
    email: string | null;
    deviceLabel: string | null;
    lastSeenAt: string | null;
    revokedAt: string | null;
}

interface TrackedSession {
    id: string;
    sessionId: string | null;
    deviceLabel: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    lastSeenAt: string | null;
    createdAt: string | null;
    revokedAt: string | null;
    isCurrent: boolean;
    isStale: boolean;
}

interface AnchorDeviceSummary {
    id: string;
    memorialId: string;
    deviceName: string;
    browser: string | null;
    os: string | null;
    lastSyncAt: string | null;
    status: string;
    createdAt: string | null;
}

interface TwoFactorFactorSummary {
    id: string;
    friendlyName: string;
    status: 'pending' | 'verified';
    createdAt: string;
    lastUsedAt: string | null;
}

interface TwoFactorState {
    enabled: boolean;
    requiresChallenge: boolean;
    trustedSessionExpiresAt: string | null;
    verifiedFactorCount: number;
    factors: TwoFactorFactorSummary[];
    recoveryCodesRemaining: number;
}

interface PendingEnrollment {
    factorId: string;
    friendlyName: string;
    qrCode: string;
    secret: string;
}

export default function SecurityCenter({ userId }: SecurityCenterProps) {
    const auth = useAuth();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
    const [trackedSessions, setTrackedSessions] = useState<TrackedSession[]>([]);
    const [anchorDevices, setAnchorDevices] = useState<AnchorDeviceSummary[]>([]);
    const [twoFactorState, setTwoFactorState] = useState<TwoFactorState | null>(null);
    const [emailInput, setEmailInput] = useState(auth.user?.email || '');
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [savingEmail, setSavingEmail] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [signingOutOthers, setSigningOutOthers] = useState(false);
    const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
    const [enrollingFactorName, setEnrollingFactorName] = useState('Primary authenticator');
    const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(null);
    const [enrollmentCode, setEnrollmentCode] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);
    const [regeneratingRecoveryCodes, setRegeneratingRecoveryCodes] = useState(false);
    const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[]>([]);
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
    const [revokingAnchorId, setRevokingAnchorId] = useState<string | null>(null);

    const verifiedFactors = useMemo(
        () => (twoFactorState?.factors || []).filter((factor) => factor.status === 'verified'),
        [twoFactorState]
    );

    const loadSecurityState = async () => {
        setLoading(true);
        setError(null);

        try {
            const [
                { data: userData, error: userError },
                twoFactorResponse,
                sessionsResponse,
            ] = await Promise.all([
                supabase.auth.getUser(),
                fetch('/api/security/two-factor/state', { cache: 'no-store' }),
                fetch('/api/security/sessions', { cache: 'no-store' }),
            ]);

            if (userError) throw userError;

            const twoFactorPayload = await twoFactorResponse.json();
            if (!twoFactorResponse.ok) {
                throw new Error(twoFactorPayload.error || 'Could not load two-factor settings.');
            }

            const sessionsPayload = await sessionsResponse.json();
            if (!sessionsResponse.ok) {
                throw new Error(sessionsPayload.error || 'Could not load session history.');
            }

            setSessionSummary({
                sessionId: sessionsPayload.currentSession?.sessionId || null,
                expiresAt: sessionsPayload.currentSession?.expiresAt || null,
                email: userData.user?.email || auth.user?.email || null,
                deviceLabel: sessionsPayload.currentSession?.deviceLabel || null,
                lastSeenAt: sessionsPayload.currentSession?.lastSeenAt || null,
                revokedAt: sessionsPayload.currentSession?.revokedAt || null,
            });
            setTrackedSessions(sessionsPayload.sessions || []);
            setAnchorDevices(sessionsPayload.devices || []);
            setTwoFactorState(twoFactorPayload);
            setEmailInput(userData.user?.email || auth.user?.email || '');
        } catch (loadError: any) {
            console.error('[SecurityCenter]', loadError);
            setError(loadError.message || 'Could not load security settings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSecurityState();
    }, []);

    const clearNoticeSoon = () => {
        window.setTimeout(() => setNotice(null), 5000);
    };

    const syncSessionScope = async (scope: 'others' | 'global') => {
        const response = await fetch('/api/security/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'scope', scope }),
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Could not sync session state.');
        }
    };

    const handleEmailChange = async () => {
        if (!emailInput.trim()) return;

        setSavingEmail(true);
        setError(null);
        setNotice(null);

        try {
            const supabase = createClient();
            const { error: updateError } = await supabase.auth.updateUser(
                { email: emailInput.trim() },
                {
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings/${userId}`,
                }
            );

            if (updateError) throw updateError;

            setNotice('Email change requested. Check both inboxes to confirm it.');
            clearNoticeSoon();
        } catch (updateError: any) {
            setError(updateError.message || 'Could not request the email change.');
        } finally {
            setSavingEmail(false);
        }
    };

    const handlePasswordChange = async () => {
        if (passwordInput.length < 8) {
            setError('Use a password with at least 8 characters.');
            return;
        }

        if (passwordInput !== passwordConfirm) {
            setError('The password confirmation does not match.');
            return;
        }

        setSavingPassword(true);
        setError(null);
        setNotice(null);

        try {
            const supabase = createClient();
            const { error: updateError } = await supabase.auth.updateUser({ password: passwordInput });
            if (updateError) throw updateError;

            setPasswordInput('');
            setPasswordConfirm('');
            setNotice('Password updated successfully.');
            clearNoticeSoon();
        } catch (updateError: any) {
            setError(updateError.message || 'Could not update the password.');
        } finally {
            setSavingPassword(false);
        }
    };

    const handleSignOutOthers = async () => {
        setSigningOutOthers(true);
        setError(null);
        setNotice(null);

        try {
            const supabase = createClient();
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
            if (signOutError) throw signOutError;

            await syncSessionScope('others');

            setNotice('All other devices were signed out.');
            clearNoticeSoon();
            await auth.revalidate();
            await loadSecurityState();
        } catch (signOutError: any) {
            setError(signOutError.message || 'Could not sign out the other sessions.');
        } finally {
            setSigningOutOthers(false);
        }
    };

    const handleSignOutEverywhere = async () => {
        if (!window.confirm('Sign out this device and every other active session for this account?')) {
            return;
        }

        setSigningOutEverywhere(true);
        setError(null);

        try {
            await syncSessionScope('global');
            const supabase = createClient();
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
            if (signOutError) throw signOutError;
            window.location.href = '/login';
        } catch (signOutError: any) {
            setError(signOutError.message || 'Could not sign out all sessions.');
        } finally {
            setSigningOutEverywhere(false);
        }
    };

    const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
        setRevokingSessionId(sessionId);
        setError(null);
        setNotice(null);

        try {
            const response = await fetch('/api/security/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'session', targetId: sessionId }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Could not revoke that session.');
            }

            if (isCurrent || payload.signedOutCurrentSession) {
                window.location.href = '/login';
                return;
            }

            setNotice('Session revoked. That device will be blocked on its next verified request.');
            clearNoticeSoon();
            await loadSecurityState();
        } catch (revokeError: any) {
            setError(revokeError.message || 'Could not revoke that session.');
        } finally {
            setRevokingSessionId(null);
        }
    };

    const handleRevokeAnchor = async (anchorId: string) => {
        setRevokingAnchorId(anchorId);
        setError(null);
        setNotice(null);

        try {
            const response = await fetch('/api/security/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'anchor', targetId: anchorId }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Could not revoke that device.');
            }

            setNotice('Anchor device revoked.');
            clearNoticeSoon();
            await loadSecurityState();
        } catch (revokeError: any) {
            setError(revokeError.message || 'Could not revoke that device.');
        } finally {
            setRevokingAnchorId(null);
        }
    };

    const handleStartEnrollment = async () => {
        setEnrolling(true);
        setError(null);
        setNotice(null);
        setFreshRecoveryCodes([]);

        try {
            const response = await fetch('/api/security/two-factor/enroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    friendlyName: enrollingFactorName.trim() || 'Authenticator',
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Could not start authenticator setup.');
            }

            setPendingEnrollment(payload.enrollment);
        } catch (enrollError: any) {
            setError(enrollError.message || 'Could not start authenticator setup.');
        } finally {
            setEnrolling(false);
        }
    };

    const handleVerifyEnrollment = async () => {
        if (!pendingEnrollment || enrollmentCode.trim().length < 6) return;

        setEnrolling(true);
        setError(null);

        try {
            const response = await fetch('/api/security/two-factor/verify-enrollment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    factorId: pendingEnrollment.factorId,
                    code: enrollmentCode.trim(),
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Could not verify this authenticator code.');
            }

            setPendingEnrollment(null);
            setEnrollmentCode('');
            setFreshRecoveryCodes(payload.recoveryCodes || []);
            setNotice('Two-factor authentication is now active on this account.');
            clearNoticeSoon();
            await auth.revalidate();
            await loadSecurityState();
        } catch (verifyError: any) {
            setError(verifyError.message || 'Could not verify this authenticator code.');
        } finally {
            setEnrolling(false);
        }
    };

    const handleRemoveFactor = async (factorId: string) => {
        if (!window.confirm('Remove this authenticator factor from your account?')) {
            return;
        }

        setRemovingFactorId(factorId);
        setError(null);
        setNotice(null);

        try {
            const response = await fetch(`/api/security/two-factor/factors/${factorId}`, {
                method: 'DELETE',
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Could not remove this authenticator.');
            }

            setFreshRecoveryCodes([]);
            setNotice('Authenticator removed.');
            clearNoticeSoon();
            await loadSecurityState();
        } catch (removeError: any) {
            setError(removeError.message || 'Could not remove this authenticator factor.');
        } finally {
            setRemovingFactorId(null);
        }
    };

    const handleRegenerateRecoveryCodes = async () => {
        if (!window.confirm('Regenerate all recovery codes? Existing unused codes will stop working immediately.')) {
            return;
        }

        setRegeneratingRecoveryCodes(true);
        setError(null);
        setNotice(null);

        try {
            const response = await fetch('/api/security/two-factor/recovery-codes', {
                method: 'POST',
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Could not regenerate recovery codes.');
            }

            setFreshRecoveryCodes(payload.recoveryCodes || []);
            setNotice('Recovery codes regenerated.');
            clearNoticeSoon();
            await loadSecurityState();
        } catch (recoveryError: any) {
            setError(recoveryError.message || 'Could not regenerate recovery codes.');
        } finally {
            setRegeneratingRecoveryCodes(false);
        }
    };

    return (
        <section className="glass-card rounded-3xl p-6 lg:col-span-3">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warm-dark/10 text-warm-dark">
                    <Shield size={20} />
                </div>
                <div>
                    <h2 className="font-serif text-2xl text-warm-dark">Security Center</h2>
                    <p className="text-xs uppercase tracking-[0.14em] text-warm-outline">Account controls</p>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {notice && (
                <div className="mb-4 rounded-2xl border border-olive/20 bg-olive/5 px-4 py-3 text-sm text-olive">
                    {notice}
                </div>
            )}

            {loading ? (
                <div className="py-16 text-center">
                    <Loader2 size={28} className="mx-auto mb-3 animate-spin text-olive" />
                    <p className="text-sm text-warm-muted">Loading your security controls...</p>
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-warm-border/30 bg-white px-5 py-5">
                            <div className="mb-4 flex items-center gap-2 text-sm text-warm-dark">
                                <Mail size={15} className="text-olive" />
                                Email address
                            </div>
                            <p className="mb-3 text-sm text-warm-muted">
                                Current login email: <span className="font-medium text-warm-dark">{sessionSummary?.email || auth.user?.email}</span>
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    value={emailInput}
                                    onChange={(event) => setEmailInput(event.target.value)}
                                    type="email"
                                    className="flex-1 rounded-xl border border-warm-border/30 bg-surface-low/40 px-4 py-3 text-sm text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15"
                                    placeholder="new-email@example.com"
                                />
                                <button
                                    onClick={handleEmailChange}
                                    disabled={savingEmail || !emailInput.trim()}
                                    className="rounded-xl bg-warm-dark px-4 py-3 text-sm text-surface-low transition-colors hover:bg-warm-dark/90 disabled:opacity-60"
                                >
                                    {savingEmail ? 'Sending...' : 'Change email'}
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-warm-border/30 bg-white px-5 py-5">
                            <div className="mb-4 flex items-center gap-2 text-sm text-warm-dark">
                                <KeyRound size={15} className="text-olive" />
                                Password
                            </div>
                            <div className="space-y-3">
                                <input
                                    value={passwordInput}
                                    onChange={(event) => setPasswordInput(event.target.value)}
                                    type="password"
                                    className="w-full rounded-xl border border-warm-border/30 bg-surface-low/40 px-4 py-3 text-sm text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15"
                                    placeholder="New password"
                                />
                                <input
                                    value={passwordConfirm}
                                    onChange={(event) => setPasswordConfirm(event.target.value)}
                                    type="password"
                                    className="w-full rounded-xl border border-warm-border/30 bg-surface-low/40 px-4 py-3 text-sm text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15"
                                    placeholder="Confirm new password"
                                />
                                <button
                                    onClick={handlePasswordChange}
                                    disabled={savingPassword || !passwordInput || !passwordConfirm}
                                    className="rounded-xl bg-warm-dark px-4 py-3 text-sm text-surface-low transition-colors hover:bg-warm-dark/90 disabled:opacity-60"
                                >
                                    {savingPassword ? 'Updating...' : 'Update password'}
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-warm-border/30 bg-white px-5 py-5">
                            <div className="mb-4 flex items-center gap-2 text-sm text-warm-dark">
                                <UserRoundCheck size={15} className="text-olive" />
                                Sessions
                            </div>
                            <div className="space-y-3 text-sm text-warm-muted">
                                <div className="rounded-xl bg-surface-low/40 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Current session</p>
                                    <p className="mt-2 text-sm font-medium text-warm-dark">
                                        {sessionSummary?.deviceLabel || 'Current browser session'}
                                    </p>
                                    <p className="mt-2 break-all font-mono text-xs text-warm-dark/70">
                                        {sessionSummary?.sessionId || 'Unavailable'}
                                    </p>
                                    <p className="mt-2">
                                        {sessionSummary?.expiresAt
                                            ? `Expires ${new Date(sessionSummary.expiresAt).toLocaleString()}`
                                            : 'Session expiry unavailable'}
                                    </p>
                                    {sessionSummary?.lastSeenAt && (
                                        <p className="mt-1 text-xs text-warm-outline">
                                            Last seen {new Date(sessionSummary.lastSeenAt).toLocaleString()}
                                        </p>
                                    )}
                                    {sessionSummary?.revokedAt && (
                                        <p className="mt-1 text-xs text-red-600">
                                            Revoked {new Date(sessionSummary.revokedAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        onClick={handleSignOutOthers}
                                        disabled={signingOutOthers}
                                        className="flex-1 rounded-xl border border-warm-border/30 px-4 py-3 text-sm text-warm-dark transition-colors hover:bg-surface-low disabled:opacity-60"
                                    >
                                        {signingOutOthers ? 'Signing out others...' : 'Log out other devices'}
                                    </button>
                                    <button
                                        onClick={handleSignOutEverywhere}
                                        disabled={signingOutEverywhere}
                                        className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                                    >
                                        {signingOutEverywhere ? 'Signing out everywhere...' : 'Log out all devices'}
                                    </button>
                                </div>

                                {trackedSessions.length > 0 && (
                                    <div className="rounded-xl border border-warm-border/20 bg-white/70 px-4 py-4">
                                        <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Tracked browser sessions</p>
                                        <div className="mt-3 space-y-3">
                                            {trackedSessions.map((tracked) => (
                                                <div key={tracked.id} className="rounded-xl border border-warm-border/20 bg-surface-low/30 px-4 py-3">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div>
                                                            <p className="font-medium text-warm-dark">
                                                                {tracked.deviceLabel || 'Browser session'}
                                                                {tracked.isCurrent ? ' (Current)' : ''}
                                                            </p>
                                                            <p className="mt-1 break-all font-mono text-[11px] text-warm-outline">
                                                                {tracked.sessionId || 'Unavailable'}
                                                            </p>
                                                            <p className="mt-1 text-xs text-warm-outline">
                                                                Last seen {tracked.lastSeenAt ? new Date(tracked.lastSeenAt).toLocaleString() : 'unknown'}
                                                            </p>
                                                            {tracked.ipAddress && (
                                                                <p className="mt-1 text-xs text-warm-outline">IP {tracked.ipAddress}</p>
                                                            )}
                                                            {tracked.revokedAt && (
                                                                <p className="mt-1 text-xs text-red-600">
                                                                    Revoked {new Date(tracked.revokedAt).toLocaleString()}
                                                                </p>
                                                            )}
                                                            {!tracked.revokedAt && tracked.isStale && (
                                                                <p className="mt-1 text-xs text-amber-700">
                                                                    This session has gone stale and has not checked in recently.
                                                                </p>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleRevokeSession(tracked.sessionId || '', tracked.isCurrent)}
                                                            disabled={!tracked.sessionId || !!tracked.revokedAt || revokingSessionId === tracked.sessionId}
                                                            className="rounded-xl border border-warm-border/30 px-4 py-2 text-xs text-warm-dark transition-colors hover:bg-surface-low disabled:opacity-50"
                                                        >
                                                            {revokingSessionId === tracked.sessionId
                                                                ? 'Revoking...'
                                                                : tracked.isCurrent
                                                                    ? 'Sign out this session'
                                                                    : tracked.revokedAt
                                                                        ? 'Already revoked'
                                                                        : 'Revoke session'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {anchorDevices.length > 0 && (
                                    <div className="rounded-xl border border-warm-border/20 bg-white/70 px-4 py-4">
                                        <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Anchor devices</p>
                                        <div className="mt-3 space-y-3">
                                            {anchorDevices.map((device) => (
                                                <div key={device.id} className="rounded-xl border border-warm-border/20 bg-surface-low/30 px-4 py-3">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div>
                                                            <p className="font-medium text-warm-dark">{device.deviceName}</p>
                                                            <p className="mt-1 text-xs text-warm-outline">
                                                                {(device.browser || 'Unknown browser')}{device.os ? ` on ${device.os}` : ''}
                                                            </p>
                                                            <p className="mt-1 text-xs text-warm-outline">
                                                                Status {device.status}
                                                            </p>
                                                            {device.lastSyncAt && (
                                                                <p className="mt-1 text-xs text-warm-outline">
                                                                    Last sync {new Date(device.lastSyncAt).toLocaleString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleRevokeAnchor(device.id)}
                                                            disabled={device.status === 'revoked' || revokingAnchorId === device.id}
                                                            className="rounded-xl border border-warm-border/30 px-4 py-2 text-xs text-warm-dark transition-colors hover:bg-surface-low disabled:opacity-50"
                                                        >
                                                            {revokingAnchorId === device.id
                                                                ? 'Revoking...'
                                                                : device.status === 'revoked'
                                                                    ? 'Already revoked'
                                                                    : 'Revoke device'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border border-warm-border/30 bg-white px-5 py-5">
                            <div className="mb-4 flex items-center gap-2 text-sm text-warm-dark">
                                <Smartphone size={15} className="text-olive" />
                                Two-factor authentication
                            </div>
                            <p className="text-sm text-warm-muted leading-relaxed">
                                This is now app-owned TOTP protection. You can use 1Password, Apple Passwords, Authy, or Google Authenticator.
                            </p>

                            {twoFactorState?.requiresChallenge && (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            Verify this session before removing factors or regenerating recovery codes.
                                            <div className="mt-2">
                                                <a href="/two-factor?next=/dashboard/settings" className="font-medium underline underline-offset-4">
                                                    Open two-factor challenge
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {twoFactorState?.enabled ? (
                                <div className="mt-4 space-y-3">
                                    {verifiedFactors.map((factor) => (
                                        <div key={factor.id} className="rounded-xl border border-warm-border/25 bg-surface-low/30 px-4 py-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <p className="font-medium text-warm-dark">{factor.friendlyName}</p>
                                                    <p className="mt-1 text-xs text-warm-outline">
                                                        Added {new Date(factor.createdAt).toLocaleString()}
                                                    </p>
                                                    {factor.lastUsedAt && (
                                                        <p className="mt-1 text-xs text-warm-outline">
                                                            Last used {new Date(factor.lastUsedAt).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFactor(factor.id)}
                                                    disabled={removingFactorId === factor.id}
                                                    className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                                                >
                                                    {removingFactorId === factor.id ? 'Removing...' : 'Remove'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-xl border-2 border-dashed border-warm-border/35 bg-surface-low/30 px-4 py-4 text-sm text-warm-muted">
                                    No authenticator app is connected yet.
                                </div>
                            )}

                            <div className="mt-5 space-y-3">
                                <input
                                    value={enrollingFactorName}
                                    onChange={(event) => setEnrollingFactorName(event.target.value)}
                                    type="text"
                                    className="w-full rounded-xl border border-warm-border/30 bg-surface-low/40 px-4 py-3 text-sm text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15"
                                    placeholder="Authenticator name"
                                />
                                <button
                                    onClick={handleStartEnrollment}
                                    disabled={enrolling}
                                    className="rounded-xl bg-warm-dark px-4 py-3 text-sm text-surface-low transition-colors hover:bg-warm-dark/90 disabled:opacity-60"
                                >
                                    {enrolling ? 'Preparing setup...' : twoFactorState?.enabled ? 'Add another authenticator' : 'Set up authenticator'}
                                </button>
                            </div>

                            {pendingEnrollment && (
                                <div className="mt-5 rounded-2xl border border-warm-border/30 bg-surface-low/30 p-4">
                                    <p className="text-sm font-medium text-warm-dark">{pendingEnrollment.friendlyName}</p>
                                    <p className="mt-2 text-sm text-warm-muted">
                                        Scan this QR code, then enter the 6-digit code to finish setup.
                                    </p>
                                    <div className="mt-4 flex flex-col gap-4 lg:flex-row">
                                        <img
                                            src={pendingEnrollment.qrCode}
                                            alt="Authenticator QR code"
                                            className="h-44 w-44 rounded-2xl border border-warm-border/20 bg-white p-3"
                                        />
                                        <div className="flex-1 space-y-3">
                                            <div className="rounded-xl bg-white px-4 py-3">
                                                <p className="text-[11px] uppercase tracking-[0.16em] text-warm-outline">Manual secret</p>
                                                <p className="mt-2 break-all font-mono text-sm text-warm-dark">{pendingEnrollment.secret}</p>
                                            </div>
                                            <input
                                                value={enrollmentCode}
                                                onChange={(event) => setEnrollmentCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                placeholder="123456"
                                                aria-label="6-digit authenticator verification code"
                                                className="w-full rounded-xl border border-warm-border/30 bg-white px-4 py-3 text-sm tracking-[0.2em] text-warm-dark focus:outline-none focus:ring-2 focus:ring-olive/15"
                                            />
                                            <button
                                                onClick={handleVerifyEnrollment}
                                                disabled={enrolling || enrollmentCode.trim().length < 6}
                                                className="rounded-xl bg-olive px-4 py-3 text-sm text-white transition-colors hover:bg-olive/90 disabled:opacity-60"
                                            >
                                                {enrolling ? 'Verifying...' : 'Finish setup'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-warm-border/30 bg-white px-5 py-5">
                            <div className="mb-4 flex items-center gap-2 text-sm text-warm-dark">
                                <CheckCircle2 size={15} className="text-olive" />
                                Recovery codes
                            </div>
                            <p className="text-sm text-warm-muted leading-relaxed">
                                Each recovery code works once if you lose access to your authenticator app.
                            </p>

                            <div className="mt-4 rounded-xl bg-surface-low/40 px-4 py-3 text-sm text-warm-muted">
                                {twoFactorState?.enabled
                                    ? `${twoFactorState.recoveryCodesRemaining} recovery code${twoFactorState.recoveryCodesRemaining !== 1 ? 's' : ''} remaining`
                                    : 'Recovery codes become available after setup is complete.'}
                            </div>

                            {freshRecoveryCodes.length > 0 && (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                                    <p className="text-sm font-medium text-amber-900">New recovery codes</p>
                                    <p className="mt-2 text-sm text-amber-800">
                                        These are shown only once. Store them before leaving this page.
                                    </p>
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                        {freshRecoveryCodes.map((code) => (
                                            <div key={code} className="rounded-xl bg-white px-4 py-3 font-mono text-sm text-warm-dark">
                                                {code}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleRegenerateRecoveryCodes}
                                disabled={!twoFactorState?.enabled || regeneratingRecoveryCodes}
                                className="mt-4 rounded-xl border border-warm-border/30 px-4 py-3 text-sm text-warm-dark transition-colors hover:bg-surface-low disabled:opacity-60"
                            >
                                {regeneratingRecoveryCodes ? 'Regenerating...' : 'Regenerate recovery codes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
