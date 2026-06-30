"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, signupSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-guard";

export interface AuthState {
  error?: string;
  /** Set by requestPasswordReset — always true so we never reveal if the email exists. */
  sent?: boolean;
}

/** Sign up a patient or provider. Role comes from a hidden form field. */
export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const role = formData.get("role") === "provider" ? "provider" : "patient";

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  // Doctors capture a license number at signup; it's carried in metadata so the
  // /provider/verify page can prefill it (the document upload happens there).
  const licenseNumber =
    role === "provider" ? String(formData.get("license_number") ?? "").trim() : "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        role,
        full_name: parsed.data.full_name,
        ...(role === "provider" ? { license_number: licenseNumber } : {}),
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Provider self-registration always lands in the pending state.
  if (role === "provider") {
    redirect("/provider/pending");
  }

  // If email confirmation is on, there's no session yet.
  if (!data.session) {
    redirect("/login?check_email=1");
  }

  redirect("/dashboard");
}

/** Sign in. Routes by role and honours a `next` target (e.g. an /e/<token>). */
export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  await checkRateLimit(`login:${formData.get("email") ?? "unknown"}`, 5);

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password" };
  }

  const next = (formData.get("next") as string) || "";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Generic message — don't reveal whether the email exists.
    return { error: "That email or password didn't match. Please try again." };
  }

  if (next.startsWith("/")) {
    redirect(next);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Admins (allowlist) land on the admin dashboard.
  if (await isAdmin()) redirect("/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  redirect(profile?.role === "provider" ? "/provider" : "/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Send a password-reset email. Always reports success (no email enumeration). */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  await checkRateLimit(`reset:${formData.get("email") ?? "unknown"}`, 5);

  const parsed = z.email().safeParse(formData.get("email"));
  if (parsed.success) {
    const supabase = await createClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  }
  return { sent: true };
}

/** Set a new password using the recovery session established by the email link. */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Use at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "We couldn't update your password. Please try again." };
  }

  redirect("/dashboard");
}
