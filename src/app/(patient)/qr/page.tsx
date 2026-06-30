import Link from "next/link";
import Image from "next/image";
import { HeartPulse, ScanLine } from "lucide-react";
import { getOwnMedicalProfile } from "@/lib/medical";
import { emergencyUrl, qrDataUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { QrActions } from "@/components/patient/qr-actions";
import { EmergencyAccessToggle } from "@/components/patient/emergency-access-toggle";
import { RecordExport } from "@/components/patient/record-export";

export default async function QrPage() {
  const profile = await getOwnMedicalProfile();

  if (!profile) {
    return (
      <div className="surface mx-auto w-full max-w-md p-10 text-center">
        <ScanLine className="mx-auto size-10 text-muted-foreground/40" />
        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
          Your QR code
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your health passport first and we&apos;ll generate a code you
          can carry.
        </p>
        <Button asChild className="mt-6">
          <Link href="/profile/edit">Create your profile</Link>
        </Button>
      </div>
    );
  }

  const dataUrl = await qrDataUrl(profile.qr_token);
  const url = emergencyUrl(profile.qr_token);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-7">
      <header className="beacon-rise">
        <span className="data-label text-primary-400">Carry this with you</span>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
          Your emergency code
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Print it on a card, save it to your wallet, or stick it on your phone
          case. A responder scans it to see your critical information.
        </p>
      </header>

      {/* The printable ID card */}
      <div className="beacon-rise [animation-delay:80ms] surface-lift bg-guilloche overflow-hidden print:shadow-none">
        <div className="flex items-center justify-between bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 text-primary-foreground">
          <span className="flex items-center gap-2">
            <HeartPulse className="size-4" strokeWidth={2.4} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Emergency Medical ID
            </span>
          </span>
          <span className="font-mono text-[0.65rem] opacity-80">BEACON</span>
        </div>

        <div className="flex flex-col items-center gap-4 p-8">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Image
              src={dataUrl}
              alt="Your Beacon emergency QR code"
              width={232}
              height={232}
              className="rounded-lg"
              unoptimized
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Scan in an emergency, or open:
          </p>
          <p className="data-value rule-dotted w-full break-all pt-3 text-center text-xs text-muted-foreground">
            {url}
          </p>
        </div>
      </div>

      <div className="print:hidden flex flex-col gap-5">
        <EmergencyAccessToggle enabled={profile.emergency_access_enabled} />
        <QrActions dataUrl={dataUrl} />
        <RecordExport />
      </div>
    </div>
  );
}
