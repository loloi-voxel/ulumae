import type { SupabaseClient } from '@supabase/supabase-js';

export type MemorialActivityAction =
  | 'invite_sent'
  | 'invite_cancelled'
  | 'invite_accepted'
  | 'member_removed'
  | 'member_role_updated'
  | 'access_request_created'
  | 'access_request_decided'
  | 'creation_request_created'
  | 'creation_request_decided'
  | 'contribution_submitted'
  | 'contribution_reviewed'
  | 'contribution_resubmitted'
  | 'memorial_exported'
  | 'memorial_soft_deleted'
  | 'memorial_restored'
  | 'memorial_permanently_deleted'
  | 'device_registered'
  | 'authorization_submitted'
  | 'content_review_submitted'
  | 'plan_upgraded'
  | 'memorial_edited'
  | 'memorial_seal_started'
  | 'memorial_seal_completed'
  | 'memorial_seal_failed';

export interface MemorialActivityLogInput {
  memorialId: string;
  action: MemorialActivityAction;
  summary: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  subjectUserId?: string | null;
  subjectEmail?: string | null;
  details?: Record<string, unknown>;
}

export async function logMemorialActivity(
  supabaseAdmin: SupabaseClient,
  input: MemorialActivityLogInput
) {
  const { error } = await supabaseAdmin.from('memorial_activity_log').insert({
    memorial_id: input.memorialId,
    action: input.action,
    summary: input.summary,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    subject_user_id: input.subjectUserId ?? null,
    subject_email: input.subjectEmail ?? null,
    details: input.details ?? {},
  });

  if (error) {
    throw error;
  }
}

export async function safeLogMemorialActivity(
  supabaseAdmin: SupabaseClient,
  input: MemorialActivityLogInput
) {
  try {
    await logMemorialActivity(supabaseAdmin, input);
  } catch (error) {
    console.error('[memorial-activity-log]', error);
  }
}
