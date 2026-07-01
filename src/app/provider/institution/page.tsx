import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionMemberRow, InstitutionRow } from "@/lib/database.types";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AffiliationRequestForm } from "@/components/provider/affiliation-request-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Institution affiliation",
  robots: { index: false, follow: false },
};

export default async function ProviderInstitutionPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/provider/login");

  const { user, profile } = session;
  if (profile.role !== "provider") redirect("/dashboard");

  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("institution_members")
    .select("*")
    .eq("member_id", user.id)
    .order("requested_at", { ascending: false });

  const rows = (memberships ?? []) as InstitutionMemberRow[];

  const institutionIds = rows.map((r) => r.institution_id);
  const { data: institutions } = institutionIds.length
    ? await supabase.from("institutions").select("*").in("id", institutionIds)
    : { data: [] as InstitutionRow[] };
  const institutionById = new Map(
    (institutions ?? []).map((i) => [i.id, i as InstitutionRow]),
  );

  // Verified facilities the doctor hasn't already requested/joined.
  const { data: verified } = await supabase
    .from("institutions")
    .select("id, name, facility_type")
    .eq("status", "verified")
    .order("name", { ascending: true });
  const requestedIds = new Set(rows.map((r) => r.institution_id));
  const available = ((verified ?? []) as Pick<
    InstitutionRow,
    "id" | "name" | "facility_type"
  >[]).filter((i) => !requestedIds.has(i.id));

  return (
    <div className="bg-aurora relative min-h-dvh overflow-hidden">
      <div className="grain absolute inset-0" aria-hidden />

      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
          <Brand href="/provider" />
          <SignOutButton variant="outline" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl px-5 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/provider">
            <ArrowLeft />
            Back to dashboard
          </Link>
        </Button>

        <header className="beacon-rise mb-6">
          <span className="data-label text-primary-400">Affiliation</span>
          <h1 className="font-display mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Building2 className="size-6 text-primary" />
            Institution affiliation
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your medical license is verified independently of any facility. You
            can also request affiliation with a verified hospital or clinic —
            useful if you practise there.
          </p>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your affiliations</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You haven&apos;t requested affiliation with any facility yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {rows.map((r) => {
                  const inst = institutionById.get(r.institution_id);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="font-medium">
                        {inst?.name ?? "Facility"}
                      </span>
                      {r.status === "approved" ? (
                        <Badge variant="safe">
                          <CheckCircle2 />
                          Affiliated
                        </Badge>
                      ) : r.status === "rejected" ? (
                        <Badge variant="critical">
                          <XCircle />
                          Not approved
                        </Badge>
                      ) : (
                        <Badge variant="caution">
                          <Clock />
                          Pending
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request affiliation</CardTitle>
          </CardHeader>
          <CardContent>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No further verified facilities are available to request right
                now.
              </p>
            ) : (
              <AffiliationRequestForm institutions={available} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
