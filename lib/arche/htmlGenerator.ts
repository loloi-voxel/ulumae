import { MemorialData } from '@/types/memorial';
import { ARCHE_CSS } from './css';

export type ResourceMap = Map<string, string>;

type StandaloneMediaItem = {
    id: string;
    kind: 'image' | 'video';
    variant?: 'default' | 'interactive-story';
    src: string;
    thumbnailSrc?: string | null;
    poster?: string | null;
    mimeType?: string | null;
    alt?: string;
    title?: string;
    description?: string;
    caption?: string;
    year?: string;
};

const ICONS = {
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    mapPin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>`,
    quote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1 0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1Z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1 0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1Z"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    mouse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>`,
    message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>`,
    clapperboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l16-4"/><path d="M4 6l7.1 1.8"/><path d="M4 16l16-4"/><path d="M4 21l7.1-1.8"/><rect width="18" height="12" x="3" y="6" rx="2"/></svg>`,
};

function processMedia(url: string | null | undefined, map?: ResourceMap): string {
    if (!url) return '';
    if (map && map.has(url)) return map.get(url) || '';
    return url;
}

function calculateAge(data: MemorialData): number | null {
    if (!data.step1.birthDate) return null;
    try {
        const birth = new Date(data.step1.birthDate);
        const end = data.step1.isStillLiving
            ? new Date()
            : (data.step1.deathDate ? new Date(data.step1.deathDate) : new Date());
        return end.getFullYear() - birth.getFullYear();
    } catch {
        return null;
    }
}

function getInteractiveStoryText(item: any, index: number): string {
    return item.description
        || item.story
        || item.caption
        || item.title
        || `Interactive photo story ${index + 1}`;
}

function renderFacts(data: MemorialData): string {
    const facts = [];
    if (data.step1.birthPlace) {
        facts.push(`
            <div class="fact-item">
                <div class="icon-box">${ICONS.mapPin}</div>
                <div>
                    <div style="font-size: 11px; font-weight: 500; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em;">Born in</div>
                    <div style="font-weight: 600; color: var(--color-charcoal);">${data.step1.birthPlace}</div>
                </div>
            </div>
        `);
    }
    if (data.step1.deathPlace && !data.step1.isStillLiving) {
        facts.push(`
            <div class="fact-item">
                <div class="icon-box">${ICONS.mapPin}</div>
                <div>
                    <div style="font-size: 11px; font-weight: 500; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em;">Passed in</div>
                    <div style="font-weight: 600; color: var(--color-charcoal);">${data.step1.deathPlace}</div>
                </div>
            </div>
        `);
    }
    if (data.step3.occupations && data.step3.occupations.length > 0) {
        facts.push(`
            <div class="fact-item">
                <div class="icon-box">${ICONS.briefcase}</div>
                <div>
                    <div style="font-size: 11px; font-weight: 500; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em;">Career</div>
                    <div style="font-weight: 600; color: var(--color-charcoal);">${data.step3.occupations[0].title}</div>
                </div>
            </div>
        `);
    }
    if (data.step4.children && data.step4.children.length > 0) {
        facts.push(`
            <div class="fact-item">
                <div class="icon-box">${ICONS.heart}</div>
                <div>
                    <div style="font-size: 11px; font-weight: 500; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em;">Family</div>
                    <div style="font-weight: 600; color: var(--color-charcoal);">${data.step4.children.length} Children</div>
                </div>
            </div>
        `);
    }

    if (facts.length === 0) return '';
    return `<div class="grid-facts section-gap">${facts.join('')}</div>`;
}

