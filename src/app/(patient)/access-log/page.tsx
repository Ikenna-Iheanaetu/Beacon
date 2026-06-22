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

export default async function AccessLogPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("access_logs")
    .select("id, access_type, created_at")
    .order("created_at", { ascending: false });

  const rows = logs ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Access log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A record of every time your emergency information was opened.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No one has accessed your record yet. When a provider opens your
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
                        <TableCell>A verified provider</TableCell>
                        <TableCell>
                          <Badge variant="info">
                            <ShieldCheck />
                            Emergency view
                          </Badge>
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
                      Emergency view
                    </Badge>
                    <span className="text-sm text-foreground">
                      A verified provider
                    </span>
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
