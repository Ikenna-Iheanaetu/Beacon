"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  restoreAccount,
  restrictAccount,
  type RestrictState,
} from "@/app/admin/restrict-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

function useToastOnError(state: RestrictState) {
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.error && state.error !== last.current) {
      last.current = state.error;
      toast.error(state.error);
    }
  }, [state]);
}

function RestrictInner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="critical" size="sm" disabled={pending}>
      <ShieldOff />
      {pending ? "Restricting…" : "Restrict"}
    </Button>
  );
}

function RestoreInner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <ShieldCheck />
      {pending ? "Restoring…" : "Restore access"}
    </Button>
  );
}

/**
 * Suspend or restore any account (patient, provider, or institution) from
 * wherever an admin is already looking at it — the approvals page, or a
 * Find-a-record result. Restricting signs the account out everywhere and
 * blocks it from signing back in until an admin restores it.
 */
export function RestrictControl({
  userId,
  name,
  isRestricted,
}: {
  userId: string;
  name: string;
  isRestricted: boolean;
}) {
  const [restrictState, restrictFormAction] = useActionState<RestrictState, FormData>(
    restrictAccount,
    {},
  );
  const [restoreState, restoreFormAction] = useActionState<RestrictState, FormData>(
    restoreAccount,
    {},
  );
  const [open, setOpen] = useState(false);

  useToastOnError(restrictState);
  useToastOnError(restoreState);

  // Both forms return {} on success — a `submitted` ref distinguishes "just
  // succeeded" from "hasn't been submitted yet" (initial state is also {}).
  const restrictSubmitted = useRef(false);
  useEffect(() => {
    if (restrictSubmitted.current && !restrictState.error) {
      restrictSubmitted.current = false;
      setOpen(false);
      toast.success(`${name}'s account is restricted.`);
    }
  }, [restrictState, name]);

  const restoreSubmitted = useRef(false);
  useEffect(() => {
    if (restoreSubmitted.current && !restoreState.error) {
      restoreSubmitted.current = false;
      toast.success(`${name}'s access is restored.`);
    }
  }, [restoreState, name]);

  if (isRestricted) {
    return (
      <form
        action={restoreFormAction}
        onSubmit={() => {
          restoreSubmitted.current = true;
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <RestoreInner />
      </form>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldOff />
          Restrict
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restrict {name}&apos;s account</DialogTitle>
          <DialogDescription>
            Signs them out of every device right now and blocks sign-in until
            an admin restores access. Add a reason — it&apos;s recorded in the
            audit log.
          </DialogDescription>
        </DialogHeader>
        <form
          action={restrictFormAction}
          onSubmit={() => {
            restrictSubmitted.current = true;
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="userId" value={userId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`restrict-reason-${userId}`}>Reason</Label>
            <Textarea
              id={`restrict-reason-${userId}`}
              name="reason"
              placeholder="e.g. Reported for sharing login credentials."
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <RestrictInner />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
