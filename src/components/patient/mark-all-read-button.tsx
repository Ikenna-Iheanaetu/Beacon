"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllNotificationsRead } from "@/app/(patient)/notifications/actions";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => markAllNotificationsRead())}
    >
      <CheckCheck />
      {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