function renderBiography(data: MemorialData): string {
    const bio = data.step6.biography;
    const chapters = data.step6.lifeChapters || [];
    if (!bio && chapters.length === 0) return '';

    let html = '';
    if (bio) {
        html += `
            <section class="card-section section-gap">
                <h2 class="section-title">
                    <div class="icon-box">${ICONS.quote}</div>
                    Life Story
                </h2>
                <div class="prose" style="white-space: pre-wrap; font-family: Georgia, serif; font-variant: normal; font-variant-caps: normal; text-transform: none;">${bio}</div>
            </section>
        `;
    }

    if (chapters.length > 0) {
        html += `
            <div class="section-gap">
                <h2 class="section-title">Life Chapters</h2>
                ${chapters.map((chapter, index) => `
                    <div class="chapter-card">
                        <div class="chapter-number">${index + 1}</div>
                        <div>
                            <h3 style="font-size: 1.5rem; margin-bottom: 8px; color: var(--color-charcoal);">${chapter.title}</h3>
                            ${chapter.period ? `<span class="badge badge-mist">${chapter.period}</span>` : ''}
                            ${(chapter as any).ageRange ? `<span class="badge badge-stone">${(chapter as any).ageRange}</span>` : ''}
                            <p style="margin-top: 12px; color: rgba(90, 107, 120, 0.7);">${chapter.description}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return html;
}

function renderEarlyLife(data: MemorialData): string {
    if (!data.step2.childhoodHome && !data.step2.familyBackground) return '';

    return `
        <section class="card-section section-gap" style="background: linear-gradient(to bottom right, rgba(138, 171, 180, 0.05), rgba(158, 142, 130, 0.05));">
            <h2 class="section-title">
                <div class="icon-box">${ICONS.home}</div>
                Early Life & Childhood
            </h2>
            <div style="display: flex; flex-direction: column; gap: 24px;">
                ${data.step2.childhoodHome ? `<div><h3 style="font-weight: 600; margin-bottom: 8px; color: var(--color-charcoal);">Childhood Home</h3><p style="opacity: 0.8;">${data.step2.childhoodHome}</p></div>` : ''}
                ${data.step2.familyBackground ? `<div><h3 style="font-weight: 600; margin-bottom: 8px; color: var(--color-charcoal);">Family Background</h3><p style="opacity: 0.8;">${data.step2.familyBackground}</p></div>` : ''}
                ${data.step2.childhoodPersonality?.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">${data.step2.childhoodPersonality.map((t: string) => `<span class="badge badge-mist">${t}</span>`).join('')}</div>` : ''}
            </div>
        </section>
    `;
}

function renderCareer(data: MemorialData): string {
    const jobs = data.step3.occupations || [];
    if (jobs.length === 0) return '';

    return `
        <div class="section-gap">
            <h2 class="section-title">
                <div class="icon-box">${ICONS.briefcase}</div>
                Career & Achievements
            </h2>
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${jobs.map(job => `
                    <div class="card-section" style="padding: 24px;">
                        <h3 style="font-weight: 600; font-size: 1.25rem; color: var(--color-charcoal);">${job.title}</h3>
                        <p style="opacity: 0.6; margin-bottom: 8px;">${job.company || ''}</p>
                        <span class="badge badge-stone">${job.yearsFrom} - ${job.yearsTo}</span>
                        ${job.description ? `<p style="margin-top: 12px; opacity: 0.8;">${job.description}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderFamily(data: MemorialData): string {
    const partners = data.step4.partners || [];
    const children = data.step4.children || [];
    if (partners.length === 0 && children.length === 0) return '';

    let html = `<div class="section-gap">
        <h2 class="section-title">
            <div class="icon-box">${ICONS.heart}</div>
            Family & Relationships
        </h2>`;

    if (partners.length > 0) {
        html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px;">
            ${partners.map(p => `
                <div class="card-section" style="padding: 24px;">
                    <h4 style="font-weight: 600; font-size: 1.125rem; color: var(--color-charcoal);">${p.name}</h4>
                    <p style="opacity: 0.6; font-size: 0.875rem;">${p.relationshipType}</p>
                    <p style="opacity: 0.6; font-size: 0.875rem; margin-bottom: 8px;">${p.yearsFrom} - ${p.yearsTo}</p>
                    ${p.description ? `<p style="margin-top: 12px; opacity: 0.8; font-size: 0.95rem;">${p.description}</p>` : ''}
                </div>
            `).join('')}
        </div>`;
    }

    if (children.length > 0) {
        html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
            ${children.map(c => `
                <div class="card-section" style="padding: 16px;">
                    <h4 style="font-weight: 600; color: var(--color-charcoal);">${c.name}</h4>
                    <p style="opacity: 0.6; font-size: 0.875rem;">Born ${c.birthYear}</p>
                </div>
            `).join('')}
        </div>`;
    }

    html += `</div>`;
    return html;
}

function renderPersonality(data: MemorialData): string {
    const traits = data.step5.personalityTraits || [];
    const values = data.step5.coreValues || [];
    const philosophy = data.step5.lifePhilosophy;
    if (traits.length === 0 && values.length === 0 && !philosophy) return '';

    return `
        <section class="card-section section-gap">
            <h2 class="section-title">
                <div class="icon-box">${ICONS.sparkles}</div>
                Personality, Values & Passions
            </h2>
            <div style="display: flex; flex-direction: column; gap: 24px;">
                ${traits.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 8px;">${traits.map((t: string) => `<span class="badge badge-mist">${t}</span>`).join('')}</div>` : ''}
                ${values.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 8px;">${values.map((v: string) => `<span class="badge badge-stone">${v}</span>`).join('')}</div>` : ''}
                ${philosophy ? `<div style="background: linear-gradient(to bottom right, rgba(138, 171, 180, 0.05), rgba(158, 142, 130, 0.05)); border-radius: 16px; padding: 24px; font-style: italic; opacity: 0.8; font-family: var(--font-serif); font-size: 1.1rem;">${philosophy}</div>` : ''}
            </div>
        </section>
    `;
}

function renderTributes(data: MemorialData): string {
    const memories = data.step7.sharedMemories || [];
    const stories = data.step7.impactStories || [];
    const tributes = [...memories, ...stories];
    if (tributes.length === 0) return '';

    return `
        <div class="section-gap">
            <h2 class="section-title">
                <div class="icon-box">${ICONS.message}</div>
                Memories & Stories
            </h2>
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${tributes.map(t => `
                    <div class="tribute-card">
                        <h4 style="font-family: var(--font-serif); font-size: 1.5rem; margin-bottom: 12px; color: var(--color-charcoal);">${t.title}</h4>
                        <p style="margin-bottom: 16px;">${t.content}</p>
                        <div class="tribute-author">- ${t.author}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderInteractiveGallery(data: MemorialData, map?: ResourceMap): string {
    const items = data.step8.interactiveGallery || [];
    if (items.length === 0) return '';

    return `
        <section class="card-section section-gap">
            <div class="media-section-header">
                <h2 class="section-title" style="margin-bottom: 0;">
                    <div class="icon-box">${ICONS.mouse}</div>
                    Interactive Photo Stories
                </h2>
                ${items.length > 1 ? `<button class="media-section-action" type="button" onclick="window.ulumaeMediaViewer.open('interactiveStories', 0)">Open story viewer</button>` : ''}
            </div>
            <div class="story-grid">
                ${items.map((item: any, index: number) => {
                    const storyText = getInteractiveStoryText(item, index);
                    return `
                        <article class="story-card">
                            <button
                                class="story-card-button"
                                type="button"
                                onmousemove="window.ulumaeMediaViewer.previewStoryMask(event, this)"
                                onmouseleave="window.ulumaeMediaViewer.clearStoryMask(this)"
                                onclick="window.ulumaeMediaViewer.open('interactiveStories', ${index})"
                            >
                                <div class="story-card-copy">
                                    <p>${storyText}</p>
                                </div>
                                <img src="${processMedia(item.preview, map)}" class="story-card-image" alt="${item.title || storyText}">
                                <div class="story-card-pill">Reveal the story</div>
                                ${item.sha256_hash ? `<div class="integrity-badge">Verified ✓</div>` : ''}
                            </button>
                            <div class="story-card-footer">
                                <p>${storyText}</p>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function renderGallery(data: MemorialData, map?: ResourceMap): string {
    const photos = data.step8.gallery || [];
    if (photos.length === 0) return '';

    return `
        <section class="card-section section-gap">
            <div class="media-section-header">
                <h2 class="section-title" style="margin-bottom: 0;">
                    <div class="icon-box">${ICONS.image}</div>
                    Photo Gallery
                </h2>
                ${photos.length > 1 ? `<button class="media-section-action" type="button" onclick="window.ulumaeMediaViewer.open('photos', 0)">Open gallery</button>` : ''}
            </div>
            <div class="gallery-grid">
                ${photos.map((photo, index) => `
                    <button class="gallery-item gallery-panel" type="button" onclick="window.ulumaeMediaViewer.open('photos', ${index})">
                        <img src="${processMedia(photo.preview, map)}" alt="${photo.caption || 'Photo'}">
                        ${photo.sha256_hash ? `<div class="integrity-badge">Verified ✓</div>` : ''}
                        ${(photo.caption || photo.year) ? `
                            <div class="gallery-panel-caption">
                                ${photo.caption ? `<div style="font-size: 12px;">${photo.caption}</div>` : ''}
                                ${photo.year ? `<div style="font-size: 10px; opacity: 0.7;">${photo.year}</div>` : ''}
                            </div>
                        ` : ''}
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function renderVideos(data: MemorialData, map?: ResourceMap): string {
    const videos = data.step9.videos || [];
    if (videos.length === 0) return '';

    return `
        <section class="card-section section-gap">
            <div class="media-section-header">
                <h2 class="section-title" style="margin-bottom: 0;">
                    <div class="icon-box">${ICONS.clapperboard}</div>
                    Video Memories
                </h2>
                ${videos.length > 1 ? `<button class="media-section-action" type="button" onclick="window.ulumaeMediaViewer.open('videos', 0)">Open video viewer</button>` : ''}
            </div>
            <div class="video-grid">
                ${videos.map((video, index) => `
                    <button class="video-memory-card" type="button" onclick="window.ulumaeMediaViewer.open('videos', ${index})">
                        <div class="video-memory-visual">
                            ${video.thumbnail ? `<img src="${processMedia(video.thumbnail, map)}" alt="${video.title || 'Video memory'}">` : `<div class="video-memory-fallback">${ICONS.clapperboard}</div>`}
                            <div class="video-memory-play">
                                <span class="video-memory-play-disc">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="8,5 19,12 8,19"></polygon></svg>
                                </span>
                            </div>
                        </div>
                        <div class="video-memory-copy">
                            <h4>${video.title || `Video memory ${index + 1}`}</h4>
                            ${video.description ? `<p>${video.description}</p>` : ''}
                        </div>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function renderMediaViewer(data: MemorialData, map?: ResourceMap): string {
    const photos: StandaloneMediaItem[] = (data.step8.gallery || [])
        .filter((photo: any) => !!photo?.preview)
        .map((photo: any) => ({
            id: photo.id,
            kind: 'image',
            src: processMedia(photo.preview, map) || '',
            thumbnailSrc: processMedia(photo.preview, map) || '',
            alt: photo.caption || 'Photo',
            title: photo.caption || 'Photo',
            caption: photo.caption || '',
            year: photo.year || '',
        }));

    const interactiveStories: StandaloneMediaItem[] = (data.step8.interactiveGallery || [])
        .filter((item: any) => !!item?.preview)
        .map((item: any, index: number) => ({
            id: item.id,
            kind: 'image',
            variant: 'interactive-story',
            src: processMedia(item.preview, map) || '',
            thumbnailSrc: processMedia(item.preview, map) || '',
            alt: item.title || item.caption || getInteractiveStoryText(item, index),
            title: item.title || item.caption || `Interactive photo story ${index + 1}`,
            description: getInteractiveStoryText(item, index),
            caption: item.caption || '',
            year: item.year || '',
        }));

    const videos: StandaloneMediaItem[] = (data.step9.videos || [])
        .filter((video: any) => !!video?.url)
        .map((video: any, index: number) => ({
            id: video.id,
            kind: 'video',
            src: processMedia(video.url, map) || '',
            thumbnailSrc: processMedia(video.thumbnail, map) || processMedia(video.url, map) || '',
            poster: processMedia(video.thumbnail, map) || null,
            mimeType: video.mimeType || null,
            title: video.title || `Video memory ${index + 1}`,
            description: video.description || '',
            caption: video.caption || '',
            year: video.year || '',
        }));

    if (!photos.length && !interactiveStories.length && !videos.length) {
        return '';
    }

    const collections = JSON.stringify({ photos, interactiveStories, videos });

    return `
        <style>
            .media-section-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 32px;
            }
            .media-section-action {
                border: 1px solid rgba(232, 216, 204, 0.45);
                background: transparent;
                color: var(--color-charcoal);
                padding: 10px 16px;
                border-radius: 14px;
                font-size: 0.9rem;
                cursor: pointer;
                transition: background 0.2s ease, border-color 0.2s ease;
            }
            .media-section-action:hover {
                background: rgba(232, 216, 204, 0.22);
                border-color: rgba(138, 171, 180, 0.38);
            }
            .story-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                gap: 24px;
            }
            .story-card {
                overflow: hidden;
                border-radius: 24px;
                border: 1px solid rgba(232, 216, 204, 0.35);
                background: #fff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .story-card-button {
                position: relative;
                display: block;
                width: 100%;
                aspect-ratio: 16 / 9;
                border: none;
                padding: 0;
                background: none;
                overflow: hidden;
                cursor: pointer;
                text-align: left;
            }
            .story-card-copy {
                position: absolute;
                inset: 0;
                z-index: 10;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
            }
            .story-card-copy p {
                margin: 0;
                max-width: 90%;
                border-radius: 24px;
                background: linear-gradient(135deg, rgba(138, 171, 180, 0.2), rgba(253, 246, 240, 0.92), rgba(158, 142, 130, 0.14));
                padding: 18px 20px;
                font-family: var(--font-serif);
                font-size: 1.25rem;
                line-height: 1.45;
                text-align: center;
                color: var(--color-charcoal);
                box-shadow: 0 12px 24px rgba(0,0,0,0.12);
                backdrop-filter: blur(6px);
            }
            .story-card-image {
                position: absolute;
                inset: 0;
                z-index: 20;
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .story-card-pill {
                position: absolute;
                left: 12px;
                bottom: 12px;
                z-index: 30;
                border-radius: 9999px;
                background: rgba(90, 107, 120, 0.72);
                color: #fdf6f0;
                padding: 8px 12px;
                font-size: 0.72rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .story-card-footer {
                border-top: 1px solid rgba(232, 216, 204, 0.3);
                padding: 16px 18px 18px;
            }
            .story-card-footer p {
                margin: 0;
                font-family: var(--font-serif);
                font-size: 1rem;
                line-height: 1.6;
                color: rgba(90, 107, 120, 0.82);
            }
            .gallery-panel {
                border: none;
                padding: 0;
                cursor: pointer;
                text-align: left;
            }
            .gallery-panel-caption {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(to top, rgba(90,107,120,0.88), transparent);
                padding: 12px;
                color: #fdf6f0;
                text-align: left;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            .gallery-panel:hover .gallery-panel-caption,
            .gallery-panel:focus-visible .gallery-panel-caption {
                opacity: 1;
            }
            .video-memory-card {
                border: 1px solid rgba(232, 216, 204, 0.35);
                border-radius: 20px;
                background: #fff;
                padding: 16px;
                cursor: pointer;
                text-align: left;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .video-memory-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 16px 30px rgba(0,0,0,0.08);
            }
            .video-memory-visual {
                position: relative;
                margin-bottom: 12px;
                aspect-ratio: 16 / 9;
                overflow: hidden;
                border-radius: 16px;
                background: rgba(90, 107, 120, 0.08);
            }
            .video-memory-visual img,
            .video-memory-fallback {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .video-memory-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--color-charcoal);
            }
            .video-memory-fallback svg {
                width: 48px;
                height: 48px;
            }
            .video-memory-play {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(90, 107, 120, 0.16);
            }
            .video-memory-play-disc {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 56px;
                height: 56px;
                border-radius: 9999px;
                background: rgba(253, 246, 240, 0.92);
                color: var(--color-charcoal);
                box-shadow: 0 10px 24px rgba(0,0,0,0.18);
            }
            .video-memory-copy h4 {
                margin: 0;
                font-size: 1rem;
                color: var(--color-charcoal);
            }
            .video-memory-copy p {
                margin: 8px 0 0;
                font-size: 0.92rem;
                line-height: 1.6;
                color: rgba(90, 107, 120, 0.72);
            }
            .ulumae-viewer {
                position: fixed;
                inset: 0;
                z-index: 9999;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(90, 107, 120, 0.95);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                padding: 16px;
            }
            .ulumae-viewer.active {
                display: flex;
            }
            .ulumae-viewer-close,
            .ulumae-viewer-nav {
                position: absolute;
                z-index: 10002;
                width: 52px;
                height: 52px;
                border: none;
                border-radius: 9999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: rgba(255,255,255,0.12);
                color: #fdf6f0;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            .ulumae-viewer-close:hover,
            .ulumae-viewer-nav:hover {
                background: rgba(255,255,255,0.22);
            }
            .ulumae-viewer-close {
                top: 16px;
                right: 16px;
            }
            .ulumae-viewer-nav.prev {
                left: 16px;
            }
            .ulumae-viewer-nav.next {
                right: 16px;
            }
            .ulumae-viewer-nav {
                top: 50%;
                transform: translateY(-50%);
            }
            .ulumae-viewer-counter {
                position: absolute;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10001;
                padding: 8px 16px;
                border-radius: 9999px;
                background: rgba(90, 107, 120, 0.84);
                color: #fdf6f0;
                font-size: 0.9rem;
            }
            .ulumae-viewer-stage {
                width: 100%;
                max-width: 1320px;
                padding: 0 80px;
            }
            .ulumae-viewer-standard {
                position: relative;
                margin: 0 auto;
                max-width: 1200px;
                max-height: 90vh;
            }
            .ulumae-viewer-frame {
                overflow: hidden;
                border-radius: 18px;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                background: #111;
            }
            .ulumae-viewer-frame img,
            .ulumae-viewer-frame video,
            .ulumae-viewer-frame iframe {
                display: block;
                max-width: 100%;
                max-height: 85vh;
                width: auto;
                height: auto;
                object-fit: contain;
            }
            .ulumae-viewer-frame iframe {
                width: min(92vw, 1200px);
                aspect-ratio: 16 / 9;
                border: 0;
                background: #000;
            }
            .ulumae-viewer-meta {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                padding: 24px;
                border-radius: 0 0 18px 18px;
                background: linear-gradient(to top, rgba(90,107,120,0.95), transparent);
                color: #fdf6f0;
                text-align: left;
            }
            .ulumae-viewer-meta h3 {
                margin: 0;
                font-size: 1.25rem;
                font-family: var(--font-serif);
                color: #fdf6f0;
            }
            .ulumae-viewer-meta p {
                margin: 8px 0 0;
                font-size: 0.95rem;
                line-height: 1.6;
                color: rgba(253,246,240,0.9);
            }
            .ulumae-viewer-meta small {
                display: block;
                margin-top: 8px;
                font-size: 0.74rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: rgba(253,246,240,0.66);
            }
            .ulumae-viewer-thumbs {
                position: absolute;
                left: 50%;
                bottom: 16px;
                transform: translateX(-50%);
                z-index: 10001;
                display: flex;
                gap: 8px;
                max-width: min(92vw, 920px);
                overflow-x: auto;
                padding: 0 16px;
                scrollbar-width: none;
            }
            .ulumae-viewer-thumbs::-webkit-scrollbar {
                display: none;
            }
            .ulumae-viewer-thumb {
                position: relative;
                flex: 0 0 auto;
                width: 64px;
                height: 64px;
                overflow: hidden;
                border: 2px solid transparent;
                border-radius: 10px;
                background: rgba(255,255,255,0.08);
                opacity: 0.6;
                cursor: pointer;
                transition: transform 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
            }
            .ulumae-viewer-thumb.active {
                transform: scale(1.08);
                border-color: #8AABB4;
                opacity: 1;
            }
            .ulumae-viewer-thumb img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .ulumae-viewer-thumb.video::after {
                content: '';
                position: absolute;
                inset: 0;
                background: rgba(90, 107, 120, 0.28);
            }
            .ulumae-viewer-thumb.video::before {
                content: '';
                position: absolute;
                left: 50%;
                top: 50%;
                z-index: 1;
                transform: translate(-38%, -50%);
                border-top: 7px solid transparent;
                border-bottom: 7px solid transparent;
                border-left: 12px solid #fdf6f0;
            }
            .ulumae-viewer-story {
                display: grid;
                gap: 24px;
                max-height: 88vh;
                grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.9fr);
            }
            .ulumae-viewer-story-visual {
                position: relative;
                aspect-ratio: 4 / 3;
                overflow: hidden;
                border-radius: 28px;
                border: 1px solid rgba(255,255,255,0.1);
                background: #111;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            }
            .ulumae-viewer-story-copy {
                position: absolute;
                inset: 0;
                z-index: 10;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 32px;
            }
            .ulumae-viewer-story-copy p {
                margin: 0;
                max-width: 720px;
                border-radius: 24px;
                background: rgba(253, 246, 240, 0.88);
                padding: 24px 28px;
                font-family: var(--font-serif);
                font-size: clamp(1.4rem, 3vw, 2.3rem);
                line-height: 1.5;
                color: var(--color-charcoal);
                box-shadow: 0 18px 32px rgba(0,0,0,0.18);
                backdrop-filter: blur(6px);
            }
            .ulumae-viewer-story-image {
                position: absolute;
                inset: 0;
                z-index: 20;
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .ulumae-viewer-story-pill {
                position: absolute;
                left: 16px;
                top: 16px;
                z-index: 30;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border-radius: 9999px;
                background: rgba(90, 107, 120, 0.75);
                color: #fdf6f0;
                padding: 10px 14px;
                font-size: 0.76rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .ulumae-viewer-story-scroll {
                position: absolute;
                right: 16px;
                bottom: 16px;
                z-index: 30;
                border-radius: 9999px;
                background: rgba(90, 107, 120, 0.75);
                color: #fdf6f0;
                padding: 10px 14px;
                font-size: 0.76rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .ulumae-viewer-story-panel {
                display: flex;
                flex-direction: column;
                min-height: 0;
                overflow: hidden;
                border-radius: 28px;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(253,246,240,0.96);
                padding: 24px;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.38);
            }
            .ulumae-viewer-story-kicker {
                font-size: 0.76rem;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                color: rgba(90, 107, 120, 0.45);
            }
            .ulumae-viewer-story-panel h3 {
                margin: 16px 0 0;
                font-size: 2rem;
                color: var(--color-charcoal);
            }
            .ulumae-viewer-story-body {
                margin-top: 20px;
                flex: 1;
                overflow-y: auto;
                color: rgba(90, 107, 120, 0.82);
                font-size: 1.05rem;
                line-height: 1.8;
                white-space: pre-wrap;
            }
            .ulumae-viewer-story-note {
                margin-top: 20px;
                border-radius: 18px;
                border: 1px solid rgba(232, 216, 204, 0.55);
                background: rgba(255,255,255,0.7);
                padding: 16px;
                font-size: 0.92rem;
                line-height: 1.65;
                color: rgba(90, 107, 120, 0.65);
            }
            @media (max-width: 1024px) {
                .ulumae-viewer-story {
                    grid-template-columns: 1fr;
                }
            }
            @media (max-width: 768px) {
                .media-section-header {
                    flex-direction: column;
                }
                .ulumae-viewer-nav {
                    display: none;
                }
                .ulumae-viewer-stage {
                    padding: 0 8px;
                }
                .ulumae-viewer-story-copy {
                    padding: 16px;
                }
                .ulumae-viewer-story-copy p {
                    padding: 18px 20px;
                }
                .ulumae-viewer-thumb {
                    width: 56px;
                    height: 56px;
                }
                .ulumae-viewer-thumbs {
                    justify-content: flex-start;
                }
            }
        </style>
        <div id="ulumae-media-viewer" class="ulumae-viewer" aria-hidden="true">
            <button id="ulumae-viewer-close" class="ulumae-viewer-close" type="button" aria-label="Close media viewer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <button id="ulumae-viewer-prev" class="ulumae-viewer-nav prev" type="button" aria-label="Previous item">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div id="ulumae-viewer-counter" class="ulumae-viewer-counter">1 / 1</div>
            <div id="ulumae-viewer-stage" class="ulumae-viewer-stage"></div>
            <button id="ulumae-viewer-next" class="ulumae-viewer-nav next" type="button" aria-label="Next item">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <div id="ulumae-viewer-thumbs" class="ulumae-viewer-thumbs"></div>
        </div>
        <script>
            (() => {
                const collections = ${collections};
                const viewer = document.getElementById('ulumae-media-viewer');
                const stage = document.getElementById('ulumae-viewer-stage');
                const thumbs = document.getElementById('ulumae-viewer-thumbs');
                const counter = document.getElementById('ulumae-viewer-counter');
                const closeButton = document.getElementById('ulumae-viewer-close');
                const prevButton = document.getElementById('ulumae-viewer-prev');
                const nextButton = document.getElementById('ulumae-viewer-next');
                const state = { collectionKey: null, index: 0, wheelLocked: false };

                const escapeHtml = (value) => String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');

                const getCollection = () => state.collectionKey ? (collections[state.collectionKey] || []) : [];

                const getVideoEmbedUrl = (src) => {
                    try {
                        const url = new URL(src);
                        const hostname = url.hostname.replace(/^www\\./, '');

                        if (hostname === 'youtu.be') {
                            const videoId = url.pathname.split('/').filter(Boolean)[0];
                            return videoId ? 'https://www.youtube.com/embed/' + videoId + '?autoplay=1' : null;
                        }

                        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
                            if (url.pathname === '/watch') {
                                const videoId = url.searchParams.get('v');
                                return videoId ? 'https://www.youtube.com/embed/' + videoId + '?autoplay=1' : null;
                            }

                            const match = url.pathname.match(/^\\/(?:embed|shorts)\\/([^/?#]+)/);
                            return match && match[1] ? 'https://www.youtube.com/embed/' + match[1] + '?autoplay=1' : null;
                        }

                        if (hostname === 'vimeo.com' || hostname === 'player.vimeo.com') {
                            const videoId = url.pathname.split('/').filter(Boolean).pop();
                            return videoId ? 'https://player.vimeo.com/video/' + videoId + '?autoplay=1' : null;
                        }
                    } catch {
                        return null;
                    }

                    return null;
                };

                const applyStoryMask = (container, x, y) => {
                    const image = container.querySelector('.story-card-image, .ulumae-viewer-story-image');
                    if (!image) return;
                    const mask = 'radial-gradient(circle 140px at ' + x + 'px ' + y + 'px, transparent 0%, transparent 45%, rgba(0,0,0,0.3) 72%, black 100%)';
                    image.style.webkitMaskImage = mask;
                    image.style.maskImage = mask;
                };

                const clearStoryMask = (container) => {
                    const image = container.querySelector('.story-card-image, .ulumae-viewer-story-image');
                    if (!image) return;
                    image.style.webkitMaskImage = 'none';
                    image.style.maskImage = 'none';
                };

                const renderThumbs = (items) => {
                    if (items.length <= 1) {
                        thumbs.innerHTML = '';
                        thumbs.style.display = 'none';
                        return;
                    }

                    thumbs.style.display = 'flex';
                    thumbs.innerHTML = items.map((item, index) => {
                        const previewSrc = item.thumbnailSrc || item.poster || item.src || '';
                        const isActive = index === state.index ? ' active' : '';
                        const kindClass = item.kind === 'video' ? ' video' : '';

                        return '<button class="ulumae-viewer-thumb' + isActive + kindClass + '" type="button" data-index="' + index + '" aria-label="View item ' + (index + 1) + '">' +
                            (previewSrc ? '<img src="' + escapeHtml(previewSrc) + '" alt="">' : '') +
                            '</button>';
                    }).join('');

                    thumbs.querySelectorAll('[data-index]').forEach((button) => {
                        button.addEventListener('click', () => {
                            state.index = Number(button.getAttribute('data-index')) || 0;
                            renderViewer();
                        });
                    });
                };

                const renderViewer = () => {
                    const items = getCollection();
                    const item = items[state.index];
                    if (!item) return;

                    counter.textContent = (state.index + 1) + ' / ' + items.length;
                    prevButton.style.display = items.length > 1 ? 'inline-flex' : 'none';
                    nextButton.style.display = items.length > 1 ? 'inline-flex' : 'none';

                    if (item.variant === 'interactive-story') {
                        stage.innerHTML = '<div class="ulumae-viewer-story">' +
                            '<div class="ulumae-viewer-story-visual">' +
                                '<div class="ulumae-viewer-story-copy"><p>' + escapeHtml(item.description || item.caption || item.title || 'Move your cursor to reveal the photo.') + '</p></div>' +
                                '<img class="ulumae-viewer-story-image" src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.alt || item.title || 'Interactive story') + '">' +
                                '<div class="ulumae-viewer-story-pill">' +
                                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="m13 13 6 6"></path></svg>' +
                                    '<span>Move to reveal</span>' +
                                '</div>' +
                                (items.length > 1 ? '<div class="ulumae-viewer-story-scroll">Scroll to continue</div>' : '') +
                            '</div>' +
                            '<aside class="ulumae-viewer-story-panel">' +
                                '<div class="ulumae-viewer-story-kicker">Interactive Story ' + (state.index + 1) + ' of ' + items.length + '</div>' +
                                '<h3>' + escapeHtml(item.title || ('Interactive photo story ' + (state.index + 1))) + '</h3>' +
                                '<div class="ulumae-viewer-story-body">' + escapeHtml(item.description || item.caption || item.title || '') + '</div>' +
                                (item.year ? '<div class="ulumae-viewer-story-kicker" style="margin-top: 16px;">' + escapeHtml(item.year) + '</div>' : '') +
                                '<div class="ulumae-viewer-story-note">Move your cursor across the image to reveal the moment. Use the arrow keys, mouse wheel, or the strip below to travel through the full set.</div>' +
                            '</aside>' +
                        '</div>';

                        const visual = stage.querySelector('.ulumae-viewer-story-visual');
                        visual.addEventListener('mousemove', (event) => {
                            const rect = visual.getBoundingClientRect();
                            applyStoryMask(visual, event.clientX - rect.left, event.clientY - rect.top);
                        });
                        visual.addEventListener('mouseleave', () => clearStoryMask(visual));
                    } else {
                        const embedUrl = item.kind === 'video' ? getVideoEmbedUrl(item.src) : null;
                        const description = item.description || item.caption || '';
                        const hasMeta = item.title || description || item.year;
                        const mediaMarkup = item.kind === 'video'
                            ? (embedUrl
                                ? '<iframe src="' + escapeHtml(embedUrl) + '" title="' + escapeHtml(item.title || 'Video viewer') + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
                                : '<video controls autoplay preload="metadata"' + (item.poster ? ' poster="' + escapeHtml(item.poster) + '"' : '') + '><source src="' + escapeHtml(item.src) + '"' + (item.mimeType ? ' type="' + escapeHtml(item.mimeType) + '"' : '') + '></video>')
                            : '<img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.alt || item.caption || item.title || 'Media item') + '">';

                        stage.innerHTML = '<div class="ulumae-viewer-standard">' +
                            '<div class="ulumae-viewer-frame">' + mediaMarkup + '</div>' +
                            (hasMeta ? '<div class="ulumae-viewer-meta">' +
                                (item.title ? '<h3>' + escapeHtml(item.title) + '</h3>' : '') +
                                (description ? '<p>' + escapeHtml(description) + '</p>' : '') +
                                (item.year ? '<small>' + escapeHtml(item.year) + '</small>' : '') +
                            '</div>' : '') +
                        '</div>';
                    }

                    renderThumbs(items);
                };

                const clampIndex = (itemsLength, nextIndex) => {
                    if (!itemsLength) return 0;
                    return (nextIndex + itemsLength) % itemsLength;
                };

                const api = {
                    open: (collectionKey, index = 0) => {
                        const items = collections[collectionKey] || [];
                        if (!items.length) return;
                        state.collectionKey = collectionKey;
                        state.index = clampIndex(items.length, index);
                        viewer.classList.add('active');
                        viewer.setAttribute('aria-hidden', 'false');
                        document.body.style.overflow = 'hidden';
                        renderViewer();
                    },
                    close: () => {
                        viewer.classList.remove('active');
                        viewer.setAttribute('aria-hidden', 'true');
                        document.body.style.overflow = '';
                        stage.innerHTML = '';
                        thumbs.innerHTML = '';
                    },
                    next: () => {
                        const items = getCollection();
                        if (!items.length) return;
                        state.index = clampIndex(items.length, state.index + 1);
                        renderViewer();
                    },
                    prev: () => {
                        const items = getCollection();
                        if (!items.length) return;
                        state.index = clampIndex(items.length, state.index - 1);
                        renderViewer();
                    },
                    previewStoryMask: (event, element) => {
                        const rect = element.getBoundingClientRect();
                        applyStoryMask(element, event.clientX - rect.left, event.clientY - rect.top);
                    },
                    clearStoryMask: (element) => clearStoryMask(element),
                };

                window.ulumaeMediaViewer = api;

                closeButton.addEventListener('click', api.close);
                prevButton.addEventListener('click', api.prev);
                nextButton.addEventListener('click', api.next);

                viewer.addEventListener('click', (event) => {
                    if (event.target === viewer) {
                        api.close();
                    }
                });

                document.addEventListener('keydown', (event) => {
                    if (!viewer.classList.contains('active')) return;

                    if (event.key === 'Escape') {
                        event.preventDefault();
                        api.close();
                    }
                    if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        api.prev();
                    }
                    if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        api.next();
                    }
                });

                viewer.addEventListener('wheel', (event) => {
                    const items = getCollection();
                    const current = items[state.index];
                    if (!viewer.classList.contains('active') || !current || current.variant !== 'interactive-story' || items.length <= 1 || Math.abs(event.deltaY) < 16 || state.wheelLocked) {
                        return;
                    }

                    event.preventDefault();
                    state.wheelLocked = true;
                    if (event.deltaY > 0) {
                        api.next();
                    } else {
                        api.prev();
                    }

                    window.setTimeout(() => {
                        state.wheelLocked = false;
                    }, 420);
                }, { passive: false });
            })();
        </script>
    `;
}

function renderVoiceRecordings(data: MemorialData): string {
    const recordings = data.step8.voiceRecordings || [];
    if (recordings.length === 0) return '';

    return `
        <div class="section-gap">
            <h2 class="section-title">
                <div class="icon-box">${ICONS.mic}</div>
                Voice Recordings
            </h2>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${recordings.map(rec => `
                    <div class="chapter-card" style="align-items: center; border-left: none; border: 1px solid rgba(232, 216, 204, 0.3); margin-bottom: 0;">
                        <div class="chapter-number" style="background: rgba(158, 142, 130, 0.1); color: var(--color-stone);">
                            <div style="width: 20px; height: 20px;">${ICONS.mic}</div>
                        </div>
                        <div style="flex: 1;">
                            <h4 style="font-weight: 600; color: var(--color-charcoal);">${rec.title || 'Untitled Recording'}</h4>
                        </div>
                        ${rec.sha256_hash ? `<div class="badge badge-stone" style="font-size: 10px; margin: 0;">Verified ✓</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderLegacy(data: MemorialData): string {
    if (!data.step8.legacyStatement) return '';

    return `
        <div class="section-gap legacy-section">
            <div style="width: 48px; height: 48px; margin: 0 auto 24px; color: var(--color-stone);">${ICONS.star}</div>
            <h2 style="color: var(--color-charcoal);">Legacy</h2>
            <p>${data.step8.legacyStatement}</p>
        </div>
    `;
}

export function generateStandaloneHTML(data: MemorialData, resourceMap?: ResourceMap): string {
    const coverPhotoUrl = processMedia(data.step8.coverPhotoPreview, resourceMap);
    const profilePhotoUrl = processMedia(data.step1.profilePhotoPreview, resourceMap);
    const age = calculateAge(data);
    const fullName = data.step1.fullName || 'Memorial Archive';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fullName}</title>
    <style>${ARCHE_CSS}</style>
</head>
<body>

    <header class="hero">
        ${coverPhotoUrl ? `<img src="${coverPhotoUrl}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;">` : ''}
        <div class="hero-overlay"></div>
        <div class="hero-content">
            ${profilePhotoUrl ? `<img src="${profilePhotoUrl}" class="profile-photo" alt="${fullName}">` : ''}
            <div class="hero-text">
                <h1>${fullName}</h1>
                <div class="hero-dates">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 16px; height: 16px; opacity: 0.8;">${ICONS.calendar}</span>
                        <span>${data.step1.birthDate || ''}</span>
                    </div>
                    ${data.step1.deathDate ? `
                        <span style="opacity: 0.6;">-</span>
                        <span>${data.step1.deathDate}</span>
                    ` : ''}
                    ${age ? `
                        <span style="opacity: 0.6;" class="desktop-bullet">•</span>
                        <span>${age} years</span>
                    ` : ''}
                </div>
            </div>
        </div>
    </header>

    <main class="container" style="margin-top: 64px;">
        ${data.step1.epitaph ? `
            <div class="section-gap" style="text-align: center; border-top: 1px solid rgba(232, 216, 204, 0.3); border-bottom: 1px solid rgba(232, 216, 204, 0.3); padding: 48px 24px;">
                <div style="width: 32px; height: 32px; margin: 0 auto 16px; color: var(--color-stone); opacity: 0.5;">${ICONS.quote}</div>
                <p class="font-serif-italic" style="font-size: 1.5rem; color: rgba(90, 107, 120, 0.8); max-width: 896px; margin: 0 auto; line-height: 1.6;">"${data.step1.epitaph}"</p>
            </div>
        ` : ''}

        ${renderFacts(data)}
        ${renderBiography(data)}
        ${renderEarlyLife(data)}
        ${renderCareer(data)}
        ${renderFamily(data)}
        ${renderPersonality(data)}
        ${renderTributes(data)}
        ${renderInteractiveGallery(data, resourceMap)}
        ${renderGallery(data, resourceMap)}
        ${renderVideos(data, resourceMap)}
        ${renderVoiceRecordings(data)}
        ${renderLegacy(data)}
    </main>

    ${renderMediaViewer(data, resourceMap)}

    <footer class="footer">
        <div class="container" style="text-align: center;">
            <p>Memorial preserved with ♥ by ULUMAE</p>
            <div class="credits">© ${new Date().getFullYear()} ULUMAE. All rights reserved.</div>
        </div>
    </footer>

</body>
</html>`;
}
