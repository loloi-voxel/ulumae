const INVITE_PATH_PREFIX = '/invite/';

export const PENDING_INVITE_COOKIE = 'pending_invite_token';
export const PENDING_INVITE_STORAGE_KEY = 'pending_invite_token';
export const PENDING_INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getInvitePath(token: string) {
  return `${INVITE_PATH_PREFIX}${encodeURIComponent(token)}`;
}

export function getInviteWelcomePath(memorialId: string, role: string) {
  return `/archive/${memorialId}/welcome?role=${encodeURIComponent(role)}`;
}

export function normalizeRelativePath(value: string | null | undefined) {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  return value;
}

export function extractInviteTokenFromPath(path: string | null | undefined) {
  const normalized = normalizeRelativePath(path);
  if (!normalized.startsWith(INVITE_PATH_PREFIX)) {
    return null;
  }

  const token = normalized
    .slice(INVITE_PATH_PREFIX.length)
    .split(/[/?#]/, 1)[0]
    ?.trim();

  return token ? decodeURIComponent(token) : null;
}

export function isInvitePath(path: string | null | undefined) {
  return extractInviteTokenFromPath(path) !== null;
}

export function persistPendingInviteToken(token: string) {
  if (typeof window === 'undefined' || !token) return;

  window.localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
  document.cookie =
    `${PENDING_INVITE_COOKIE}=${encodeURIComponent(token)}; ` +
    `Path=/; Max-Age=${PENDING_INVITE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function readPendingInviteToken() {
  if (typeof window === 'undefined') return null;

  const fromStorage = window.localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
  if (fromStorage) return fromStorage;

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${PENDING_INVITE_COOKIE}=`));

  if (!cookie) return null;

  const value = cookie.slice(PENDING_INVITE_COOKIE.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export function clearPendingInviteToken() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  document.cookie =
    `${PENDING_INVITE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
