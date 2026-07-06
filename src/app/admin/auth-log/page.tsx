import { KeyRound, LogIn, ShieldAlert, UserPlus } from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthEventRow, UserRole } from "@/lib/database.types";
import { roleLabel } from "@/lib/roles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
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

const PAGE_SIZE = 25;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminAuthLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
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

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const admin = createAdminClient();

  // `count: "exact"` piggybacks a row-count onto the same query (Postgres
  // computes it from the same index scan) so we get the total for "Page X
  // of Y" without a second round trip.
  const { data: events, count } = await admin
    .from("auth_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = (events ?? []) as AuthEventRow[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Current name/role per user — looked up once, not stored per-event, since
  // both can change after the fact and the current values are what's useful
  // here (a name at signup time isn't necessarily still accurate).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profs } = userIds.length
    ? await admin.from("profiles").select("id, full_name, role").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; role: UserRole }[] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
  const roleById = new Map((profs ?? []).map((p) => [p.id, p.role]));

  // Facility affiliation: a provider's approved institution_members grant,
  // or — for an institution account itself — the facility it owns.
  const providerIds = (profs ?? []).filter((p) => p.role === "provider").map((p) => p.id);
  const institutionOwnerIds = (profs ?? [])
    .filter((p) => p.role === "institution")
    .map((p) => p.id);

  const { data: memberships } = providerIds.length
    ? await admin
        .from("institution_members")
        .select("member_id, institution_id")
        .eq("status", "approved")
        .in("member_id", providerIds)
    : { data: [] as { member_id: string; institution_id: string }[] };

  const { data: ownedInstitutions } = institutionOwnerIds.length
    ? await admin.from("institutions").select("owner_id, name").in("owner_id", institutionOwnerIds)
    : { data: [] as { owner_id: string; name: string }[] };

  const membershipInstitutionIds = [
    ...new Set((memberships ?? []).map((m) => m.institution_id)),
  ];
  const { data: memberInstitutions } = membershipInstitutionIds.length
    ? await admin.from("institutions").select("id, name").in("id", membershipInstitutionIds)
    : { data: [] as { id: string; name: string }[] };
  const institutionNameById = new Map((memberInstitutions ?? []).map((i) => [i.id, i.name]));

  const facilityById = new Map<string, string>();
  for (const m of memberships ?? []) {
    const name = institutionNameById.get(m.institution_id);
    if (name) facilityById.set(m.member_id, name);
  }
  for (const i of ownedInstitutions ?? []) {
    facilityById.set(i.owner_id, i.name);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="beacon-rise mb-7">
        <span className="data-label text-primary-700">Administration</span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
          <KeyRound className="size-7 text-primary" />
          Auth activity
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every signup and sign-in for patient, provider, and institution
          accounts, newest first. Admin activity isn&apos;t tracked here.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {page > 1
                ? "No events on this page."
                : "No signups or sign-ins recorded yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Event</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const role = roleById.get(r.user_id);
                  const name = nameById.get(r.user_id);
                  const facility = facilityById.get(r.user_id);
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
                      <TableCell className="text-sm text-muted-foreground">
                        {facility ?? "—"}
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
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => `/admin/auth-log?page=${p}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
