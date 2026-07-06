import { KeyRound, LogIn, ShieldAlert, UserPlus } from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthEventRow, UserRole } from "@/lib/database.types";
import { roleLabel } from "@/lib/roles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  title: "Auth activity",
  robots: { index: false, follow: false },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminAuthLogPage() {
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

  const { data: events } = await admin
    .from("auth_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (events ?? []) as AuthEventRow[];

  // Current name/role per user — looked up once, not stored per-event, since
  // both can change after the fact and the current values are what's useful
  // here (a name at signup time isn't necessarily still accurate).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profs } = userIds.length
    ? await admin.from("profiles").select("id, full_name, role").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; role: UserRole }[] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
  const roleById = new Map((profs ?? []).map((p) => [p.id, p.role]));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="beacon-rise mb-7">
        <span className="data-label text-primary-700">Administration</span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
          <KeyRound className="size-7 text-primary" />
          Auth activity
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every signup and sign-in, across every role. The 200 most recent.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No signups or sign-ins recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Event</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const role = roleById.get(r.user_id);
                  const name = nameById.get(r.user_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                        {formatWhen(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{name || "—"}</div>
                        <div className="tabular text-sm text-muted-foreground">
                          {r.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {role ? roleLabel(role) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.event_type === "signup" ? (
                          <Badge variant="info">
                            <UserPlus />
                            Signup
                          </Badge>
                        ) : (
                          <Badge variant="muted">
                            <LogIn />
                            Login
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
