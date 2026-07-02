"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Clock, PenLine, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  requestCareAccess,
  submitClinicalEdit,
  type CareAccessState,
  type ClinicalEditState,
} from "@/app/provider/lookup/actions";
import type { EmergencyView } from "@/lib/emergency";
import type { CareAccessStatus } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function RequestButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Send />
      {pending ? "Sending…" : "Request edit access"}
    </Button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <PenLine />
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

function RequestAccessForm({ patientUserId }: { patientUserId: string }) {
  const [state, formAction] = useActionState<CareAccessState, FormData>(
    requestCareAccess,
    {},
  );
  const lastOk = useRef(false);

  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      toast.success("Request sent. The patient will need to approve it.");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="patient_user_id" value={patientUserId} />
      <p className="text-sm text-muted-foreground">
        To edit this patient&apos;s allergies, medications, conditions, or
        notes, ask them to approve you first.
      </p>
      {state.error && (
        <Alert variant="critical">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div>
        <RequestButton />
      </div>
    </form>
  );
}

function ClinicalEditForm({
  patientUserId,
  view,
}: {
  patientUserId: string;
  view: EmergencyView;
}) {
  const [state, formAction] = useActionState<ClinicalEditState, FormData>(
    submitClinicalEdit,
    {},
  );
  const lastOk = useRef(false);

  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      toast.success("Saved. The patient is notified of this change.");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="patient_user_id" value={patientUserId} />
      {state.error && (
        <Alert variant="critical">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="allergies">Allergies</Label>
        <Textarea
          id="allergies"
          name="allergies"
          defaultValue={view.allergies}
          placeholder="e.g. Penicillin, peanuts, latex"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="medications">Medications</Label>
        <Textarea
          id="medications"
          name="medications"
          defaultValue={view.medications}
          placeholder="e.g. Metformin 500mg twice daily"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="medical_conditions">Medical conditions</Label>
        <Textarea
          id="medical_conditions"
          name="medical_conditions"
          defaultValue={view.medical_conditions}
          placeholder="e.g. Type 2 diabetes, high blood pressure"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="additional_notes">Other notes</Label>
        <Textarea
          id="additional_notes"
          name="additional_notes"
          defaultValue={view.additional_notes}
          placeholder="Anything else a responder should know"
        />
      </div>

      <div>
        <SaveButton />
      </div>
    </form>
  );
}

export function CareAccessPanel({
  patientUserId,
  careAccessStatus,
  view,
}: {
  patientUserId: string;
  careAccessStatus: CareAccessStatus | null;
  view: EmergencyView;
}) {
  return (
    <Card className="mx-auto mt-4 w-full max-w-xl">
      <CardHeader>
        <CardTitle>Edit access</CardTitle>
      </CardHeader>
      <CardContent>
        {careAccessStatus === "approved" && (
          <ClinicalEditForm patientUserId={patientUserId} view={view} />
        )}

        {careAccessStatus === "pending" && (
          <Alert variant="caution">
            <Clock />
            <AlertTitle>Request pending</AlertTitle>
            <AlertDescription>
              Waiting for the patient to approve your access request.
            </AlertDescription>
          </Alert>
        )}

        {(careAccessStatus === "rejected" || careAccessStatus === "revoked") && (
          <div className="flex flex-col gap-3">
            <Alert variant="critical">
              <XCircle />
              <AlertTitle>
                {careAccessStatus === "rejected"
                  ? "Request declined"
                  : "Access revoked"}
              </AlertTitle>
              <AlertDescription>
                You can ask again if circumstances have changed.
              </AlertDescription>
            </Alert>
            <RequestAccessForm patientUserId={patientUserId} />
          </div>
        )}

        {careAccessStatus === null && (
          <RequestAccessForm patientUserId={patientUserId} />
        )}
      </CardContent>
    </Card>
  );
}
