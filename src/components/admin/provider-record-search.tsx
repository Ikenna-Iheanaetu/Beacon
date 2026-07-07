"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Clock, ExternalLink, Search, Stethoscope, XCircle } from "lucide-react";
import {
  openProviderRecord,
  searchProviders,
  type OpenProviderState,
  type ProviderSearchState,
} from "@/app/admin/records/actions";
import { practitionerTypeLabel } from "@/lib/roles";
import type { PractitionerType } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VerificationReview } from "@/components/admin/verification-review";
import { RestrictControl } from "@/components/admin/restrict-control";

function PendingButton({
  idle,
  busy,
  icon,
  ...props
}: {
  idle: string;
  busy: string;
  icon?: React.ReactNode;
} & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {icon}
      {pending ? busy : idle}
    </Button>
  );
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  verified: "safe",
  approved: "safe",
  pending: "caution",
  rejected: "critical",
  none: "muted",
};

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? "muted";
  const Icon = status === "verified" || status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <Badge variant={variant}>
      <Icon />
      {status}
    </Badge>
  );
}

/**
 * The provider half of "Find a record": search doctors/nurses by name or
 * email, then view their account + council license + facility affiliation
 * with the same approve/reject actions used on the Approvals page, right
 * in place.
 */
export function ProviderRecordSearch() {
  const [search, searchAction] = useActionState<ProviderSearchState, FormData>(
    searchProviders,
    {},
  );
  const [opened, openAction] = useActionState<OpenProviderState, FormData>(
    openProviderRecord,
    {},
  );
  const queryId = useId();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Find a doctor or nurse</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={searchAction} className="flex flex-col gap-2">
            <Label htmlFor={queryId}>Name or email</Label>
            <div className="flex gap-2">
              <Input
                id={queryId}
                name="query"
                type="text"
                placeholder="Dr. Ade Bello or dr.ade@clinic.com"
              />
              <PendingButton idle="Search" busy="Searching…" icon={<Search className="size-4" />} />
            </div>
          </form>

          {search.error && (
            <Alert variant="critical" className="mt-4">
              <AlertDescription>{search.error}</AlertDescription>
            </Alert>
          )}

          {search.matches && (
            <div className="mt-5">
              {search.matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No provider matched “{search.query}”.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {search.matches.map((m) => (
                    <li
                      key={m.providerId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700">
                          <Stethoscope className="size-4" />
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            {m.name ?? "Unnamed provider"}
                          </p>
                          <p className="tabular text-sm text-muted-foreground">
                            {m.email ?? "—"}
                          </p>
                        </div>
                      </div>
                      <form action={openAction}>
                        <input type="hidden" name="providerId" value={m.providerId} />
                        <PendingButton idle="Open" busy="Opening…" size="sm" variant="outline" />
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {opened.error && (
        <Alert variant="critical">
          <AlertDescription>{opened.error}</AlertDescription>
        </Alert>
      )}

      {opened.detail && (
        <Card className="beacon-rise">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>{opened.detail.name ?? "Provider"}</CardTitle>
            <RestrictControl
              userId={opened.detail.providerId}
              name={opened.detail.name ?? "this provider"}
              isRestricted={opened.detail.restricted}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <div className="data-label text-muted-foreground">Email</div>
                <div className="tabular">{opened.detail.email ?? "—"}</div>
              </div>
              <div>
                <div className="data-label text-muted-foreground">Account status</div>
                <StatusBadge status={opened.detail.providerStatus ?? "none"} />
              </div>
              <div>
                <div className="data-label text-muted-foreground">Facility</div>
                <div>{opened.detail.facility ?? "Not affiliated"}</div>
              </div>
            </div>

            {opened.detail.verification ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <div className="data-label text-muted-foreground">Type</div>
                    <div>
                      {practitionerTypeLabel(
                        opened.detail.verification.practitionerType as PractitionerType,
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="data-label text-muted-foreground">Council</div>
                    <div>{opened.detail.verification.council}</div>
                  </div>
                  <div>
                    <div className="data-label text-muted-foreground">License</div>
                    <div className="tabular">{opened.detail.verification.licenseNumber}</div>
                  </div>
                  <div>
                    <div className="data-label text-muted-foreground">Verification</div>
                    <StatusBadge status={opened.detail.verification.status} />
                  </div>
                  <div>
                    <div className="data-label text-muted-foreground">Document</div>
                    {opened.detail.verification.documentUrl ? (
                      <a
                        href={opened.detail.verification.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        View document
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </div>
                </div>
                {opened.detail.verification.notes && (
                  <p className="text-sm text-muted-foreground">
                    Note: {opened.detail.verification.notes}
                  </p>
                )}
                <VerificationReview
                  providerId={opened.detail.providerId}
                  name={opened.detail.name ?? "this provider"}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No council license has been submitted yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
