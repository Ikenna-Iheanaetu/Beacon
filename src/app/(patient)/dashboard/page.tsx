import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Pencil,
  QrCode,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOwnMedicalProfileDecrypted, profileCompleteness } from "@/lib/medical";
import { qrDataUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SavedToast } from "@/components/patient/saved-toast";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getOwnMedicalProfileDecrypted();
  const { complete, filled, total } = profileCompleteness(profile);

  const supabase = await createClient();
  const { data: logs } = profile
    ? await supabase
        .from("access_logs")
        .select("id, access_type, created_at")
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const qr = profile ? await qrDataUrl(profile.qr_token) : null;

  return (
    <div className="flex flex-col gap-6">
      {sp.saved && <SavedToast />}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your passport complete so it&apos;s ready when it matters.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Completeness */}
        <Card>
          <CardHeader>
            <CardTitle>Is my passport complete?</CardTitle>
            <CardDescription>
              {filled} of {total} details filled in.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {complete ? (
              <Badge variant="safe" className="w-fit">
                <CheckCircle2 />
                Complete
              </Badge>
            ) : (
              <Badge variant="caution" className="w-fit">
                <CircleAlert />
                {profile ? "A few details missing" : "Not started yet"}
              </Badge>
            )}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((filled / total) * 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/profile/edit">
                  <Pencil />
                  {profile ? "Edit profile" : "Create profile"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/access-log">
                  <ClipboardList />
                  Access log
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR preview */}
        <Card>
          <CardHeader>
            <CardTitle>Your emergency QR code</CardTitle>
            <CardDescription>
              A responder scans this to see your critical information.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qr ? (
              <>
                <Image
                  src={qr}
                  alt="Your Beacon emergency QR code"
                  width={180}
                  height={180}
                  className="rounded-lg border border-border"
                  unoptimized
                />
                <Button asChild variant="outline">
                  <Link href="/qr">
                    <QrCode />
                    View &amp; download
                  </Link>
                </Button>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Create your profile to generate a QR code.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent access */}
      <Card>
        <CardHeader>
          <CardTitle>Who has seen my record?</CardTitle>
          <CardDescription>
            Every emergency access is logged here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="text-foreground">
                    Emergency view by a verified provider
                  </span>
                  <span className="tabular text-muted-foreground">
                    {formatWhen(log.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              No one has accessed your record yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
