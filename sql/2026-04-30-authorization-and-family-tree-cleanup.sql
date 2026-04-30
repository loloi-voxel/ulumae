-- 2026-04-30
-- Authorization hardening and family-tree cleanup notes
--
-- Important:
-- 1. This project still uses `memorial_relations` for family linking in places
--    outside the deleted `/dashboard/family/[userId]/tree` page, so this file
--    does NOT drop that table.
-- 2. No `choice-pricing` SQL table exists in `supabase_for_real.sql`; the
--    pricing cleanup for family-tree wording is application-code only.
-- 3. Personal and family authorizations stay separate through
--    `authorization_type` (`individual` vs `account`), so upgrading from
--    Personal to Family still correctly requires the Family authorization
--    without resetting the earlier Personal one.

BEGIN;

-- Remove duplicate live authorization records before adding the index.
WITH ranked_authorizations AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY memorial_id, user_id, authorization_type
            ORDER BY
                CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
                created_at ASC,
                id ASC
        ) AS row_number
    FROM memorial_authorizations
    WHERE status IN ('pending', 'approved')
)
DELETE FROM memorial_authorizations ma
USING ranked_authorizations ra
WHERE ma.id = ra.id
  AND ra.row_number > 1;

-- Enforce one live authorization per memorial, per user, per authorization type.
CREATE UNIQUE INDEX IF NOT EXISTS memorial_authorizations_one_live_record_per_type_idx
    ON memorial_authorizations (memorial_id, user_id, authorization_type)
    WHERE status IN ('pending', 'approved');

COMMIT;

-- Optional verification:
-- SELECT memorial_id, user_id, authorization_type, COUNT(*)
-- FROM memorial_authorizations
-- WHERE status IN ('pending', 'approved')
-- GROUP BY memorial_id, user_id, authorization_type
-- HAVING COUNT(*) > 1;
