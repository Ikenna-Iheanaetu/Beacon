"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  requestAffiliation,
  type AffiliationState,
} from "@/app/provider/institution/actions";
import { FACILITY_TYPES } from "@/lib/validation";
import type { FacilityType } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const FACILITY_LABEL = new Map(FACILITY_TYPES.map((f) => [f.value, f.label]));

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Send />
      {pending ? "Sending…" : "Request affiliation"}
    </Button>
  );
}

export function AffiliationRequestForm({
  institutions,
}: {
  institutions: { id: string; name: string; facility_type: FacilityType }[];
}) {
  const [state, formAction] = useActionState<AffiliationState, FormData>(
    requestAffiliation,
    {},
  );
  const lastOk = useRef(false);

  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      toast.success("Affiliation request sent.");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert variant="critical" aria-live="assertive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="institution_id">Facility</Label>
        <select
          id="institution_id"
          name="institution_id"
          required
          defaultValue=""
          className="border-input bg-card focus-visible:ring-ring flex min-h-11 w-full rounded-[var(--radius)] border px-3 py-2 text-base shadow-sm focus:outline-none focus-visible:ring-2"
        >
          <option value="" disabled>
            Choose a verified facility…
          </option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({FACILITY_LABEL.get(i.facility_type) ?? i.facility_type})
            </option>
          ))}
        </select>
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
