import type { MemorialData, MemorialRelation } from '@/types/memorial';

type ResourceMap = Map<string, string>;

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withBreaks(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function resolveMedia(url: string | null | undefined, resourceMap: ResourceMap) {
  if (!url) return '';
  return resourceMap.get(url) || url;
}

function renderPhotoCard(
  src: string,
  alt: string,
  title: string,
  detail?: string
) {
  return `
    <figure class="media-card">
      <img src="${src}" alt="${escapeHtml(alt)}" loading="lazy">
      <figcaption>
        <strong>${escapeHtml(title)}</strong>
        ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
      </figcaption>
    </figure>
  `;
}

function renderVideoCard(
  src: string,
  poster: string | null,
  title: string,
  description?: string,
  mimeType?: string | null
) {
  return `
    <article class="video-card">
      <video controls preload="metadata"${poster ? ` poster="${poster}"` : ''}>
        <source src="${src}"${mimeType ? ` type="${escapeHtml(mimeType)}"` : ''}>
      </video>
      <div class="video-copy">
        <h3>${escapeHtml(title || 'Video memory')}</h3>
        ${description ? `<p>${withBreaks(description)}</p>` : ''}
      </div>
    </article>
  `;
}

function renderAudioCard(src: string, title: string, mimeType?: string | null) {
  return `
    <article class="audio-card">
      <div>
        <h3>${escapeHtml(title || 'Voice recording')}</h3>
      </div>
      <audio controls preload="metadata">
        <source src="${src}"${mimeType ? ` type="${escapeHtml(mimeType)}"` : ''}>
      </audio>
    </article>
  `;
}

function renderRelationList(relations: MemorialRelation[]) {
  if (relations.length === 0) return '';

  return `
    <section class="section card">
      <div class="section-heading">
        <span class="eyebrow">Family Map</span>
        <h2>Linked memorials</h2>
      </div>
      <div class="relation-list">
        ${relations
          .map(
            (relation) => `
              <div class="relation-item">
                <strong>${escapeHtml(relation.target_name || 'Linked memorial')}</strong>
                <span>${escapeHtml(relation.relationship_type)}</span>
              </div>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

export function generateAnchorOfflineGallery(
  data: MemorialData,
  relations: MemorialRelation[],
  resourceMap: ResourceMap
) {
  const fullName = data.step1.fullName || 'Memorial Archive';
  const cover = resolveMedia(data.step8.coverPhotoPreview, resourceMap);
  const profile = resolveMedia(data.step1.profilePhotoPreview, resourceMap);
  const biography = data.step6.biography || '';
  const epitaph = data.step1.epitaph || '';
  const childhoodPhotos = data.step2.childhoodPhotos || [];
  const gallery = data.step8.gallery || [];
  const interactiveGallery = data.step8.interactiveGallery || [];
  const videos = data.step9.videos || [];
  const voiceRecordings = data.step8.voiceRecordings || [];
  const memories = data.step7.sharedMemories || [];

  const photoCards = [
    ...childhoodPhotos.map((photo) =>
      renderPhotoCard(
        resolveMedia(photo.preview, resourceMap),
        photo.caption || 'Childhood photo',
        photo.caption || 'Childhood photo',
        photo.year || ''
      )
    ),
    ...gallery.map((photo) =>
      renderPhotoCard(
        resolveMedia(photo.preview, resourceMap),
        photo.caption || 'Memorial photo',
        photo.caption || 'Memorial photo',
        photo.year || ''
      )
    ),
    ...interactiveGallery.map((item, index) =>
      renderPhotoCard(
        resolveMedia(item.preview, resourceMap),
        item.description || `Interactive story ${index + 1}`,
        `Interactive story ${index + 1}`,
        item.description || ''
      )
    ),
  ].join('');

  const videoCards = videos
    .map((video) =>
      renderVideoCard(
        resolveMedia(video.url, resourceMap),
        video.thumbnail ? resolveMedia(video.thumbnail, resourceMap) : null,
        video.title || 'Video memory',
        video.description || '',
        video.mimeType
      )
    )
    .join('');

  const audioCards = voiceRecordings
    .map((recording) =>
      renderAudioCard(
        resolveMedia(recording.url || '', resourceMap),
        recording.title || 'Voice recording',
        recording.mimeType
      )
    )
    .join('');

  const memoryCards = memories
    .map(
      (memory) => `
        <article class="memory-card">
          <h3>${escapeHtml(memory.title || 'Shared memory')}</h3>
          <p>${withBreaks(memory.content || '')}</p>
          <span>${escapeHtml(memory.author || 'Contributor')}</span>
        </article>
      `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullName)} - Legacy Vault</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #2e241c;
      --soft-ink: #66584b;
      --paper: #f8f3ec;
      --paper-strong: #fffdfa;
      --line: rgba(92, 73, 55, 0.16);
      --accent: #b57745;
      --accent-soft: rgba(181, 119, 69, 0.12);
      --shadow: 0 24px 60px rgba(46, 36, 28, 0.14);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top, rgba(181, 119, 69, 0.14), transparent 35%),
        linear-gradient(180deg, #f5efe7 0%, #fcfaf6 28%, #f8f3ec 100%);
    }

    .hero {
      position: relative;
      overflow: hidden;
      min-height: 420px;
      padding: 72px 24px 48px;
      display: flex;
      align-items: flex-end;
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(27, 19, 13, 0.1), rgba(27, 19, 13, 0.72)),
        ${cover ? `url('${cover}') center/cover no-repeat` : 'linear-gradient(135deg, #d8c7b4, #b89b80)'};
      transform: scale(1.04);
    }

    .hero-content {
      position: relative;
      z-index: 1;
      width: min(1080px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 24px;
      align-items: end;
      grid-template-columns: auto 1fr;
    }

    .profile {
      width: 160px;
      height: 160px;
      border-radius: 26px;
      object-fit: cover;
      border: 3px solid rgba(255,255,255,0.7);
      box-shadow: var(--shadow);
      background: rgba(255,255,255,0.16);
    }

    .hero-copy h1 {
      margin: 0;
      font-size: clamp(2.6rem, 5vw, 4.6rem);
      color: #fff6ee;
      letter-spacing: -0.04em;
    }

    .hero-copy p {
      margin: 14px 0 0;
      max-width: 720px;
      font-size: 1.08rem;
      line-height: 1.7;
      color: rgba(255, 246, 238, 0.88);
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 18px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.14);
      color: #fff6ee;
      border: 1px solid rgba(255,255,255,0.2);
      font-size: 0.92rem;
    }

    main {
      width: min(1080px, calc(100% - 32px));
      margin: -42px auto 72px;
      position: relative;
      z-index: 2;
    }

    .card {
      background: var(--paper-strong);
      border: 1px solid var(--line);
      border-radius: 28px;
      box-shadow: var(--shadow);
      padding: 28px;
    }

    .section {
      margin-top: 24px;
    }

    .section-heading {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.74rem;
      color: var(--soft-ink);
    }

    h2 {
      margin: 0;
      font-size: 2rem;
      letter-spacing: -0.03em;
    }

    .prose, .memory-card p {
      color: var(--soft-ink);
      line-height: 1.8;
      font-size: 1rem;
    }

    .memory-grid,
    .relation-list,
    .audio-list {
      display: grid;
      gap: 16px;
    }

    .memory-grid {
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }

    .memory-card,
    .relation-item,
    .audio-card {
      border: 1px solid var(--line);
      background: var(--paper);
      border-radius: 20px;
      padding: 18px;
    }

    .memory-card h3,
    .video-copy h3,
    .audio-card h3 {
      margin: 0 0 10px;
      font-size: 1.15rem;
    }

    .memory-card span,
    .relation-item span {
      color: var(--soft-ink);
      font-size: 0.9rem;
    }

    .media-grid,
    .video-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .media-card {
      margin: 0;
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid var(--line);
      background: var(--paper);
    }

    .media-card img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: #e7ddcf;
    }

    .media-card figcaption {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px 18px;
      font-size: 0.92rem;
      color: var(--soft-ink);
    }

    .video-card {
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid var(--line);
      background: var(--paper);
    }

    .video-card video {
      display: block;
      width: 100%;
      background: #18120e;
    }

    .video-copy {
      padding: 16px 18px 18px;
    }

    .video-copy p {
      margin: 0;
      color: var(--soft-ink);
      line-height: 1.7;
    }

    .legacy {
      background: linear-gradient(135deg, var(--accent-soft), rgba(255,255,255,0.82));
    }

    footer {
      padding: 0 24px 48px;
      text-align: center;
      color: var(--soft-ink);
      font-size: 0.92rem;
    }

    a {
      color: var(--accent);
    }

    @media (max-width: 720px) {
      .hero {
        min-height: 520px;
        padding-top: 56px;
      }

      .hero-content {
        grid-template-columns: 1fr;
      }

      .profile {
        width: 132px;
        height: 132px;
      }

      .card {
        padding: 22px;
      }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="hero-content">
      ${profile ? `<img class="profile" src="${profile}" alt="${escapeHtml(fullName)}">` : ''}
      <div class="hero-copy">
        <h1>${escapeHtml(fullName)}</h1>
        ${
          epitaph
            ? `<p>${withBreaks(epitaph)}</p>`
            : `<p>This memorial was anchored locally so it can be opened and remembered without an internet connection.</p>`
        }
        <div class="hero-meta">
          ${
            data.step1.birthDate
              ? `<span class="pill">Born ${escapeHtml(data.step1.birthDate)}</span>`
              : ''
          }
          ${
            data.step1.deathDate
              ? `<span class="pill">Died ${escapeHtml(data.step1.deathDate)}</span>`
              : ''
          }
          ${data.step1.birthPlace ? `<span class="pill">${escapeHtml(data.step1.birthPlace)}</span>` : ''}
        </div>
      </div>
    </div>
  </header>

  <main>
    ${
      biography
        ? `
          <section class="card">
            <div class="section-heading">
              <span class="eyebrow">Biography</span>
              <h2>The life remembered</h2>
            </div>
            <div class="prose">${withBreaks(biography)}</div>
          </section>
        `
        : ''
    }

    ${
      memories.length > 0
        ? `
          <section class="section card">
            <div class="section-heading">
              <span class="eyebrow">Memories</span>
              <h2>Shared stories</h2>
            </div>
            <div class="memory-grid">${memoryCards}</div>
          </section>
        `
        : ''
    }

    ${
      photoCards
        ? `
          <section class="section card">
            <div class="section-heading">
              <span class="eyebrow">Photo Gallery</span>
              <h2>Images preserved offline</h2>
            </div>
            <div class="media-grid">${photoCards}</div>
          </section>
        `
        : ''
    }

    ${
      videoCards
        ? `
          <section class="section card">
            <div class="section-heading">
              <span class="eyebrow">Video Memories</span>
              <h2>Moments that still move</h2>
            </div>
            <div class="video-grid">${videoCards}</div>
          </section>
        `
        : ''
    }

    ${
      audioCards
        ? `
          <section class="section card">
            <div class="section-heading">
              <span class="eyebrow">Voice Recordings</span>
              <h2>Voices carried forward</h2>
            </div>
            <div class="audio-list">${audioCards}</div>
          </section>
        `
        : ''
    }

    ${renderRelationList(relations)}

    ${
      data.step8.legacyStatement
        ? `
          <section class="section card legacy">
            <div class="section-heading">
              <span class="eyebrow">Legacy</span>
              <h2>What remains</h2>
            </div>
            <div class="prose">${withBreaks(data.step8.legacyStatement)}</div>
          </section>
        `
        : ''
    }
  </main>

  <footer>
    <p>This gallery was created from a local Legacy Vault. It does not require ULUMAE or an internet connection to open.</p>
  </footer>
</body>
</html>`;
}
