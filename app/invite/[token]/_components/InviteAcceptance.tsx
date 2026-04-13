'use client';

import { useState } from 'react';
import {
    Shield, Check, ChevronRight,
    Loader2, AlertCircle, User,
    Eye, Edit, MessageCircle
} from 'lucide-react';
import { InvitationData } from '../page';
import { WitnessRole } from '@/types/roles';

interface Props {
    invitation: InvitationData;
    token: string;
    currentUserEmail: string | null;
    onSwitchAccount: () => void;
    onSuccess: (memorialId: string, role: string) => void;
}

const ROLE_CONFIG: Record<'witness' | 'co_guardian' | 'reader', {
    label: string;
    color: string;
    description: string;
    capabilities: { icon: any; text: string }[];
    cannotDo: string[];
}> = {
    witness: {
        label: 'Witness',
        color: 'bg-olive/10 text-olive border-olive/20',
        description:
            'You can share memories and photos. ' +
            'The archive owner reviews all contributions ' +
            'before they appear.',
        capabilities: [
            {
                icon: MessageCircle,
                text: 'Share memories and stories'
            },
            {
                icon: Eye,
                text: 'Read the full archive'
            },
            {
                icon: Check,
                text: 'Suggest photos (owner approves)'
            }
        ],
        cannotDo: [
            'Edit the main biography',
            'Delete content',
            'Invite others'
        ]
    },
    co_guardian: {
        label: 'Co-Guardian',
        color: 'bg-warm-muted/10 text-warm-muted border-warm-muted/20',
        description:
            'You share stewardship of this archive. ' +
            'You can review and approve contributions ' +
            'from witnesses, and edit memorial content across the family archive.',
        capabilities: [
            {
                icon: Edit,
                text: 'Edit and add content directly'
            },
            {
                icon: Shield,
                text: 'Review witness contributions'
            },
            {
                icon: Eye,
                text: 'Move across family memorials'
            }
        ],
        cannotDo: [
            'Delete the archive',
            'Change the owner',
            'Access billing',
            'Invite other people'
        ]
    },
    reader: {
        label: 'Reader',
        color: 'bg-warm-border/25 text-warm-dark/60 border-warm-border/40',
        description:
            'You can read and explore this archive, but you cannot contribute to it or edit anything inside it.',
        capabilities: [
            {
                icon: Eye,
                text: 'Read the full archive'
            }
        ],
        cannotDo: [
            'Share memories or photos',
            'Edit archive content',
            'Invite others'
        ]
    }
} as const;

const ACKNOWLEDGEMENT_COPY = {
    witness: {
        firstTitle: 'I understand my contributions are reviewed',
        firstBody: 'Everything I share will be reviewed by the archive owner before it appears. This protects the dignity of the archive.',
        secondTitle: 'I will honour this archive with care',
        secondBody: 'I will only share memories that are truthful and respectful. I understand this is a permanent family record.'
    },
    co_guardian: {
        firstTitle: 'I understand this role carries stewardship responsibility',
        firstBody: 'I may help review contributions and shape how this archive is preserved for the family.',
        secondTitle: 'I will act with care and respect',
        secondBody: 'I will only make edits or decisions that protect the truth, dignity, and continuity of this archive.'
    },
    reader: {
        firstTitle: 'I understand this archive is private',
        firstBody: 'What I read here belongs to a family memory space and should be treated with discretion and respect.',
        secondTitle: 'I will honour the family context of this archive',
        secondBody: 'I understand this invitation is for reading and remembrance, not for editing or contributing.'
    }
} as const;

