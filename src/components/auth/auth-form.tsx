"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  signInAction,
  signUpAction,
  type AuthState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";

function Required() {
  return (
    <>
      <span aria-hidden className="text-critical">
        {" "}
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Just a moment…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  role = "patient",
  next,
}: {
  mode: "login" | "signup";
  role?: "patient" | "provider";
  next?: string;
}) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction] = useActionState<AuthState, FormData>(action, {});
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {role === "provider" && <input type="hidden" name="role" value="provider" />}
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && (
        <Alert variant="critical" aria-live="assertive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {isSignup && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="full_name">
            Full name
            <Required />
          </Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            required
            placeholder="Jordan Rivera"
          />
        </div>
      )}

      {isSignup && role === "provider" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="license_number">
            Medical license number
            <Required />
          </Label>
          <Input
            id="license_number"
            name="license_number"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
            className="tabular"
            placeholder="e.g. MDCN-123456"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">
          Email
          <Required />
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">
            Password
            <Required />
          </Label>
          {!isSignup && (
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:underline"
            >
              Forgot?
            </Link>
          )}
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={8}
          aria-describedby={isSignup ? "password-hint" : undefined}
          placeholder={isSignup ? "Create a password" : "Your password"}
        />
        {isSignup && (
          <p id="password-hint" className="text-sm text-muted-foreground">
            Use at least 8 characters.
          </p>
        )}
      </div>

      <div className="mt-1">
        <SubmitButton label={isSignup ? "Create account" : "Sign in"} />
      </div>
    </form>
  );
}
