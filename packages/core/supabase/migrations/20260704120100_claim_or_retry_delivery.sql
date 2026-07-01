-- claim_or_retry_delivery: atomic insert-or-retry for alert delivery rows.
--
-- The double-email defense is the unique constraint on (monitor_id, hosted_run_id):
--   - Row doesn't exist → insert status='pending', return the new id.
--   - Row exists, status='failed' → reset to 'pending' for retry, return id.
--   - Row exists, status='sent' or 'pending' → DO UPDATE WHERE fails (row
--     unchanged), RETURNING returns nothing → caller gets null → skip.
--
-- This replaces the supabase-js upsert(ignoreDuplicates:true) approach, which
-- blocked retries of failed rows by treating them the same as sent ones.

create or replace function claim_or_retry_delivery(
  p_monitor_id    uuid,
  p_hosted_run_id uuid,
  p_target        text,
  p_version       text,
  p_grade         text,
  p_email         text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into alert_deliveries (
    monitor_id, hosted_run_id, target, version, grade, email, status
  ) values (
    p_monitor_id, p_hosted_run_id, p_target, p_version, p_grade, p_email, 'pending'
  )
  on conflict (monitor_id, hosted_run_id)
  do update
    set status             = 'pending',
        error              = null,
        resend_message_id  = null,
        sent_at            = null
    where alert_deliveries.status = 'failed'
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function claim_or_retry_delivery(uuid, uuid, text, text, text, text)
  to service_role;
