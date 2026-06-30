import Link from "next/link";
import {
  ArrowRight,
  Droplet,
  HeartPulse,
  LayoutDashboard,
  Lock,
  QrCode,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    n: "01",
    icon: Lock,
    title: "Encrypted by default",
    body: "Allergies, medications, and conditions are encrypted before they're ever stored. A database leak reveals nothing readable.",
  },
  {
    n: "02",
    icon: QrCode,
    title: "One scan in an emergency",
    body: "Carry a single code. An approved responder scans it and sees exactly what they need — fast, and nothing more.",
  },
  {
    n: "03",
    icon: ScrollText,
    title: "You see every access",
    body: "Each time your record is opened it's logged. Open your access log any time to see who looked, and when.",
  },
];

export default async function LandingPage() {
  const session = await getCurrentProfile();
  const isProvider = session?.profile.role === "provider";
  const homeHref = isProvider ? "/provider" : "/dashboard";
  const homeLabel = isProvider ? "Provider home" : "Dashboard";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-aurora">
      <div className="grain absolute inset-0" aria-hidden />

      {/* Nav */}
      <header className="relative z-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
          <Brand href="/" showCaption />
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild size="sm">
                <Link href={homeHref}>
                  <LayoutDashboard />
                  {homeLabel}
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="beacon-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50/70 px-3 py-1 text-xs font-medium text-primary-800">
              <ShieldCheck className="size-3.5" />
              Digital health passport
            </span>
            <h1 className="font-display mt-5 text-[2.75rem] font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl">
              Your medical story,{" "}
              <span className="text-brand-gradient italic">ready</span> the
              moment it matters.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Beacon keeps the few facts a responder needs — blood group,
              allergies, medications — encrypted, carried as a QR code, and
              shared only with people you can trust.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {session ? (
                <Button asChild size="lg">
                  <Link href={homeHref}>
                    Go to {homeLabel.toLowerCase()}
                    <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/signup">
                      Create your passport
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/provider/signup">
                      <ShieldCheck />
                      I&apos;m a doctor
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Free to set up · Encrypted end to end · You control every access
            </p>
          </div>

          {/* The signature: a passport-style emergency card mockup. */}
          <div className="beacon-rise [animation-delay:120ms]" aria-hidden>
            <PassportMock />
          </div>
        </section>

        {/* Features as document sections */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-24">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
              Built like a document you can trust.
            </h2>
            <span className="data-label hidden text-primary-400 sm:block">
              How it works
            </span>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {FEATURES.map(({ n, icon: Icon, title, body }) => (
              <article
                key={n}
                className="group surface relative overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
              >
                {/* Oversized watermark numeral */}
                <span
                  className="font-display pointer-events-none absolute -right-2 -top-4 select-none text-[6rem] font-semibold leading-none text-primary-100/70 transition-colors group-hover:text-primary-200/70"
                  aria-hidden
                >
                  {n}
                </span>
                <span className="relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-primary-foreground shadow-[0_6px_16px_-4px_rgba(13,148,136,0.5)]">
                  <Icon className="size-6" strokeWidth={2.2} />
                </span>
                <h3 className="font-display relative mt-6 text-xl font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
                <span
                  className="bg-primary-600 absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  aria-hidden
                />
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <Brand href={null} />
          <div className="flex flex-col gap-1 sm:items-end">
            <p>A digital health passport prototype.</p>
            <p>
              Designed &amp; built by{" "}
              <span className="font-medium text-foreground">Ijeoma</span>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Decorative emergency-ID card showing the product's visual language. */
function PassportMock() {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary-200/40 blur-2xl" />
      <div className="surface-lift bg-guilloche overflow-hidden rounded-[1.5rem] [transform:rotate(1.5deg)]">
        <div className="flex items-center justify-between bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 text-primary-foreground">
          <span className="flex items-center gap-2">
            <HeartPulse className="size-4" strokeWidth={2.4} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Emergency Medical ID
            </span>
          </span>
          <span className="font-mono text-[0.65rem] opacity-80">BEACON</span>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-xl border-2 border-critical/30 bg-critical/5 p-4">
            <div className="flex items-center gap-1.5">
              <TriangleAlert className="size-4 text-critical" />
              <span className="data-label !text-critical">Allergies</span>
            </div>
            <p className="mt-1 font-display text-2xl font-semibold text-foreground">
              Penicillin · Peanuts
            </p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <Droplet className="size-3.5 text-critical" />
                <span className="data-label">Blood group</span>
              </div>
              <p className="data-value mt-0.5 text-5xl font-bold">O−</p>
            </div>
            <div className="grid size-20 shrink-0 place-items-center rounded-lg border border-border bg-card">
              <QrCode className="size-14 text-primary-900" strokeWidth={1.2} />
            </div>
          </div>

          <div className="rule-dotted grid grid-cols-2 gap-4 pt-4">
            <div>
              <span className="data-label">Medications</span>
              <p className="mt-0.5 text-sm text-foreground">Metformin 500mg</p>
            </div>
            <div>
              <span className="data-label">Contact</span>
              <p className="data-value mt-0.5 text-sm">+234 800 000 0000</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
