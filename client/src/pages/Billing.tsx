import { useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const LICENSE_TYPES = [
  "subscription",
  "perpetual",
  "node_locked",
  "user_based",
  "feature_based",
] as const;

const BILLING_MODELS = ["subscription", "one_time"] as const;

type BillingPlanForm = {
  productId: string;
  name: string;
  stripePriceId: string;
  billingModel: (typeof BILLING_MODELS)[number];
  licenseType: (typeof LICENSE_TYPES)[number];
  maxActivations: string;
  renewalPeriodDays: string;
  autoRenew: boolean;
  features: string;
  active: boolean;
};

const emptyPlanForm = (): BillingPlanForm => ({
  productId: "",
  name: "",
  stripePriceId: "",
  billingModel: "one_time",
  licenseType: "perpetual",
  maxActivations: "1",
  renewalPeriodDays: "365",
  autoRenew: true,
  features: "",
  active: true,
});

export default function Billing() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form, setForm] = useState<BillingPlanForm>(emptyPlanForm());

  const utils = trpc.useUtils();
  const { data: stripeStatus } = trpc.stripe.status.useQuery();
  const { data: plans, isLoading: plansLoading } = trpc.stripe.plans.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  const { data: payments, isLoading: paymentsLoading } = trpc.stripe.payments.list.useQuery();

  const productOptions = useMemo(
    () => (products ?? []).map(product => ({ id: product.id, label: product.name })),
    [products]
  );

  const resetForm = () => setForm(emptyPlanForm());

  const createMutation = trpc.stripe.plans.create.useMutation({
    onSuccess: () => {
      utils.stripe.plans.list.invalidate();
      setIsCreateOpen(false);
      resetForm();
      toast.success("Billing plan created");
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.stripe.plans.update.useMutation({
    onSuccess: () => {
      utils.stripe.plans.list.invalidate();
      setEditingPlan(null);
      resetForm();
      toast.success("Billing plan updated");
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.stripe.plans.delete.useMutation({
    onSuccess: () => {
      utils.stripe.plans.list.invalidate();
      toast.success("Billing plan deleted");
    },
    onError: error => toast.error(error.message),
  });

  const submitPlan = () => {
    const payload = {
      productId: Number(form.productId),
      name: form.name.trim(),
      stripePriceId: form.stripePriceId.trim(),
      billingModel: form.billingModel,
      licenseType: form.licenseType,
      maxActivations: Number(form.maxActivations) || 1,
      renewalPeriodDays: Number(form.renewalPeriodDays) || 365,
      autoRenew: form.autoRenew,
      features: form.features
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
      active: form.active,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, ...payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setForm({
      productId: String(plan.productId),
      name: plan.name,
      stripePriceId: plan.stripePriceId,
      billingModel: plan.billingModel ?? "one_time",
      licenseType: plan.licenseType,
      maxActivations: String(plan.maxActivations ?? 1),
      renewalPeriodDays: String(plan.renewalPeriodDays ?? 365),
      autoRenew: plan.autoRenew,
      features: Array.isArray(plan.features) ? plan.features.join(", ") : "",
      active: plan.active,
    });
  };

  const renderPlanForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Product</Label>
        <Select value={form.productId} onValueChange={value => setForm({ ...form, productId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {productOptions.map(product => (
              <SelectItem key={product.id} value={product.id.toString()}>
                {product.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Plan name</Label>
        <Input
          value={form.name}
          onChange={event => setForm({ ...form, name: event.target.value })}
          placeholder="Annual subscription"
        />
      </div>

      <div>
        <Label>Stripe Price ID</Label>
        <Input
          value={form.stripePriceId}
          onChange={event => setForm({ ...form, stripePriceId: event.target.value })}
          placeholder="price_..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Payment model</Label>
          <Select
            value={form.billingModel}
            onValueChange={value => {
              const billingModel = value as BillingPlanForm["billingModel"];
              setForm({
                ...form,
                billingModel,
                licenseType:
                  billingModel === "subscription" ? "subscription" : form.licenseType,
                autoRenew: billingModel === "subscription",
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subscription">Subscription (recurring)</SelectItem>
              <SelectItem value="one_time">One-time payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>License type</Label>
          <Select
            value={form.licenseType}
            onValueChange={value =>
              setForm({ ...form, licenseType: value as BillingPlanForm["licenseType"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LICENSE_TYPES.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Max activations</Label>
          <Input
            type="number"
            min={1}
            value={form.maxActivations}
            onChange={event => setForm({ ...form, maxActivations: event.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Renewal period (days)</Label>
          <Input
            type="number"
            min={1}
            value={form.renewalPeriodDays}
            onChange={event => setForm({ ...form, renewalPeriodDays: event.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="autoRenew">Auto renew (subscriptions only)</Label>
          <Switch
            id="autoRenew"
            checked={form.autoRenew}
            disabled={form.billingModel !== "subscription"}
            onCheckedChange={checked => setForm({ ...form, autoRenew: checked })}
          />
        </div>
      </div>

      <div>
        <Label>Features (comma-separated)</Label>
        <Input
          value={form.features}
          onChange={event => setForm({ ...form, features: event.target.value })}
          placeholder="pro, export, api"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="planActive">Active</Label>
        <Switch
          id="planActive"
          checked={form.active}
          onCheckedChange={checked => setForm({ ...form, active: checked })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Stripe checkout plans and payment history</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} disabled={!stripeStatus?.configured}>
          <Plus className="mr-2 h-4 w-4" />
          Add plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={stripeStatus?.configured ? "default" : "secondary"}>
              {stripeStatus?.configured ? "Configured" : "Not configured"}
            </Badge>
            {stripeStatus?.publishableKey ? (
              <span className="text-sm text-muted-foreground">
                Publishable key: {stripeStatus.publishableKey.slice(0, 12)}…
              </span>
            ) : null}
          </div>
          {!stripeStatus?.configured ? (
            <p className="text-sm text-muted-foreground">
              Set <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> in your environment.
              Webhook endpoint: <code>/api/stripe/webhook</code>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Public checkout page: <a className="underline" href="/checkout">/checkout</a>
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Billing plans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing plans</CardTitle>
              <CardDescription>
                Map Stripe Price IDs to products and license settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : plans && plans.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Stripe Price</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map(plan => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.productName}</TableCell>
                        <TableCell>
                          {plan.billingModel === "subscription" ? "Subscription" : "One-time"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{plan.stripePriceId}</TableCell>
                        <TableCell>{plan.licenseType}</TableCell>
                        <TableCell>
                          <Badge variant={plan.active ? "default" : "secondary"}>
                            {plan.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => openEdit(plan)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                if (confirm("Delete this billing plan?")) {
                                  deleteMutation.mutate({ id: plan.id });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No billing plans yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Stripe payments</CardTitle>
              <CardDescription>Checkout sessions and subscription invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : payments && payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.planName}</TableCell>
                        <TableCell>{payment.customerLabel ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {payment.licenseKey ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.status === "completed" ? "default" : "secondary"}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(payment.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create billing plan</DialogTitle>
            <DialogDescription>
              Link a Stripe Price ID to a product and license configuration.
            </DialogDescription>
          </DialogHeader>
          {renderPlanForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPlan} disabled={createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPlan} onOpenChange={open => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit billing plan</DialogTitle>
          </DialogHeader>
          {renderPlanForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button onClick={submitPlan} disabled={updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
