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
import { Plus, Ban, Copy, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import LicenseFormFields from "@/components/LicenseFormFields";
import {
  downloadCsv,
  emptyLicenseForm,
  formFromLicense,
  metadataFromForm,
  type LicenseFormState,
} from "@/lib/licenseForm";
import { formatProductLabel } from "@shared/productLabel";

export default function Licenses() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<any>(null);
  const [createForm, setCreateForm] = useState<LicenseFormState>(emptyLicenseForm());
  const [editForm, setEditForm] = useState<LicenseFormState>(emptyLicenseForm());

  const utils = trpc.useUtils();
  const { data: licenses, isLoading } = trpc.licenses.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();

  const productOptions =
    products?.map(product => ({
      id: product.id,
      label: formatProductLabel(product.id, product.name),
    })) ?? [];
  const customerOptions =
    customers?.map(customer => ({
      id: customer.id,
      label: customer.name ? `${customer.name} (${customer.email})` : customer.email,
    })) ?? [];

  const createMutation = trpc.licenses.create.useMutation({
    onSuccess: () => {
      utils.licenses.list.invalidate();
      setIsCreateOpen(false);
      setCreateForm(emptyLicenseForm());
      toast.success("License created successfully");
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.licenses.update.useMutation({
    onSuccess: () => {
      utils.licenses.list.invalidate();
      setEditingLicense(null);
      toast.success("License updated successfully");
    },
    onError: error => toast.error(error.message),
  });

  const revokeMutation = trpc.licenses.revoke.useMutation({
    onSuccess: () => {
      utils.licenses.list.invalidate();
      toast.success("License revoked successfully");
    },
    onError: error => toast.error(error.message),
  });

  const exportQuery = trpc.licenses.exportCsv.useQuery(undefined, { enabled: false });

  const handleCreate = () => {
    createMutation.mutate({
      productId: parseInt(createForm.productId, 10),
      customerId: createForm.customerId ? parseInt(createForm.customerId, 10) : undefined,
      type: createForm.type,
      maxActivations: parseInt(createForm.maxActivations, 10),
      expiresAt: createForm.expiresAt || undefined,
      metadata: metadataFromForm(createForm),
    });
  };

  const handleUpdate = () => {
    if (!editingLicense) return;

    updateMutation.mutate({
      licenseKey: editingLicense.licenseKey,
      status: editForm.status,
      maxActivations: parseInt(editForm.maxActivations, 10),
      customerId: editForm.customerId ? parseInt(editForm.customerId, 10) : null,
      expiresAt: editForm.expiresAt ? editForm.expiresAt : null,
      metadata: metadataFromForm(editForm),
    });
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (result.data?.csv) {
      downloadCsv(result.data.filename, result.data.csv);
      toast.success("License export downloaded");
    }
  };

  const openEdit = (license: any) => {
    setEditingLicense(license);
    setEditForm(formFromLicense(license));
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

  const customerLabel = (customerId?: number | null) => {
    if (!customerId) return "—";
    const customer = customers?.find(entry => entry.id === customerId);
    return customer?.name || customer?.email || `#${customerId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Licenses</h1>
          <p className="text-muted-foreground">Manage software licenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create License
          </Button>
        </div>
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
            </div>
          ) : licenses && licenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Key</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Max Activations</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map(license => {
                  const product = products?.find(entry => entry.id === license.productId);
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
                      <TableCell>
                        {product
                          ? formatProductLabel(product.id, product.name)
                          : license.productId
                            ? formatProductLabel(license.productId)
                            : "—"}
                      </TableCell>
                      <TableCell>{customerLabel(license.customerId)}</TableCell>
                      <TableCell className="capitalize">{license.type.replace("_", " ")}</TableCell>
                      <TableCell>{getStatusBadge(license.status)}</TableCell>
                      <TableCell>{license.maxActivations || "Unlimited"}</TableCell>
                      <TableCell>
                        {license.expiresAt
                          ? new Date(license.expiresAt).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(license)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create License</DialogTitle>
            <DialogDescription>Generate a new license for a product</DialogDescription>
          </DialogHeader>
          <LicenseFormFields
            form={createForm}
            setForm={setCreateForm}
            products={productOptions}
            customers={customerOptions}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!createForm.productId || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLicense} onOpenChange={open => !open && setEditingLicense(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit License</DialogTitle>
            <DialogDescription>
              Update license settings for{" "}
              <span className="font-mono">{editingLicense?.licenseKey}</span>
            </DialogDescription>
          </DialogHeader>
          <LicenseFormFields
            form={editForm}
            setForm={setEditForm}
            products={productOptions}
            customers={customerOptions}
            showStatus
            disableProduct
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLicense(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
