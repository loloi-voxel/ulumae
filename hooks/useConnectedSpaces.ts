'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ConnectedSpaceEntry } from '@/lib/connectedSpaces';
import { sortConnectedSpaces } from '@/lib/connectedSpaces';

interface ConnectedSpacesPayload {
    authenticated?: boolean;
    invitedSpaces?: ConnectedSpaceEntry[];
    spaces?: ConnectedSpaceEntry[];
}

export function useConnectedSpaces() {
    const [spaces, setSpaces] = useState<ConnectedSpaceEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetch('/api/user/spaces', { cache: 'no-store' })
            .then(async (res) => {
                const payload = (await res.json().catch(() => ({}))) as ConnectedSpacesPayload;
                if (cancelled) return;

                if (payload?.authenticated === false) {
                    setSpaces([]);
                    return;
                }

                const nextSpaces = Array.isArray(payload?.invitedSpaces)
                    ? payload.invitedSpaces
                    : Array.isArray(payload?.spaces)
                        ? payload.spaces
                        : [];

                setSpaces(nextSpaces);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err?.message || 'Could not load connected spaces');
                setSpaces([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const sortedSpaces = useMemo(() => {
        if (!spaces) return [] as ConnectedSpaceEntry[];
        return sortConnectedSpaces(spaces);
    }, [spaces]);

    return {
        spaces: sortedSpaces,
        loading: spaces === null,
        error,
    };
}
