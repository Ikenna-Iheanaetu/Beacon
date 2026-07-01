import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = {
  title: "Doctor & nurse registration",
  description:
    "Doctors (MDCN) and nurses/midwives (NMCN): register for Beacon to access patients' emergency medical information once approved.",
};

export default function ProviderSignupPage() {
  return (
    <AuthShell
      title="Doctor & nurse registration"
      subtitle="Register to access emergency medical information when it matters."
      footer={
        <>
          Already registered?{" "}
          <Link
            href="/provider/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
          <br />
          <span className="mt-2 inline-block">
            Represent a hospital or clinic instead?{" "}
            <Link
              href="/institution/signup"
              className="font-medium text-primary hover:underline"
            >
              Register your facility
            </Link>
          </span>
        </>
      }
    >
      <Alert variant="info" className="mb-4">
        <ShieldCheck />
        <AlertDescription>
          New accounts are reviewed before they can access patient data.
          You&apos;ll be able to sign in once an administrator approves you.
        </AlertDescription>
      </Alert>
      <AuthForm mode="signup" role="provider" />
    </AuthShell>
  );
}
