import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * The patient's notifications feed: their own access_logs rows, left-joined
 * against their notification_reads state. access_logs itself is NEVER
 * filtered or mutated here beyond excluding dismissed items from this VIEW —
 * it stays the permanent, immutable audit trail shown in full on
 * /access-log. Dismissing a notification only sets dismissed_at on the join
 * row; the underlying access event is never lost.
 */
export interface NotificationRow {
  id: string;
  access_type: string;
  created_at: string;
  accessor_name: string | null;
  note: string | null;
  read: boolean;
}

export async function getNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: logs }, { data: reads }] = await Promise.all([
    supabase
      .from("access_logs")
      .select("id, access_type, created_at, accessor_name, note")
      .order("created_at", { ascending: false }),
    supabase
      .from("notification_reads")
      .select("access_log_id, read_at, dismissed_at")
      .eq("patient_user_id", user.id),
  ]);

  const stateById = new Map((reads ?? []).map((r) => [r.access_log_id, r]));

  return (logs ?? [])
    .filter((log) => !stateById.get(log.id)?.dismissed_at)
    .map((log) => ({
      ...log,
      read: Boolean(stateById.get(log.id)?.read_at),
    }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const rows = await getNotifications();
  return rows.filter((r) => !r.read).length;
}
