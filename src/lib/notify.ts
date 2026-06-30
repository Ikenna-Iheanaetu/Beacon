import "server-only";

/**
 * Access notifications (BUILD_SPEC §7). Pluggable seam: if RESEND_API_KEY is
 * set we send a real email via Resend; otherwise this is a no-op (so the app
 * works without an email provider configured). Swapping providers touches only
 * this file.
 */

interface AccessNotification {
  to: string;
  providerName: string;
  accessedAt: Date;
}

export async function sendAccessNotification({
  to,
  providerName,
  accessedAt,
}: AccessNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Beacon <onboarding@resend.dev>";
  if (!apiKey || !to) return; // deferred / not configured — no-op

  const when = accessedAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="font-family:Georgia,serif;color:#1a1714">Your Beacon record was opened</h2>
      <p style="color:#5b554d;line-height:1.6">
        <strong>${providerName}</strong> opened your emergency medical
        information on <strong>${when}</strong>.
      </p>
      <p style="color:#5b554d;line-height:1.6">
        If this was expected (e.g. during care), no action is needed. If not, you
        can pause emergency access or regenerate your QR code from your Beacon
        dashboard.
      </p>
      <p style="color:#8a8278;font-size:12px">Beacon — a digital health passport.</p>
    </div>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Your Beacon record was accessed",
        html,
      }),
    });
  } catch {
    // Never let a notification failure break the emergency read.
  }
}

interface RecordTransfer {
  to: string;
  patientName: string | null;
  pdf: Uint8Array;
  filename?: string;
  note?: string;
  downloadUrl?: string;
  sentBy: "patient" | "admin";
}

/**
 * Email a medical record (PDF attachment) for a referral / transfer. Pluggable
 * Resend seam — no-op when RESEND_API_KEY is unset. Returns true if sent.
 */
export async function sendRecordTransfer(opts: RecordTransfer): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Beacon <onboarding@resend.dev>";
  if (!apiKey || !opts.to) return false;

  const who = opts.patientName ? `${opts.patientName}'s` : "a patient's";
  const base64 = Buffer.from(opts.pdf).toString("base64");
  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="font-family:Georgia,serif;color:#1a1714">Beacon medical record</h2>
      <p style="color:#5b554d;line-height:1.6">
        Attached is ${who} emergency medical record, shared via Beacon
        ${opts.sentBy === "admin" ? "by an administrator" : "by the patient"}.
      </p>
      ${opts.note ? `<p style="color:#5b554d;line-height:1.6">Note: ${opts.note}</p>` : ""}
      ${opts.downloadUrl ? `<p><a href="${opts.downloadUrl}" style="color:#0d9488">Open the record online</a> (link expires shortly).</p>` : ""}
      <p style="color:#8a8278;font-size:12px">Beacon — a digital health passport.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: "A medical record was shared with you via Beacon",
        html,
        attachments: [
          { filename: opts.filename ?? "beacon-record.pdf", content: base64 },
        ],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
