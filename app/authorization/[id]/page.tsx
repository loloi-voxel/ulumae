// app/authorization/[id]/page.tsx
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
import { createClient } from '@/utils/supabase/client';
import { Shield, Check, AlertTriangle, ArrowLeft, PenTool, Type, Clock, Loader2, Users, User } from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import fp from '@fingerprintjs/fingerprintjs';
import VideoRecorder from '@/components/VideoRecorder';
import toast from 'react-hot-toast';

const PUBLIC_FIGURE_KEYWORDS = [
  'President', 'Queen', 'King', 'Senator', 'Governor', 
  'CEO', 'Founder', 'Director', 'Minister', 'Artist', 'Actor'
];

export default function AuthorizationPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const memorialId = unwrappedParams.id;
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Check if this is a Master Account authorization or a Specific Individual one
    const isAccountLevel = searchParams.get('type') === 'account';
    const expectedAuthorizationType = isAccountLevel ? 'account' : 'individual';
    // Opened in a popup window from the confirmation page
    const isPopup = searchParams.get('popup') === 'true';

    const [loading, setLoading] = useState(true);
    const [memorialName, setMemorialName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [wantsVideo, setWantsVideo] = useState(false);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null); // To store the recorded video

    const [isSuccess, setIsSuccess] = useState(false);
    const [authorizationLocked, setAuthorizationLocked] = useState(false);
    
    const [identity, setIdentity] = useState({
        fullName: '',
        email: '',
        relationship: isAccountLevel ? 'Account Holder' : ''
    });

    const [agreements, setAgreements] = useState({
        legal_authority: false,
        good_faith: false,
        permanence: false,
        indemnification: false
    });

    const [signatureType, setSignatureType] = useState<'drawn' | 'typed'>('typed');
    const [signatureValue, setSignatureValue] = useState<string | null>(null);
    const [signatureTimestamp, setSignatureTimestamp] = useState<string | null>(null);
    const [finalConfirmation, setFinalConfirmation] = useState(false);

    const [isMandatory, setIsMandatory] = useState(false);
    const [mandatoryReason, setMandatoryReason] = useState('');

    useEffect(() => {
        loadData();
    }, [memorialId, expectedAuthorizationType]);

    const loadData = async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: existingAuthorization } = await supabase
                    .from('memorial_authorizations')
                    .select('id')
                    .eq('memorial_id', memorialId)
                    .eq('user_id', user.id)
                    .eq('authorization_type', expectedAuthorizationType)
                    .in('status', ['pending', 'approved'])
                    .maybeSingle();

                if (existingAuthorization) {
                    setAuthorizationLocked(true);
                    setIsSuccess(true);
                    localStorage.setItem(`lv-auth-${memorialId}`, 'done');
                }
            }

            if (isAccountLevel) {
                setMemorialName("Family Plan Account");
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('memorials')
                .select('step1, mode') // Added mode
                .eq('id', memorialId)
                .single();

            if (error) throw error;
            
            const fullName = data?.step1?.fullName || 'the Deceased';
            setMemorialName(fullName);

            // --- HIGH RISK DETECTION LOGIC ---
            let mandatory = false;
            let reason = '';

            // 1. Check if Concierge/Premium
            if (data.mode === 'concierge') {
                mandatory = true;
                reason = 'Required for white-glove Concierge Service to ensure maximum legal protection.';
            } 
            // 2. Check for public figure keywords in name
            else if (PUBLIC_FIGURE_KEYWORDS.some(k => fullName.toLowerCase().includes(k.toLowerCase()))) {
                mandatory = true;
                reason = 'Required for archives of public figures to prevent identity disputes.';
            }
            // 3. Strongly recommend for Family mode (optional but flagged)
            else if (data.mode === 'family') {
                setWantsVideo(true); // Default to on, but user can still uncheck unless mandatory
            }

            if (mandatory) {
                setIsMandatory(true);
                setMandatoryReason(reason);
                setWantsVideo(true);
            }
            // ---------------------------------

        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleAgreement = (key: keyof typeof agreements) => {
        setAgreements(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSignatureInput = (val: string | null) => {
        setSignatureValue(val);
        setFinalConfirmation(false);
        if (val) {
            setSignatureTimestamp(new Date().toLocaleString('en-US', { 
                timeZoneName: 'short', dateStyle: 'long', timeStyle: 'long' 
            }));
        } else {
            setSignatureTimestamp(null);
        }
    };

    // Add this helper function at the top of your component or inside handleAuthorize
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleAuthorize = async () => {
        if (!memorialId) return;
        if (authorizationLocked) {
            toast.error('This authorization has already been recorded.');
            return;
        }
        setIsSubmitting(true);

        try {
            // 1. Generate Device Fingerprint
            const agent = await fp.load();
            const fpResult = await agent.get();
            const fingerprint = fpResult.visitorId;
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id;

            // 2. Prepare Video Data (if recorded)
            let videoData = null;
            if (wantsVideo && videoBlob) {
                videoData = await blobToBase64(videoBlob);
            }

            // 3. Submit to Server API
            const response = await fetch('/api/authorization/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memorialId,
                    userId,
                    identity,
                    agreements,
                    signature: { type: signatureType, content: signatureValue },
                    fingerprint,
                    authorizationType: expectedAuthorizationType,
                    videoContent: videoData // <--- ADDED THE VIDEO DATA HERE
                })
            });

            const data = await response.json();
            if (data.code === 'ALREADY_AUTHORIZED') {
                setAuthorizationLocked(true);
            }
            if (data.error) throw new Error(data.error);

            setIsSuccess(true);

            if (isPopup) {
                // Signal the parent confirmation window that auth is done
                try {
                    window.opener?.postMessage({ type: 'lv-auth-complete', memorialId }, '*');
                } catch (_) {}
                // Write to localStorage as a fallback (parent polls this)
                localStorage.setItem(`lv-auth-${memorialId}`, 'done');
                // No auto-redirect — user closes the window manually
            } else {
                // Step 2.3.3: Post-signature, pre-payment transition
                // Show "Your authorization has been recorded" for 3 seconds
                // then redirect to the payment page
                setTimeout(() => {
                    const redirectTo = searchParams.get('redirect');
                    if (redirectTo === 'payment') {
                        // New flow: authorization → payment page
                        router.push(`/payment?memorialId=${memorialId}`);
                    } else if (redirectTo === 'personal') {
                        router.push('/personal-confirmation?authorized=true');
                    } else if (redirectTo === 'family') {
                        router.push('/family-confirmation?authorized=true');
                    } else if (isAccountLevel) {
                        router.push('/family-confirmation?authorized=true');
                    } else {
                        router.push(`/create?id=${memorialId}&mode=draft&authorized=true`);
                    }
                }, 3000);
            }

        } catch (err: any) {
            if (err?.message?.includes('already been recorded')) {
                setAuthorizationLocked(true);
                setIsSuccess(true);
                localStorage.setItem(`lv-auth-${memorialId}`, 'done');
                setIsSubmitting(false);
                return;
            }
            console.error("Authorization failed:", err);
            toast.error(`Authorization failed: ${err.message}`);
            setIsSubmitting(false);
        }
    };

    const allAgreed = Object.values(agreements).every(Boolean);
    const isIdentityComplete = identity.fullName.trim().length > 2 && identity.email.includes('@');
    const isSignatureValid = signatureType === 'drawn' 
        ? !!signatureValue 
        : signatureValue?.trim().toLowerCase() === identity.fullName.trim().toLowerCase();

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-olive/30 border-t-olive rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-low text-warm-dark font-sans selection:bg-olive/20 pb-20">
            <header className="border-b border-warm-border/30 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button onClick={() => router.back()} className="text-sm text-warm-muted hover:text-warm-dark flex items-center gap-2 transition-colors">
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="flex items-center gap-2 text-olive font-medium">
                        <Shield size={18} />
                        <span className="text-sm tracking-wide uppercase">
                            {isAccountLevel ? 'Master Account Authorization' : 'Archive Authorization'}
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-12">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-olive/10 rounded-2xl text-olive mb-6">
                        {isAccountLevel ? <Users size={32} /> : <User size={32} />}
                    </div>
                    <h1 className="font-serif text-3xl md:text-4xl text-warm-dark mb-4">
                        {isAccountLevel ? 'Master Guardian Declaration' : 'Declaration of Authority'}
                    </h1>
                    <p className="text-warm-muted leading-relaxed">
                        {isAccountLevel 
                          ? "As the Master Guardian, you are assuming legal responsibility for all archives created under this Family Account."
                          : `Establishing the permanent archive for ${memorialName}.`
                        }
                    </p>
                </div>

                {/* 1. Identity Form */}
                <div className="bg-white p-8 rounded-2xl border border-warm-border/30 shadow-sm mb-8">
                    <h2 className="font-serif text-xl text-warm-dark mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-olive text-warm-bg flex items-center justify-center text-xs font-sans">1</span>
                        Your Identity
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-warm-outline mb-1 uppercase tracking-widest">Full Legal Name</label>
                            <input
                                type="text"
                                value={identity.fullName}
                                onChange={e => setIdentity({...identity, fullName: e.target.value})}
                                placeholder="e.g. Eleanor Marie Thompson"
                                className="w-full px-4 py-3 glass-input rounded-lg"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-warm-outline mb-1 uppercase tracking-widest">Email Address</label>
                                <input
                                    type="email"
                                    value={identity.email}
                                    onChange={e => setIdentity({...identity, email: e.target.value})}
                                    placeholder="name@example.com"
                                    className="w-full px-4 py-3 glass-input rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-warm-outline mb-1 uppercase tracking-widest">
                                    {isAccountLevel ? 'Your Role' : 'Relationship to Deceased'}
                                </label>
                                <input
                                    type="text"
                                    value={identity.relationship}
                                    onChange={e => setIdentity({...identity, relationship: e.target.value})}
                                    placeholder={isAccountLevel ? "Account Holder" : "e.g. Daughter, Executor"}
                                    disabled={isAccountLevel}
                                    className={`w-full px-4 py-3 glass-input rounded-lg ${isAccountLevel ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Declarations - Dynamic Wording */}
                <div className={`bg-white p-8 rounded-2xl border border-warm-border/30 shadow-sm mb-8 transition-all ${!isIdentityComplete ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <h2 className="font-serif text-xl text-warm-dark mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-olive text-warm-bg flex items-center justify-center text-xs font-sans">2</span>
                        Solemn Declarations
                    </h2>

                    <div className="space-y-4">
                        <label className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${agreements.legal_authority ? 'border-olive/50 bg-olive/5' : 'border-transparent hover:bg-warm-border/10'}`}>
                            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${agreements.legal_authority ? 'bg-olive border-olive text-warm-bg' : 'border-warm-border/60 bg-white'}`}>
                                {agreements.legal_authority && <Check size={12} strokeWidth={3} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={agreements.legal_authority} onChange={() => toggleAgreement('legal_authority')} />
                            <div>
                                <p className="font-medium text-sm text-warm-dark">I assert legal authority.</p>
                                <p className="text-xs text-warm-muted mt-1">
                                    {isAccountLevel
                                      ? "I am responsible for all content created within this Family Account."
                                      : "I am the next of kin, executor, or have explicit consent from the legal representative."}
                                </p>
                            </div>
                        </label>

                        <label className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${agreements.good_faith ? 'border-olive/50 bg-olive/5' : 'border-transparent hover:bg-warm-border/10'}`}>
                            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${agreements.good_faith ? 'bg-olive border-olive text-warm-bg' : 'border-warm-border/60 bg-white'}`}>
                                {agreements.good_faith && <Check size={12} strokeWidth={3} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={agreements.good_faith} onChange={() => toggleAgreement('good_faith')} />
                            <div>
                                <p className="font-medium text-sm text-warm-dark">I am acting in good faith.</p>
                                <p className="text-xs text-warm-muted mt-1">I will ensure all content is accurate, respectful, and dignified.</p>
                            </div>
                        </label>

                        <label className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${agreements.permanence ? 'border-olive/50 bg-olive/5' : 'border-transparent hover:bg-warm-border/10'}`}>
                            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${agreements.permanence ? 'bg-olive border-olive text-warm-bg' : 'border-warm-border/60 bg-white'}`}>
                                {agreements.permanence && <Check size={12} strokeWidth={3} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={agreements.permanence} onChange={() => toggleAgreement('permanence')} />
                            <div>
                                <p className="font-medium text-sm text-warm-dark">I understand the permanence.</p>
                                <p className="text-xs text-warm-muted mt-1">These archives are intended as a permanent historical and family record.</p>
                            </div>
                        </label>

                        <label className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${agreements.indemnification ? 'border-warm-brown/50 bg-warm-brown/5' : 'border-transparent hover:bg-warm-border/10'}`}>
                            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${agreements.indemnification ? 'bg-warm-brown border-warm-brown text-warm-bg' : 'border-warm-border/60 bg-white'}`}>
                                {agreements.indemnification && <Check size={12} strokeWidth={3} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={agreements.indemnification} onChange={() => toggleAgreement('indemnification')} />
                            <div>
                                <p className="font-medium text-sm text-warm-dark">I agree to indemnify ULUMAE.</p>
                                <p className="text-xs text-warm-muted mt-1">I hold ULUMAE harmless from any claims or family disputes arising from this account.</p>
                            </div>
                        </label>
                    </div>
                </div>


                {/* 2.5 Video Verification (Smarter Logic) */}
                <div className={`bg-white p-8 rounded-2xl border border-warm-border/30 shadow-sm mb-8 transition-all ${!allAgreed ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <div className="flex items-start justify-between mb-4">
                        <h2 className="font-serif text-xl text-warm-dark flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-olive text-warm-bg flex items-center justify-center text-xs font-sans">2.5</span>
                            Video Signature
                        </h2>
                        {isMandatory ? (
                            <div className="px-3 py-1 bg-warm-dark text-warm-bg text-[10px] font-bold uppercase tracking-widest rounded-full border border-warm-dark/20 flex items-center gap-1">
                                <Shield size={10} /> Required
                            </div>
                        ) : (
                            <div className="px-3 py-1 bg-warm-brown/10 text-warm-brown text-[10px] font-bold uppercase tracking-widest rounded-full border border-warm-brown/20">
                                Recommended
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-warm-muted mb-6 leading-relaxed">
                        {isMandatory
                            ? "Due to the nature of this archive, a video signature is required to ensure maximum legal protection for the family."
                            : "Adding a video signature provides irrefutable proof of your identity. It is securely stored and only accessed if a legal dispute arises."
                        }
                    </p>

                    {isMandatory && (
                        <div className="mb-6 p-4 bg-olive/5 border border-olive/20 rounded-xl flex items-start gap-3">
                            <AlertTriangle size={18} className="text-olive flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-warm-muted leading-relaxed">
                                <strong>Why is this required?</strong> {mandatoryReason}
                                <br />
                                This additional precaution protects everyone—including you—in case of future family conflict or claims regarding the archive's validity.
                            </p>
                        </div>
                    )}

                    <label className={`flex items-center gap-4 p-4 rounded-xl border-2 border-dashed transition-all ${
                        isMandatory
                        ? 'bg-surface-low border-warm-border/20 opacity-80 cursor-default'
                        : 'border-warm-border/60 hover:border-olive/40 hover:bg-olive/5 cursor-pointer group'
                    }`}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${wantsVideo ? 'bg-olive border-olive text-warm-bg' : 'border-warm-border/60 bg-white group-hover:border-warm-border'}`}>
                            {wantsVideo && <Check size={14} strokeWidth={3} />}
                        </div>
                        <input
                            type="checkbox"
                            className="hidden"
                            checked={wantsVideo}
                            onChange={() => !isMandatory && setWantsVideo(!wantsVideo)}
                            disabled={isMandatory}
                        />
                        <span className="text-sm font-medium text-warm-dark">
                            {isMandatory ? "I will record my video signature below." : "Yes, I want to strengthen my authorization with a 10-second video."}
                        </span>
                    </label>

                    {wantsVideo && (
                        <div className="mt-8 p-6 bg-surface-low rounded-xl border border-warm-border/30 animate-fadeIn">
                            <VideoRecorder
                                fullName={identity.fullName}
                                deceasedName={memorialName}
                                onComplete={(blob) => setVideoBlob(blob)}
                            />

                            {videoBlob && (
                                <div className="mt-4 flex items-center justify-center gap-2 text-olive font-medium text-sm animate-fadeIn">
                                    Video recorded and signed.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. Signature */}
                {allAgreed && isIdentityComplete && (
                    <div className="bg-white p-8 rounded-2xl border border-warm-border/30 shadow-sm mb-8 animate-fadeIn">
                        <h2 className="font-serif text-xl text-warm-dark mb-6 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-olive text-warm-bg flex items-center justify-center text-xs font-sans">3</span>
                            Digital Signature
                        </h2>

                        <div className="flex gap-2 p-1 bg-warm-border/10 rounded-xl mb-6">
                            <button onClick={() => { setSignatureType('typed'); setSignatureValue(''); }} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${signatureType === 'typed' ? 'bg-white shadow-sm text-warm-dark' : 'text-warm-outline hover:text-warm-dark'}`}>
                                <Type size={16} /> Type Name
                            </button>
                            <button onClick={() => { setSignatureType('drawn'); setSignatureValue(''); }} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${signatureType === 'drawn' ? 'bg-white shadow-sm text-warm-dark' : 'text-warm-outline hover:text-warm-dark'}`}>
                                <PenTool size={16} /> Draw Signature
                            </button>
                        </div>

                        <div className="mb-6">
                            {signatureType === 'typed' ? (
                                <div className="space-y-2">
                                    <input type="text" placeholder={`Type "${identity.fullName}" to sign`} className="w-full px-4 py-4 rounded-xl border-2 border-warm-border/40 focus:outline-none focus:ring-2 focus:ring-olive/20 bg-surface-low/30 font-serif text-xl text-center" onChange={(e) => handleSignatureInput(e.target.value)} value={signatureValue || ''} />
                                    {signatureValue && !isSignatureValid && <p className="text-xs text-red-500 text-center">Must exactly match your full name.</p>}
                                </div>
                            ) : ( <SignaturePad onEnd={handleSignatureInput} /> )}
                        </div>

                        {isSignatureValid && (
                            <div className="p-6 bg-warm-border/5 rounded-xl border border-warm-border/20 animate-fadeIn">
                                <div className="flex flex-col items-center gap-2">
                                    {signatureType === 'drawn' ? <img src={signatureValue!} alt="Signature" className="h-16 object-contain" /> : <p className="font-serif text-3xl text-warm-dark italic">{signatureValue}</p>}
                                    <div className="flex items-center gap-1.5 text-xs text-olive font-mono mt-2 bg-white px-3 py-1 rounded-full border border-olive/20">
                                        <Clock size={12} /> {signatureTimestamp}
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-warm-border/20">
                                    <label className="flex items-center justify-center gap-3 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${finalConfirmation ? 'bg-warm-dark border-warm-dark text-warm-bg' : 'border-warm-dark/30 bg-white group-hover:border-warm-dark'}`}>
                                            {finalConfirmation && <Check size={12} strokeWidth={3} />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={finalConfirmation} onChange={() => setFinalConfirmation(!finalConfirmation)} />
                                        <span className="text-sm font-medium text-warm-dark">I confirm this signature is legally binding.</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="text-center pb-8">
                    {wantsVideo && !videoBlob && allAgreed && isSignatureValid && (
                        <p className="text-xs text-warm-brown mb-4 flex items-center justify-center gap-1 animate-pulse">Please complete your 10-second video recording to continue.</p>
                    )}
                    <button
                        onClick={handleAuthorize}
                        disabled={
                            !allAgreed ||
                            !isIdentityComplete ||
                            !isSignatureValid ||
                            !finalConfirmation ||
                            isSubmitting ||
                            (wantsVideo && !videoBlob)
                        }
                        className="w-full py-4 rounded-lg bg-warm-dark text-warm-bg font-medium shadow-lg hover:bg-warm-dark/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Shield size={20} />}
                        {isAccountLevel ? 'Authorize Family Account' : 'Authorize Memorial'}
                    </button>
                </div>
                {isSuccess && (
                    <div className="fixed inset-0 z-[110] bg-surface-low/95 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
                        <div className="max-w-md w-full text-center">
                            <div className="w-16 h-16 bg-warm-dark rounded-full flex items-center justify-center mx-auto mb-6">
                                <Check className="text-warm-bg" size={28} strokeWidth={2.5} />
                            </div>
                            <h2 className="font-serif text-3xl text-warm-dark mb-4">
                                {authorizationLocked ? 'Authorization Already Recorded' : 'Authorization Recorded'}
                            </h2>
                            <p className="text-warm-outline mb-8 leading-relaxed">
                                {authorizationLocked
                                    ? 'This authorization was already completed for this archive and cannot be submitted again.'
                                    : 'Your authorization has been recorded. You may now proceed to payment.'}
                            </p>

                            {isPopup ? (
                                <div className="bg-surface-high border border-warm-border/30 rounded-2xl p-6">
                                    <p className="font-medium text-warm-dark mb-1">
                                        You can now close this window.
                                    </p>
                                    <p className="text-sm text-warm-muted mb-5">
                                        Return to the previous window to proceed with your payment.
                                    </p>
                                    <button
                                        onClick={() => window.close()}
                                        className="px-6 py-2.5 bg-warm-dark text-warm-bg rounded-full text-sm font-medium hover:bg-warm-dark/90 transition-all"
                                    >
                                        Close this window
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 text-warm-outline text-sm italic">
                                    <Loader2 size={16} className="animate-spin" />
                                    Returning to your archive…
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
