"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  submitInstitutionVerification,
  type VerifyState,
} from "@/app/institution/verify/actions";
import { FACILITY_TYPES, LICENSE_FILE_TYPES } from "@/lib/validation";
import type { InstitutionRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileInput } from "@/components/ui/file-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <ShieldCheck />
      {pending ? "Submitting…" : "Submit for verification"}
    </Button>
  );
}

export function InstitutionVerifyForm({
  defaults,
}: {
  defaults?: Partial<InstitutionRow> & { name?: string };
}) {
  const [state, formAction] = useActionState<VerifyState, FormData>(
    submitInstitutionVerification,
    {},
  );
  const lastOk = useRef(false);

  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      toast.success("Registration submitted. We'll review it shortly.");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <Alert variant="critical" aria-live="assertive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Facility name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          autoCapitalize="words"
          required
          defaultValue={defaults?.name ?? ""}
          placeholder="e.g. Lagoon General Hospital"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="facility_type">Facility type</Label>
        <select
          id="facility_type"
          name="facility_type"
          required
          defaultValue={defaults?.facility_type ?? "hospital"}
          className="border-input bg-card focus-visible:ring-ring flex min-h-11 w-full rounded-[var(--radius)] border px-3 py-2 text-base shadow-sm focus:outline-none focus-visible:ring-2"
        >
          {FACILITY_TYPES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-border bg-background/40 p-4">
        <legend className="data-label px-1">Registry identifiers</legend>
        <p className="-mt-1 text-sm text-muted-foreground">
          Provide at least one facility registry number. These are checked
          against the Nigerian health-facility registries.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nhfr_code">
            NHFR code{" "}
            <span className="font-normal text-muted-foreground">
              (National Health Facility Registry)
            </span>
          </Label>
          <Input
            id="nhfr_code"
            name="nhfr_code"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="tabular"
            defaultValue={defaults?.nhfr_code ?? ""}
            placeholder="e.g. 24/01/3/1/0001"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="state_moh_reg_no">
            State MoH / HEFAMAA registration no.
          </Label>
          <Input
            id="state_moh_reg_no"
            name="state_moh_reg_no"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="tabular"
            defaultValue={defaults?.state_moh_reg_no ?? ""}
            placeholder="e.g. LSH/2287"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cac_rc_number">
            CAC RC number{" "}
            <span className="font-normal text-muted-foreground">
              (Corporate Affairs Commission)
            </span>
          </Label>
          <Input
            id="cac_rc_number"
            name="cac_rc_number"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="tabular"
            defaultValue={defaults?.cac_rc_number ?? ""}
            placeholder="e.g. RC1234567"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-border bg-background/40 p-4">
        <legend className="data-label px-1">Medical Director</legend>
        <p className="-mt-1 text-sm text-muted-foreground">
          The Medical Director must be MDCN-registered — this links your facility
          to the individual-practitioner register.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="medical_director_name">Medical Director&apos;s name</Label>
          <Input
            id="medical_director_name"
            name="medical_director_name"
            type="text"
            autoCapitalize="words"
            autoComplete="off"
            defaultValue={defaults?.medical_director_name ?? ""}
            placeholder="Dr. Jordan Rivera"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="medical_director_mdcn">
            Medical Director&apos;s MDCN number
          </Label>
          <Input
            id="medical_director_mdcn"
            name="medical_director_mdcn"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="tabular"
            defaultValue={defaults?.medical_director_mdcn ?? ""}
            placeholder="e.g. MDCN-123456"
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="registration_document">Registration document</Label>
        <FileInput
          id="registration_document"
          name="registration_document"
          accept={LICENSE_FILE_TYPES.join(",")}
          required
          hint="Facility licence / registration certificate — PDF, PNG, or JPEG, up to 5 MB."
        />
      </div>

      <div className="mt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
