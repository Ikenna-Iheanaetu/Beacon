import { Building2, ExternalLink, ShieldAlert } from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedInstitutionUrl } from "@/lib/storage";
import type { FacilityCheck } from "@/lib/verification";
import type { InstitutionRow } from "@/lib/database.types";
import { FACILITY_TYPES } from "@/lib/validation";
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
import { InstitutionReview } from "@/components/admin/institution-review";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facility verifications",
  robots: { index: false, follow: false },
};

const FACILITY_LABEL = new Map(FACILITY_TYPES.map((f) => [f.value, f.label]));

function checkSummary(result: unknown): {
  label: string;
  variant: "safe" | "caution" | "muted";
} {
  const r = result as Partial<FacilityCheck> | null;
  if (!r || typeof r !== "object") {
    return { label: "No check on file", variant: "muted" };
  }
  if (r.ok) return { label: "Registry match", variant: "safe" };
  if (r.format_valid) {
    return { label: "Format OK · no registry match", variant: "caution" };
  }
  return { label: "Invalid format", variant: "caution" };
}

export default async function AdminInstitutionsPage() {
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

  const { data: pending } = await admin
    .from("institutions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const institutions = (pending ?? []) as InstitutionRow[];

  // Owner emails from auth.users.
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));

  // Short-lived signed URLs to each registration document.
  const docUrls = new Map<string, string | null>();
  await Promise.all(
    institutions.map(async (i) => {
      if (i.registration_document_path) {
        docUrls.set(i.id, await signedInstitutionUrl(i.registration_document_path));
      }
    }),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="beacon-rise mb-7">
        <span className="data-label text-primary-400">Administration</span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
          <Building2 className="size-7 text-primary" />
          Facility verifications
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Review each facility&apos;s registration (NHFR, State MoH / HEFAMAA,
          CAC, and Medical Director) before trusting the institution.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pending facilities</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {institutions.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No facilities are waiting for review.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>Registry IDs</TableHead>
                  <TableHead>Medical Director</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institutions.map((i) => {
                  const summary = checkSummary(i.verify_check_result);
                  const url = docUrls.get(i.id) ?? null;
                  return (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="font-medium">{i.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {FACILITY_LABEL.get(i.facility_type) ?? i.facility_type}
                        </div>
                        <div className="tabular text-sm text-muted-foreground">
                          {emailById.get(i.owner_id) ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="tabular text-sm">
                        <div className="flex flex-col gap-0.5">
                          {i.nhfr_code && <span>NHFR: {i.nhfr_code}</span>}
                          {i.state_moh_reg_no && (
                            <span>MoH: {i.state_moh_reg_no}</span>
                          )}
                          {i.cac_rc_number && <span>CAC: {i.cac_rc_number}</span>}
                          {!i.nhfr_code &&
                            !i.state_moh_reg_no &&
                            !i.cac_rc_number && (
                              <span className="text-muted-foreground">—</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {i.medical_director_name ?? "—"}
                        </div>
                        <div className="tabular text-muted-foreground">
                          {i.medical_director_mdcn ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={summary.variant}>{summary.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                          >
                            View document
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <InstitutionReview institutionId={i.id} name={i.name} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
