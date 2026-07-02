"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  approveCareAccess,
  rejectCareAccess,
  revokeCareAccess,
  type CareAccessDecisionState,
} from "@/app/(patient)/care-access/actions";
import { Button } from "@/components/ui/button";

function useToastOnError(state: CareAccessDecisionState) {
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.error && state.error !== last.current) {
      last.current = state.error;
      toast.error(state.error);
    }
  }, [state]);
}

function ApproveInner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <CheckCircle2 />
      {pending ? "Approving…" : "Approve"}
    </Button>
  );
}

function RejectInner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <XCircle />
      {pending ? "Declining…" : "Decline"}
    </Button>
  );
}

export function PendingRequestActions({ requestId }: { requestId: string }) {
  const [approveState, approveAction] = useActionState<
    CareAccessDecisionState,
    FormData
  >(approveCareAccess, {});
  const [rejectState, rejectAction] = useActionState<
    CareAccessDecisionState,
    FormData
  >(rejectCareAccess, {});

  useToastOnError(approveState);
  useToastOnError(rejectState);

  return (
    <div className="flex gap-2">
      <form action={approveAction}>
        <input type="hidden" name="request_id" value={requestId} />
        <ApproveInner />
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="request_id" value={requestId} />
        <RejectInner />
      </form>
    </div>
  );
}

function RevokeInner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="critical" size="sm" disabled={pending}>
      <XCircle />
      {pending ? "Revoking…" : "Revoke access"}
    </Button>
  );
}

export function RevokeAccessButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<CareAccessDecisionState, FormData>(
    revokeCareAccess,
    {},
  );
  useToastOnError(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="request_id" value={requestId} />
      <RevokeInner />
    </form>
  );
}
