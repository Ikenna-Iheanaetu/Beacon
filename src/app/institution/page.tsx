import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionRow, VerificationStatus } from "@/lib/database.types";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Institution home",
  robots: { index: false, follow: false },
};

export default async function InstitutionHomePage() {
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

  const status: VerificationStatus = institution?.status ?? "pending";
  const verified = status === "verified";
  const submitted = Boolean(institution);

  const facilityName =
    institution?.name ||
    (user.user_metadata?.institution_name as string | undefined) ||
    "Your facility";

  return (
    <div className="bg-aurora relative min-h-dvh overflow-hidden">
      <div className="grain absolute inset-0" aria-hidden />

      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <Brand href="/institution" />
          <SignOutButton variant="outline" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 py-12">
        <div className="beacon-rise surface-lift bg-guilloche overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-primary-800 to-primary-600 px-6 py-4 text-primary-foreground">
            <span className="flex items-center gap-2">
              <Building2 className="size-5" strokeWidth={2.4} />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                Institution
              </span>
            </span>
            {verified ? (
              <span className="beacon-stamp inline-flex items-center gap-1.5 rounded-md border-2 border-white/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="size-3.5" />
                Verified
              </span>
            ) : status === "rejected" ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
                <XCircle className="size-3.5" />
                Not approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
                <Clock className="size-3.5" />
                Pending
              </span>
            )}
          </div>

          <div className="p-7">
            <span className="data-label">Facility</span>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
              {facilityName}
            </h1>
            <p className="data-value mt-0.5 text-sm text-muted-foreground">
              {user.email}
            </p>

            <div className="mt-4 flex items-center gap-2">
              <span className="data-label">Verification</span>
              {verified ? (
                <Badge variant="safe">
                  <CheckCircle2 />
                  Verified
                </Badge>
              ) : status === "rejected" ? (
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
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background/60 p-5">
              {verified ? (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-foreground">
                    Your facility is verified. Enrolling and managing clinical
                    staff (doctors and nurses) under your institution is coming
                    next — your verification is the foundation that makes those
                    affiliations trustworthy.
                  </p>
                </div>
              ) : status === "rejected" ? (
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 size-5 shrink-0 text-critical" />
                  <p className="text-sm leading-relaxed text-foreground">
                    Your facility couldn&apos;t be verified. Review your
                    registration details and submit again.
                  </p>
                </div>
              ) : submitted ? (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-caution" />
                  <p className="text-sm leading-relaxed text-foreground">
                    Your registration is awaiting review. An administrator will
                    verify your facility&apos;s details and documents.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-5 shrink-0 text-caution" />
                  <p className="text-sm leading-relaxed text-foreground">
                    Submit your facility&apos;s registration details so an
                    administrator can verify your institution.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant={verified ? "outline" : "default"}>
                <Link href="/institution/verify">
                  <ShieldCheck />
                  {submitted ? "View registration" : "Submit registration"}
                </Link>
              </Button>

              {verified && (
                <Button asChild variant="outline">
                  <Link href="/institution/members">
                    <Users />
                    Manage staff
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
