import Link from "next/link";
import { Building2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = {
  title: "Institution registration",
  description:
    "Hospitals, clinics, and diagnostic centres: register your facility on Beacon to enrol and manage your verified clinical staff.",
};

export default function InstitutionSignupPage() {
  return (
    <AuthShell
      title="Register your facility"
      subtitle="Hospitals, clinics, and diagnostic centres join Beacon as a verified institution."
      footer={
        <>
          Already registered?{" "}
          <Link
            href="/institution/login"
            className="font-medium text-primary hover:underline"
          >
            Institution sign in
          </Link>
          <br />
          <span className="mt-2 inline-block">
            Are you an individual doctor or nurse instead?{" "}
            <Link
              href="/provider/signup"
              className="font-medium text-primary hover:underline"
            >
              Register here
            </Link>
          </span>
        </>
      }
    >
      <Alert variant="info" className="mb-4">
        <Building2 />
        <AlertDescription>
          New facility accounts are reviewed before they&apos;re trusted. After
          signing up you&apos;ll submit your registration details (NHFR, State
          Ministry of Health / HEFAMAA, CAC, and Medical Director) for an
          administrator to verify.
        </AlertDescription>
      </Alert>
      <AuthForm mode="signup" role="institution" />
    </AuthShell>
  );
}
