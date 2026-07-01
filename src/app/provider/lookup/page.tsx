import type { Metadata } from "next";
import Link from "next/link";
import { Clock, IdCard, ShieldAlert } from "lucide-react";
import { getCurrentProfile, isApprovedProvider } from "@/lib/auth";
import { NationalIdLookupForm } from "@/components/provider/national-id-lookup-form";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Sensitive — must never be crawled or indexed.
export const metadata: Metadata = {
  title: "National ID lookup",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ProviderLookupPage() {
  // Middleware guarantees an authenticated user reaches this page.
  const session = await getCurrentProfile();

  // Authorisation: approved providers only (BUILD_SPEC §6, §7.4) → 403.
  if (!session || !isApprovedProvider(session.profile)) {
    const pending = session?.profile.role === "provider";
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Alert variant={pending ? "caution" : "critical"}>
            {pending ? <Clock /> : <ShieldAlert />}
            <AlertTitle>
              {pending ? "Awaiting approval" : "Access restricted"}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              {pending
                ? "Your account hasn't been approved yet. You'll be able to look up records once an administrator approves you."
                : "Only approved practitioners can look up patient records."}
              <SignOutButton variant="outline" />
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

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
        <div className="beacon-rise flex flex-col gap-6">
          <div>
            <span className="data-label flex items-center gap-2 text-primary-300">
              <IdCard className="size-4" />
              Backup lookup
            </span>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
              Find a record by national ID
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              For when a patient can&apos;t present their Beacon QR code. The
              patient is notified and the access is recorded in their visible
              activity log.{" "}
              <Link href="/provider" className="underline">
                Back to dashboard
              </Link>
            </p>
          </div>

          <NationalIdLookupForm />
        </div>
      </main>
    </div>
  );
}
