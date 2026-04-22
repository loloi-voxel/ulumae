import { MemorialData } from '@/types/memorial';
import { serializeMemorialDataForSave } from '@/lib/memorialSave';

export type MemorialVersionChangeType =
    | 'manual'
    | 'auto_save'
    | 'witness_contribution'
    | 'restore';

export interface MemorialVersion {
    id: string;
    memorial_id: string;
    version_number: number;
    created_at: string;
    created_by: string | null;
    created_by_name: string | null;
    change_summary: string;
    change_reason: string | null;
    change_type: MemorialVersionChangeType;
    steps_modified: number[];
    snapshot_data: Partial<MemorialData>;
    is_full_snapshot: boolean;
    is_restored_from: string | null;
}

const STEP_KEYS = [
    { step: 1, key: 'step1' },
    { step: 2, key: 'step2' },
    { step: 3, key: 'step3' },
    { step: 4, key: 'step4' },
    { step: 5, key: 'step5' },
    { step: 6, key: 'step6' },
    { step: 7, key: 'step7' },
    { step: 8, key: 'step8' },
    { step: 9, key: 'step9' },
] as const;

const STEP_NAMES: Record<number, string> = {
    1: 'Basic Information',
    2: 'Early Life & Childhood',
    3: 'Career & Education',
    4: 'Relationships & Family',
    5: 'Personality & Values',
    6: 'Life Story',
    7: 'Memories & Witnesses',
    8: 'Photos & Legacy',
    9: 'Videos',
};

function countWords(text?: string | null) {
    if (!text?.trim()) return 0;
    return text.trim().split(/\s+/).length;
}

function describeCountChange(oldCount: number, newCount: number, label: string) {
    const diff = newCount - oldCount;
    if (diff > 0) {
        return `Added ${diff} ${label}${diff === 1 ? '' : 's'}`;
    }
    if (diff < 0) {
        return `Removed ${Math.abs(diff)} ${label}${Math.abs(diff) === 1 ? '' : 's'}`;
    }
    return null;
}

function safeJson(value: unknown) {
    return JSON.stringify(value ?? null);
}

export function extractVersionSnapshot(data: Partial<MemorialData> | Record<string, any>) {
    const snapshot: Record<string, any> = {};

    for (const { key } of STEP_KEYS) {
        if (key in data) {
            snapshot[key] = data[key];
        }
    }

    if (Array.isArray((data as MemorialData).completedSteps)) {
        snapshot.completedSteps = (data as MemorialData).completedSteps;
    } else if (Array.isArray((data as any).completed_steps)) {
        snapshot.completedSteps = (data as any).completed_steps;
    }

    return snapshot as Partial<MemorialData>;
}

export function detectChangedSteps(
    oldData: Partial<MemorialData>,
    newData: Partial<MemorialData>
) {
    const changed: number[] = [];

    for (const { step, key } of STEP_KEYS) {
        if (safeJson(oldData[key]) !== safeJson(newData[key])) {
            changed.push(step);
        }
    }

    return changed;
}

