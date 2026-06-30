import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Brand } from "@/components/brand";

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

  return (
    <main className="bg-aurora mx-auto w-full max-w-3xl px-4 py-10">
      <header className="beacon-rise mb-8">
        <Brand href="/" />
        <span className="data-label mt-6 block text-primary-400">
          Administration
        </span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
          <ShieldCheck className="size-7 text-primary" />
          Admin oversight
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Approve providers, find and share records, and review the audit trail.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
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
  );
}
