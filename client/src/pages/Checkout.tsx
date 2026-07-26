import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { APP_TITLE } from "@/const";

export default function Checkout() {
  const [billingPlanId, setBillingPlanId] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const { data: stripeStatus } = trpc.stripe.status.useQuery();
  const { data: plans, isLoading } = trpc.stripe.plans.listPublic.useQuery();

  const selectedPlan = useMemo(
    () => plans?.find(plan => plan.id.toString() === billingPlanId),
    [plans, billingPlanId]
  );

  const checkoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: data => {
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error("Stripe did not return a checkout URL");
    },
    onError: error => toast.error(error.message),
  });

  const handleCheckout = () => {
    if (!billingPlanId || !customerEmail) {
      toast.error("Please select a plan and enter your email");
      return;
    }

    const origin = window.location.origin;
    checkoutMutation.mutate({
      billingPlanId: Number(billingPlanId),
      customerEmail,
      successUrl: `${origin}/checkout?success=1`,
      cancelUrl: `${origin}/checkout?canceled=1`,
    });
  };

  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {APP_TITLE} – License Checkout
          </CardTitle>
          <CardDescription>
            Purchase a license via Stripe. Your license key will be issued automatically after payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {success ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              Payment successful. Your license will be sent to your email shortly and appears in the admin portal.
            </div>
          ) : null}

          {canceled ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Checkout was canceled. You can try again below.
            </div>
          ) : null}

          {!stripeStatus?.configured ? (
            <p className="text-sm text-muted-foreground">
              Stripe checkout is not configured on this server.
            </p>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div>
                <Label>Plan</Label>
                <Select value={billingPlanId} onValueChange={setBillingPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {(plans ?? []).map(plan => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.productName} – {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPlan ? (
                <div className="rounded-md border p-4 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{selectedPlan.licenseType}</Badge>
                    <Badge variant="secondary">
                      {selectedPlan.maxActivations ?? 1} activation(s)
                    </Badge>
                  </div>
                  {selectedPlan.features.length > 0 ? (
                    <p className="text-muted-foreground">
                      Features: {selectedPlan.features.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={event => setCustomerEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending || !plans?.length}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Continue to Stripe
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
