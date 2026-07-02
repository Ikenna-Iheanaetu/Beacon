import {
  Bell,
  Download,
  Eye,
  PenLine,
  Search,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

/**
 * In-app notifications (BUILD_SPEC §7). Every privileged access to a patient's
 * record already writes an `access_logs` row; this page reframes those events as
 * a patient-facing alert feed (RLS scopes the query to the signed-in patient).
 * Anything in the last 7 days is flagged "New".
 */

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

interface Alert {
  icon: LucideIcon;
  tone: "info" | "warning";
  title: string;
}

function describe(accessType: string, who: string): Alert {
  switch (accessType) {
    case "pdf_export":
      return { icon: Download, tone: "info", title: `${who} downloaded your record` };
    case "admin_review":
      return {
        icon: ShieldAlert,
        tone: "warning",
        title: `${who} reviewed your record`,
      };
    case "national_id_lookup":
      return { icon: Search, tone: "info", title: `${who} looked up your record by ID` };
    case "email_lookup":
      return { icon: Search, tone: "info", title: `${who} looked up your record by email` };
    case "record_edit":
      return {
        icon: PenLine,
        tone: "warning",
        title: `${who} edited your medical record`,
      };
    case "emergency_view":
    default:
      return { icon: Eye, tone: "info", title: `${who} opened your emergency record` };
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("access_logs")
    .select("id, access_type, created_at, accessor_name, note")
    .order("created_at", { ascending: false });

  const rows = logs ?? [];
  const unread = rows.filter(
    (r) => Date.now() - new Date(r.created_at).getTime() < SEVEN_DAYS,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="beacon-rise">
        <span className="data-label text-primary-400">Stay informed</span>
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
      </header>

      {rows.length === 0 ? (
        <div className="surface beacon-rise flex flex-col items-center gap-3 px-4 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground/60">
            <Bell className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            No notifications yet. When a doctor or administrator opens your
            record, you&apos;ll see it here.
          </p>
        </div>
      ) : (
        <ul className="beacon-rise flex flex-col gap-3">
          {rows.map((log) => {
            const who = log.accessor_name || "A verified provider";
            const { icon: Icon, tone, title } = describe(log.access_type, who);
            const isNew =
              Date.now() - new Date(log.created_at).getTime() < SEVEN_DAYS;
            return (
              <li
                key={log.id}
                className="surface flex items-start gap-3.5 p-4 sm:p-5"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    tone === "warning"
                      ? "bg-caution/10 text-caution"
                      : "bg-info/10 text-info"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {title}
                      {isNew && (
                        <Badge variant="info" className="ml-2 align-middle">
                          New
                        </Badge>
                      )}
                    </p>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {relativeTime(log.created_at)}
                    </span>
                  </div>
                  {log.note && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
