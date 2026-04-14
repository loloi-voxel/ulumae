const LEGACY_CURRENT_MEMORIAL_KEY = 'current-memorial-id';

function getScopedCurrentMemorialKey(userId: string, mode: 'personal' | 'family') {
  return `${LEGACY_CURRENT_MEMORIAL_KEY}:${userId}:${mode}`;
}

export function readCurrentMemorialId(
  userId: string,
  mode: 'personal' | 'family'
): string | null {
  if (typeof window === 'undefined') return null;

  return (
    localStorage.getItem(getScopedCurrentMemorialKey(userId, mode)) ||
    localStorage.getItem(LEGACY_CURRENT_MEMORIAL_KEY)
  );
}

export function writeCurrentMemorialId(
  userId: string,
  mode: 'personal' | 'family',
  memorialId: string
) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(getScopedCurrentMemorialKey(userId, mode), memorialId);
  localStorage.removeItem(LEGACY_CURRENT_MEMORIAL_KEY);
}

export function clearCurrentMemorialId(userId: string, mode: 'personal' | 'family') {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(getScopedCurrentMemorialKey(userId, mode));
  localStorage.removeItem(LEGACY_CURRENT_MEMORIAL_KEY);
}
