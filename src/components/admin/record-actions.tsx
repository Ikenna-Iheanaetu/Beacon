"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileText, FileType, Mail, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  emailRecord,
  openRecord,
  searchPatients,
  type EmailRecordState,
  type OpenRecordState,
  type SearchState,
} from "@/app/admin/records/actions";
import { reasonSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TriageCard } from "@/components/emergency/triage-card";

function PendingButton({
  idle,
  busy,
  icon,
}: {
  idle: string;
  busy: string;
  icon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {icon}
      {pending ? busy : idle}
    </Button>
  );
}

/**
 * Actions for an opened record: export to PDF (a GET route that re-derives and
 * audit-logs) and email the record to a recipient (server action).
 */
export function RecordActions({
  patientId,
  reason,
}: {
  patientId: string;
  reason: string;
}) {
  const recipientId = useId();
  const noteId = useId();
  const [state, formAction] = useActionState<EmailRecordState, FormData>(
    emailRecord,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) {
      if (state.ok) toast.success(state.message);
      else toast.info(state.message);
    }
  }, [state]);

  const exportHref = `/admin/records/export?patientId=${encodeURIComponent(
    patientId,
  )}&reason=${encodeURIComponent(reason)}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild variant="outline">
        <a href={exportHref} target="_blank" rel="noopener noreferrer">
          <FileText className="size-4" />
          Export PDF
        </a>
      </Button>

      <Button asChild variant="outline">
        <a href={`${exportHref}&format=docx`} target="_blank" rel="noopener noreferrer">
          <FileType className="size-4" />
          Export Word
        </a>
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">
            <Mail className="size-4" />
            Email record
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Email this record</DialogTitle>
              <DialogDescription>
                Sends the record as a PDF attachment. This share is recorded in
                the audit log.
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="reason" value={reason} />

            <div className="flex flex-col gap-2">
              <Label htmlFor={recipientId}>Recipient email</Label>
              <Input
                id={recipientId}
                name="recipient"
                type="email"
                required
                placeholder="clinic@example.com"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={noteId}>Note (optional)</Label>
              <Textarea
                id={noteId}
                name="note"
                maxLength={500}
                placeholder="Context for the recipient."
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <PendingButton idle="Send record" busy="Sending…" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Reason-gated dialog that opens a single patient's record. */
function OpenRecordDialog({
  patientId,
  state,
  formAction,
}: {
  patientId: string;
  state: OpenRecordState;
  formAction: (formData: FormData) => void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const parsed = reasonSchema.safeParse(reason);
  const showError = reason.length > 0 && !parsed.success;
  const reasonError = showError ? parsed.error.issues[0]?.message : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Open
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Open this record</DialogTitle>
            <DialogDescription>
              A reason is required. It is recorded in the audit log and shown to
              the patient in their own access log.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="patientId" value={patientId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor={reasonId}>Reason for access</Label>
            <Textarea
              id={reasonId}
              name="reason"
              required
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient support call ref #1234 — verifying allergies."
              aria-invalid={showError}
            />
          </div>

          {reasonError && (
            <Alert variant="critical" aria-live="polite">
              <AlertDescription>{reasonError}</AlertDescription>
            </Alert>
          )}
          {state.error && (
            <Alert variant="critical" aria-live="assertive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <PendingButton idle="Open record" busy="Opening…" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The full "find a record" experience: search by email/national ID, pick a
 * match, supply a reason to open, then view + act on the opened record.
 */
export function RecordSearch() {
  const [search, searchAction] = useActionState<SearchState, FormData>(
    searchPatients,
    {},
  );
  const [opened, openAction] = useActionState<OpenRecordState, FormData>(
    openRecord,
    {},
  );
  const [mode, setMode] = useState<"email" | "national_id">("email");
  const queryId = useId();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Find a patient</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={searchAction} className="flex flex-col gap-4">
            <input type="hidden" name="mode" value={mode} />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "email" ? "default" : "outline"}
                onClick={() => setMode("email")}
              >
                By email
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "national_id" ? "default" : "outline"}
                onClick={() => setMode("national_id")}
              >
                By national ID
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={queryId}>
                {mode === "email" ? "Patient email" : "National ID"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={queryId}
                  name="query"
                  type={mode === "email" ? "email" : "text"}
                  className={mode === "national_id" ? "tabular" : undefined}
                  placeholder={
                    mode === "email"
                      ? "patient@example.com"
                      : "National ID number"
                  }
                />
                <PendingButton
                  idle="Search"
                  busy="Searching…"
                  icon={<Search className="size-4" />}
                />
              </div>
            </div>
          </form>

          {search.error && (
            <Alert variant="critical" className="mt-4">
              <AlertDescription>{search.error}</AlertDescription>
            </Alert>
          )}

          {search.matches && (
            <div className="mt-5">
              {search.matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No patient matched “{search.query}”.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {search.matches.map((m) => (
                    <li
                      key={m.patientId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700">
                          <UserRound className="size-4" />
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            {m.name ?? "Unnamed patient"}
                          </p>
                          <p className="tabular text-sm text-muted-foreground">
                            {m.email ?? "—"}
                          </p>
                        </div>
                      </div>
                      <OpenRecordDialog
                        patientId={m.patientId}
                        state={opened}
                        formAction={openAction}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {opened.view && opened.patientId && opened.reason && (
        <section className="beacon-rise flex flex-col gap-4">
          <div className="surface flex flex-col gap-4 p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Opened record
            </h2>
            <RecordActions patientId={opened.patientId} reason={opened.reason} />
          </div>
          <TriageCard data={opened.view} />
        </section>
      )}
    </div>
  );
}
