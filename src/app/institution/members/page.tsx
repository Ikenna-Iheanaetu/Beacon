import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Users, XCircle } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InstitutionMemberRow, InstitutionRow } from "@/lib/database.types";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MemberReview } from "@/components/institution/member-review";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facility staff",
  robots: { index: false, follow: false },
};

export default async function InstitutionMembersPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/institution/login");

  const { user, profile } = session;
  if (profile.role !== "institution") redirect("/dashboard");

  const supabase = await createClient();

  const { data: institution } = await supabase
    .from("institutions")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle<InstitutionRow>();

  if (!institution || institution.status !== "verified") {
    return (
      <div className="bg-aurora relative min-h-dvh overflow-hidden">
        <div className="grain absolute inset-0" aria-hidden />
        <header className="relative z-10 border-b border-border/70">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
            <Brand href="/institution" />
            <SignOutButton variant="outline" />
          </div>
        </header>
        <main className="relative z-10 mx-auto w-full max-w-2xl px-5 py-12">
          <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
            <Link href="/institution">
              <ArrowLeft />
              Back to dashboard
            </Link>
          </Button>
          <Alert variant="caution">
            <Clock />
            <AlertTitle>Verification required</AlertTitle>
            <AlertDescription>
              Your facility must be verified before you can review staff
              affiliation requests.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  const { data: members } = await supabase
    .from("institution_members")
    .select("*")
    .eq("institution_id", institution.id)
    .order("requested_at", { ascending: true });

  const rows = (members ?? []) as InstitutionMemberRow[];

  const admin = createAdminClient();
  const memberIds = rows.map((r) => r.member_id);
  const { data: profs } = memberIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

  const { data: userList } = memberIds.length
    ? await admin.auth.admin.listUsers({ perPage: 1000 })
    : { data: null };
  const emailById = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="bg-aurora relative min-h-dvh overflow-hidden">
      <div className="grain absolute inset-0" aria-hidden />

      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-4">
          <Brand href="/institution" />
          <SignOutButton variant="outline" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-4xl px-5 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/institution">
            <ArrowLeft />
            Back to dashboard
          </Link>
        </Button>

        <header className="beacon-rise mb-6">
          <span className="data-label text-primary-400">{institution.name}</span>
          <h1 className="font-display mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Users className="size-6 text-primary" />
            Facility staff
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Review affiliation requests from doctors and nurses who practise at
            your facility. Their council license is verified independently —
            this only records their affiliation with your institution.
          </p>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pending requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pending.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No requests are waiting for review.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Practitioner</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((r) => {
                    const name = nameById.get(r.member_id) ?? "Practitioner";
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{name}</div>
                          <div className="tabular text-sm text-muted-foreground">
                            {emailById.get(r.member_id) ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <MemberReview memberRowId={r.id} name={name} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {decided.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Roster</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Practitioner</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decided.map((r) => {
                    const name = nameById.get(r.member_id) ?? "Practitioner";
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{name}</div>
                          <div className="tabular text-sm text-muted-foreground">
                            {emailById.get(r.member_id) ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.status === "approved" ? (
                            <Badge variant="safe">
                              <CheckCircle2 />
                              Affiliated
                            </Badge>
                          ) : (
                            <Badge variant="critical">
                              <XCircle />
                              Rejected
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
