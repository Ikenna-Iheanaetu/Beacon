import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionRow } from "@/lib/database.types";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InstitutionVerifyForm } from "@/components/institution/institution-verify-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facility verification",
  robots: { index: false, follow: false },
};

export default async function InstitutionVerifyPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/institution/login");

  const { user, profile } = session;
  if (profile.role !== "institution") redirect("/dashboard");

  // The institution reads its OWN facility row via RLS.
  const supabase = await createClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle<InstitutionRow>();

  const status = institution?.status;
  const canResubmit = !institution || status === "rejected";

  const metaName =
    (user.user_metadata?.institution_name as string | undefined) ?? "";
  const defaults = {
    ...institution,
    name: institution?.name ?? metaName,
  };

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

        <div className="beacon-rise surface-lift overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-primary-800 to-primary-600 px-6 py-4 text-primary-foreground">
            <span className="flex items-center gap-2">
              <Building2 className="size-5" strokeWidth={2.4} />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                Facility verification
              </span>
            </span>
          </div>

          <div className="p-7">
            {status === "verified" && (
              <Alert variant="safe">
                <CheckCircle2 />
                <AlertTitle>Your facility is verified</AlertTitle>
                <AlertDescription>
                  Your institution is trusted on Beacon. There is nothing more to
                  do here.
                </AlertDescription>
              </Alert>
            )}

            {status === "pending" && (
              <Alert variant="caution">
                <Clock />
                <AlertTitle>Verification in review</AlertTitle>
                <AlertDescription>
                  We&apos;ve received your registration for{" "}
                  <span className="font-medium">{institution?.name}</span> and an
                  administrator is reviewing it. You&apos;ll be verified once the
                  check is complete.
                </AlertDescription>
              </Alert>
            )}

            {status === "rejected" && (
              <Alert variant="critical" className="mb-6">
                <XCircle />
                <AlertTitle>Verification was not approved</AlertTitle>
                <AlertDescription>
                  {institution?.notes
                    ? institution.notes
                    : "Your previous submission couldn't be verified."}{" "}
                  Please check your details and submit again.
                </AlertDescription>
              </Alert>
            )}

            {canResubmit ? (
              <>
                {!institution && (
                  <div className="mb-6">
                    <span className="data-label">Submit your registration</span>
                    <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
                      Verify your facility
                    </h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Provide your facility&apos;s registration details so an
                      administrator can verify your institution.
                    </p>
                  </div>
                )}
                <InstitutionVerifyForm defaults={defaults} />
              </>
            ) : (
              <div className="mt-6 flex items-center gap-2">
                <span className="data-label">Current status</span>
                <Badge variant={status === "verified" ? "safe" : "caution"}>
                  {status === "verified" ? (
                    <>
                      <CheckCircle2 />
                      Verified
                    </>
                  ) : (
                    <>
                      <Clock />
                      Pending
                    </>
                  )}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
