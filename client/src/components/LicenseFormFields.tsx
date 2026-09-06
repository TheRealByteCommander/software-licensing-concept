import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { LicenseFormState } from "@/lib/licenseForm";

type Option = { id: number; label: string };

type LicenseFormFieldsProps = {
  form: LicenseFormState;
  setForm: (form: LicenseFormState) => void;
  products?: Option[];
  customers?: Option[];
  showStatus?: boolean;
  disableProduct?: boolean;
};

export default function LicenseFormFields({
  form,
  setForm,
  products = [],
  customers = [],
  showStatus = false,
  disableProduct = false,
}: LicenseFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Product</Label>
        <Select
          value={form.productId}
          onValueChange={value => setForm({ ...form, productId: value })}
          disabled={disableProduct}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a product" />
          </SelectTrigger>
          <SelectContent>
            {products.map(product => (
              <SelectItem key={product.id} value={product.id.toString()}>
                {product.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Customer (Optional)</Label>
        <Select
          value={form.customerId || "none"}
          onValueChange={value =>
            setForm({ ...form, customerId: value === "none" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="No customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No customer</SelectItem>
            {customers.map(customer => (
              <SelectItem key={customer.id} value={customer.id.toString()}>
                {customer.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>License Type</Label>
          <Select
            value={form.type}
            onValueChange={(value: LicenseFormState["type"]) =>
              setForm({ ...form, type: value })
            }
          >
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

        {showStatus && (
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value: LicenseFormState["status"]) =>
                setForm({ ...form, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="grace_period">Grace Period</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="maxActivations">Max Activations</Label>
          <Input
            id="maxActivations"
            type="number"
            min={1}
            value={form.maxActivations}
            onChange={e => setForm({ ...form, maxActivations: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="expiresAt">Expiration Date</Label>
          <Input
            id="expiresAt"
            type="date"
            value={form.expiresAt}
            onChange={e => setForm({ ...form, expiresAt: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="features">Features (comma-separated)</Label>
        <Input
          id="features"
          value={form.features}
          onChange={e => setForm({ ...form, features: e.target.value })}
          placeholder="basic, inspection, Trends, Export"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Non-empty list is authoritative (no union with product defaults). Leave empty to use
          the product defaults, or basic.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="staleActivationDays">Stale Activation Days</Label>
          <Input
            id="staleActivationDays"
            type="number"
            min={1}
            value={form.staleActivationDays}
            onChange={e => setForm({ ...form, staleActivationDays: e.target.value })}
            placeholder="14"
          />
        </div>
        <div>
          <Label htmlFor="renewalPeriodDays">Renewal Period Days</Label>
          <Input
            id="renewalPeriodDays"
            type="number"
            min={1}
            value={form.renewalPeriodDays}
            onChange={e => setForm({ ...form, renewalPeriodDays: e.target.value })}
            disabled={!form.autoRenew}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="autoRenew">Auto-Renew Subscription</Label>
          <p className="text-xs text-muted-foreground">
            Extends expired subscription licenses automatically on activation or validation.
          </p>
        </div>
        <Switch
          id="autoRenew"
          checked={form.autoRenew}
          onCheckedChange={checked => setForm({ ...form, autoRenew: checked })}
        />
      </div>
    </div>
  );
}
