import { FileSearch, ShieldAlert } from "lucide-react";
import { isAdmin } from "@/lib/admin-guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RecordSearch } from "@/components/admin/record-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find a record",
  robots: { index: false, follow: false },
};

export default async function AdminRecordsPage() {
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
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="beacon-rise mb-7">
        <span className="data-label text-primary-400">Administration</span>
        <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
          <FileSearch className="size-7 text-primary" />
          Find a record
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Look up a patient by email or national ID. Opening a record requires a
          reason and is recorded in the audit log and the patient&apos;s access
          log.
        </p>
      </header>

      <RecordSearch />
    </main>
  );
}
