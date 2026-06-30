import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Create your health passport",
  description:
    "Sign up to store your blood group, allergies, medications and emergency contacts — encrypted and ready when it matters.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your health passport"
      subtitle="It takes a minute. Your medical details stay encrypted and private."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
          <br />
          <span className="mt-2 inline-block">
            Are you a doctor?{" "}
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
      <AuthForm mode="signup" role="patient" />
    </AuthShell>
  );
}
