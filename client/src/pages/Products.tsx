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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import ProductTwoFADialog from "@/components/ProductTwoFADialog";
import CopyableId from "@/components/CopyableId";

export default function Products() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [twoFAProduct, setTwoFAProduct] = useState<any>(null);
  const [createdProduct, setCreatedProduct] = useState<{ id: number; name: string } | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", defaultFeatures: "" });

  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.products.list.useQuery();

  const createMutation = trpc.products.create.useMutation({
    onSuccess: data => {
      utils.products.list.invalidate();
      setIsCreateOpen(false);
      setFormData({ name: "", description: "", defaultFeatures: "" });
      setCreatedProduct({ id: data.id, name: data.name });
      toast.success(`Product created. ID: ${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setEditingProduct(null);
      setFormData({ name: "", description: "", defaultFeatures: "" });
      toast.success("Product updated successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Product deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const featureList = (value: string) =>
    value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      defaultFeatures: featureList(formData.defaultFeatures),
    });
  };

  const handleUpdate = () => {
    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        name: formData.name,
        description: formData.description,
        defaultFeatures: featureList(formData.defaultFeatures),
      });
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      defaultFeatures: Array.isArray(product.defaultFeatures)
        ? product.defaultFeatures.join(", ")
        : "",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your software products</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>List of all software products in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : products && products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <CopyableId value={product.id} label="Product ID" />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.description || "—"}</TableCell>
                    <TableCell>
                      {product.defaultFeatures?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {product.defaultFeatures.map(flag => (
                            <Badge key={flag} variant="outline">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {product.require2FA ? (
                        <Badge>Required</Badge>
                      ) : (
                        <Badge variant="outline">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(product.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTwoFAProduct(product)}
                        title="Manage 2FA"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No products yet. Create your first product!</p>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Product</DialogTitle>
            <DialogDescription>Add a new software product to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Software"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
              />
            </div>
            <div>
              <Label htmlFor="defaultFeatures">Default features</Label>
              <Input
                id="defaultFeatures"
                value={formData.defaultFeatures}
                onChange={e => setFormData({ ...formData, defaultFeatures: e.target.value })}
                placeholder="basic, inspection, Trends, Export"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Returned on activate/validate and merged with each license&apos;s feature list.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingProduct ? (
              <div>
                <Label>Product ID</Label>
                <div className="mt-1">
                  <CopyableId value={editingProduct.id} label="Product ID" />
                </div>
              </div>
            ) : null}
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-defaultFeatures">Default features</Label>
              <Input
                id="edit-defaultFeatures"
                value={formData.defaultFeatures}
                onChange={e => setFormData({ ...formData, defaultFeatures: e.target.value })}
                placeholder="basic, inspection, Trends, Export"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Example for AnomalyMatrix: basic, inspection, Trends, Export
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.name || updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdProduct} onOpenChange={(open) => !open && setCreatedProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product created</DialogTitle>
            <DialogDescription>
              Share this Product ID with integrators. SDKs and the public license API use it as{" "}
              <code>productId</code>.
            </DialogDescription>
          </DialogHeader>
          {createdProduct ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{createdProduct.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Product ID</p>
                <CopyableId value={createdProduct.id} label="Product ID" />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setCreatedProduct(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductTwoFADialog
        product={twoFAProduct}
        open={!!twoFAProduct}
        onOpenChange={(open) => !open && setTwoFAProduct(null)}
      />
    </div>
  );
}
