import { ScrollText, ShieldAlert } from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminActionRow, AdminActionType } from "@/lib/database.types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

const ACTION_LABELS: Record<AdminActionType, string> = {
  record_view: "Record view",
  pdf_export: "PDF export",
  email_send: "Email sent",
  provider_approve: "Provider approved",
  provider_reject: "Provider rejected",
};

const ACTION_VARIANTS: Record<AdminActionType, BadgeProps["variant"]> = {
  record_view: "info",
  pdf_export: "muted",
  email_send: "caution",
  provider_approve: "safe",
  provider_reject: "critical",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminAuditPage() {
  if (!(await isAdmin())) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Alert variant="critical">
            <ShieldAlert />
            <AlertTitle>Access restricted</AlertTitle>
            <AlertDescription>
              This page is for administrators only.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();

  const { data: actions } = await admin
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (actions ?? []) as AdminActionRow[];

  // Map admin ids → name/email for display.
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(
    (userList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );
  const { data: profs } = await admin.from("profiles").select("id, full_name");
  const nameById = new Map(
    (profs ?? []).map((p) => [p.id, p.full_name as string | null]),
  );

  function adminLabel(id: string): string {
    return nameById.get(id) || emailById.get(id) || id;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header className="beacon-rise mb-7">
        <span className="data-label text-primary-400">Administration</span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
          <ScrollText className="size-7 text-primary" />
          Audit log
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The 100 most recent privileged admin actions. Every record view,
          export and share is recorded here.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Recent actions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No admin actions have been recorded yet.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                          {formatWhen(a.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {adminLabel(a.admin_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_VARIANTS[a.action_type]}>
                            {ACTION_LABELS[a.action_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-sm text-muted-foreground">
                          {a.reason ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile list */}
              <ul className="flex flex-col divide-y divide-border md:hidden">
                {rows.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1.5 px-5 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={ACTION_VARIANTS[a.action_type]}>
                        {ACTION_LABELS[a.action_type]}
                      </Badge>
                      <span className="tabular text-xs text-muted-foreground">
                        {formatWhen(a.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {adminLabel(a.admin_id)}
                    </p>
                    {a.reason && (
                      <p className="text-sm text-muted-foreground">
                        {a.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
