import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [productId, setProductId] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "active" | "deactivated">("all");
  const [licenseKey, setLicenseKey] = useState("");

  const { data: products } = trpc.products.list.useQuery();
  const { data: activations, isLoading } = trpc.activations.list.useQuery({
    productId: productId !== "all" ? parseInt(productId, 10) : undefined,
    status,
    licenseKey: licenseKey.trim() || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activations</h1>
        <p className="text-muted-foreground">View all license activations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter activations by product, status, or license key</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products?.map(product => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={value => setStatus(value as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="licenseKeyFilter">License Key</Label>
            <Input
              id="licenseKeyFilter"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
          </div>
        </CardContent>
      </Card>

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
                {activations.map(activation => (
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
            <p className="text-sm text-muted-foreground">No activations match the current filters</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
