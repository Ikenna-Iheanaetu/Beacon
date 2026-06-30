import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const TYPE_LABELS: Record<string, string> = {
  emergency_view: "Emergency view",
  pdf_export: "PDF downloaded",
  national_id_lookup: "Looked up by ID",
  admin_review: "Administrative review",
};

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? "Access";
}

export default async function AccessLogPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("access_logs")
    .select("id, access_type, created_at, accessor_name, accessor_email, note")
    .order("created_at", { ascending: false });

  const rows = logs ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="beacon-rise">
        <span className="data-label text-primary-400">Audit trail</span>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
          Access log
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A record of every time your emergency information was opened.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No one has accessed your record yet. When a doctor opens your
            emergency view, it will appear here.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table on md+; cards on mobile */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Accessed by</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {log.accessor_name || "A verified doctor"}
                            </span>
                            {log.accessor_email && (
                              <span className="tabular text-xs text-muted-foreground">
                                {log.accessor_email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">
                            <ShieldCheck />
                            {typeLabel(log.access_type)}
                          </Badge>
                          {log.note && (
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              {log.note}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="tabular text-right text-muted-foreground">
                          {formatWhen(log.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((log) => (
              <li key={log.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 py-4">
                    <Badge variant="info" className="w-fit">
                      <ShieldCheck />
                      {typeLabel(log.access_type)}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      {log.accessor_name || "A verified doctor"}
                    </span>
                    {log.accessor_email && (
                      <span className="tabular text-xs text-muted-foreground">
                        {log.accessor_email}
                      </span>
                    )}
                    {log.note && (
                      <span className="text-xs text-muted-foreground">
                        {log.note}
                      </span>
                    )}
                    <span className="tabular text-sm text-muted-foreground">
                      {formatWhen(log.created_at)}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
