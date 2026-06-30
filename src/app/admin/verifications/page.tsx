import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedLicenseUrl } from "@/lib/storage";
import type { LicenseCheck } from "@/lib/verification";
import type { ProviderVerificationRow } from "@/lib/database.types";
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
import { VerificationReview } from "@/components/admin/verification-review";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "License verifications",
  robots: { index: false, follow: false },
};

function checkSummary(result: unknown): {
  label: string;
  variant: "safe" | "caution" | "muted";
} {
  const r = result as Partial<LicenseCheck> | null;
  if (!r || typeof r !== "object") {
    return { label: "No check on file", variant: "muted" };
  }
  if (r.ok) return { label: "Registry match", variant: "safe" };
  if (r.format_valid) {
    return { label: "Format OK · no registry match", variant: "caution" };
  }
  return { label: "Invalid format", variant: "caution" };
}

export default async function AdminVerificationsPage() {
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
    .from("provider_verifications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const verifications = (pending ?? []) as ProviderVerificationRow[];

  // Names from profiles; emails from auth.users.
  const ids = verifications.map((v) => v.provider_id);
  const { data: profs } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));

  // Short-lived signed URLs to each uploaded document.
  const docUrls = new Map<string, string | null>();
  await Promise.all(
    verifications.map(async (v) => {
      if (v.license_document_path) {
        docUrls.set(v.id, await signedLicenseUrl(v.license_document_path));
      }
    }),
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header className="beacon-rise mb-7">
        <span className="data-label text-primary-400">Administration</span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
          <ShieldCheck className="size-7 text-primary" />
          License verifications
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Review each doctor&apos;s license and document before approving access
          to emergency records.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pending verifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {verifications.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No licenses are waiting for review.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications.map((v) => {
                  const summary = checkSummary(v.verify_check_result);
                  const url = docUrls.get(v.id) ?? null;
                  const name = nameById.get(v.provider_id) ?? "Doctor";
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        <div className="tabular text-sm text-muted-foreground">
                          {emailById.get(v.provider_id) ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="tabular">
                        {v.license_number}
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
                        <VerificationReview
                          providerId={v.provider_id}
                          name={name}
                        />
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
