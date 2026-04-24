// components/wizard/Step6LifeStory.tsx
'use client';

import { useState } from 'react';
import { BookOpen, Lightbulb, Plus, X, Trash2, HelpCircle, FileText } from 'lucide-react';
import { LifeStory } from '@/types/memorial';

interface Step6Props {
    data: LifeStory;
    onUpdate: (data: LifeStory) => void;
    onNext: () => void;
    onBack: () => void;
    readOnly?: boolean;
    isSelfArchive?: boolean; // NEW PROP
}

const WRITING_PROMPTS_DEFAULT = [
    "What challenges did they overcome?",
    "What made them unique?",
    "How did they treat others?",
    "What brought them joy?",
    "What would people remember most?",
    "What were their proudest moments?",
    "How did they handle adversity?",
    "What wisdom did they share?",
    "What was their impact on others?",
    "What legacy did they leave?"
];

const WRITING_PROMPTS_SELF = [
    "What challenges did you overcome?",
    "What made you unique?",
    "How did you treat others?",
    "What brought you joy?",
    "What would you like to be remembered for?",
    "What were your proudest moments?",
    "How did you handle adversity?",
    "What wisdom would you like to share?",
    "What was your impact on others?",
    "What legacy do you want to leave?"
];

const BIOGRAPHY_TEMPLATE = `[Opening - Who they were in essence]


[Early Life - Childhood, family, education]


[Adult Years - Career, relationships, family they built]


[Middle Years - Achievements, challenges, growth]


[Later Years - Wisdom, legacy, final chapter]


[Closing - What they meant to others]

`;

