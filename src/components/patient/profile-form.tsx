"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CalendarDays,
  Droplet,
  HeartHandshake,
  NotebookPen,
  Phone,
  Pill,
  Stethoscope,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import {
  saveMedicalProfile,
  type SaveState,
} from "@/app/(patient)/profile/edit/actions";
import { BLOOD_GROUPS, SEX_OPTIONS, ORGAN_DONOR_OPTIONS } from "@/lib/validation";
import type { DecryptedMedicalProfile } from "@/lib/medical";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Section({
  n,
  icon,
  title,
  description,
  children,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
          {icon}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <span className="data-label text-primary-300">{n}</span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Saving…" : "Save passport"}
    </Button>
  );
}

export function ProfileForm({
  initial,
}: {
  initial: DecryptedMedicalProfile | null;
}) {
  const [state, formAction] = useActionState<SaveState, FormData>(
    saveMedicalProfile,
    {},
  );

  const organDonorDefault =
    initial?.organ_donor === true
      ? "yes"
      : initial?.organ_donor === false
        ? "no"
        : "unknown";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <Alert variant="critical" aria-live="assertive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* 01 — About you */}
      <Section
        n="01"
        icon={<CalendarDays className="size-5" />}
        title="About you"
        description="The basics a responder reads first."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="date_of_birth" label="Date of birth">
            <Input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              className="tabular"
              defaultValue={initial?.date_of_birth ?? ""}
            />
          </Field>
          <Field htmlFor="sex" label="Sex">
            <Select name="sex" defaultValue={initial?.sex ?? undefined}>
              <SelectTrigger id="sex">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {SEX_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field htmlFor="blood_group" label="Blood group">
            <Select
              name="blood_group"
              defaultValue={initial?.blood_group ?? "unknown"}
            >
              <SelectTrigger id="blood_group" className="tabular">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((g) => (
                  <SelectItem key={g} value={g} className="tabular">
                    {g === "unknown" ? "Unknown" : g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field htmlFor="organ_donor" label="Organ donor">
            <Select name="organ_donor" defaultValue={organDonorDefault}>
              <SelectTrigger id="organ_donor">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {ORGAN_DONOR_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="rule-dotted pt-4">
          <Field
            htmlFor="national_id"
            label="National ID (required)"
            hint="Lets an approved doctor pull up your record by ID if your QR code isn't to hand. Stored encrypted."
          >
            <Input
              id="national_id"
              name="national_id"
              autoComplete="off"
              required
              className="tabular"
              defaultValue={initial?.national_id ?? ""}
              placeholder="e.g. 1234567890"
            />
          </Field>
        </div>
      </Section>

      {/* 02 — Allergies */}
      <Section
        n="02"
        icon={<TriangleAlert className="size-5" />}
        title="Allergies"
        description="List anything you're allergic to — medicines, foods, materials."
      >
        <Field
          htmlFor="allergies"
          label="Allergies"
          hint="Add your allergies so they're there in an emergency."
        >
          <Textarea
            id="allergies"
            name="allergies"
            defaultValue={initial?.allergies ?? ""}
            placeholder="e.g. Penicillin, peanuts, latex"
          />
        </Field>
      </Section>

      {/* 03 — Medications */}
      <Section
        n="03"
        icon={<Pill className="size-5" />}
        title="Current medications"
        description="Medicines you take regularly, with doses if you know them."
      >
        <Field htmlFor="medications" label="Medications">
          <Textarea
            id="medications"
            name="medications"
            defaultValue={initial?.medications ?? ""}
            placeholder="e.g. Metformin 500mg twice daily"
          />
        </Field>
      </Section>

      {/* 04 — Conditions */}
      <Section
        n="04"
        icon={<Stethoscope className="size-5" />}
        title="Medical conditions"
        description="Ongoing conditions a clinician should know about."
      >
        <Field htmlFor="medical_conditions" label="Conditions">
          <Textarea
            id="medical_conditions"
            name="medical_conditions"
            defaultValue={initial?.medical_conditions ?? ""}
            placeholder="e.g. Type 2 diabetes, high blood pressure"
          />
        </Field>
      </Section>

      {/* 05 — Other notes */}
      <Section
        n="05"
        icon={<NotebookPen className="size-5" />}
        title="Anything else"
        description="Other things a responder should know."
      >
        <Field
          htmlFor="additional_notes"
          label="Notes"
          hint="e.g. has a pacemaker, pregnant, uses a wheelchair, DNR wishes."
        >
          <Textarea
            id="additional_notes"
            name="additional_notes"
            defaultValue={initial?.additional_notes ?? ""}
            placeholder="Anything that doesn't fit above"
          />
        </Field>
      </Section>

      {/* 06 — Emergency contacts */}
      <Section
        n="06"
        icon={<UserRound className="size-5" />}
        title="Emergency contacts"
        description="People we can point a responder to."
      >
        <p className="data-label">Primary contact</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="emergency_contact_name" label="Name">
            <Input
              id="emergency_contact_name"
              name="emergency_contact_name"
              defaultValue={initial?.emergency_contact_name ?? ""}
              placeholder="Sam Rivera"
            />
          </Field>
          <Field htmlFor="emergency_contact_relationship" label="Relationship">
            <Input
              id="emergency_contact_relationship"
              name="emergency_contact_relationship"
              defaultValue={initial?.emergency_contact_relationship ?? ""}
              placeholder="Sister"
            />
          </Field>
          <Field htmlFor="emergency_contact_phone" label="Phone">
            <Input
              id="emergency_contact_phone"
              name="emergency_contact_phone"
              type="tel"
              inputMode="tel"
              className="tabular"
              defaultValue={initial?.emergency_contact_phone ?? ""}
              placeholder="+234 800 000 0000"
            />
          </Field>
        </div>

        <p className="data-label mt-2 rule-dotted pt-4">Second contact (optional)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="emergency_contact_2_name" label="Name">
            <Input
              id="emergency_contact_2_name"
              name="emergency_contact_2_name"
              defaultValue={initial?.emergency_contact_2_name ?? ""}
              placeholder="Alex Rivera"
            />
          </Field>
          <Field htmlFor="emergency_contact_2_relationship" label="Relationship">
            <Input
              id="emergency_contact_2_relationship"
              name="emergency_contact_2_relationship"
              defaultValue={initial?.emergency_contact_2_relationship ?? ""}
              placeholder="Partner"
            />
          </Field>
          <Field htmlFor="emergency_contact_2_phone" label="Phone">
            <Input
              id="emergency_contact_2_phone"
              name="emergency_contact_2_phone"
              type="tel"
              inputMode="tel"
              className="tabular"
              defaultValue={initial?.emergency_contact_2_phone ?? ""}
              placeholder="+234 800 000 0000"
            />
          </Field>
        </div>
      </Section>

      {/* 07 — Primary doctor */}
      <Section
        n="07"
        icon={<HeartHandshake className="size-5" />}
        title="Doctor & hospital"
        description="Who looks after you day to day — shown to anyone who scans your emergency code."
      >
        <Field
          htmlFor="current_hospital_name"
          label="Current hospital (optional)"
          hint="If you're currently admitted or under care somewhere, name it here."
        >
          <Input
            id="current_hospital_name"
            name="current_hospital_name"
            defaultValue={initial?.current_hospital_name ?? ""}
            placeholder="e.g. Lagoon General Hospital"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="primary_physician_name" label="Doctor's name">
            <Input
              id="primary_physician_name"
              name="primary_physician_name"
              defaultValue={initial?.primary_physician_name ?? ""}
              placeholder="Dr. Adaeze Okoro"
            />
          </Field>
          <Field htmlFor="primary_physician_phone" label="Doctor's phone">
            <Input
              id="primary_physician_phone"
              name="primary_physician_phone"
              type="tel"
              inputMode="tel"
              className="tabular"
              defaultValue={initial?.primary_physician_phone ?? ""}
              placeholder="+234 800 000 0000"
            />
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 px-5 py-3 shadow-lg backdrop-blur-md">
        <p className="hidden text-sm text-muted-foreground sm:block">
          Your allergies, medications, conditions and notes are encrypted before
          saving.
        </p>
        <SaveButton />
      </div>
    </form>
  );
}
