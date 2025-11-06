import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Ban, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Licenses() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    productId: "",
    type: "perpetual" as const,
    maxActivations: "1",
    expiresAt: "",
  });

  const utils = trpc.useUtils();
  const { data: licenses, isLoading } = trpc.licenses.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();

  const createMutation = trpc.licenses.create.useMutation({
    onSuccess: () => {
      utils.licenses.list.invalidate();
      setIsCreateOpen(false);
      setFormData({ productId: "", type: "perpetual", maxActivations: "1", expiresAt: "" });
      toast.success("License created successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const revokeMutation = trpc.licenses.revoke.useMutation({
    onSuccess: () => {
      utils.licenses.list.invalidate();
      toast.success("License revoked successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      productId: parseInt(formData.productId),
      type: formData.type,
      maxActivations: parseInt(formData.maxActivations),
      expiresAt: formData.expiresAt || undefined,
    });
  };

  const handleRevoke = (licenseKey: string) => {
    if (confirm("Are you sure you want to revoke this license?")) {
      revokeMutation.mutate({ licenseKey });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("License key copied to clipboard");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      expired: "secondary",
      revoked: "destructive",
      grace_period: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Licenses</h1>
          <p className="text-muted-foreground">Manage software licenses</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create License
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Licenses</CardTitle>
          <CardDescription>List of all licenses in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : licenses && licenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Key</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Max Activations</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((license) => {
                  const product = products?.find((p) => p.id === license.productId);
                  return (
                    <TableRow key={license.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {license.licenseKey}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(license.licenseKey)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{product?.name || "—"}</TableCell>
                      <TableCell className="capitalize">{license.type.replace("_", " ")}</TableCell>
                      <TableCell>{getStatusBadge(license.status)}</TableCell>
                      <TableCell>{license.maxActivations || "Unlimited"}</TableCell>
                      <TableCell>
                        {license.expiresAt
                          ? new Date(license.expiresAt).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        {license.status !== "revoked" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(license.licenseKey)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No licenses yet. Create your first license!</p>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create License</DialogTitle>
            <DialogDescription>Generate a new license for a product</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product">Product</Label>
              <Select value={formData.productId} onValueChange={(v) => setFormData({ ...formData, productId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">License Type</Label>
              <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="perpetual">Perpetual</SelectItem>
                  <SelectItem value="node_locked">Node Locked</SelectItem>
                  <SelectItem value="user_based">User Based</SelectItem>
                  <SelectItem value="feature_based">Feature Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maxActivations">Max Activations</Label>
              <Input
                id="maxActivations"
                type="number"
                value={formData.maxActivations}
                onChange={(e) => setFormData({ ...formData, maxActivations: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.productId || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
