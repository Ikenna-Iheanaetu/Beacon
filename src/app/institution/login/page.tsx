import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Institution sign in" };

export default async function InstitutionLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;

  return (
    <AuthShell
      title="Institution sign in"
      subtitle="Sign in to manage your facility and its clinical staff."
      footer={
        <>
          Need an account?{" "}
          <Link
            href="/institution/signup"
            className="font-medium text-primary hover:underline"
          >
            Register your facility
          </Link>
        </>
      }
    >
      <AuthForm mode="login" role="institution" next={sp.next} />
    </AuthShell>
  );
}
