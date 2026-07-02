import { CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CareAccessRequestRow } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PendingRequestActions,
  RevokeAccessButton,
} from "@/components/patient/care-access-review";

export default async function CareAccessPage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("care_access_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  const rows = (requests ?? []) as CareAccessRequestRow[];
  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");

  const doctorIds = rows.map((r) => r.doctor_id);
  const admin = createAdminClient();
  const { data: profs } = doctorIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", doctorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

  const { data: userList } = doctorIds.length
    ? await admin.auth.admin.listUsers({ perPage: 1000 })
    : { data: null };
  const emailById = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));

  return (
    <div className="flex flex-col gap-6">
      <header className="beacon-rise">
        <span className="data-label text-primary-400">Your care team</span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <ShieldCheck className="size-7 text-primary" />
          Edit access
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Doctors can view your emergency info without asking, but editing
          your allergies, medications, conditions, or notes requires your
          approval. You can revoke it any time.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pending requests</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No requests are waiting for your review.
            </p>
          ) : (
            pending.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {nameById.get(r.doctor_id) ?? "A doctor"}
                  </p>
                  <p className="tabular text-sm text-muted-foreground">
                    {emailById.get(r.doctor_id) ?? "—"}
                  </p>
                </div>
                <PendingRequestActions requestId={r.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doctors with edit access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No doctor currently has edit access to your record.
            </p>
          ) : (
            approved.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {nameById.get(r.doctor_id) ?? "A doctor"}
                    </p>
                    <Badge variant="safe">
                      <CheckCircle2 />
                      Approved
                    </Badge>
                  </div>
                  <p className="tabular text-sm text-muted-foreground">
                    {emailById.get(r.doctor_id) ?? "—"}
                  </p>
                </div>
                <RevokeAccessButton requestId={r.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {rows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground/60">
              <UserCheck className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              No doctor has requested edit access yet. Anyone who scans your
              code can still view your emergency info — this only covers who
              can make changes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
