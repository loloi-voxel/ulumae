// components/MemorialRenderer.tsx
// UNIFIED renderer used by BOTH:
//   - LiveMirror (isPreview=true, compact=true)
//   - /person/[id] published page (isPreview=false)
//   - PreviewModal (isPreview=true, compact=false)
//
// Step 1.2.1: One source of truth for how a memorial looks.

'use client';

import { useState } from 'react';
import {
    Calendar, MapPin, Heart, Briefcase, GraduationCap, Quote, Star, Home,
    Sparkles, MessageCircle, Share2, Mail, Users, BookOpen, Lightbulb, Award,
    MousePointer, Play, Mic
} from 'lucide-react';
import MediaLightbox, { type MediaLightboxItem } from '@/components/MediaLightbox';
import IntegrityBadge from '@/components/IntegrityBadge';
import BioWithLinks from '@/components/BioWithLinks';
import GhostPresence from '@/components/wizard/GhostPresence';


interface MemorialRendererProps {
    data: any;               // Memorial data (step1-step9)
    relations?: any[];       // Related individuals
    isPreview?: boolean;     // true = show watermark + badge
    compact?: boolean;       // true = LiveMirror sidebar mode (scrollable, smaller)
    className?: string;
}

export default function MemorialRenderer({
    data,
    relations = [],
    isPreview = false,
    compact = false,
    className = '',
}: MemorialRendererProps) {
    const [hoveredInteractive, setHoveredInteractive] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [showAllGallery, setShowAllGallery] = useState(false);
    const [showAllInteractiveGallery, setShowAllInteractiveGallery] = useState(false);
    const [showAllVideos, setShowAllVideos] = useState(false);
    const [lightboxState, setLightboxState] = useState<{
        items: MediaLightboxItem[];
        initialIndex: number;
    } | null>(null);
    const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
    const defaultVisibleCount = compact ? 4 : 8;

    const calculateAge = () => {
        if (!data.step1?.birthDate) return null;
        const birth = new Date(data.step1.birthDate);
        const end = data.step1.isStillLiving ? new Date() :
            data.step1.deathDate ? new Date(data.step1.deathDate) : new Date();
        return end.getFullYear() - birth.getFullYear();
    };

    const handleInteractiveMouseMove = (e: React.MouseEvent<HTMLElement>, imageId: string) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setHoveredInteractive(imageId);
    };

    // Scale classes for compact (mirror) vs full mode
    const s = {
        heroH: compact ? 'h-48' : 'h-96 md:h-[500px]',
        profileSize: compact ? 'w-24 h-24' : 'w-40 h-40 md:w-48 md:h-48',
        nameSize: compact ? 'text-2xl' : 'text-5xl md:text-6xl',
        sectionTitle: compact ? 'text-xl' : 'text-4xl',
        sectionPadding: compact ? 'p-4' : 'p-8 md:p-12',
        bodyText: compact ? 'text-sm' : 'text-base md:text-lg',
        gap: compact ? 'space-y-8' : 'space-y-16',
        maxW: compact ? 'max-w-full' : 'max-w-7xl mx-auto px-6 md:px-12',
        gridCols: compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        galleryGrid: compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        quoteSize: compact ? 'text-lg' : 'text-3xl md:text-4xl',
    };
    const galleryItems = (data.step8?.gallery || [])
        .filter((photo: any) => !!photo?.preview)
        .filter((photo: any) => !brokenImages[photo.id]);
    const interactiveGalleryItems = (data.step8?.interactiveGallery || []).filter((item: any) => !!item?.preview);
    const videoItems = (data.step9?.videos || []).filter((video: any) => !!video?.url);

    const galleryLightboxItems: MediaLightboxItem[] = galleryItems.map((photo: any) => ({
        id: photo.id,
        kind: 'image',
        src: photo.preview,
        thumbnailSrc: photo.preview,
        alt: photo.caption || 'Photo',
        title: photo.caption || 'Photo',
        caption: photo.caption || '',
        year: photo.year || '',
    }));
    const interactiveLightboxItems: MediaLightboxItem[] = interactiveGalleryItems.map((item: any, index: number) => ({
        id: item.id,
        kind: 'image',
        src: item.preview,
        thumbnailSrc: item.preview,
        alt: item.description || `Interactive photo story ${index + 1}`,
        title: `Interactive photo story ${index + 1}`,
        description: item.description || '',
    }));
    const videoLightboxItems: MediaLightboxItem[] = videoItems.map((video: any, index: number) => ({
        id: video.id,
        kind: 'video',
        src: video.url,
        thumbnailSrc: video.thumbnail || video.url,
        poster: video.thumbnail || null,
        title: video.title || `Video memory ${index + 1}`,
        description: video.description || '',
    }));

    const visibleGalleryItems = showAllGallery ? galleryItems : galleryItems.slice(0, defaultVisibleCount);
    const visibleInteractiveItems = showAllInteractiveGallery
        ? interactiveGalleryItems
        : interactiveGalleryItems.slice(0, defaultVisibleCount);
    const visibleVideoItems = showAllVideos ? videoItems : videoItems.slice(0, defaultVisibleCount);

    const openLightbox = (items: MediaLightboxItem[], initialIndex: number) => {
        setLightboxState({
            items,
            initialIndex,
        });
    };

    return (
        <div className={`relative bg-surface-low ${compact ? 'rounded-2xl shadow-inner border border-warm-border/30 overflow-hidden' : 'min-h-screen'} ${className}`}>

            {/* ========================================= */}
            {/* WATERMARK — Step 1.2.2: Elegant badge     */}
            {/* No large diagonal text. Subtle corner     */}
            {/* badge that doesn't ruin the preview.      */}
            {/* ========================================= */}
            {isPreview && (
                <>
                    {/* Step 1.2.2: Small fixed badge, bottom-right, semi-transparent */}
                    <div className="fixed bottom-4 right-4 z-30 px-3 py-1.5 bg-warm-dark/40 backdrop-blur-sm rounded-lg pointer-events-none">
                        <p className="text-surface-low/70 text-[10px] tracking-wide">
                            Preview — Draft
                        </p>
                    </div>

                    {/* Step 1.2.2 alternative: Thin top banner (30px) */}
                    {!compact && (
                        <div className="absolute top-0 left-0 right-0 z-30 bg-warm-dark/30 backdrop-blur-sm py-1.5 text-center pointer-events-none">
                            <p className="text-surface-low/60 text-[10px] tracking-wide">
                                This is a preview. The final archive will be identical, without this notice.
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* ========================================= */}
            {/* SCROLLABLE CONTENT                        */}
            {/* ========================================= */}
            <div className={compact ? 'h-full overflow-y-auto' : ''}>

                {/* HERO SECTION */}
                <div className={`relative ${s.heroH} bg-gradient-to-br from-olive/30 to-warm-brown/30`}>
                    {data.step8?.coverPhotoPreview ? (
                        <>
                            <img src={data.step8.coverPhotoPreview} alt="Cover" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#6b7f8e] via-[#6b7f8e]/20 to-[#6b7f8e]/10" />
                            <IntegrityBadge hash={data.step8.coverPhotoHash} className="top-4 left-4" />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#8a9ba8] via-[#7d8e9b] to-[#6b7f8e]" />
                    )}

                    <div className="absolute bottom-0 left-0 right-0">
                        <div className={`${s.maxW} pb-${compact ? '4' : '8'}`}>
                            <div className={`flex ${compact ? 'flex-col items-center text-center gap-3' : 'flex-col md:flex-row items-center md:items-end gap-6'}`}>
                                {data.step1?.profilePhotoPreview && (
                                    <div className={`${s.profileSize} rounded-2xl border-4 border-surface-low shadow-2xl overflow-hidden flex-shrink-0 bg-white`}>
                                        <img src={data.step1.profilePhotoPreview} alt={data.step1.fullName} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className={compact ? '' : 'text-center md:text-left pb-4'}>
                                    <h1 className={`font-serif ${s.nameSize} text-surface-low mb-2 drop-shadow-2xl`}>
                                        {data.step1?.fullName || 'Name'}
                                    </h1>
                                    <div className={`flex ${compact ? 'justify-center' : 'flex-col md:flex-row items-center'} gap-2 text-surface-low/90 ${compact ? 'text-xs' : 'text-lg'} drop-shadow-lg`}>
                                        {data.step1?.birthDate && (
                                            <div className="flex items-center gap-1">
                                                <Calendar size={compact ? 12 : 20} />
                                                <span>{new Date(data.step1.birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {!data.step1?.isStillLiving && data.step1?.deathDate && (
                                            <>
                                                <span className="hidden md:inline">—</span>
                                                <span>{new Date(data.step1.deathDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                            </>
                                        )}
                                        {calculateAge() && (
                                            <>
                                                <span className="hidden md:inline">•</span>
                                                <span>{calculateAge()} years</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Share buttons — only on full view */}
                    {!compact && (
                        <div className="absolute top-6 right-6 flex gap-3">
                            <button className="p-3 bg-surface-low/90 hover:bg-surface-low rounded-full shadow-lg transition-all">
                                <Share2 size={20} className="text-warm-dark" />
                            </button>
                            <button className="p-3 bg-surface-low/90 hover:bg-surface-low rounded-full shadow-lg transition-all">
                                <Mail size={20} className="text-warm-dark" />
                            </button>
                        </div>
                    )}
                </div>

                {/* MAIN CONTENT */}
                <div className={`${s.maxW} py-${compact ? '6' : '12'} ${s.gap}`}>

                    {/* Epitaph */}
                    {data.step1?.epitaph ? (
                        <div className={`text-center py-${compact ? '6' : '12'} border-y border-warm-border/30`}>
                            <Quote size={compact ? 24 : 40} className="text-warm-brown mx-auto mb-4 opacity-50" />
                            <p className={`font-serif ${s.quoteSize} text-warm-dark/80 italic leading-relaxed max-w-4xl mx-auto`}>
                                "{data.step1.epitaph}"
                            </p>
                        </div>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="Their defining words have not yet been spoken." />
                    ) : null}

                    {/* Quick Facts Grid */}
                    <div className={`grid ${s.gridCols} gap-${compact ? '3' : '6'}`}>
                        {data.step1?.birthPlace && (
                            <div className={`${compact ? 'p-3' : 'p-6'} bg-white rounded-xl border border-warm-border/30 shadow-sm`}>
                                <div className="flex items-start gap-3">
                                    <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-olive/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <MapPin size={compact ? 16 : 24} className="text-olive" />
                                    </div>
                                    <div>
                                        <p className={`${compact ? 'text-[10px]' : 'text-sm'} font-medium text-warm-muted mb-0.5`}>Born in</p>
                                        <p className={`text-warm-dark font-semibold ${compact ? 'text-xs' : ''}`}>{data.step1.birthPlace}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {data.step1?.deathPlace && !data.step1?.isStillLiving && (
                            <div className={`${compact ? 'p-3' : 'p-6'} bg-white rounded-xl border border-warm-border/30 shadow-sm`}>
                                <div className="flex items-start gap-3">
                                    <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-olive/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <MapPin size={compact ? 16 : 24} className="text-olive" />
                                    </div>
                                    <div>
                                        <p className={`${compact ? 'text-[10px]' : 'text-sm'} font-medium text-warm-muted mb-0.5`}>Passed in</p>
                                        <p className={`text-warm-dark font-semibold ${compact ? 'text-xs' : ''}`}>{data.step1.deathPlace}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {data.step3?.occupations?.length > 0 && (
                            <div className={`${compact ? 'p-3' : 'p-6'} bg-white rounded-xl border border-warm-border/30 shadow-sm`}>
                                <div className="flex items-start gap-3">
                                    <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-warm-brown/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <Briefcase size={compact ? 16 : 24} className="text-warm-brown" />
                                    </div>
                                    <div>
                                        <p className={`${compact ? 'text-[10px]' : 'text-sm'} font-medium text-warm-muted mb-0.5`}>Career</p>
                                        <p className={`text-warm-dark font-semibold ${compact ? 'text-xs' : ''}`}>{data.step3.occupations[0].title}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {data.step4?.children?.length > 0 && (
                            <div className={`${compact ? 'p-3' : 'p-6'} bg-white rounded-xl border border-warm-border/30 shadow-sm`}>
                                <div className="flex items-start gap-3">
                                    <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-olive/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <Heart size={compact ? 16 : 24} className="text-olive" />
                                    </div>
                                    <div>
                                        <p className={`${compact ? 'text-[10px]' : 'text-sm'} font-medium text-warm-muted mb-0.5`}>Family</p>
                                        <p className={`text-warm-dark font-semibold ${compact ? 'text-xs' : ''}`}>
                                            {data.step4.children.length} child{data.step4.children.length !== 1 ? 'ren' : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Life Story */}
                    {data.step6?.biography ? (
                        <section className={`bg-white rounded-2xl ${s.sectionPadding} shadow-sm border border-warm-border/30`}>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-olive/10 rounded-xl flex items-center justify-center`}>
                                    <Quote size={compact ? 16 : 24} className="text-olive" />
                                </div>
                                Life Story
                            </h2>
                            <div className="prose prose-lg max-w-none">
                                <div className={`text-warm-dark/80 leading-relaxed font-serif ${s.bodyText}`}>
                                    <BioWithLinks
                                        text={compact
                                            ? data.step6.biography.substring(0, 500) + (data.step6.biography.length > 500 ? '...' : '')
                                            : data.step6.biography
                                        }
                                        relations={relations}
                                    />
                                    {/* Biography Mirror Appendage — contextual trailing for incomplete biographies */}
                                    {!compact && (() => {
                                        const bioWordCount = data.step6.biography.trim().split(/\s+/).filter(Boolean).length;
                                        if (bioWordCount === 0 || bioWordCount >= 500) return null;
                                        const appendage = data.step1?.isStillLiving
                                            ? '\u2026And the story continues \u2014 each day adding a new line to a life still being written.'
                                            : data.step1?.deathDate
                                                ? '\u2026The story of their final chapter remains unwritten. Perhaps someone, somewhere, still carries the words.'
                                                : '\u2026There is more to tell. Every life holds stories that have not yet found their way here.';
                                        return (
                                            <p className="mt-6 text-warm-dark/30 italic font-serif text-sm leading-relaxed">
                                                {appendage}
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="Their story remains unwritten." />
                    ) : null}

                    {/* Life Chapters */}
                    {data.step6?.lifeChapters?.length > 0 ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'}`}>Life Chapters</h2>
                            <div className={`space-y-${compact ? '3' : '6'}`}>
                                {data.step6.lifeChapters.map((chapter: any, index: number) => (
                                    <div key={chapter.id} className={`bg-white rounded-xl ${compact ? 'p-4' : 'p-6 md:p-8'} shadow-sm border-l-4 border-olive`}>
                                        <div className="flex items-start gap-4">
                                            <div className={`${compact ? 'w-8 h-8 text-sm' : 'w-12 h-12 text-xl'} bg-olive text-surface-low rounded-full flex items-center justify-center font-serif font-bold flex-shrink-0`}>
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className={`font-serif ${compact ? 'text-base' : 'text-2xl'} text-warm-dark mb-2`}>{chapter.title}</h3>
                                                {chapter.period && <span className={`px-3 py-1 bg-olive/10 text-olive rounded-full ${compact ? 'text-[10px]' : 'text-sm'} font-medium mr-2`}>{chapter.period}</span>}
                                                {chapter.ageRange && <span className={`px-3 py-1 bg-warm-brown/10 text-warm-brown rounded-full ${compact ? 'text-[10px]' : 'text-sm'} font-medium`}>{chapter.ageRange}</span>}
                                                <p className={`text-warm-muted leading-relaxed mt-3 ${compact ? 'text-xs' : ''}`}>{chapter.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="The chapters of their life await." />
                    ) : null}

                    {/* Early Life */}
                    {(data.step2?.childhoodHome || data.step2?.familyBackground || data.step2?.schools?.elementary || data.step2?.schools?.highSchool || data.step2?.schools?.college || data.step2?.schools?.additionalEducation || data.step2?.earlyInterests?.length > 0 || data.step2?.childhoodPhotos?.length > 0) ? (
                        <section className={`bg-gradient-to-br from-olive/5 to-warm-brown/5 rounded-2xl ${s.sectionPadding} border border-warm-border/30`}>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-warm-brown/10 rounded-xl flex items-center justify-center`}>
                                    <Home size={compact ? 16 : 24} className="text-warm-brown" />
                                </div>
                                Early Life & Childhood
                            </h2>
                            <div className={`space-y-${compact ? '3' : '6'}`}>
                                {data.step2.childhoodHome && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-2 ${compact ? 'text-sm' : ''}`}>Childhood Home</h3>
                                        <p className={`text-warm-muted leading-relaxed ${compact ? 'text-xs' : ''}`}>{data.step2.childhoodHome}</p>
                                    </div>
                                )}
                                {data.step2.familyBackground && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-2 ${compact ? 'text-sm' : ''}`}>Family Background</h3>
                                        <p className={`text-warm-muted leading-relaxed ${compact ? 'text-xs' : ''}`}>{data.step2.familyBackground}</p>
                                    </div>
                                )}
                                {/* Schools / Education */}
                                {(data.step2?.schools?.elementary || data.step2?.schools?.highSchool || data.step2?.schools?.college || data.step2?.schools?.additionalEducation) && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-3 flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
                                            <GraduationCap size={compact ? 14 : 18} className="text-olive" />
                                            Education
                                        </h3>
                                        <div className={`grid grid-cols-1 ${compact ? '' : 'sm:grid-cols-2'} gap-${compact ? '2' : '3'}`}>
                                            {data.step2.schools.elementary && (
                                                <div className={`bg-white/60 rounded-lg ${compact ? 'p-2' : 'p-4'} border border-warm-border/20`}>
                                                    <p className={`text-warm-dark/40 ${compact ? 'text-[10px]' : 'text-xs'} font-medium mb-0.5`}>Elementary / Primary</p>
                                                    <p className={`text-warm-dark font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{data.step2.schools.elementary}</p>
                                                </div>
                                            )}
                                            {data.step2.schools.highSchool && (
                                                <div className={`bg-white/60 rounded-lg ${compact ? 'p-2' : 'p-4'} border border-warm-border/20`}>
                                                    <p className={`text-warm-dark/40 ${compact ? 'text-[10px]' : 'text-xs'} font-medium mb-0.5`}>High School</p>
                                                    <p className={`text-warm-dark font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{data.step2.schools.highSchool}</p>
                                                </div>
                                            )}
                                            {data.step2.schools.college && (
                                                <div className={`bg-white/60 rounded-lg ${compact ? 'p-2' : 'p-4'} border border-warm-border/20`}>
                                                    <p className={`text-warm-dark/40 ${compact ? 'text-[10px]' : 'text-xs'} font-medium mb-0.5`}>College / University</p>
                                                    <p className={`text-warm-dark font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{data.step2.schools.college}</p>
                                                </div>
                                            )}
                                            {data.step2.schools.additionalEducation && (
                                                <div className={`bg-white/60 rounded-lg ${compact ? 'p-2' : 'p-4'} border border-warm-border/20`}>
                                                    <p className={`text-warm-dark/40 ${compact ? 'text-[10px]' : 'text-xs'} font-medium mb-0.5`}>Additional Education</p>
                                                    <p className={`text-warm-dark font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{data.step2.schools.additionalEducation}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {data.step2?.childhoodPersonality?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {data.step2.childhoodPersonality.map((trait: string) => (
                                            <span key={trait} className={`px-3 py-1.5 bg-olive/10 text-olive rounded-full ${compact ? 'text-[10px]' : 'text-sm'} font-medium`}>{trait}</span>
                                        ))}
                                    </div>
                                )}
                                {/* Early Interests */}
                                {data.step2?.earlyInterests?.length > 0 && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-2 ${compact ? 'text-sm' : ''}`}>Early Interests</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {data.step2.earlyInterests.map((interest: string) => (
                                                <span key={interest} className={`px-3 py-1.5 bg-warm-brown/10 text-warm-brown rounded-full ${compact ? 'text-[10px]' : 'text-sm'} font-medium`}>{interest}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Childhood Photos */}
                                {data.step2?.childhoodPhotos?.length > 0 && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-3 ${compact ? 'text-sm' : ''}`}>Childhood Photos</h3>
                                        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-${compact ? '2' : '3'}`}>
                                            {data.step2.childhoodPhotos.map((photo: any, index: number) => (
                                                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-warm-border/20 shadow-sm">
                                                    <img src={photo.preview} alt={photo.caption || 'Childhood photo'} className="w-full h-full object-cover" />
                                                    {(photo.caption || photo.year) && (
                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-warm-dark/70 to-transparent p-2">
                                                            {photo.caption && <p className="text-surface-low text-xs">{photo.caption}</p>}
                                                            {photo.year && <p className="text-surface-low/70 text-[10px]">{photo.year}</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="Where they came from remains untold." />
                    ) : null}

                    {/* Career & Education */}
                    {(data.step3?.occupations?.length > 0 || data.step3?.careerHighlights?.length > 0 || data.step3?.education?.major) ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-warm-brown/10 rounded-xl flex items-center justify-center`}>
                                    <Briefcase size={compact ? 16 : 24} className="text-warm-brown" />
                                </div>
                                Career & Achievements
                            </h2>
                            <div className={`space-y-${compact ? '3' : '6'}`}>
                                {data.step3?.occupations?.map((job: any) => (
                                    <div key={job.id} className={`bg-white rounded-xl ${compact ? 'p-4' : 'p-6'} shadow-sm border border-warm-border/30`}>
                                        <h4 className={`font-semibold ${compact ? 'text-sm' : 'text-xl'} text-warm-dark`}>{job.title}</h4>
                                        <p className={`text-warm-muted ${compact ? 'text-xs' : ''} mb-2`}>{job.company}</p>
                                        <span className={`px-3 py-1 bg-warm-brown/10 text-warm-brown rounded-full ${compact ? 'text-[10px]' : 'text-sm'}`}>
                                            {job.yearsFrom} - {job.yearsTo}
                                        </span>
                                        {job.description && <p className={`text-warm-muted leading-relaxed mt-3 ${compact ? 'text-xs' : ''}`}>{job.description}</p>}
                                    </div>
                                ))}
                                {/* Career Highlights */}
                                {data.step3?.careerHighlights?.length > 0 && (
                                    <div className={`bg-white rounded-xl ${compact ? 'p-4' : 'p-6'} shadow-sm border border-warm-border/30`}>
                                        <h3 className={`font-semibold text-warm-dark mb-3 flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
                                            <Award size={compact ? 14 : 18} className="text-warm-brown" />
                                            Career Highlights
                                        </h3>
                                        <ul className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
                                            {data.step3.careerHighlights.map((highlight: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-warm-muted">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-warm-brown/40 mt-2 flex-shrink-0" />
                                                    {highlight}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {/* Education */}
                                {(data.step3?.education?.major || data.step3?.education?.graduationYear || data.step3?.education?.honors) && (
                                    <div className={`bg-white rounded-xl ${compact ? 'p-4' : 'p-6'} shadow-sm border border-warm-border/30`}>
                                        <h3 className={`font-semibold text-warm-dark mb-3 flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
                                            <GraduationCap size={compact ? 14 : 18} className="text-olive" />
                                            Higher Education
                                        </h3>
                                        <div className={`space-y-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                                            {data.step3.education.major && (
                                                <p className="text-warm-muted"><span className="text-warm-dark font-medium">Major:</span> {data.step3.education.major}</p>
                                            )}
                                            {data.step3.education.graduationYear && (
                                                <p className="text-warm-muted"><span className="text-warm-dark font-medium">Graduated:</span> {data.step3.education.graduationYear}</p>
                                            )}
                                            {data.step3.education.honors && (
                                                <p className="text-warm-muted"><span className="text-warm-dark font-medium">Honors:</span> {data.step3.education.honors}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="Their life's work has not been recorded." />
                    ) : null}

                    {/* Family & Relationships */}
                    {((data.step4?.partners?.length > 0) || (data.step4?.children?.length > 0) || (data.step4?.majorLifeEvents?.length > 0)) ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-olive/10 rounded-xl flex items-center justify-center`}>
                                    <Heart size={compact ? 16 : 24} className="text-olive" />
                                </div>
                                Family & Relationships
                            </h2>
                            {data.step4?.partners?.length > 0 && (
                                <div className={`grid grid-cols-1 ${compact ? '' : 'md:grid-cols-2'} gap-${compact ? '3' : '6'} mb-6`}>
                                    {data.step4.partners.map((partner: any) => (
                                        <div key={partner.id} className={`bg-white rounded-xl ${compact ? 'p-4' : 'p-6'} shadow-sm border border-warm-border/30`}>
                                            <div className={`flex ${compact ? 'gap-3' : 'gap-4'} items-start`}>
                                                {partner.photoPreview && (
                                                    <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-xl overflow-hidden flex-shrink-0 border border-warm-border/20`}>
                                                        <img src={partner.photoPreview} alt={partner.name} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className={`font-semibold text-warm-dark mb-1 ${compact ? 'text-sm' : ''}`}>{partner.name}</h4>
                                                    <p className={`text-warm-muted mb-1 ${compact ? 'text-[10px]' : 'text-sm'}`}>{partner.relationshipType}</p>
                                                    <p className={`text-warm-muted ${compact ? 'text-[10px]' : 'text-sm'}`}>{partner.yearsFrom} - {partner.yearsTo}</p>
                                                    {partner.description && <p className={`text-warm-muted mt-2 ${compact ? 'text-xs' : 'text-sm'}`}>{partner.description}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {data.step4?.children?.length > 0 && (
                                <div className={`grid grid-cols-1 ${compact ? '' : 'md:grid-cols-2'} gap-${compact ? '2' : '4'} ${data.step4?.majorLifeEvents?.length > 0 ? 'mb-6' : ''}`}>
                                    {data.step4.children.map((child: any) => (
                                        <div key={child.id} className={`bg-white rounded-xl ${compact ? 'p-3' : 'p-6'} shadow-sm border border-warm-border/30`}>
                                            <h4 className={`font-semibold text-warm-dark mb-1 ${compact ? 'text-sm' : ''}`}>{child.name}</h4>
                                            <p className={`text-warm-muted ${compact ? 'text-[10px]' : 'text-sm'}`}>Born {child.birthYear}</p>
                                            {child.description && <p className={`text-warm-muted mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>{child.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Major Life Events Timeline */}
                            {data.step4?.majorLifeEvents?.length > 0 && (
                                <div className={`mt-${compact ? '3' : '6'}`}>
                                    <h3 className={`font-semibold text-warm-dark mb-4 flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
                                        <Calendar size={compact ? 14 : 18} className="text-olive" />
                                        Major Life Events
                                    </h3>
                                    <div className="relative">
                                        <div className={`absolute left-${compact ? '2' : '3'} top-0 bottom-0 w-px bg-warm-border/30`} />
                                        <div className={`space-y-${compact ? '3' : '4'}`}>
                                            {data.step4.majorLifeEvents.map((event: any) => (
                                                <div key={event.id} className={`relative pl-${compact ? '7' : '10'}`}>
                                                    <div className={`absolute left-${compact ? '0.5' : '1'} top-1 ${compact ? 'w-3 h-3' : 'w-4 h-4'} rounded-full border-2 border-surface-low shadow-sm ${
                                                        event.category === 'marriage' ? 'bg-pink-400' :
                                                        event.category === 'birth' ? 'bg-blue-400' :
                                                        event.category === 'career' ? 'bg-purple-400' :
                                                        event.category === 'achievement' ? 'bg-olive' :
                                                        event.category === 'loss' ? 'bg-gray-400' :
                                                        'bg-warm-brown'
                                                    }`} />
                                                    <div className={`bg-white rounded-lg ${compact ? 'p-3' : 'p-4'} border border-warm-border/20 shadow-sm`}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`px-2 py-0.5 rounded-full ${compact ? 'text-[9px]' : 'text-xs'} font-medium ${
                                                                event.category === 'marriage' ? 'bg-pink-50 text-pink-600' :
                                                                event.category === 'birth' ? 'bg-blue-50 text-blue-600' :
                                                                event.category === 'career' ? 'bg-purple-50 text-purple-600' :
                                                                event.category === 'achievement' ? 'bg-olive/10 text-olive' :
                                                                event.category === 'loss' ? 'bg-gray-100 text-warm-dark' :
                                                                'bg-warm-brown/10 text-warm-brown'
                                                            }`}>{event.category}</span>
                                                            {event.year && <span className={`text-warm-dark/40 ${compact ? 'text-[10px]' : 'text-xs'}`}>{event.year}</span>}
                                                        </div>
                                                        <h4 className={`font-medium text-warm-dark ${compact ? 'text-xs' : 'text-sm'}`}>{event.title}</h4>
                                                        {event.description && <p className={`text-warm-muted mt-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>{event.description}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="The people who shaped their world are unnamed." />
                    ) : null}

                    {/* Personality & Values */}
                    {(data.step5?.personalityTraits?.length > 0 || data.step5?.lifePhilosophy || data.step5?.passions?.length > 0 || data.step5?.favoriteQuotes?.length > 0 || data.step5?.memorableSayings?.length > 0 || data.step5?.coreValues?.length > 0) ? (
                        <section className={`bg-white rounded-2xl ${s.sectionPadding} shadow-sm border border-warm-border/30`}>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-warm-brown/10 rounded-xl flex items-center justify-center`}>
                                    <Sparkles size={compact ? 16 : 24} className="text-warm-brown" />
                                </div>
                                Personality, Values & Passions
                            </h2>
                            <div className={`space-y-${compact ? '4' : '8'}`}>
                                {data.step5?.personalityTraits?.length > 0 && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-3 ${compact ? 'text-sm' : ''}`}>Personality Traits</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {data.step5.personalityTraits.map((trait: string) => (
                                                <span key={trait} className={`px-3 py-1.5 bg-olive/10 text-olive rounded-full ${compact ? 'text-[10px]' : 'text-sm'}`}>{trait}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.step5?.coreValues?.length > 0 && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-3 ${compact ? 'text-sm' : ''}`}>Core Values</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {data.step5.coreValues.map((value: string) => (
                                                <span key={value} className={`px-3 py-1.5 bg-warm-brown/10 text-warm-brown rounded-full ${compact ? 'text-[10px]' : 'text-sm'}`}>{value}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Passions */}
                                {data.step5?.passions?.length > 0 && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-3 ${compact ? 'text-sm' : ''}`}>Passions & Interests</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {data.step5.passions.map((passion: string) => (
                                                <span key={passion} className={`px-3 py-1.5 bg-olive/10 text-olive rounded-full ${compact ? 'text-[10px]' : 'text-sm'} font-medium`}>{passion}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.step5?.lifePhilosophy && (
                                    <div className="bg-gradient-to-br from-olive/5 to-warm-brown/5 rounded-xl p-6 border border-warm-border/20">
                                        <h3 className={`font-semibold text-warm-dark mb-2 ${compact ? 'text-sm' : ''}`}>Life Philosophy</h3>
                                        <p className={`text-warm-dark/80 leading-relaxed italic ${compact ? 'text-xs' : ''}`}>{data.step5.lifePhilosophy}</p>
                                    </div>
                                )}
                                {/* Favorite Quotes */}
                                {data.step5?.favoriteQuotes?.length > 0 && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-3 ${compact ? 'text-sm' : ''}`}>Favorite Quotes</h3>
                                        <div className={`space-y-${compact ? '2' : '4'}`}>
                                            {data.step5.favoriteQuotes.map((quote: any) => (
                                                <div key={quote.id} className={`border-l-3 border-warm-brown/30 pl-${compact ? '3' : '5'} py-1`}>
                                                    <p className={`text-warm-dark/80 italic font-serif ${compact ? 'text-xs' : 'text-base'} leading-relaxed`}>"{quote.text}"</p>
                                                    {quote.context && <p className={`text-warm-muted mt-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>— {quote.context}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Memorable Sayings */}
                                {data.step5?.memorableSayings?.length > 0 && (
                                    <div>
                                        <h3 className={`font-semibold text-warm-dark mb-3 flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
                                            <MessageCircle size={compact ? 14 : 18} className="text-olive" />
                                            Things They Used to Say
                                        </h3>
                                        <div className={`space-y-${compact ? '2' : '3'}`}>
                                            {data.step5.memorableSayings.map((saying: string, i: number) => (
                                                <div key={i} className={`bg-olive/5 rounded-lg ${compact ? 'px-3 py-2' : 'px-5 py-3'} border border-olive/10`}>
                                                    <p className={`text-warm-dark/70 italic font-serif ${compact ? 'text-xs' : 'text-sm'}`}>"{saying}"</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="Their character has not yet been captured." />
                    ) : null}

                    {/* Memories & Stories */}
                    {(data.step7?.sharedMemories?.length > 0 || data.step7?.impactStories?.length > 0) ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-olive/10 rounded-xl flex items-center justify-center`}>
                                    <MessageCircle size={compact ? 16 : 24} className="text-olive" />
                                </div>
                                Memories & Stories
                            </h2>
                            <div className={`space-y-${compact ? '3' : '6'}`}>
                                {data.step7.sharedMemories?.map((memory: any) => (
                                    <div key={memory.id} className={`bg-white rounded-xl ${compact ? 'p-4' : 'p-8'} shadow-sm border border-warm-border/30`}>
                                        <h4 className={`font-semibold ${compact ? 'text-sm' : 'text-xl'} text-warm-dark mb-2`}>{memory.title}</h4>
                                        <p className={`text-warm-muted leading-relaxed mb-3 ${compact ? 'text-xs' : ''}`}>{memory.content}</p>
                                        <p className={`text-warm-muted ${compact ? 'text-[10px]' : 'text-sm'}`}>— <span className="font-medium text-warm-dark">{memory.author}</span></p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="No one has shared a memory yet." />
                    ) : null}

                    {/* Interactive Photo Stories */}
                    {interactiveGalleryItems.length > 0 ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-olive/10 rounded-xl flex items-center justify-center`}>
                                    <MousePointer size={compact ? 16 : 24} className="text-olive" />
                                </div>
                                Interactive Photo Stories
                            </h2>
                            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-${compact ? '3' : '6'}`}>
                                {visibleInteractiveItems.map((item: any, index: number) => {
                                    const absoluteIndex = interactiveGalleryItems.findIndex((entry: any) => entry.id === item.id);

                                    return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => openLightbox(interactiveLightboxItems, absoluteIndex)}
                                        className={`relative aspect-video rounded-xl overflow-hidden border-2 border-warm-border/30 group text-left ${isPreview && index > 0 ? 'opacity-50 pointer-events-none' : ''}`}
                                        onMouseMove={(e) => handleInteractiveMouseMove(e, item.id)}
                                        onMouseLeave={() => setHoveredInteractive(null)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {/* Hidden text layer (visible by default) */}
                                        <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
                                            <div className="bg-gradient-to-br from-olive/20 via-surface-low/90 to-warm-brown/20 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
                                                <p className={`font-serif text-warm-dark leading-relaxed text-center font-medium drop-shadow-sm ${compact ? 'text-base' : 'text-2xl md:text-3xl'}`}>
                                                    {item.description || 'Move your cursor to reveal the photo'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Photo layer with spotlight mask */}
                                        <div
                                            className="absolute inset-0 z-20 transition-opacity duration-300"
                                            style={{
                                                maskImage: hoveredInteractive === item.id
                                                    ? `radial-gradient(circle 110px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, transparent 40%, rgba(0,0,0,0.3) 70%, black 100%)`
                                                    : 'none',
                                                WebkitMaskImage: hoveredInteractive === item.id
                                                    ? `radial-gradient(circle 110px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, transparent 40%, rgba(0,0,0,0.3) 70%, black 100%)`
                                                    : 'none',
                                            }}
                                        >
                                            <img
                                                src={item.preview}
                                                alt="Interactive photo"
                                                        className="w-full h-full object-cover"
                                                draggable={false}
                                            />
                                        </div>

                                        <IntegrityBadge hash={item.sha256_hash} />
                                    </button>
                                )})}
                            </div>
                            {interactiveGalleryItems.length > defaultVisibleCount && !showAllInteractiveGallery && (
                                <div className="mt-4 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowAllInteractiveGallery(true)}
                                        className="rounded-xl border border-warm-border/30 px-4 py-2 text-sm text-warm-dark transition-all hover:bg-warm-border/10"
                                    >
                                        Show all
                                    </button>
                                </div>
                            )}
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="gallery" whisper="Moments waiting to be revealed." />
                    ) : null}

                    {/* Photo Gallery */}
                    {galleryItems.length > 0 ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'}`}>Photo Gallery</h2>
                            <div className={`grid ${s.galleryGrid} gap-${compact ? '2' : '4'}`}>
                                {visibleGalleryItems.map((photo: any, index: number) => {
                                    const absoluteIndex = galleryItems.findIndex((entry: any) => entry.id === photo.id);

                                    return (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => openLightbox(galleryLightboxItems, absoluteIndex)}
                                        className={`group relative aspect-square rounded-xl overflow-hidden bg-warm-border/20 shadow-sm cursor-pointer hover:shadow-lg transition-all ${isPreview && index > 0 ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        <img
                                            src={photo.preview}
                                            alt={photo.caption}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                            onError={() => setBrokenImages((current) => ({ ...current, [photo.id]: true }))}
                                        />

                                        <IntegrityBadge hash={photo.sha256_hash} />

                                        {(photo.caption || photo.year) && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-warm-dark/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {photo.caption && <p className="text-surface-low text-xs">{photo.caption}</p>}
                                                {photo.year && <p className="text-surface-low/70 text-[10px]">{photo.year}</p>}
                                            </div>
                                        )}
                                    </button>
                                )})}
                            </div>
                            {galleryItems.length > defaultVisibleCount && !showAllGallery && (
                                <div className="mt-4 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowAllGallery(true)}
                                        className="px-4 py-2 text-sm border border-warm-border/30 rounded-xl text-warm-dark hover:bg-warm-border/10 transition-all"
                                    >
                                        Show all
                                    </button>
                                </div>
                            )}
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="gallery" whisper="No images preserve their face." />
                    ) : null}

                    {/* Videos */}
                    {videoItems.length > 0 ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'}`}>Video Memories</h2>
                            <div className={`grid grid-cols-1 ${compact ? '' : 'md:grid-cols-2'} gap-${compact ? '3' : '6'}`}>
                                {visibleVideoItems.map((video: any) => {
                                    const absoluteIndex = videoItems.findIndex((entry: any) => entry.id === video.id);

                                    return (
                                    <button
                                        key={video.id}
                                        type="button"
                                        onClick={() => openLightbox(videoLightboxItems, absoluteIndex)}
                                        className={`relative overflow-hidden rounded-xl border border-warm-border/30 bg-white text-left shadow-sm transition-all hover:shadow-lg ${compact ? 'p-3' : 'p-4'}`}
                                    >

                                        <IntegrityBadge hash={video.sha256_hash} className="top-2 left-2" />

                                        <div className="relative mb-2 aspect-video overflow-hidden rounded-lg bg-warm-dark/10">
                                            {video.thumbnail ? (
                                                <img
                                                    src={video.thumbnail}
                                                    alt={video.title || 'Video memory'}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-warm-dark/15">
                                                    <Play size={28} className="fill-warm-dark text-warm-dark" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-warm-dark/20">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/85 shadow-lg">
                                                    <Play size={20} className="fill-warm-dark text-warm-dark" />
                                                </div>
                                            </div>
                                        </div>
                                        {video.title && <h3 className={`font-semibold text-warm-dark ${compact ? 'text-xs' : ''}`}>{video.title}</h3>}
                                        {video.description && !compact && (
                                            <p className="mt-2 text-sm text-warm-dark line-clamp-2">{video.description}</p>
                                        )}
                                    </button>
                                )})}
                            </div>
                            {videoItems.length > defaultVisibleCount && !showAllVideos && (
                                <div className="mt-4 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowAllVideos(true)}
                                        className="px-4 py-2 text-sm border border-warm-border/30 rounded-xl text-warm-dark hover:bg-warm-border/10 transition-all"
                                    >
                                        Show all
                                    </button>
                                </div>
                            )}
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="video" whisper="No moving images have been gathered." />
                    ) : null}

                    {/* Voice Recordings */}
                    {data.step8?.voiceRecordings?.length > 0 ? (
                        <section>
                            <h2 className={`font-serif ${s.sectionTitle} text-warm-dark mb-${compact ? '4' : '8'} flex items-center gap-3`}>
                                <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-warm-brown/10 rounded-xl flex items-center justify-center`}>
                                    <Mic size={compact ? 16 : 24} className="text-warm-brown" />
                                </div>
                                Voice Recordings
                            </h2>
                            <div className={`space-y-${compact ? '2' : '4'}`}>
                                {data.step8.voiceRecordings.map((recording: any) => (
                                    <div key={recording.id} className={`bg-white rounded-xl ${compact ? 'p-3' : 'p-4 md:p-6'} shadow-sm border border-warm-border/30 flex items-center gap-4`}>
                                        <div className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} bg-warm-brown/10 rounded-full flex items-center justify-center flex-shrink-0`}>
                                            <Mic size={compact ? 16 : 24} className="text-warm-brown" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className={`font-semibold text-warm-dark ${compact ? 'text-xs' : 'text-base'}`}>{recording.title || 'Untitled Recording'}</h4>
                                        </div>
                                        <IntegrityBadge hash={recording.sha256_hash} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="voice" whisper="Their voice is waiting to be heard." />
                    ) : null}

                    {/* Legacy Statement */}
                    {data.step8?.legacyStatement ? (
                        <section className={`bg-gradient-to-br from-olive/20 via-surface-low to-warm-brown/20 rounded-2xl ${compact ? 'p-6' : 'p-12 md:p-16'} text-center border-2 border-warm-border/30 shadow-lg`}>
                            <Star size={compact ? 24 : 48} className="text-warm-brown mx-auto mb-4" />
                            <h2 className={`font-serif ${compact ? 'text-lg' : 'text-3xl'} text-warm-dark mb-4`}>Legacy</h2>
                            <p className={`${compact ? 'text-sm' : 'text-xl md:text-2xl'} text-warm-dark/80 leading-relaxed max-w-4xl mx-auto font-serif`}>
                                {data.step8.legacyStatement}
                            </p>
                        </section>
                    ) : isPreview ? (
                        <GhostPresence variant="text" whisper="Their legacy message awaits." />
                    ) : null}
                </div>

                {/* Footer — only on full view */}
                {!compact && (
                    <div className="bg-warm-dark text-surface-low py-12">
                        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
                            <p className="text-surface-low/60 mb-4">Memorial created with ❤️ by ULUMAE</p>
                            <p className="text-surface-low/40 text-sm">© {new Date().getFullYear()} ULUMAE. All rights reserved.</p>
                        </div>
                    </div>
                )}
            </div>
            {lightboxState && (
                <MediaLightbox
                    items={lightboxState.items}
                    initialIndex={lightboxState.initialIndex}
                    onClose={() => setLightboxState(null)}
                />
            )}
        </div>
    );
}
