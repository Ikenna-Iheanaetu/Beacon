import {
  Building2,
  Droplet,
  HeartHandshake,
  HeartPulse,
  NotebookPen,
  Phone,
  Pill,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import type { EmergencyContact, EmergencyView } from "@/lib/emergency";
import type { Sex } from "@/lib/database.types";

function rise(index: number): React.CSSProperties {
  return { animationDelay: `${index * 60}ms` };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const SEX_LABELS: Record<Sex, string> = {
  female: "Female",
  male: "Male",
  intersex: "Intersex",
  prefer_not_to_say: "—",
  unknown: "—",
};

function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 140 ? a : null;
}

export function TriageCard({ data }: { data: EmergencyView }) {
  const hasAllergies = data.allergies.trim().length > 0;
  const age = ageFrom(data.date_of_birth);
  const sexLabel = data.sex ? SEX_LABELS[data.sex] : null;
  const organ =
    data.organ_donor === true ? "Yes" : data.organ_donor === false ? "No" : "—";

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="surface-lift bg-guilloche overflow-hidden">
        <header
          className="beacon-rise flex items-center justify-between bg-gradient-to-r from-primary-800 to-primary-600 px-6 py-4 text-primary-foreground"
          style={rise(0)}
        >
          <span className="flex items-center gap-2">
            <HeartPulse className="size-5" strokeWidth={2.4} />
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">
              Emergency Medical ID
            </span>
          </span>
          <span className="font-mono text-xs opacity-80">BEACON</span>
        </header>

        <div className="p-5 sm:p-6">
          {data.patient_name && (
            <div className="beacon-rise mb-5" style={rise(1)}>
              <span className="data-label">Patient</span>
              <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {data.patient_name}
              </p>
            </div>
          )}

          {/* 1 — ALLERGIES: loudest when present */}
          <section
            className={`beacon-rise rounded-2xl border-2 p-5 ${
              hasAllergies
                ? "border-critical bg-critical/10"
                : "border-border bg-muted/40"
            }`}
            style={rise(2)}
          >
            <div className="flex items-center gap-2">
              <TriangleAlert
                className={`size-6 ${hasAllergies ? "text-critical" : "text-muted-foreground"}`}
                strokeWidth={2.4}
              />
              <span
                className={`text-base font-bold uppercase tracking-[0.14em] ${
                  hasAllergies ? "text-critical" : "text-muted-foreground"
                }`}
              >
                Allergies
              </span>
            </div>
            {hasAllergies ? (
              <p className="font-display mt-2 whitespace-pre-wrap text-3xl font-bold leading-tight text-foreground">
                {data.allergies}
              </p>
            ) : (
              <p className="mt-2 text-lg text-muted-foreground">
                No known allergies on file
              </p>
            )}
          </section>

          {/* 2 — BLOOD GROUP */}
          <section
            className="beacon-rise mt-4 flex items-center justify-between rounded-2xl border border-border bg-card p-5"
            style={rise(3)}
          >
            <div className="flex items-center gap-2">
              <Droplet className="size-5 text-critical" strokeWidth={2.2} />
              <span className="data-label">Blood group</span>
            </div>
            <p className="data-value text-5xl font-bold leading-none text-foreground">
              {data.blood_group === "unknown" ? "—" : data.blood_group}
            </p>
          </section>

          {/* About strip: age / sex / organ donor */}
          <section
            className="beacon-rise mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-5"
            style={rise(4)}
          >
            <div>
              <span className="data-label">Age</span>
              <p className="data-value mt-0.5 text-xl text-foreground">
                {age ?? "—"}
              </p>
            </div>
            <div>
              <span className="data-label">Sex</span>
              <p className="mt-0.5 text-xl text-foreground">{sexLabel ?? "—"}</p>
            </div>
            <div>
              <span className="data-label">Organ donor</span>
              <p className="mt-0.5 text-xl text-foreground">{organ}</p>
            </div>
          </section>

          {data.national_id && (
            <section
              className="beacon-rise mt-4 flex items-center justify-between rounded-2xl border border-border bg-card p-5"
              style={rise(4)}
            >
              <span className="data-label">National ID</span>
              <p className="data-value tabular text-lg text-foreground">
                {data.national_id}
              </p>
            </section>
          )}

          {/* 3 & 4 — MEDICATIONS / CONDITIONS */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Block
              index={5}
              icon={<Pill className="size-5 text-caution" strokeWidth={2.2} />}
              label="Current medications"
              value={data.medications}
              empty="None on file"
            />
            <Block
              index={5}
              icon={
                <Stethoscope className="size-5 text-info" strokeWidth={2.2} />
              }
              label="Medical conditions"
              value={data.medical_conditions}
              empty="None on file"
            />
          </div>

          {/* Additional notes */}
          {data.additional_notes.trim().length > 0 && (
            <Block
              index={6}
              icon={
                <NotebookPen className="size-5 text-foreground" strokeWidth={2.2} />
              }
              label="Other notes"
              value={data.additional_notes}
              empty=""
              className="mt-4"
            />
          )}

          {/* 5 — EMERGENCY CONTACTS */}
          <section
            className="beacon-rise mt-4 rounded-2xl border border-border bg-card p-5"
            style={rise(6)}
          >
            <div className="flex items-center gap-2">
              <Phone className="size-5 text-primary" strokeWidth={2.2} />
              <span className="data-label">Emergency contacts</span>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              <ContactRow contact={data.emergency_contact} />
              {(data.emergency_contact_2.name ||
                data.emergency_contact_2.phone) && (
                <div className="rule-dotted pt-3">
                  <ContactRow contact={data.emergency_contact_2} />
                </div>
              )}
              {!data.emergency_contact.name &&
                !data.emergency_contact.phone &&
                !data.emergency_contact_2.name &&
                !data.emergency_contact_2.phone && (
                  <p className="text-muted-foreground">None on file</p>
                )}
            </div>
          </section>

          {/* Current hospital */}
          {data.current_hospital_name && (
            <section
              className="beacon-rise mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-5"
              style={rise(7)}
            >
              <Building2 className="size-5 text-primary" strokeWidth={2.2} />
              <div>
                <span className="data-label">Currently at</span>
                <p className="text-foreground">{data.current_hospital_name}</p>
              </div>
            </section>
          )}

          {/* Primary doctor */}
          {(data.primary_physician.name || data.primary_physician.phone) && (
            <section
              className="beacon-rise mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
              style={rise(7)}
            >
              <div className="flex items-center gap-2">
                <HeartHandshake
                  className="size-5 text-primary"
                  strokeWidth={2.2}
                />
                <div>
                  <span className="data-label">Primary doctor</span>
                  {data.primary_physician.name && (
                    <p className="text-foreground">
                      {data.primary_physician.name}
                    </p>
                  )}
                </div>
              </div>
              {data.primary_physician.phone && (
                <a
                  href={`tel:${data.primary_physician.phone}`}
                  className="data-value text-primary underline-offset-2 hover:underline"
                >
                  {data.primary_physician.phone}
                </a>
              )}
            </section>
          )}
        </div>

        <footer
          className="beacon-rise rule-dotted flex items-center gap-1.5 px-6 py-4 text-xs text-muted-foreground"
          style={rise(8)}
        >
          <ShieldCheck className="size-3.5 shrink-0" />
          <span>
            Emergency view · accessed{" "}
            <span className="data-value">{formatTime(data.accessed_at)}</span> ·
            this access has been logged.
          </span>
        </footer>
      </div>
    </div>
  );
}

function ContactRow({ contact }: { contact: EmergencyContact }) {
  if (!contact.name && !contact.phone) return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        {contact.name && (
          <span className="text-lg font-medium text-foreground">
            {contact.name}
          </span>
        )}
        {contact.relationship && (
          <span className="ml-2 text-sm text-muted-foreground">
            {contact.relationship}
          </span>
        )}
      </div>
      {contact.phone && (
        <a
          href={`tel:${contact.phone}`}
          className="data-value text-xl text-primary underline-offset-2 hover:underline"
        >
          {contact.phone}
        </a>
      )}
    </div>
  );
}

function Block({
  index,
  icon,
  label,
  value,
  empty,
  className = "",
}: {
  index: number;
  icon: React.ReactNode;
  label: string;
  value: string;
  empty: string;
  className?: string;
}) {
  const has = value.trim().length > 0;
  return (
    <section
      className={`beacon-rise rounded-2xl border border-border bg-card p-5 ${className}`}
      style={rise(index)}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="data-label">{label}</span>
      </div>
      <p
        className={`mt-1.5 whitespace-pre-wrap ${
          has ? "text-lg text-foreground" : "text-muted-foreground"
        }`}
      >
        {has ? value : empty}
      </p>
    </section>
  );
}
