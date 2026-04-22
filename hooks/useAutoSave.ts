// hooks/useAutoSave.ts
// Step 1.1.3: Silent auto-save with offline support
// Auto-saves memorial data to Supabase every 30 seconds
// Also saves on any change after a 3-second debounce (so rapid typing doesn't spam)
// NEVER asks "Would you like to save?" — saves silently, always

import { useEffect, useRef, useCallback, useState } from 'react';
import { MemorialData } from '@/types/memorial';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'reconnected';

interface UseAutoSaveOptions {
    memorialId: string | null;
    data: MemorialData;
    enabled?: boolean;         // Disable auto-save if needed
    intervalMs?: number;       // Default: 30000 (30s)
    debounceMs?: number;       // Default: 3000 (3s) after last change
}

interface UseAutoSaveReturn {
    saveStatus: SaveStatus;
    lastSavedAt: Date | null;
    saveNow: () => Promise<void>;   // Force immediate save
    error: string | null;
}

export function useAutoSave({
    memorialId,
    data,
    enabled = true,
    intervalMs = 30000,
    debounceMs = 3000,
}: UseAutoSaveOptions): UseAutoSaveReturn {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Refs to track latest data without re-triggering effects
    const dataRef = useRef(data);
    const lastSavedDataRef = useRef<string>('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef(false);

    // Keep data ref current
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // Step 1.1.3: Serialize data for save (shared between save and offline cache)
    const serializeForSave = useCallback((currentData: MemorialData) => {
        return {
            step1: currentData.step1,
            step2: currentData.step2,
            step3: currentData.step3,
            step4: currentData.step4,
            step5: currentData.step5,
            step6: currentData.step6,
            step7: currentData.step7,
            step8: {
                ...currentData.step8,
                coverPhoto: null,
                gallery: currentData.step8.gallery.map(g => ({
                    ...g,
                    file: null,
                })),
                interactiveGallery: currentData.step8.interactiveGallery?.map(ig => ({
                    ...ig,
                    file: null,
                })),
                voiceRecordings: currentData.step8.voiceRecordings.map(v => ({
                    ...v,
                    file: null,
                })),
            },
            step9: {
                ...currentData.step9,
                videos: currentData.step9.videos?.map(v => ({
                    ...v,
                    file: null,
                })),
            },
        };
    }, []);

    // Core save function
    const performSave = useCallback(async () => {
        if (!memorialId || !enabled || isSavingRef.current) return;

        const currentData = dataRef.current;
        const serializable = serializeForSave(currentData);
        const serialized = JSON.stringify(serializable);

        if (serialized === lastSavedDataRef.current) {
            return; // Nothing changed, skip
        }

        // Step 1.1.3: Check if offline — cache locally
        if (!navigator.onLine) {
            try {
                localStorage.setItem(`offline-save-${memorialId}`, serialized);
                setSaveStatus('offline');
            } catch {
                // localStorage full or unavailable — silent fail
            }
            return;
        }

        isSavingRef.current = true;
        setSaveStatus('saving');
        setError(null);

        try {
            const saveRes = await fetch(`/api/memorials/${memorialId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memorialData: serializable,
                }),
            });

            if (!saveRes.ok) {
                const result = await saveRes.json().catch(() => ({}));
                throw new Error(result.error || 'Save failed');
            }

            lastSavedDataRef.current = serialized;
            setLastSavedAt(new Date());
            setSaveStatus('saved');

            // Clear any offline cache on success
            localStorage.removeItem(`offline-save-${memorialId}`);

            // Reset to idle after 2 seconds (brief "Saved" then disappear)
            setTimeout(() => {
                setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
            }, 2000);

        } catch (err: any) {
            console.error('Auto-save failed:', err);
            // Fall back to offline cache
            try {
                localStorage.setItem(`offline-save-${memorialId}`, serialized);
            } catch { /* silent */ }
            setError(err.message || 'Failed to save');
            setSaveStatus('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [memorialId, enabled, serializeForSave]);

    // Public "save now" function
    const saveNow = useCallback(async () => {
        await performSave();
    }, [performSave]);

    // Debounced save on data change (3s after last change)
    useEffect(() => {
        if (!memorialId || !enabled) return;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            performSave();
        }, debounceMs);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [data, memorialId, enabled, debounceMs, performSave]);

    // Interval save every 30 seconds
    useEffect(() => {
        if (!memorialId || !enabled) return;

        intervalTimerRef.current = setInterval(() => {
            performSave();
        }, intervalMs);

        return () => {
            if (intervalTimerRef.current) {
                clearInterval(intervalTimerRef.current);
            }
        };
    }, [memorialId, enabled, intervalMs, performSave]);

    // Step 1.1.3: Sync offline cache when connection returns
    useEffect(() => {
        if (!memorialId || !enabled) return;

        const handleOnline = async () => {
            const cached = localStorage.getItem(`offline-save-${memorialId}`);
            if (cached) {
                setSaveStatus('reconnected');
                // Wait a beat then save
                setTimeout(async () => {
                    await performSave();
                }, 1000);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [memorialId, enabled, performSave]);

    // Save on page unload (best effort)
    useEffect(() => {
        if (!memorialId || !enabled) return;

        const handleBeforeUnload = () => {
            const currentData = dataRef.current;
            const payload = JSON.stringify({
                memorialData: serializeForSave(currentData),
            });
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(`/api/memorials/${memorialId}/save`, blob);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [memorialId, enabled, serializeForSave]);

    return { saveStatus, lastSavedAt, saveNow, error };
}
