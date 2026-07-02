"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Mail, Search, SearchX, ShieldOff } from "lucide-react";
import { lookupPatient, type LookupState } from "@/app/provider/lookup/actions";
import { TriageCard } from "@/components/emergency/triage-card";
import { CareAccessPanel } from "@/components/provider/care-access-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Mode = "national_id" | "email";

function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Search />
      {pending ? "Searching…" : "Look up record"}
    </Button>
  );
}

export function NationalIdLookupForm() {
  const [state, formAction] = useActionState<LookupState, FormData>(
    lookupPatient,
    { status: "idle" },
  );
  const [mode, setMode] = useState<Mode>("national_id");

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="surface flex flex-col gap-4 p-6">
        <input type="hidden" name="mode" value={mode} />

        <div
          role="tablist"
          aria-label="Lookup by"
          className="inline-flex w-fit rounded-lg border border-border bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "national_id"}
            onClick={() => setMode("national_id")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "national_id"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            National ID
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "email"}
            onClick={() => setMode("email")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "email"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Email
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="query">
            {mode === "national_id" ? "Patient national ID" : "Patient email"}
          </Label>
          <Input
            id="query"
            name="query"
            type={mode === "email" ? "email" : "text"}
            inputMode={mode === "email" ? "email" : "text"}
            autoComplete="off"
            className={mode === "national_id" ? "tabular" : undefined}
            placeholder={mode === "national_id" ? "e.g. 1234567890" : "patient@example.com"}
            aria-describedby="lookup_hint"
          />
          <p id="lookup_hint" className="text-sm text-muted-foreground">
            Use this only when no QR code is available. Every lookup is logged
            and shown to the patient.
          </p>
        </div>
        <SearchButton />

        {state.status === "error" && (
          <Alert variant="critical" aria-live="assertive">
            <SearchX />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
      </form>

      {state.status === "not_found" && (
        <Alert variant="default">
          {mode === "email" ? <Mail /> : <SearchX />}
          <AlertTitle>No matching record found</AlertTitle>
          <AlertDescription>
            No Beacon record matches that {mode === "email" ? "email" : "national ID"}.
            Check it, or ask for the patient&apos;s QR code.
          </AlertDescription>
        </Alert>
      )}

      {state.status === "disabled" && (
        <Alert variant="caution">
          <ShieldOff />
          <AlertTitle>Emergency access is paused</AlertTitle>
          <AlertDescription>
            This person has paused emergency access to their record. Please use
            another way to obtain their information.
          </AlertDescription>
        </Alert>
      )}

      {state.status === "ok" && (
        <>
          <TriageCard data={state.view} />
          <CareAccessPanel
            patientUserId={state.patient_user_id}
            careAccessStatus={state.care_access_status}
            view={state.view}
          />
        </>
      )}
    </div>
  );
}
