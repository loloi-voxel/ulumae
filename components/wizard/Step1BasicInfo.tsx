// components/wizard/Step1BasicInfo.tsx
'use client';
import { useState, useRef } from 'react';
import { Upload, X, Calendar, MapPin, Quote, User, AlertTriangle, Users, Eye, ArrowRight, Loader2, Lock } from 'lucide-react';
import { BasicInfo } from '@/types/memorial';
import { deleteMediaAssets, secureUpload } from '@/lib/uploadService';

interface Step1Props {
    data: BasicInfo;
    onUpdate: (data: BasicInfo) => void;
    onNext: () => void;
    readOnly?: boolean;
    memorialId: string | null;
}

export default function Step1BasicInfo({ data, onUpdate, onNext, readOnly, memorialId }: Step1Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [potentialDuplicates, setPotentialDuplicates] = useState<any[]>([]);
    const [checkingDuplicates, setCheckingDuplicates] = useState(false);
    const [photoError, setPhotoError] = useState<string | null>(null);


    const handleChange = (field: keyof BasicInfo, value: any) => {
        onUpdate({ ...data, [field]: value });
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!memorialId) {
            setPhotoError('Please wait for the private preview to finish initializing before adding a profile photo.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const preview = reader.result as string;
            onUpdate({
                ...data,
                profilePhoto: file,
                profilePhotoPreview: preview,
                profilePhotoUploadStatus: 'uploading',
                profilePhotoUploadError: null,
            });
            setPhotoError(null);

            const result = await secureUpload(file, {
                memorialId,
                kind: 'profile_photo',
            });

            if (!result.success || !result.asset) {
                const errorMessage = result.error || 'Could not upload the profile photo.';
                setPhotoError(errorMessage);
                onUpdate({
                    ...data,
                    profilePhoto: file,
                    profilePhotoPreview: preview,
                    profilePhotoUploadStatus: 'error',
                    profilePhotoUploadError: errorMessage,
                });
                return;
            }

            onUpdate({
                ...data,
                profilePhoto: null,
                profilePhotoPreview: result.asset.publicUrl,
                profilePhotoAssetId: result.asset.id,
                profilePhotoBucket: result.asset.bucket,
                profilePhotoStoragePath: result.asset.storagePath,
                profilePhotoMimeType: result.asset.mimeType,
                profilePhotoFileSize: result.asset.fileSize,
                profilePhotoUploadedAt: result.asset.createdAt,
                profilePhotoUploadStatus: 'ready',
                profilePhotoUploadError: null,
                profilePhotoHash: result.asset.sha256Hash,
            });
        };
        reader.readAsDataURL(file);
    };

    const removePhoto = async () => {
        if (!window.confirm('Remove the profile photo? This change will be saved to the memorial.')) {
            return;
        }
        if (memorialId && data.profilePhotoAssetId) {
            try {
                await deleteMediaAssets(memorialId, [data.profilePhotoAssetId], 'soft');
            } catch (error: any) {
                setPhotoError(error.message || 'Could not remove the profile photo.');
                return;
            }
        }
        onUpdate({
            ...data,
            profilePhoto: null,
            profilePhotoPreview: null,
            profilePhotoAssetId: null,
            profilePhotoBucket: null,
            profilePhotoStoragePath: null,
            profilePhotoMimeType: null,
            profilePhotoFileSize: null,
            profilePhotoUploadedAt: null,
            profilePhotoUploadStatus: 'idle',
            profilePhotoUploadError: null,
            profilePhotoHash: undefined,
        });
        setPhotoError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const calculateAge = () => {
        if (!data.birthDate) return null;
        const birth = new Date(data.birthDate);
        const end = data.isStillLiving ? new Date() : data.deathDate ? new Date(data.deathDate) : new Date();
        const years = end.getFullYear() - birth.getFullYear();
        return years;
    };

    const isValid = () => {
        return data.fullName.trim() !== '' && data.birthDate !== '';
    };

    const checkForDuplicates = async () => {
        if (data.fullName.length < 3) return [];

        setCheckingDuplicates(true);
        try {
            const res = await fetch('/api/memorials/check-duplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: data.fullName,
                    birthDate: data.birthDate,
                    deathDate: data.deathDate,
                    excludeId: memorialId
                })
            });
            const result = await res.json();
            const duplicates = result.duplicates || [];
            setPotentialDuplicates(duplicates);
            return duplicates;
        } catch (err) {
            console.error("Duplicate check failed", err);
            return [];
        } finally {
            setCheckingDuplicates(false);
        }
    };

    const handleNextClick = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // If we haven't found any duplicates yet, check now
        let currentDuplicates = potentialDuplicates;
        if (currentDuplicates.length === 0) {
            currentDuplicates = await checkForDuplicates();
        }

        // If after checking (or if already checked) there are no matches, proceed
        if (currentDuplicates.length === 0) {
            onNext();
        }
        // If there are duplicates, we stay on this step to show them (UI handled in next task)
    };

    const handleRequestCollab = async (duplicate: any) => {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const requesterId = user?.id;

        try {
            const res = await fetch('/api/memorials/request-collaboration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memorialId: duplicate.id,
                    targetOwnerId: duplicate.user_id,
                    requesterId: requesterId
                })
            });

            if (res.ok) {
                alert("Collaboration request sent to the owner of that archive!");
                // Redirect to dashboard or stay here
            }
        } catch (err) {
            alert("Failed to send request.");
        }
    };

    return (
        <form autoComplete="off" onSubmit={handleNextClick}>
            {/* Hidden dummy input to trick browser autofill heuristics */}
            <input type="text" className="hidden" aria-hidden="true" autoComplete="off" name="hidden_dummy_input" tabIndex={-1} />

            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-12">
                <div className="mb-12">
                    <h2 className="font-serif text-4xl text-warm-dark mb-3">
                        Let's Start with the Basics
                    </h2>
                    <p className="text-warm-muted text-lg">
                        We'll begin with the essential information. Don't worry, you can always come back and edit this later.
                    </p>
                    <p className="text-xs text-warm-dark/30 italic mt-1 mb-4">
                        The foundation of a legacy that will outlive us all.
                    </p>
                </div>

                <div className="space-y-8">
                    <div>
                        <label className="block text-sm font-medium text-warm-dark mb-2">
                            Full Name <span className="text-warm-brown">*</span>
                        </label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" size={20} />
                            <input

                                type="text"
                                name="memorial_subject_full_name"
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                                value={data.fullName}
                                onChange={(e) => handleChange('fullName', e.target.value)}
                                placeholder="e.g., Eleanor Marie Thompson"
                                disabled={readOnly}
                                className="w-full pl-12 pr-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <p className="text-xs text-warm-outline mt-1">Their full legal name or the name they were known by</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-warm-dark mb-2">
                            Birth Date <span className="text-warm-brown">*</span>
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" size={20} />
                            <input
                                type="date"
                                name="memorial_subject_birth_date"
                                autoComplete="off"
                                value={data.birthDate}
                                onChange={(e) => handleChange('birthDate', e.target.value)}
                                disabled={readOnly}
                                className="w-full pl-12 pr-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        {calculateAge() && (
                            <p className="text-xs text-olive mt-1">
                                {data.isStillLiving ? `Currently ${calculateAge()} years old` : `Lived ${calculateAge()} years`}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-warm-border/10 rounded-xl">
                        <input
                            type="checkbox"
                            id="stillLiving"
                            name="memorial_subject_is_living"
                            checked={data.isStillLiving}
                            disabled={readOnly}
                            onChange={(e) => {
                                const isChecked = e.target.checked;
                                onUpdate({
                                    ...data,
                                    isStillLiving: isChecked,
                                    deathDate: isChecked ? null : data.deathDate,
                                    deathPlace: isChecked ? '' : data.deathPlace,
                                    isSelfArchive: isChecked ? data.isSelfArchive : false
                                });
                            }}
                            className="w-5 h-5 text-olive border-warm-border/30 rounded focus:ring-olive/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <label htmlFor="stillLiving" className="text-sm font-medium text-warm-dark cursor-pointer">
                            This person is still living
                        </label>
                    </div>

                    {/* NEW: Self-Archive Checkbox (Only visible if Living) */}
                    {data.isStillLiving && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pl-8 border-l-2 border-olive/20 animate-fadeIn">
                                <input
                                    type="checkbox"
                                    id="selfArchive"
                                    checked={!!data.isSelfArchive}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        handleChange('isSelfArchive', isChecked);
                                        // Reset private flag if self archive is unchecked
                                        if (!isChecked) handleChange('privateUntilDeath', false);
                                    }}
                                    className="w-5 h-5 text-warm-brown border-warm-border/30 rounded focus:ring-warm-brown/30 cursor-pointer disabled:opacity-50"
                                />
                                <div>
                                    <label htmlFor="selfArchive" className="text-sm text-warm-dark cursor-pointer font-medium">
                                        I am creating this archive for myself
                                    </label>
                                    <p className="text-xs text-warm-outline mt-0.5">
                                        Content will be framed in the first person ("I was born...", "My story")
                                    </p>
                                </div>
                            </div>

                            {/* NEW: PRIVATE UNTIL DEATH TOGGLE */}
                            {data.isSelfArchive && (
                                <div className="ml-8 p-4 bg-white/60 border border-warm-brown/20 rounded-xl animate-fadeIn">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 p-1.5 bg-warm-brown/10 rounded-full text-warm-brown">
                                            <Lock size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="flex items-center gap-3 cursor-pointer mb-1">
                                                <input
                                                    type="checkbox"
                                                    checked={!!data.privateUntilDeath}
                                                    disabled={readOnly}
                                                    onChange={(e) => handleChange('privateUntilDeath', e.target.checked)}
                                                    className="w-5 h-5 text-warm-brown border-warm-border/30 rounded focus:ring-warm-brown"
                                                />
                                                <span className="font-medium text-warm-dark text-sm">Keep this archive private until my death</span>
                                            </label>
                                            <p className="text-xs text-warm-muted leading-relaxed">
                                                If enabled, this archive will be accessible <strong>only by you</strong>.
                                                It will only be revealed to your designated successor(s) after the inheritance process is officially activated.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!data.isStillLiving && (
                        <div>
                            <label className="block text-sm font-medium text-warm-dark mb-2">
                                Death Date
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" size={20} />
                                <input
                                    type="date"
                                    name="memorial_subject_death_date"
                                    autoComplete="off"
                                    value={data.deathDate || ''}
                                    onChange={(e) => handleChange('deathDate', e.target.value)}
                                    disabled={readOnly}
                                    className="w-full pl-12 pr-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-warm-dark mb-2">
                            Birth Place
                        </label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" size={20} />
                            <input
                                type="text"
                                name="memorial_subject_birth_place"
                                autoComplete="off"
                                value={data.birthPlace}
                                onChange={(e) => handleChange('birthPlace', e.target.value)}
                                placeholder="e.g., Charleston, South Carolina"
                                disabled={readOnly}
                                className="w-full pl-12 pr-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <p className="text-xs text-warm-outline mt-1">City and state/country where they were born</p>
                    </div>

                    {!data.isStillLiving && (
                        <div>
                            <label className="block text-sm font-medium text-warm-dark mb-2">
                                Death Place
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-outline" size={20} />
                                <input
                                    type="text"
                                    name="memorial_subject_death_place"
                                    autoComplete="off"
                                    value={data.deathPlace}
                                    onChange={(e) => handleChange('deathPlace', e.target.value)}
                                    placeholder="e.g., Boston, Massachusetts"
                                    disabled={readOnly}
                                    className="w-full pl-12 pr-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-warm-dark mb-2">
                            Profile Photo
                        </label>
                        {!data.profilePhotoPreview ? (
                            !readOnly ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-warm-border/30 rounded-xl p-8 text-center cursor-pointer hover:border-olive/40 hover:bg-olive/5 transition-all"
                                >
                                    <Upload className="mx-auto mb-3 text-warm-outline" size={32} />
                                    <p className="text-sm text-warm-muted mb-1">
                                        Select a photo or drag and drop
                                    </p>
                                    <p className="text-xs text-warm-outline">
                                        PNG, JPG up to 10MB
                                    </p>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-warm-border/30 rounded-xl p-8 text-center bg-warm-border/5">
                                    <p className="text-sm text-warm-outline">Photo cannot be added yet</p>
                                </div>
                            )
                        ) : (
                            <div className="relative">
                                <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden border-4 border-warm-border/30">
                                    <img
                                        src={data.profilePhotoPreview}
                                        alt="Profile preview"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <button
                                    onClick={removePhoto}
                                    disabled={readOnly}
                                    className={`absolute top-2 right-2 p-2 bg-warm-dark/80 hover:bg-warm-dark rounded-full transition-colors ${readOnly ? 'hidden' : ''}`}
                                >
                                    <X size={16} className="text-surface-low" />
                                </button>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            name="memorial_subject_profile_photo"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                        />
                        {(photoError || data.profilePhotoUploadError) && (
                            <p className="text-xs text-red-600 mt-2 text-center">
                                {photoError || data.profilePhotoUploadError}
                            </p>
                        )}
                        {data.profilePhotoUploadStatus === 'uploading' && (
                            <p className="text-xs text-olive mt-2 text-center">
                                Uploading profile photo...
                            </p>
                        )}
                        <p className="text-xs text-warm-outline mt-2 text-center">
                            You can add more photos later in the gallery
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-warm-dark mb-2">
                            One-Line Epitaph
                        </label>
                        <div className="relative">
                            <Quote className="absolute left-4 top-4 text-warm-outline" size={20} />
                            <textarea
                                value={data.epitaph}
                                name="memorial_subject_epitaph"
                                autoComplete="off"
                                onChange={(e) => handleChange('epitaph', e.target.value)}
                                placeholder="A sentence that captures their essence..."
                                maxLength={200}
                                rows={3}
                                disabled={readOnly}
                                className="w-full pl-12 pr-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-warm-outline">Optional but recommended</p>
                            <p className="text-xs text-warm-outline">{(data?.epitaph || '').length}/200</p>
                        </div>
                        <div className="mt-3 p-3 bg-olive/5 rounded-lg border border-olive/20">
                            <p className="text-xs font-medium text-olive mb-2">Examples:</p>
                            <ul className="space-y-1 text-xs text-warm-muted">
                                <li>• "She taught us how to see beauty in ordinary moments"</li>
                                <li>• "A gentle soul who lived with fierce purpose"</li>
                                <li>• "He turned strangers into family wherever he went"</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* DUPLICATE WARNING BLOCK */}
                {potentialDuplicates.length > 0 && (
                    <div className="mt-8 p-6 bg-warm-brown/5 border-2 border-warm-brown/20 rounded-2xl animate-fadeIn">
                        <div className="flex items-start gap-4">
                            <div className="bg-warm-brown/10 p-2 rounded-lg text-warm-brown">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-serif text-lg text-warm-dark mb-2">Similar Archive Detected</h3>
                                <p className="text-sm text-warm-muted mb-4">
                                    It looks like an archive for <strong>{data.fullName}</strong> might already exist in your family constellation.
                                </p>

                                <div className="space-y-3 mb-6">
                                    {potentialDuplicates.map((dup) => (
                                        <div key={dup.id} className="bg-white p-4 rounded-xl border border-warm-border/30 flex items-center justify-between shadow-sm">
                                            <div>
                                                <p className="font-medium text-sm text-warm-dark">{dup.full_name}</p>
                                                <p className="text-xs text-warm-outline">
                                                    {dup.birth_date?.substring(0, 4)} — {dup.death_date?.substring(0, 4)}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <a
                                                    href={`/person/${dup.id}`}
                                                    target="_blank"
                                                    className="p-2 text-warm-outline hover:text-olive transition-colors"
                                                    title="View existing archive"
                                                >
                                                    <Eye size={18} />
                                                </a>
                                                <button
                                                    onClick={() => handleRequestCollab(dup)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-olive/10 text-olive text-xs rounded-lg font-medium hover:bg-olive/20"
                                                >
                                                    <Users size={14} />
                                                    Collaborate
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => {
                                            setPotentialDuplicates([]); // Clear warnings
                                            onNext(); // Proceed anyway
                                        }}
                                        className="text-xs text-warm-outline hover:text-warm-dark transition-colors underline"
                                    >
                                        This is a different person, continue anyway
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-12 flex gap-4">
                    <button
                        data-tutorial="save-continue"
                        type="submit"
                        disabled={!isValid() || checkingDuplicates}
                        className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all ${isValid() && !checkingDuplicates
                            ? 'bg-olive hover:bg-olive/90 text-warm-bg'
                            : 'bg-warm-border/30 text-warm-outline cursor-not-allowed'
                            }`}
                    >
                        {checkingDuplicates ? 'Checking...' : 'Preserve & continue →'}
                    </button>
                </div>

                <div className="mt-4 text-center">
                    <button className="text-sm text-warm-muted hover:text-warm-dark transition-colors">
                        Save Private Preview & Exit
                    </button>
                </div>
            </div>
        </form>
    );
}
