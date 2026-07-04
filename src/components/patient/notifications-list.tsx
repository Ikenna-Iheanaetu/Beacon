"use client";

import { useState, useTransition } from "react";
import {
  Bell,
  Check,
  Download,
  Eye,
  PenLine,
  Search,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  dismissNotification,
  markNotificationRead,
} from "@/app/(patient)/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogRow {
  id: string;
  access_type: string;
  created_at: string;
  accessor_name: string | null;
  note: string | null;
  read: boolean;
}

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

function NotificationItem({ log }: { log: LogRow }) {
  const [pending, startTransition] = useTransition();
  const who = log.accessor_name || "A verified provider";
  const { icon: Icon, tone, title } = describe(log.access_type, who);

  return (
    <li className="surface flex items-start gap-3.5 p-4 sm:p-5">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          tone === "warning" ? "bg-caution/10 text-caution" : "bg-info/10 text-info",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {title}
            {!log.read && (
              <Badge variant="info" className="ml-2 align-middle">
                Unread
              </Badge>
            )}
          </p>
          <span className="tabular shrink-0 text-xs text-muted-foreground">
            {relativeTime(log.created_at)}
          </span>
        </div>
        {log.note && <p className="mt-1 text-xs text-muted-foreground">{log.note}</p>}

        <div className="mt-2 flex gap-2">
          {!log.read && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(() => markNotificationRead(log.id))}
            >
              <Check />
              Mark as read
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => dismissNotification(log.id))}
          >
            <X />
            Dismiss
          </Button>
        </div>
      </div>
    </li>
  );
}

export function NotificationsList({ rows }: { rows: LogRow[] }) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const visible = tab === "unread" ? rows.filter((r) => !r.read) : rows;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Filter notifications"
        className="inline-flex w-fit gap-1 rounded-lg border border-border bg-muted/40 p-1"
      >
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="surface beacon-rise flex flex-col items-center gap-3 px-4 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground/60">
            <Bell className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            {tab === "unread"
              ? "Nothing unread."
              : "No notifications yet. When a doctor or administrator opens your record, you'll see it here."}
          </p>
        </div>
      ) : (
        <ul className="beacon-rise flex flex-col gap-3">
          {visible.map((log) => (
            <NotificationItem key={log.id} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}
