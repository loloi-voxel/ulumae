// components/wizard/Step2Childhood.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Home, Users, GraduationCap, Heart, Sparkles, Upload, X, Plus } from 'lucide-react';
import { deleteMediaAssets, secureUpload } from '@/lib/uploadService';
import { ChildhoodInfo, ChildhoodPhotoReference } from '@/types/memorial';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';

interface Step2Props {
    data: ChildhoodInfo;
    onUpdate: (data: ChildhoodInfo) => void;
    onNext: () => void;
    onBack: () => void;
    readOnly?: boolean;
    isSelfArchive?: boolean; // NEW PROP
    memorialId: string | null;
}

const PERSONALITY_OPTIONS = [
    'Curious', 'Shy', 'Adventurous', 'Studious', 'Athletic',
    'Creative', 'Rebellious', 'Compassionate', 'Playful', 'Thoughtful',
    'Bold', 'Gentle', 'Energetic', 'Calm', 'Funny',
    'Serious', 'Social', 'Independent', 'Helpful', 'Imaginative'
];

export default function Step2Childhood({
    data,
    onUpdate,
    onNext,
    onBack,
    readOnly,
    isSelfArchive = false,
    memorialId,
}: Step2Props) {
    const [newInterest, setNewInterest] = useState('');
    const photoInputRef = useRef<HTMLInputElement>(null);
    const dataRef = useRef(data);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    const applyUpdate = (updater: (current: ChildhoodInfo) => ChildhoodInfo) => {
        const next = updater(dataRef.current);
        dataRef.current = next;
        onUpdate(next);
    };

    const handleChange = (field: keyof ChildhoodInfo, value: any) => {
        applyUpdate((current) => ({ ...current, [field]: value }));
    };

    const handleSchoolChange = (school: keyof ChildhoodInfo['schools'], value: string) => {
        applyUpdate((current) => ({
            ...current,
            schools: { ...current.schools, [school]: value }
        }));
    };

    const togglePersonality = (trait: string) => {
        const current = data.childhoodPersonality;
        if (current.includes(trait)) {
            handleChange('childhoodPersonality', current.filter(t => t !== trait));
        } else {
            handleChange('childhoodPersonality', [...current, trait]);
        }
    };

    const addInterest = () => {
        if (newInterest.trim() && !data.earlyInterests.includes(newInterest.trim())) {
            handleChange('earlyInterests', [...data.earlyInterests, newInterest.trim()]);
            setNewInterest('');
        }
    };

    const removeInterest = (interest: string) => {
        handleChange('earlyInterests', data.earlyInterests.filter(i => i !== interest));
    };

    const ensureMemorial = () => {
        if (!memorialId) {
            setPhotoError('Please wait for the private preview to finish initializing before adding childhood photos.');
            return false;
        }

        return true;
    };

    const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        if (!ensureMemorial()) {
            e.currentTarget.value = '';
            return;
        }

        setPhotoError(null);

        for (const file of files) {
            const tempId = `childhood-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const pendingPhoto: ChildhoodPhotoReference = {
                id: tempId,
                file,
                preview: URL.createObjectURL(file),
                caption: '',
                year: '',
                uploadStatus: 'uploading',
                uploadError: null,
            };

            applyUpdate((current) => ({
                ...current,
                childhoodPhotos: [...current.childhoodPhotos, pendingPhoto],
            }));

            const result = await secureUpload(file, {
                memorialId: memorialId!,
                kind: 'gallery_photo',
                metadata: { section: 'childhood_photos' },
            });

            if (!result.success || !result.asset) {
                applyUpdate((current) => ({
                    ...current,
                    childhoodPhotos: current.childhoodPhotos.map((photo) =>
                        photo.id === tempId
                            ? {
                                ...photo,
                                uploadStatus: 'error',
                                uploadError: result.error || 'Upload failed.',
                            }
                            : photo
                    ),
                }));
                setPhotoError(result.error || `Could not upload ${file.name}.`);
                continue;
            }

            const asset = result.asset;
            applyUpdate((current) => ({
                ...current,
                childhoodPhotos: current.childhoodPhotos.map((photo) =>
                    photo.id === tempId
                        ? {
                            ...photo,
                            file: null,
                            preview: asset.publicUrl,
                            assetId: asset.id,
                            bucket: asset.bucket,
                            storagePath: asset.storagePath,
                            originalFileName: asset.originalFileName,
                            mimeType: asset.mimeType,
                            fileSize: asset.fileSize,
                            uploadedAt: asset.createdAt,
                            uploadStatus: 'ready',
                            uploadError: null,
                            sha256_hash: asset.sha256Hash,
                        }
                        : photo
                ),
            }));
        }

        e.currentTarget.value = '';
    };

    const removePhoto = async (index: number) => {
        const photo = dataRef.current.childhoodPhotos[index];
        if (!photo) return;

        if (memorialId && photo.assetId) {
            try {
                await deleteMediaAssets(memorialId, [photo.assetId], 'soft');
            } catch (error: any) {
                setPhotoError(error.message || 'Could not remove this childhood photo.');
                return;
            }
        }

        setPhotoError(null);
        applyUpdate((current) => ({
            ...current,
            childhoodPhotos: current.childhoodPhotos.filter((_, i) => i !== index),
        }));
    };

    const updatePhotoCaption = (index: number, caption: string) => {
        applyUpdate((current) => {
            const updated = [...current.childhoodPhotos];
            updated[index] = { ...updated[index], caption };
            return { ...current, childhoodPhotos: updated };
        });
    };

    const updatePhotoYear = (index: number, year: string) => {
        applyUpdate((current) => {
            const updated = [...current.childhoodPhotos];
            updated[index] = { ...updated[index], year };
            return { ...current, childhoodPhotos: updated };
        });
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="mb-12">
                <h2 className="font-serif text-4xl text-warm-dark mb-3">
                    Early Life & Childhood
                </h2>
                <p className="text-warm-muted text-lg">
                    {isSelfArchive
                        ? "Tell us about your formative years. You can skip any section and come back later."
                        : "Tell us about their formative years. You can skip any section and come back later."}
                </p>
                <p className="text-xs text-warm-dark/30 italic mt-1 mb-4">
                    The roots of their story — for those who will one day ask where it all began.
                </p>
            </div>

            <div className="space-y-10">
                {/* Childhood Home */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-3">
                        <Home size={18} className="text-olive" />
                        {isSelfArchive ? "Where did you grow up?" : "Where did they grow up?"}
                    </label>
                    <textarea
                        value={data.childhoodHome}
                        onChange={(e) => handleChange('childhoodHome', e.target.value)}
                        placeholder={isSelfArchive ? "Describe your childhood home and neighborhood..." : "Describe their childhood home and neighborhood..."}
                        rows={4}
                        disabled={readOnly}
                        className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="mt-2 text-xs text-warm-outline space-y-1">
                        <p>💡 Prompts to help you:</p>
                        <p>• What was {isSelfArchive ? "your" : "their"} neighborhood like?</p>
                        <p>• What kind of home did {isSelfArchive ? "you" : "they"} live in?</p>
                        <p>• City or countryside?</p>
                    </div>
                </div>

                {/* Family Background */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-3">
                        <Users size={18} className="text-warm-brown" />
                        {isSelfArchive ? "Tell us about your family" : "Tell us about their family"}
                    </label>
                    <textarea
                        value={data.familyBackground}
                        onChange={(e) => handleChange('familyBackground', e.target.value)}
                        placeholder={isSelfArchive ? "Describe your family life and upbringing..." : "Describe their family life and upbringing..."}
                        rows={5}
                        disabled={readOnly}
                        className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="mt-2 text-xs text-warm-outline space-y-1">
                        <p>💡 Prompts:</p>
                        <p>• Who raised {isSelfArchive ? "you" : "them"}?</p>
                        <p>• How many siblings do {isSelfArchive ? "you have" : "they have"}?</p>
                        <p>• What was {isSelfArchive ? "your" : "their"} family life like?</p>
                    </div>
                </div>

                {/* Education */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-3">
                        <GraduationCap size={18} className="text-olive" />
                        {isSelfArchive ? "Where did you go to school?" : "Where did they go to school?"}
                    </label>
                    <div className="space-y-3">
                        <div>
                            <input
                                type="text"
                                value={data.schools.elementary}
                                onChange={(e) => handleSchoolChange('elementary', e.target.value)}
                                placeholder="Elementary/Primary school"
                                disabled={readOnly}
                                className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={data.schools.highSchool}
                                onChange={(e) => handleSchoolChange('highSchool', e.target.value)}
                                placeholder="High school"
                                disabled={readOnly}
                                className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={data.schools.college}
                                onChange={(e) => handleSchoolChange('college', e.target.value)}
                                placeholder="College/University (with degree if applicable)"
                                disabled={readOnly}
                                className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={data.schools.additionalEducation}
                                onChange={(e) => handleSchoolChange('additionalEducation', e.target.value)}
                                placeholder="Additional education (optional)"
                                disabled={readOnly}
                                className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>

                {/* Childhood Personality */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-3">
                        <Sparkles size={18} className="text-warm-brown" />
                        {isSelfArchive ? "What were you like as a child?" : "What were they like as a child?"}
                    </label>
                    <p className="text-xs text-warm-outline mb-4">
                        {isSelfArchive ? "Select 3-5 traits that best describe you back then" : "Select 3-5 traits that best describe them"}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {PERSONALITY_OPTIONS.map((trait) => {
                            const isSelected = data.childhoodPersonality.includes(trait);
                            return (
                                <button
                                    key={trait}
                                    onClick={() => togglePersonality(trait)}
                                    disabled={readOnly}
                                    className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${isSelected
                                        ? 'bg-olive text-surface-low border-olive'
                                        : 'bg-white text-warm-dark border-warm-border/30 hover:border-olive/40 hover:bg-olive/5'
                                        } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {trait}
                                </button>
                            );
                        })}
                    </div>

                    {data.childhoodPersonality.length > 0 && (
                        <p className="text-xs text-olive mt-3">
                            Selected: {data.childhoodPersonality.length} trait{data.childhoodPersonality.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>

                {/* Early Interests */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-3">
                        <Heart size={18} className="text-warm-brown" />
                        {isSelfArchive ? "What did you love doing?" : "What did they love doing?"}
                    </label>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={newInterest}
                            onChange={(e) => setNewInterest(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                            placeholder="e.g., reading, sports, music..."
                            disabled={readOnly}
                            className="flex-1 px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {!readOnly && (
                            <button
                                onClick={addInterest}
                                className="px-6 py-3 bg-olive hover:bg-olive/90 text-surface-low rounded-xl transition-all flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Add
                            </button>
                        )}
                    </div>

                    {data.earlyInterests.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {data.earlyInterests.map((interest, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 px-4 py-2 bg-warm-brown/10 text-warm-brown border border-warm-brown/30 rounded-full"
                                >
                                    <span className="text-sm">{interest}</span>
                                    {!readOnly && (
                                        <button
                                            onClick={() => removeInterest(interest)}
                                            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:bg-warm-brown/20 rounded-full p-1 transition-all"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-3 p-3 bg-olive/5 rounded-lg border border-olive/20">
                        <p className="text-xs text-warm-muted">
                            💡 Examples: reading, baseball, piano, drawing, building things, nature walks, cooking with grandma
                        </p>
                    </div>
                </div>

                {/* Childhood Photos */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-3">
                        <Upload size={18} className="text-olive" />
                        Gather Childhood Photos (Optional)
                    </label>

                    {data.childhoodPhotos.length === 0 ? (
                        !readOnly ? (
                            <div
                                onClick={() => photoInputRef.current?.click()}
                                className="border-2 border-dashed border-warm-border/30 rounded-xl p-8 text-center cursor-pointer hover:border-olive/40 hover:bg-olive/5 transition-all"
                            >
                                <Upload className="mx-auto mb-3 text-warm-outline" size={32} />
                                <p className="text-sm text-warm-muted mb-1">
                                    Select childhood photos
                                </p>
                                <p className="text-xs text-warm-outline">
                                    You can select multiple photos
                                </p>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-warm-border/30 rounded-xl p-8 text-center bg-warm-border/5">
                                <p className="text-sm text-warm-outline">Photo gathering disabled</p>
                            </div>
                        )
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                {data.childhoodPhotos.map((photo, idx) => (
                                    <div key={idx} className="relative group">
                                        <div className="aspect-square rounded-xl overflow-hidden bg-warm-border/20 border border-warm-border/30">
                                            <img
                                                src={photo.preview}
                                                alt={`Childhood photo ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        {!readOnly && (
                                            <button
                                                onClick={() => setPendingRemoveIndex(idx)}
                                                className="absolute top-2 right-2 p-2 bg-warm-dark/80 hover:bg-warm-dark rounded-full transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                            >
                                                <X size={14} className="text-surface-low" />
                                            </button>
                                        )}

                                        {/* Caption and Year */}
                                        <div className="mt-2 space-y-1">
                                            <input
                                                type="text"
                                                value={photo.caption}
                                                onChange={(e) => updatePhotoCaption(idx, e.target.value)}
                                                placeholder="Caption (optional)"
                                                disabled={readOnly}
                                                className="w-full px-2 py-1 text-xs border border-warm-border/30 rounded focus:outline-none focus:ring-1 focus:ring-olive/10 disabled:opacity-50"
                                            />
                                            <input
                                                type="text"
                                                value={photo.year}
                                                onChange={(e) => updatePhotoYear(idx, e.target.value)}
                                                placeholder="Year (optional)"
                                                disabled={readOnly}
                                                className="w-full px-2 py-1 text-xs border border-warm-border/30 rounded focus:outline-none focus:ring-1 focus:ring-olive/10 disabled:opacity-50"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!readOnly && (
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    className="w-full py-3 border-2 border-dashed border-warm-border/30 rounded-xl text-sm text-warm-muted hover:border-olive/40 hover:bg-olive/5 transition-all"
                                >
                                    + Add More Photos
                                </button>
                            )}
                        </>
                    )}

                    <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotosUpload}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Navigation */}
            <div className="mt-12 flex gap-4">
                <button
                    onClick={onBack}
                    className="px-6 py-4 border border-warm-border/30 rounded-xl hover:bg-warm-border/10 transition-all font-medium"
                >
                    ← Return
                </button>
                <button
                    onClick={onNext}
                    className="flex-1 bg-olive hover:bg-olive/90 text-warm-bg py-4 px-6 rounded-xl font-medium transition-all"
                >
                    Preserve & continue →
                </button>
            </div>

            {/* Skip Option */}
            <div className="mt-4 text-center">
                <button
                    onClick={onNext}
                    className="text-sm text-warm-muted hover:text-warm-dark transition-colors"
                >
                    I'll return to this →
                </button>
            </div>
            <ConfirmDialog
                open={pendingRemoveIndex !== null}
                title="Remove this childhood photo?"
                description="This change will be saved to the memorial immediately."
                confirmLabel="Remove photo"
                variant="danger"
                onConfirm={() => {
                    if (pendingRemoveIndex === null) return;
                    const index = pendingRemoveIndex;
                    setPendingRemoveIndex(null);
                    void removePhoto(index);
                }}
                onCancel={() => setPendingRemoveIndex(null)}
            />
        </div>
    );
}
