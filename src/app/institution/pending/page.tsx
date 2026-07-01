import Link from "next/link";
import { Clock } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function InstitutionPendingPage() {
  return (
    <AuthShell
      title="Account created"
      footer={
        <Link
          href="/institution/login"
          className="font-medium text-primary hover:underline"
        >
          Go to sign in
        </Link>
      }
    >
      <Alert variant="caution">
        <Clock />
        <AlertTitle>Confirm your email to continue</AlertTitle>
        <AlertDescription>
          Thanks for registering. Check your email and confirm your address,
          then sign in — you&apos;ll be asked to submit your facility&apos;s
          registration details (NHFR, State MoH / HEFAMAA, CAC, and Medical
          Director). An administrator reviews that before your facility is
          verified.
        </AlertDescription>
      </Alert>
    </AuthShell>
  );
}
