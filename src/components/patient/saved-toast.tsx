"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Fires a one-time "Profile saved" toast when arriving from a save redirect. */
export function SavedToast() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    toast.success("Profile saved");
    // Clean the query string so a refresh doesn't re-fire it.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return null;
}
