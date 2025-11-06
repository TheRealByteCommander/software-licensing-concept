import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Activations() {
  const { data: activations, isLoading } = trpc.activations.list.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activations</h1>
        <p className="text-muted-foreground">View all license activations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activation Log</CardTitle>
          <CardDescription>Complete history of license activations and deactivations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : activations && activations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Key</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead>Last Validated</TableHead>
                  <TableHead>Deactivated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activations.map((activation) => (
                  <TableRow key={activation.id}>
                    <TableCell className="font-mono text-sm">{activation.licenseKey}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {activation.deviceId.substring(0, 16)}...
                    </TableCell>
                    <TableCell>
                      {activation.deactivatedAt ? (
                        <Badge variant="secondary">Deactivated</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(activation.activatedAt).toLocaleString()}</TableCell>
                    <TableCell>{new Date(activation.lastValidatedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {activation.deactivatedAt
                        ? new Date(activation.deactivatedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No activations yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
