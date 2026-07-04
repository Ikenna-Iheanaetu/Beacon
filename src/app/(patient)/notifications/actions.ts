"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Read/dismiss state lives entirely in notification_reads — access_logs is
 * never written to by these actions. Each is a "bound" server action
 * (`.bind(null, accessLogId)`), so the form itself needs no hidden input.
 */

async function upsertState(
  accessLogId: string,
  fields: { read_at?: string; dismissed_at?: string },
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("notification_reads").upsert(
    { patient_user_id: user.id, access_log_id: accessLogId, ...fields },
    { onConflict: "patient_user_id,access_log_id" },
  );

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationRead(accessLogId: string): Promise<void> {
  await upsertState(accessLogId, { read_at: new Date().toISOString() });
}

export async function dismissNotification(accessLogId: string): Promise<void> {
  await upsertState(accessLogId, { dismissed_at: new Date().toISOString() });
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: logs } = await supabase.from("access_logs").select("id");
  const rows = (logs ?? []).map((l) => ({
    patient_user_id: user.id,
    access_log_id: l.id,
    read_at: new Date().toISOString(),
  }));
  if (rows.length) {
    await supabase
      .from("notification_reads")
      .upsert(rows, { onConflict: "patient_user_id,access_log_id" });
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
