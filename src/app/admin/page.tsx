import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Clock,
  FileSearch,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
  UserRound,
} from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderStatus, UserRole } from "@/lib/database.types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const LINKS = [
  {
    href: "/admin/verifications",
    icon: UserCheck,
    title: "Provider approvals",
    description: "Review and verify providers before they can open records.",
  },
  {
    href: "/admin/institutions",
    icon: Building2,
    title: "Facility approvals",
    description:
      "Verify hospitals and clinics by their registration before trusting them.",
  },
  {
    href: "/admin/records",
    icon: FileSearch,
    title: "Find a record",
    description: "Look up a patient and open their record with a logged reason.",
  },
  {
    href: "/admin/audit",
    icon: ScrollText,
    title: "Audit log",
    description: "Every privileged admin action, newest first.",
  },
] as const;

/** Count rows in `profiles` matching an optional column=value filter. */
async function countProfiles(
  admin: ReturnType<typeof createAdminClient>,
  filter?:
    | { column: "role"; value: UserRole }
    | { column: "provider_status"; value: ProviderStatus },
): Promise<number> {
  let query = admin
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count } = await query;
  return count ?? 0;
}

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Alert variant="critical">
            <ShieldAlert />
            <AlertTitle>Access restricted</AlertTitle>
            <AlertDescription>
              This page is for administrators only.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const [totalUsers, doctors, patients, pending, pendingFacilities] =
    await Promise.all([
      countProfiles(admin),
      countProfiles(admin, { column: "role", value: "provider" }),
      countProfiles(admin, { column: "role", value: "patient" }),
      countProfiles(admin, { column: "provider_status", value: "pending" }),
      admin
        .from("institutions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .then(({ count }) => count ?? 0),
    ]);

  const stats = [
    { label: "Total users", value: totalUsers, icon: Users },
    { label: "Doctors", value: doctors, icon: Stethoscope },
    { label: "Patients", value: patients, icon: UserRound },
    {
      label: "Pending approvals",
      value: pending,
      icon: Clock,
      highlight: pending > 0,
    },
    {
      label: "Pending facilities",
      value: pendingFacilities,
      icon: Building2,
      highlight: pendingFacilities > 0,
    },
  ] as const;

  return (
    <div className="bg-aurora relative min-h-dvh">
      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <Brand href="/" />
          <SignOutButton variant="outline" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <header className="beacon-rise mb-8">
          <span className="data-label block text-primary-400">
            Administration
          </span>
          <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <ShieldCheck className="size-7 text-primary" />
            Admin dashboard
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage users, approve providers, and review the audit trail.
          </p>
        </header>

      <section className="beacon-rise mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="surface flex flex-col gap-3 p-5">
              <span
                className={`grid size-10 place-items-center rounded-xl ${
                  "highlight" in stat && stat.highlight
                    ? "bg-amber-50 text-amber-600"
                    : "bg-primary-50 text-primary-700"
                }`}
              >
                <Icon className="size-5" />
              </span>
              <div>
                <div className="font-display tabular text-3xl font-semibold tracking-tight text-foreground">
                  {stat.value}
                </div>
                <div className="data-label mt-0.5 text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            </div>
          );
        })}
      </section>

        <h2 className="data-label mb-3 text-primary-400">System actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="surface surface-lift group flex flex-col gap-3 p-6"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-700">
                <Icon className="size-5" />
              </span>
              <div className="flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {link.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {link.description}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
        </div>
      </main>
    </div>
  );
}
