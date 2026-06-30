import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ScanLine,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/roles";
import type {
  ProviderVerificationRow,
  VerificationStatus,
} from "@/lib/database.types";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Doctor home",
  robots: { index: false, follow: false },
};

export default async function ProviderHomePage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/provider/login");

  const { user, profile } = session;
  if (profile.role !== "provider") redirect("/dashboard");

  const label = roleLabel(profile.role); // "Doctor"

  // Prefer the verification row's status; fall back to the profile flag.
  const supabase = await createClient();
  const { data: verification } = await supabase
    .from("provider_verifications")
    .select("status")
    .eq("provider_id", user.id)
    .maybeSingle<Pick<ProviderVerificationRow, "status">>();

  const status: VerificationStatus =
    verification?.status ??
    (profile.provider_status === "approved" ? "verified" : "pending");

  const approved = status === "verified" || profile.provider_status === "approved";
  const admin = await isAdmin();

  return (
    <div className="bg-aurora relative min-h-dvh overflow-hidden">
      <div className="grain absolute inset-0" aria-hidden />

      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <Brand href="/provider" />
          <SignOutButton variant="outline" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 py-12">
        <div className="beacon-rise surface-lift bg-guilloche overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-primary-800 to-primary-600 px-6 py-4 text-primary-foreground">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-5" strokeWidth={2.4} />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                {label} access
              </span>
            </span>
            {status === "verified" ? (
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
            <span className="data-label">Signed in as</span>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
              {profile.full_name || label}
            </h1>
            <p className="data-value mt-0.5 text-sm text-muted-foreground">
              {user.email}
            </p>

            <div className="mt-4 flex items-center gap-2">
              <span className="data-label">Verification</span>
              {status === "verified" ? (
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
              {approved ? (
                <div className="flex items-start gap-3">
                  <ScanLine className="mt-0.5 size-5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-foreground">
                    You&apos;re approved. To view a patient&apos;s emergency
                    information, scan their Beacon QR code with your phone camera
                    — it opens the emergency view directly. You can also look up
                    a patient by national ID.{" "}
                    <span className="text-muted-foreground">
                      Every access is logged.
                    </span>
                  </p>
                </div>
              ) : status === "rejected" ? (
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 size-5 shrink-0 text-critical" />
                  <p className="text-sm leading-relaxed text-foreground">
                    Your license couldn&apos;t be verified. Review your details
                    and submit again on the verification page.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-caution" />
                  <p className="text-sm leading-relaxed text-foreground">
                    Your account is awaiting verification. Submit your medical
                    license so an administrator can approve your access to
                    emergency records.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant={approved ? "outline" : "default"}>
                <Link href="/provider/verify">
                  <ShieldCheck />
                  {approved ? "View verification" : "Verify your license"}
                </Link>
              </Button>

              {approved && (
                <Button asChild variant="outline">
                  <Link href="/provider/lookup">
                    <Search />
                    Patient lookup
                  </Link>
                </Button>
              )}

              {admin && (
                <Button asChild variant="outline">
                  <Link href="/admin">
                    <Users />
                    Open admin approvals
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