export function generateChangeSummary(
    oldData: Partial<MemorialData>,
    newData: Partial<MemorialData>,
    stepsModified: number[]
) {
    if (stepsModified.length === 0) return 'No changes detected';

    const parts: string[] = [];

    for (const step of stepsModified) {
        switch (step) {
            case 1: {
                const oldName = oldData.step1?.fullName || '';
                const newName = newData.step1?.fullName || '';
                if (oldName !== newName && newName) {
                    parts.push(`Updated name to "${newName}"`);
                    break;
                }

                const portraitChanged =
                    safeJson(oldData.step1?.profilePhotoPreview) !== safeJson(newData.step1?.profilePhotoPreview);
                if (portraitChanged) {
                    parts.push('Updated the portrait');
                } else {
                    parts.push('Updated basic information');
                }
                break;
            }

            case 2: {
                const photoChange = describeCountChange(
                    oldData.step2?.childhoodPhotos?.length || 0,
                    newData.step2?.childhoodPhotos?.length || 0,
                    'childhood photo'
                );
                parts.push(photoChange || 'Expanded childhood details');
                break;
            }

            case 3: {
                const occupationChange = describeCountChange(
                    oldData.step3?.occupations?.length || 0,
                    newData.step3?.occupations?.length || 0,
                    'career entry'
                );
                parts.push(occupationChange || 'Updated career and education');
                break;
            }

            case 4: {
                const relationshipChange =
                    describeCountChange(
                        oldData.step4?.partners?.length || 0,
                        newData.step4?.partners?.length || 0,
                        'partner entry'
                    ) ||
                    describeCountChange(
                        oldData.step4?.children?.length || 0,
                        newData.step4?.children?.length || 0,
                        'child entry'
                    ) ||
                    describeCountChange(
                        oldData.step4?.majorLifeEvents?.length || 0,
                        newData.step4?.majorLifeEvents?.length || 0,
                        'family milestone'
                    );
                parts.push(relationshipChange || 'Updated relationships and family');
                break;
            }

            case 5: {
                const valuesChange =
                    describeCountChange(
                        oldData.step5?.coreValues?.length || 0,
                        newData.step5?.coreValues?.length || 0,
                        'core value'
                    ) ||
                    describeCountChange(
                        oldData.step5?.favoriteQuotes?.length || 0,
                        newData.step5?.favoriteQuotes?.length || 0,
                        'quote'
                    );
                parts.push(valuesChange || 'Refined personality and values');
                break;
            }

            case 6: {
                const oldWords = countWords(oldData.step6?.biography);
                const newWords = countWords(newData.step6?.biography);
                const wordDiff = newWords - oldWords;

                if (wordDiff > 0) {
                    parts.push(`Added ${wordDiff} words to the biography`);
                } else if (wordDiff < 0) {
                    parts.push(`Edited the biography (${Math.abs(wordDiff)} words removed)`);
                } else {
                    const chapterChange = describeCountChange(
                        oldData.step6?.lifeChapters?.length || 0,
                        newData.step6?.lifeChapters?.length || 0,
                        'life chapter'
                    );
                    parts.push(chapterChange || 'Updated the life story');
                }
                break;
            }

            case 7: {
                const memoryChange =
                    describeCountChange(
                        oldData.step7?.sharedMemories?.length || 0,
                        newData.step7?.sharedMemories?.length || 0,
                        'shared memory'
                    ) ||
                    describeCountChange(
                        oldData.step7?.impactStories?.length || 0,
                        newData.step7?.impactStories?.length || 0,
                        'impact story'
                    );
                parts.push(memoryChange || 'Updated memories and witness content');
                break;
            }

            case 8: {
                const galleryChange =
                    describeCountChange(
                        oldData.step8?.gallery?.length || 0,
                        newData.step8?.gallery?.length || 0,
                        'photo'
                    ) ||
                    describeCountChange(
                        oldData.step8?.interactiveGallery?.length || 0,
                        newData.step8?.interactiveGallery?.length || 0,
                        'gallery item'
                    ) ||
                    describeCountChange(
                        oldData.step8?.voiceRecordings?.length || 0,
                        newData.step8?.voiceRecordings?.length || 0,
                        'voice recording'
                    );
                parts.push(galleryChange || 'Updated photos and legacy media');
                break;
            }

            case 9: {
                const videoChange = describeCountChange(
                    oldData.step9?.videos?.length || 0,
                    newData.step9?.videos?.length || 0,
                    'video'
                );
                parts.push(videoChange || 'Updated videos');
                break;
            }

            default:
                parts.push(`Updated ${STEP_NAMES[step] || `Step ${step}`}`);
        }
    }

    return parts.join(', ');
}

export function applyVersionSnapshot(currentData: MemorialData, snapshotData: Partial<MemorialData>) {
    const normalized = extractVersionSnapshot(snapshotData);

    return {
        ...currentData,
        ...normalized,
        completedSteps: normalized.completedSteps || currentData.completedSteps,
    };
}

export function getMemorialSaveSignature(data: MemorialData) {
    const serializable = serializeMemorialDataForSave(data);

    return JSON.stringify({
        step1: serializable.step1,
        step2: serializable.step2,
        step3: serializable.step3,
        step4: serializable.step4,
        step5: serializable.step5,
        step6: serializable.step6,
        step7: serializable.step7,
        step8: serializable.step8,
        step9: serializable.step9,
        completedSteps: serializable.completedSteps || [],
        paid: serializable.paid ?? false,
    });
}
