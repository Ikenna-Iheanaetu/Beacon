import Link from "next/link";
import { Clock } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function ProviderPendingPage() {
  return (
    <AuthShell
      title="Account created"
      footer={
        <Link
          href="/provider/login"
          className="font-medium text-primary hover:underline"
        >
          Go to doctor sign in
        </Link>
      }
    >
      <Alert variant="caution">
        <Clock />
        <AlertTitle>Awaiting approval</AlertTitle>
        <AlertDescription>
          Thanks for registering. An administrator will review your account
          before you can access emergency medical information. You&apos;ll be
          able to sign in once you&apos;re approved.
        </AlertDescription>
      </Alert>
    </AuthShell>
  );
}