export default function Step6LifeStory({ data, onUpdate, onNext, onBack, readOnly, isSelfArchive = false }: Step6Props) {
    const WRITING_PROMPTS = isSelfArchive ? WRITING_PROMPTS_SELF : WRITING_PROMPTS_DEFAULT;
    const [showPrompts, setShowPrompts] = useState(true);
    const [showTemplate, setShowTemplate] = useState(false);
    const [previousBiography, setPreviousBiography] = useState<string | null>(null);

    const handleChange = (field: keyof LifeStory, value: any) => {
        onUpdate({ ...data, [field]: value });
    };

    const wordCount = data.biography.trim().split(/\s+/).filter(w => w.length > 0).length;

    const useTemplate = () => {
        if (window.confirm('This will replace your current biography text. Continue?')) {
            // Save current text for undo
            setPreviousBiography(data.biography);
            handleChange('biography', BIOGRAPHY_TEMPLATE);
            setShowTemplate(false);
        }
    };

    const undoTemplate = () => {
        if (previousBiography !== null) {
            handleChange('biography', previousBiography);
            setPreviousBiography(null);
        }
    };

    // Life Chapters Management
    const addChapter = () => {
        const newChapter = {
            id: `chapter-${Date.now()}`,
            period: '',
            ageRange: '',
            title: '',
            description: '',
            keyEvents: []
        };
        handleChange('lifeChapters', [...data.lifeChapters, newChapter]);
    };

    const removeChapter = (id: string) => {
        handleChange('lifeChapters', data.lifeChapters.filter(c => c.id !== id));
    };

    const updateChapter = (id: string, field: string, value: any) => {
        handleChange(
            'lifeChapters',
            data.lifeChapters.map(c => (c.id === id ? { ...c, [field]: value } : c))
        );
    };

    const addKeyEvent = (chapterId: string) => {
        const chapter = data.lifeChapters.find(c => c.id === chapterId);
        if (chapter) {
            updateChapter(chapterId, 'keyEvents', [...chapter.keyEvents, '']);
        }
    };

    const updateKeyEvent = (chapterId: string, eventIndex: number, value: string) => {
        const chapter = data.lifeChapters.find(c => c.id === chapterId);
        if (chapter) {
            const newEvents = [...chapter.keyEvents];
            newEvents[eventIndex] = value;
            updateChapter(chapterId, 'keyEvents', newEvents);
        }
    };

    const removeKeyEvent = (chapterId: string, eventIndex: number) => {
        const chapter = data.lifeChapters.find(c => c.id === chapterId);
        if (chapter) {
            updateChapter(
                chapterId,
                'keyEvents',
                chapter.keyEvents.filter((_, i) => i !== eventIndex)
            );
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="mb-12">
                <h2 className="font-serif text-4xl text-warm-dark mb-3">
                    Full Life Story
                </h2>
                <p className="text-warm-dark/60 text-lg">
                    This is the heart of the memorial. Take your time - you can preserve your progress and come back anytime.
                </p>
                <p className="text-xs text-warm-dark/30 italic mt-1 mb-4">
                    The narrative that will carry their voice through time.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Biography Editor */}
                <div className="lg:col-span-2 space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <label className="flex items-center gap-2 text-sm font-medium text-warm-dark">
                                <BookOpen size={18} className="text-warm-brown" />
                                Biography
                            </label>
                            <div className="flex items-center gap-2">
                                {previousBiography !== null && !readOnly && (
                                    <button
                                        onClick={undoTemplate}
                                        className="text-xs px-3 py-2 bg-warm-brown/10 text-warm-brown border border-warm-brown/30 rounded-lg hover:bg-warm-brown/20 transition-all flex items-center gap-2"
                                    >
                                        <X size={14} />
                                        Undo Template
                                    </button>
                                )}
                                {!readOnly && (
                                    <button
                                        onClick={() => setShowTemplate(!showTemplate)}
                                        className="text-xs px-3 py-2 border border-warm-border/40 rounded-lg hover:bg-warm-border/10 transition-all flex items-center gap-2"
                                    >
                                        <FileText size={14} />
                                        {showTemplate ? 'Hide' : 'Show'} Template
                                    </button>
                                )}
                            </div>
                        </div>

                        {showTemplate && (
                            <div className="mb-4 p-4 bg-warm-brown/5 border border-warm-brown/20 rounded-xl">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-warm-brown" />
                                        <p className="text-sm font-medium text-warm-dark">Suggested Structure</p>
                                    </div>
                                    <button
                                        onClick={useTemplate}
                                        className="text-xs px-3 py-1.5 bg-warm-brown hover:bg-warm-brown/90 text-surface-low rounded-lg transition-all"
                                    >
                                        Use This Template
                                    </button>
                                </div>
                                <p className="text-xs text-warm-dark/60">
                                    This template provides a helpful structure for writing a complete life story.
                                </p>
                            </div>
                        )}

                        <textarea
                            value={data.biography}
                            onChange={(e) => handleChange('biography', e.target.value)}
                            placeholder={isSelfArchive
                                ? "Tell your complete story here...\n\nStart with who you are in essence, then guide us through your journey from early life through today. What made you special? What did you overcome? How did you touch lives?\n\nDon't worry about making it perfect - just write from the heart. You can always edit later."
                                : "Tell their complete story here...\n\nStart with who they were in essence, then guide us through their journey from early life through their final years. What made them special? What did they overcome? How did they touch lives?\n\nDon't worry about making it perfect - just write from the heart. You can always edit later."
                            }
                            rows={20}
                            className="w-full px-6 py-4 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all resize-none normal-case text-base leading-relaxed disabled:opacity-60 disabled:bg-warm-border/10"
                            style={{
                                fontFamily: 'Georgia, serif',
                                fontVariant: 'normal',
                                fontVariantCaps: 'normal',
                                textTransform: 'none',
                            }}
                            disabled={readOnly}
                        />

                        <div className="flex items-center justify-between text-xs text-warm-dark/60">
                            <div className="flex items-center gap-4">
                                <span className={wordCount >= 500 ? 'text-olive font-medium' : ''}>
                                    {wordCount} words {wordCount < 500 && `(${500 - wordCount} more recommended)`}
                                </span>
                                <span className="text-warm-dark/40">•</span>
                                <span className="text-warm-dark/40">Auto-saving...</span>
                            </div>
                            <button
                                onClick={onNext}
                                className="text-olive hover:text-olive/80 transition-colors"
                            >
                                I'll continue this later →
                            </button>
                        </div>
                    </div>

                    {/* Life Chapters Section */}
                    <div className="pt-8 border-t border-warm-border/30">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-warm-dark mb-1">
                                    <BookOpen size={18} className="text-olive" />
                                    Life Chapters (Optional but Recommended)
                                </label>
                                <p className="text-xs text-warm-dark/40">
                                    Break their life into 4-6 chapters to help organize the story
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {data.lifeChapters.map((chapter, index) => (
                                <div
                                    key={chapter.id}
                                    className="p-6 bg-white border border-warm-border/40 rounded-xl space-y-4 relative"
                                >
                                    {/* Chapter number badge */}
                                    <div className="absolute -top-3 -left-3 w-10 h-10 bg-olive text-surface-low rounded-full flex items-center justify-center font-serif text-lg font-bold shadow-md">
                                        {index + 1}
                                    </div>

                                    {/* Remove button */}
                                    {!readOnly && (
                                        <button
                                            onClick={() => removeChapter(chapter.id)}
                                            className="absolute top-4 right-4 p-2 text-warm-dark/40 hover:text-warm-brown hover:bg-warm-brown/10 rounded-lg transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                            title="Remove chapter"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <label className="block text-xs text-warm-dark/60 mb-1">Period</label>
                                            <input
                                                type="text"
                                                value={chapter.period}
                                                onChange={(e) => updateChapter(chapter.id, 'period', e.target.value)}
                                                placeholder="e.g., 1960-1975"
                                                className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all disabled:opacity-60 disabled:bg-warm-border/10"
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-warm-dark/60 mb-1">Age Range</label>
                                            <input
                                                type="text"
                                                value={chapter.ageRange}
                                                onChange={(e) => updateChapter(chapter.id, 'ageRange', e.target.value)}
                                                placeholder="e.g., Ages 18-33"
                                                className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all disabled:opacity-60 disabled:bg-warm-border/10"
                                                disabled={readOnly}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-warm-dark/60 mb-1">Chapter Title</label>
                                        <input
                                            type="text"
                                            value={chapter.title}
                                            onChange={(e) => updateChapter(chapter.id, 'title', e.target.value)}
                                            placeholder="e.g., Finding My Path"
                                            className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all font-medium disabled:opacity-60 disabled:bg-warm-border/10"
                                            disabled={readOnly}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-warm-dark/60 mb-1">Description</label>
                                        <textarea
                                            value={chapter.description}
                                            onChange={(e) => updateChapter(chapter.id, 'description', e.target.value)}
                                            placeholder={isSelfArchive ? "Describe this period of your life (3-5 lines)..." : "Describe this period of their life (3-5 lines)..."}
                                            rows={4}
                                            className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all resize-none disabled:opacity-60 disabled:bg-warm-border/10"
                                            disabled={readOnly}
                                        />
                                    </div>

                                    {/* Key Events */}
                                    <div>
                                        <label className="block text-xs text-warm-dark/60 mb-2">Key Events in this Chapter</label>
                                        <div className="space-y-2">
                                            {chapter.keyEvents.map((event, eventIdx) => (
                                                <div key={eventIdx} className="flex gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-olive mt-3 flex-shrink-0" />
                                                    <input
                                                        type="text"
                                                        value={event}
                                                        onChange={(e) => updateKeyEvent(chapter.id, eventIdx, e.target.value)}
                                                        placeholder="Describe a key event..."
                                                        className="flex-1 px-4 py-2 border border-warm-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all text-sm disabled:opacity-60 disabled:bg-warm-border/10"
                                                        disabled={readOnly}
                                                    />
                                                    {!readOnly && (
                                                        <button
                                                            onClick={() => removeKeyEvent(chapter.id, eventIdx)}
                                                            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-2 hover:bg-warm-border/20 rounded-lg transition-all"
                                                        >
                                                            <X size={16} className="text-warm-dark/40" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {!readOnly && (
                                                <button
                                                    onClick={() => addKeyEvent(chapter.id)}
                                                    className="text-xs text-olive hover:text-olive/80 transition-colors flex items-center gap-1 ml-4"
                                                >
                                                    <Plus size={14} />
                                                    Add Key Event
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {!readOnly && (
                                <button
                                    onClick={addChapter}
                                    className="w-full py-4 border-2 border-dashed border-warm-border/40 rounded-xl text-sm font-medium text-warm-dark/60 hover:border-olive hover:bg-olive/5 hover:text-olive transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} />
                                    Add Life Chapter
                                </button>
                            )}

                            {data.lifeChapters.length > 0 && (
                                <div className="p-3 bg-olive/5 rounded-lg border border-olive/20">
                                    <p className="text-xs text-warm-dark/60">
                                        💡 Tip: Most life stories work well with 4-6 chapters covering different periods
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar with Writing Prompts */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24">
                        <div className="bg-gradient-to-br from-warm-brown/5 to-olive/5 rounded-xl p-6 border border-warm-border/30">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Lightbulb size={18} className="text-warm-brown" />
                                    <h3 className="text-sm font-medium text-warm-dark">Writing Prompts</h3>
                                </div>
                                <button
                                    onClick={() => setShowPrompts(!showPrompts)}
                                    className="text-xs text-warm-dark/60 hover:text-warm-dark transition-colors"
                                >
                                    {showPrompts ? 'Hide' : 'Show'}
                                </button>
                            </div>

                            {showPrompts && (
                                <div className="space-y-3">
                                    {WRITING_PROMPTS.map((prompt, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 bg-white/50 rounded-lg border border-warm-border/20 hover:border-olive/30 hover:bg-white transition-all cursor-pointer"
                                        >
                                            <p className="text-xs text-warm-dark/70 leading-relaxed">{prompt}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-warm-border/20">
                                <div className="flex items-start gap-2 text-xs text-warm-dark/60">
                                    <HelpCircle size={14} className="flex-shrink-0 mt-0.5" />
                                    <p>
                                        Click these prompts for inspiration. Don't feel pressure to answer all of them - just use what helps.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Tips */}
                        <div className="mt-6 p-4 bg-white rounded-xl border border-warm-border/30">
                            <h4 className="text-xs font-medium text-warm-dark mb-3">Quick Tips</h4>
                            <ul className="space-y-2 text-xs text-warm-dark/60">
                                <li className="flex items-start gap-2">
                                    <span className="text-olive">✓</span>
                                    <span>Write like you're talking to a friend</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-olive">✓</span>
                                    <span>Include specific memories and details</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-olive">✓</span>
                                    <span>Share their unique qualities and quirks</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-olive">✓</span>
                                    <span>Don't worry about perfect grammar</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-olive">✓</span>
                                    <span>Take breaks if you need to</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="mt-12 flex gap-4 max-w-6xl">
                <button
                    onClick={onBack}
                    className="px-6 py-4 border border-warm-border/40 rounded-xl hover:bg-warm-border/10 transition-all font-medium"
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
        </div>
    );
}
