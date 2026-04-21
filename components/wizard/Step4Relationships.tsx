// components/wizard/Step4Relationships.tsx
'use client';

import { useRef } from 'react';
import { Heart, Users, Calendar, Plus, X, Trash2, Upload } from 'lucide-react';
import { RelationshipsFamily } from '@/types/memorial';

interface Step4Props {
    data: RelationshipsFamily;
    onUpdate: (data: RelationshipsFamily) => void;
    onNext: () => void;
    onBack: () => void;
    readOnly?: boolean;
    isSelfArchive?: boolean; // NEW PROP
}

const EVENT_CATEGORIES = [
    { value: 'marriage', label: 'Marriage', color: 'bg-pink-100 text-pink-700' },
    { value: 'birth', label: 'Birth', color: 'bg-blue-100 text-blue-700' },
    { value: 'career', label: 'Career', color: 'bg-purple-100 text-purple-700' },
    { value: 'achievement', label: 'Achievement', color: 'bg-olive/15 text-warm-dark' },
    { value: 'loss', label: 'Loss', color: 'bg-gray-100 text-warm-dark' },
    { value: 'milestone', label: 'Milestone', color: 'bg-surface-high text-warm-brown' },
] as const;

export default function Step4Relationships({ data, onUpdate, onNext, onBack, readOnly, isSelfArchive = false }: Step4Props) {
    const partnerPhotoRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    const handleChange = (field: keyof RelationshipsFamily, value: any) => {
        onUpdate({ ...data, [field]: value });
    };

    // Partners Management
    const addPartner = () => {
        const newPartner = {
            id: `partner-${Date.now()}`,
            name: '',
            relationshipType: '',
            yearsFrom: '',
            yearsTo: '',
            description: '',
            photo: null,
            photoPreview: null,
        };
        handleChange('partners', [...data.partners, newPartner]);
    };

    const removePartner = (id: string) => {
        handleChange('partners', data.partners.filter(p => p.id !== id));
    };

    const updatePartner = (id: string, field: string, value: any) => {
        handleChange(
            'partners',
            data.partners.map(p => (p.id === id ? { ...p, [field]: value } : p))
        );
    };

    const handlePartnerPhotoUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updatePartner(id, 'photo', file);
                updatePartner(id, 'photoPreview', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removePartnerPhoto = (id: string) => {
        updatePartner(id, 'photo', null);
        updatePartner(id, 'photoPreview', null);
        if (partnerPhotoRefs.current[id]) {
            partnerPhotoRefs.current[id]!.value = '';
        }
    };

    // Children Management
    const addChild = () => {
        const newChild = {
            id: `child-${Date.now()}`,
            name: '',
            birthYear: '',
            description: '',
        };
        handleChange('children', [...data.children, newChild]);
    };

    const removeChild = (id: string) => {
        handleChange('children', data.children.filter(c => c.id !== id));
    };

    const updateChild = (id: string, field: string, value: string) => {
        handleChange(
            'children',
            data.children.map(c => (c.id === id ? { ...c, [field]: value } : c))
        );
    };

    // Life Events Management
    const addLifeEvent = () => {
        const newEvent = {
            id: `event-${Date.now()}`,
            year: '',
            title: '',
            category: 'milestone' as const,
            description: '',
        };
        handleChange('majorLifeEvents', [...data.majorLifeEvents, newEvent]);
    };

    const removeLifeEvent = (id: string) => {
        handleChange('majorLifeEvents', data.majorLifeEvents.filter(e => e.id !== id));
    };

    const updateLifeEvent = (id: string, field: string, value: any) => {
        handleChange(
            'majorLifeEvents',
            data.majorLifeEvents.map(e => (e.id === id ? { ...e, [field]: value } : e))
        );
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="mb-12">
                <h2 className="font-serif text-4xl text-warm-dark mb-3">
                    Relationships & Family
                </h2>
                <p className="text-warm-muted text-lg">
                    {isSelfArchive
                        ? "Tell us about the important people in your life and major life events."
                        : "Tell us about the important people in their life and major life events."}
                </p>
                <p className="text-xs text-warm-dark/30 italic mt-1 mb-4">
                    The bonds that shaped a life — so future generations may know who mattered.
                </p>
            </div>

            <div className="space-y-10">
                {/* Life Partners/Spouses */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-4">
                        <Heart size={18} className="text-warm-brown" />
                        Life Partners / Spouses
                    </label>

                    <div className="space-y-4">
                        {data.partners.map((partner) => (
                            <div
                                key={partner.id}
                                className="p-6 bg-white border border-warm-border/30 rounded-xl space-y-4 relative"
                            >
                                {/* Remove button */}
                                {!readOnly && (
                                    <button
                                        onClick={() => removePartner(partner.id)}
                                        className="absolute top-4 right-4 p-2 text-warm-outline hover:text-warm-brown hover:bg-warm-brown/10 rounded-lg transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                        title="Remove"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}

                                <div className="flex gap-4">
                                    {/* Photo upload */}
                                    <div className="flex-shrink-0">
                                        {!partner.photoPreview ? (
                                            <div
                                                onClick={() => !readOnly && partnerPhotoRefs.current[partner.id]?.click()}
                                                className={`w-24 h-24 border-2 border-dashed border-warm-border/30 rounded-xl flex flex-col items-center justify-center transition-all ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-olive/40 hover:bg-olive/5'}`}
                                            >
                                                <Upload size={20} className="text-warm-outline mb-1" />
                                                <span className="text-xs text-warm-outline">Photo</span>
                                            </div>
                                        ) : (
                                            <div className="relative w-24 h-24">
                                                <img
                                                    src={partner.photoPreview}
                                                    alt={partner.name}
                                                    className="w-full h-full object-cover rounded-xl border-2 border-warm-border/30"
                                                />
                                                {!readOnly && (
                                                    <button
                                                        onClick={() => removePartnerPhoto(partner.id)}
                                                        className="absolute -top-2 -right-2 p-1 bg-warm-dark rounded-full"
                                                    >
                                                        <X size={12} className="text-surface-low" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <input
                                            ref={(el) => { partnerPhotoRefs.current[partner.id] = el; }}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handlePartnerPhotoUpload(partner.id, e)}
                                            className="hidden"
                                            disabled={readOnly}
                                        />
                                    </div>

                                    {/* Form fields */}
                                    <div className="flex-1 space-y-3 pr-8">
                                        <input
                                            type="text"
                                            value={partner.name}
                                            onChange={(e) => updatePartner(partner.id, 'name', e.target.value)}
                                            placeholder="Name (e.g., James Thompson)"
                                            className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all font-medium disabled:opacity-60 disabled:bg-warm-border/10"
                                            disabled={readOnly}
                                        />

                                        <input
                                            type="text"
                                            value={partner.relationshipType}
                                            onChange={(e) => updatePartner(partner.id, 'relationshipType', e.target.value)}
                                            placeholder="Relationship (e.g., Spouse, Partner, Husband, Wife)"
                                            className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-60 disabled:bg-warm-border/10"
                                            disabled={readOnly}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-warm-muted mb-1">Together From</label>
                                        <input
                                            type="text"
                                            value={partner.yearsFrom}
                                            onChange={(e) => updatePartner(partner.id, 'yearsFrom', e.target.value)}
                                            placeholder="e.g., 1966"
                                            className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-60 disabled:bg-warm-border/10"
                                            disabled={readOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-warm-muted mb-1">To</label>
                                        <input
                                            type="text"
                                            value={partner.yearsTo}
                                            onChange={(e) => updatePartner(partner.id, 'yearsTo', e.target.value)}
                                            placeholder="e.g., 2018 or 'Present'"
                                            className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-60 disabled:bg-warm-border/10"
                                            disabled={readOnly}
                                        />
                                    </div>
                                </div>

                                <textarea
                                    value={partner.description}
                                    onChange={(e) => updatePartner(partner.id, 'description', e.target.value)}
                                    placeholder={isSelfArchive ? "Brief description of your relationship..." : "Brief description of their relationship..."}
                                    rows={2}
                                    className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all resize-none disabled:opacity-60 disabled:bg-warm-border/10"
                                    disabled={readOnly}
                                />
                            </div>
                        ))}

                        {!readOnly && (
                            <button
                                onClick={addPartner}
                                className="w-full py-4 border-2 border-dashed border-warm-border/30 rounded-xl text-sm font-medium text-warm-muted hover:border-olive hover:bg-olive/5 hover:text-olive transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                Add Partner/Spouse
                            </button>
                        )}
                    </div>
                </div>

                {/* Children */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-4">
                        <Users size={18} className="text-olive" />
                        Children
                    </label>

                    <div className="space-y-4">
                        {data.children.map((child) => (
                            <div
                                key={child.id}
                                className="p-6 bg-white border border-warm-border/30 rounded-xl space-y-4 relative"
                            >
                                {/* Remove button */}
                                {!readOnly && (
                                    <button
                                        onClick={() => removeChild(child.id)}
                                        className="absolute top-4 right-4 p-2 text-warm-outline hover:text-warm-brown hover:bg-warm-brown/10 rounded-lg transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                        title="Remove"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}

                                <div className="pr-8">
                                    <input
                                        type="text"
                                        value={child.name}
                                        onChange={(e) => updateChild(child.id, 'name', e.target.value)}
                                        placeholder="Name (e.g., Michael James Thompson)"
                                        className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all font-medium disabled:opacity-60 disabled:bg-warm-border/10"
                                        disabled={readOnly}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-warm-muted mb-1">Birth Year</label>
                                    <input
                                        type="text"
                                        value={child.birthYear}
                                        onChange={(e) => updateChild(child.id, 'birthYear', e.target.value)}
                                        placeholder="e.g., 1968"
                                        className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all disabled:opacity-60 disabled:bg-warm-border/10"
                                        disabled={readOnly}
                                    />
                                </div>

                                <textarea
                                    value={child.description}
                                    onChange={(e) => updateChild(child.id, 'description', e.target.value)}
                                    placeholder="Brief description (e.g., Civil rights attorney in Atlanta)"
                                    rows={2}
                                    className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all resize-none disabled:opacity-60 disabled:bg-warm-border/10"
                                    disabled={readOnly}
                                />
                            </div>
                        ))}

                        {!readOnly && (
                            <button
                                onClick={addChild}
                                className="w-full py-4 border-2 border-dashed border-warm-border/30 rounded-xl text-sm font-medium text-warm-muted hover:border-olive hover:bg-olive/5 hover:text-olive transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                Add Child
                            </button>
                        )}
                    </div>
                </div>

                {/* Major Life Events */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-4">
                        <Calendar size={18} className="text-warm-brown" />
                        Major Life Events Timeline
                    </label>
                    <p className="text-xs text-warm-outline mb-4">
                        {isSelfArchive ? "Add significant moments and turning points throughout your life" : "Add significant moments and turning points throughout their life"}
                    </p>

                    <div className="space-y-4">
                        {data.majorLifeEvents
                            .sort((a, b) => (a.year || '').localeCompare(b.year || ''))
                            .map((event) => (
                                <div
                                    key={event.id}
                                    className="p-6 bg-white border border-warm-border/30 rounded-xl space-y-4 relative"
                                >
                                    {/* Remove button */}
                                    {!readOnly && (
                                        <button
                                            onClick={() => removeLifeEvent(event.id)}
                                            className="absolute top-4 right-4 p-2 text-warm-outline hover:text-warm-brown hover:bg-warm-brown/10 rounded-lg transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}

                                    <div className="flex gap-4 pr-8">
                                        <div className="w-24">
                                            <label className="block text-xs text-warm-muted mb-1">Year</label>
                                            <input
                                                type="text"
                                                value={event.year}
                                                onChange={(e) => updateLifeEvent(event.id, 'year', e.target.value)}
                                                placeholder="1968"
                                                className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all text-center font-medium disabled:opacity-60 disabled:bg-warm-border/10"
                                                disabled={readOnly}
                                            />
                                        </div>

                                        <div className="flex-1">
                                            <label className="block text-xs text-warm-muted mb-1">Event Title</label>
                                            <input
                                                type="text"
                                                value={event.title}
                                                onChange={(e) => updateLifeEvent(event.id, 'title', e.target.value)}
                                                placeholder="e.g., Married James Thompson"
                                                className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all font-medium disabled:opacity-60 disabled:bg-warm-border/10"
                                                disabled={readOnly}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-warm-muted mb-2">Category</label>
                                        <div className="flex flex-wrap gap-2">
                                            {EVENT_CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.value}
                                                    onClick={() => !readOnly && updateLifeEvent(event.id, 'category', cat.value)}
                                                    disabled={readOnly}
                                                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${event.category === cat.value
                                                        ? cat.color
                                                        : 'bg-warm-border/20 text-warm-muted hover:bg-warm-border/30'
                                                        } ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {cat.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <textarea
                                        value={event.description}
                                        onChange={(e) => updateLifeEvent(event.id, 'description', e.target.value)}
                                        placeholder="Brief description of what happened..."
                                        rows={2}
                                        className="w-full px-4 py-3 border border-warm-border/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/10 focus:border-olive transition-all resize-none disabled:opacity-60 disabled:bg-warm-border/10"
                                        disabled={readOnly}
                                    />
                                </div>
                            ))}

                        {!readOnly && (
                            <button
                                onClick={addLifeEvent}
                                className="w-full py-4 border-2 border-dashed border-warm-border/30 rounded-xl text-sm font-medium text-warm-muted hover:border-olive hover:bg-olive/5 hover:text-olive transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                Add Life Event
                            </button>
                        )}
                    </div>

                    <div className="mt-3 p-3 bg-warm-brown/5 rounded-lg border border-warm-brown/20">
                        <p className="text-xs text-warm-muted">
                            💡 Examples: Marriage, births, graduations, career milestones, moves, awards, losses
                        </p>
                    </div>
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
        </div>
    );
}
