export const INVITATION_EXPIRATION_DAYS = 30;
export const SOFT_DELETE_RETENTION_DAYS = 30;
export const EXPORT_COOLDOWN_MINUTES = 10;
export const EXPORT_SIGNED_URL_TTL_SECONDS = 60 * 60;
export const PAUSE_REMINDER_DELAY_DAYS = 7;
export const DRAFT_MEDIA_LIMIT = 10;
export const DRAFT_VIDEO_LIMIT = 3;
export const PAID_VIDEO_LIMIT = 20;
export const MAX_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_ACTIVITY_LIMIT = 20;
export const DEFAULT_VERSION_LIMIT = 50;
export const MAX_VERSION_LIMIT = 100;
export const MEMORIAL_STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const MEMORIAL_TOTAL_STEPS = MEMORIAL_STEP_IDS.length;
export const SESSION_ACTIVITY_STALE_HOURS = 24;

// ─── Dead-man-switch (proof-of-life) thresholds ─────────────────────────────
// These were previously hard-coded inside the cron route. Centralized here so
// product can tune them without grepping for magic numbers.
export const DMS_INACTIVITY_WARNING_DAYS = 365;
export const DMS_INACTIVITY_ALERT_DAYS = 365 + 90;
export const DMS_WARNING_RESEND_INTERVAL_DAYS = 30;
export const DEAD_MAN_SWITCH_DELAY_OPTIONS = [3, 6, 12, 24] as const;
export const DEAD_MAN_SWITCH_WARNING_STAGES = [30, 7, 1] as const;
export const ARCHIVE_ROLE_REFETCH_GUARD_MS = 300_000;

// ─── Plan pricing (USD, in whole dollars) ───────────────────────────────────
// Server-side source of truth. Never trust the price the client sends.
export const PLAN_PRICES_USD: Record<string, number> = {
  personal: 1470,
  family: 2940,
  concierge: 6300,
};

// ─── Auth ───────────────────────────────────────────────────────────────────
export const MIN_PASSWORD_LENGTH = 6;
