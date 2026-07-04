import { getNotifications } from "@/lib/notifications";
import { NotificationsList } from "@/components/patient/notifications-list";
import { MarkAllReadButton } from "@/components/patient/mark-all-read-button";

/**
 * In-app notifications. Every privileged access to a patient's record already
 * writes an `access_logs` row; this page reframes those events as a
 * patient-facing alert feed. Read/dismiss state lives in notification_reads
 * (see lib/notifications.ts) — access_logs itself is never touched, so
 * /access-log stays the complete, permanent record regardless of what's been
 * read or dismissed here.
 */

export default async function NotificationsPage() {
  const rows = await getNotifications();
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="beacon-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="data-label text-primary-700">Stay informed</span>
          <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
            Notifications
            {unread > 0 && (
              <span className="inline-grid min-w-6 place-items-center rounded-full bg-primary px-2 py-0.5 text-sm font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You&apos;re alerted whenever someone accesses your medical record.
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </header>

      <NotificationsList rows={rows} />
    </div>
  );
}
