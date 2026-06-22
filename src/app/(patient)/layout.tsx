import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile/edit", label: "Edit profile" },
  { href: "/qr", label: "My QR code" },
  { href: "/access-log", label: "Access log" },
];

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  // Providers don't have a patient passport — send them to their own area.
  if (session.profile.role === "provider") redirect("/provider");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-primary">
            <HeartPulse className="size-5" />
            <span className="font-semibold tracking-tight">Beacon</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-1 py-1 text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