export default function InviteAcceptance({
    invitation,
    token,
    currentUserEmail,
    onSwitchAccount,
    onSuccess
}: Props) {
    const [checkedModeration, setCheckedModeration] =
        useState(false);
    const [checkedDignity, setCheckedDignity] =
        useState(false);
    const [loading, setLoading] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeclineConfirm, setShowDeclineConfirm] =
        useState(false);

    const role = invitation.role as WitnessRole;
    const roleKey = (role === 'reader' ? 'reader' : role) as keyof typeof ROLE_CONFIG;
    const roleConfig = ROLE_CONFIG[roleKey];
    const acknowledgmentCopy = ACKNOWLEDGEMENT_COPY[roleKey];
    const signedInAsDifferentUser = !!currentUserEmail
        && currentUserEmail.toLowerCase() !== invitation.inviteeEmail.toLowerCase();
    const canJoin = checkedModeration && checkedDignity && !signedInAsDifferentUser;

    const handleJoin = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/invite/${token}/join`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                }
            );

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(
                    data.error || 'Failed to join. Please try again.'
                );
                return;
            }

            onSuccess(data.memorialId, data.role);
        } catch {
            setError(
                'A network error occurred. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        setDeclining(true);
        try {
            await fetch(`/api/invite/${token}/decline`, {
                method: 'POST'
            });
            window.location.href = '/';
        } catch {
            setDeclining(false);
        }
    };

    const formatYear = (d: string | null) =>
        d ? new Date(d).getFullYear() : null;

    const birthYear = formatYear(
        invitation.memorial.birthDate
    );
    const deathYear = formatYear(
        invitation.memorial.deathDate
    );

    return (
        <div className="min-h-screen bg-gradient-to-br
      from-olive/10 via-surface-low to-warm-muted/10">
            <div className="border-b border-warm-border/20
        bg-white/60 backdrop-blur-sm">
                <div className="max-w-2xl mx-auto px-6 py-4
          text-center">
                    <span className="text-xs tracking-widest
            uppercase text-warm-dark/30 font-sans">
                        ULUMAE
                    </span>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-16">
                <div className="flex flex-col items-center
          text-center mb-12">
                    {invitation.memorial.profilePhotoUrl ? (
                        <div className="w-24 h-24 rounded-full
              overflow-hidden border-4 border-white
              shadow-lg mb-6">
                            <img
                                src={invitation.memorial.profilePhotoUrl}
                                alt={invitation.memorial.fullName}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-full
              bg-gradient-to-br from-olive/20
              to-warm-muted/20 border-4 border-white
              shadow-lg flex items-center
              justify-center mb-6">
                            <User size={36}
                                className="text-warm-dark/20" />
                        </div>
                    )}

                    <h1 className="font-serif text-4xl
            text-warm-dark mb-2">
                        {invitation.memorial.fullName}
                    </h1>

                    {(birthYear || deathYear) && (
                        <p className="font-serif italic
              text-warm-dark/40 text-lg">
                            {birthYear && deathYear
                                ? `${birthYear} - ${deathYear}`
                                : birthYear
                                    ? `Born ${birthYear}`
                                    : ''}
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-2xl
          border border-warm-border/30 shadow-sm
          overflow-hidden mb-6">
                    <div className="px-8 pt-8 pb-6
            border-b border-warm-border/20">
                        <p className="text-warm-dark/60
              text-base leading-relaxed">
                            <strong className="text-warm-dark">
                                {invitation.inviterName}
                            </strong>{' '}
                            has invited you to join this archive
                            as a{' '}
                            <span className={`inline-flex
                items-center gap-1 px-2.5 py-0.5
                rounded-full text-sm font-medium
                border ${roleConfig.color}`}>
                                {roleConfig.label}
                            </span>
                        </p>
                        <p className="mt-3 text-sm text-warm-dark/45">
                            Invitation address: <strong>{invitation.inviteeEmail}</strong>
                        </p>
                    </div>

                    <div className="px-8 py-6
            border-b border-warm-border/20">
                        <p className="text-sm text-warm-dark/50
              leading-relaxed mb-5">
                            {roleConfig.description}
                        </p>

                        <div className="grid grid-cols-1
              sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold
                  text-warm-dark/40 uppercase
                  tracking-wider mb-3">
                                    As a {roleConfig.label} you can
                                </p>
                                <ul className="space-y-2">
                                    {roleConfig.capabilities.map(
                                        (cap: { icon: any; text: string }, i: number) => {
                                            const Icon = cap.icon;
                                            return (
                                                <li key={i}
                                                    className="flex items-center
                            gap-2.5 text-sm
                            text-warm-dark/70">
                                                    <Icon size={14}
                                                        className="text-olive
                              flex-shrink-0" />
                                                    {cap.text}
                                                </li>
                                            );
                                        }
                                    )}
                                </ul>
                            </div>

                            <div>
                                <p className="text-xs font-semibold
                  text-warm-dark/40 uppercase
                  tracking-wider mb-3">
                                    You cannot
                                </p>
                                <ul className="space-y-2">
                                    {roleConfig.cannotDo.map((item: string, i: number) => (
                                        <li key={i}
                                            className="flex items-center
                        gap-2.5 text-sm
                        text-warm-dark/40">
                                            <div className="w-3.5 h-3.5
                        flex items-center
                        justify-center flex-shrink-0">
                                                <div className="w-1.5 h-1.5
                          rounded-full
                          bg-warm-dark/20" />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-6 space-y-4">
                        <label className={`flex items-start
              gap-4 p-4 rounded-xl border-2
              cursor-pointer transition-all ${checkedModeration
                                ? 'border-olive/40 bg-olive/5'
                                : 'border-warm-border/30 hover:bg-warm-border/10'
                            }`}>
                            <div className={`w-5 h-5 rounded
                border-2 flex items-center
                justify-center flex-shrink-0 mt-0.5
                transition-colors ${checkedModeration
                                    ? 'bg-olive border-olive'
                                    : 'border-warm-border/60 bg-white'
                                }`}>
                                {checkedModeration && (
                                    <Check size={12}
                                        className="text-white"
                                        strokeWidth={3} />
                                )}
                            </div>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={checkedModeration}
                                onChange={e =>
                                    setCheckedModeration(e.target.checked)
                                }
                                aria-label={acknowledgmentCopy.firstTitle}
                            />
                            <div>
                                <p className="text-sm font-medium
                  text-warm-dark mb-1">
                                    {acknowledgmentCopy.firstTitle}
                                </p>
                                <p className="text-xs
                  text-warm-dark/50 leading-relaxed">
                                    {acknowledgmentCopy.firstBody}
                                </p>
                            </div>
                        </label>

                        <label className={`flex items-start
              gap-4 p-4 rounded-xl border-2
              cursor-pointer transition-all ${checkedDignity
                                ? 'border-warm-dark/20 bg-warm-border/5'
                                : 'border-warm-border/30 hover:bg-warm-border/10'
                            }`}>
                            <div className={`w-5 h-5 rounded
                border-2 flex items-center
                justify-center flex-shrink-0 mt-0.5
                transition-colors ${checkedDignity
                                    ? 'bg-warm-dark border-warm-dark'
                                    : 'border-warm-border/60 bg-white'
                                }`}>
                                {checkedDignity && (
                                    <Check size={12}
                                        className="text-white"
                                        strokeWidth={3} />
                                )}
                            </div>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={checkedDignity}
                                onChange={e =>
                                    setCheckedDignity(e.target.checked)
                                }
                                aria-label={acknowledgmentCopy.secondTitle}
                            />
                            <div>
                                <p className="text-sm font-medium
                  text-warm-dark mb-1">
                                    {acknowledgmentCopy.secondTitle}
                                </p>
                                <p className="text-xs
                  text-warm-dark/50 leading-relaxed">
                                    {acknowledgmentCopy.secondBody}
                                </p>
                            </div>
                        </label>
                    </div>

                    {signedInAsDifferentUser && (
                        <div className="mx-8 mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm leading-relaxed text-amber-800">
                                You are signed in as <strong>{currentUserEmail}</strong>, but this invitation was sent to <strong>{invitation.inviteeEmail}</strong>.
                                Switch accounts to continue securely with the invited email.
                            </p>
                            <button
                                onClick={onSwitchAccount}
                                className="mt-3 inline-flex items-center rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
                            >
                                Sign out and continue
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mx-8 mb-6 p-4
              bg-red-50 border border-red-200
              rounded-xl flex items-start gap-3">
                            <AlertCircle size={16}
                                className="text-red-500 mt-0.5
                  flex-shrink-0" />
                            <p className="text-sm text-red-700">
                                {error}
                            </p>
                        </div>
                    )}

                    <div className="px-8 pb-8">
                        <button
                            onClick={handleJoin}
                            disabled={!canJoin || loading}
                            className={`w-full py-4 rounded-xl
                font-medium transition-all flex
                items-center justify-center gap-2
                ${canJoin && !loading
                                    ? 'glass-btn-dark shadow-lg'
                                    : 'bg-warm-border/20 text-warm-dark/30 cursor-not-allowed'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18}
                                        className="animate-spin" />
                                    Joining archive...
                                </>
                            ) : (
                                <>
                                    Join this archive
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>

                        {!canJoin && !loading && (
                            <p className="text-center text-xs
                text-warm-dark/30 mt-3">
                                {signedInAsDifferentUser
                                    ? 'Use the invited account before accepting this invitation.'
                                    : 'Please confirm both statements above to continue'}
                            </p>
                        )}
                    </div>
                </div>

                {!showDeclineConfirm ? (
                    <div className="text-center">
                        <button
                            onClick={() =>
                                setShowDeclineConfirm(true)
                            }
                            className="text-sm text-warm-dark/25
                hover:text-warm-dark/50
                transition-colors"
                        >
                            I would prefer not to join
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl
            border border-warm-border/30 p-6 text-center">
                        <p className="text-sm text-warm-dark/60
              mb-4 leading-relaxed">
                            That is completely fine. You can always
                            ask{' '}
                            <strong>{invitation.inviterName}</strong>
                            {' '}for a new invitation later.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() =>
                                    setShowDeclineConfirm(false)
                                }
                                className="flex-1 py-2.5 border
                  border-warm-border/40 rounded-xl text-sm
                  text-warm-dark/60
                  hover:bg-warm-border/10 transition-all"
                            >
                                Go back
                            </button>
                            <button
                                onClick={handleDecline}
                                disabled={declining}
                                className="flex-1 py-2.5
                  bg-warm-dark/10 rounded-xl
                  text-sm text-warm-dark/60
                  hover:bg-warm-dark/20 transition-all
                  flex items-center justify-center
                  gap-2"
                            >
                                {declining ? (
                                    <Loader2 size={14}
                                        className="animate-spin" />
                                ) : (
                                    'Decline invitation'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
