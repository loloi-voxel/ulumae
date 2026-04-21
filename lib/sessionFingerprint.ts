import type { NextRequest } from 'next/server';

export const SESSION_FINGERPRINT_STORAGE_KEY = 'ulumae:session-fingerprint';
export const SESSION_FINGERPRINT_HEADER = 'x-ulumae-session-fingerprint';

export function normalizeSessionFingerprint(value?: string | null) {
    const normalized = String(value || '').trim().slice(0, 255);
    return normalized || null;
}

export function getSessionFingerprintFromRequest(request: NextRequest) {
    return normalizeSessionFingerprint(request.headers.get(SESSION_FINGERPRINT_HEADER));
}

export function getOrCreateSessionFingerprint() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const existing = normalizeSessionFingerprint(
            window.localStorage.getItem(SESSION_FINGERPRINT_STORAGE_KEY)
        );
        if (existing) {
            return existing;
        }

        const generated =
            typeof window.crypto?.randomUUID === 'function'
                ? window.crypto.randomUUID()
                : `fp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        window.localStorage.setItem(SESSION_FINGERPRINT_STORAGE_KEY, generated);
        return generated;
    } catch {
        return null;
    }
}
