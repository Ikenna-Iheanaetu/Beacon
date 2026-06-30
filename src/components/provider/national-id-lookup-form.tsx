"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Search, SearchX, ShieldOff } from "lucide-react";
import {
  lookupNationalId,
  type LookupState,
} from "@/app/provider/lookup/actions";
import { TriageCard } from "@/components/emergency/triage-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    lookupNationalId,
    { status: "idle" },
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="surface flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="national_id">Patient national ID</Label>
          <Input
            id="national_id"
            name="national_id"
            autoComplete="off"
            className="tabular"
            placeholder="e.g. 1234567890"
            aria-describedby="national_id_hint"
          />
          <p id="national_id_hint" className="text-sm text-muted-foreground">
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
          <SearchX />
          <AlertTitle>No record found for that ID</AlertTitle>
          <AlertDescription>
            No Beacon record matches that national ID. Check the number, or ask
            for the patient&apos;s QR code.
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

      {state.status === "ok" && <TriageCard data={state.view} />}
    </div>
  );
}
