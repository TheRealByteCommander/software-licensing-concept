import { useEffect, useMemo, useState } from "react";
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
import { CreditCard, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { APP_TITLE } from "@/const";

function billingModelLabel(model: "subscription" | "one_time") {
  return model === "subscription" ? "Subscription" : "One-time payment";
}

export default function Checkout() {
  const [billingPlanId, setBillingPlanId] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";
  const sessionId = params.get("session_id") ?? "";

  const { data: stripeStatus } = trpc.stripe.status.useQuery();
  const { data: plans, isLoading } = trpc.stripe.plans.listPublic.useQuery();

  const checkoutResultQuery = trpc.stripe.getCheckoutResult.useQuery(
    { sessionId, email: customerEmail || undefined },
    {
      enabled: success && Boolean(sessionId),
      refetchInterval: query =>
        query.state.data?.readyToActivate ? false : 2000,
    }
  );

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

  useEffect(() => {
    if (checkoutResultQuery.data?.readyToActivate && checkoutResultQuery.data.licenseKey) {
      toast.success("License ready – you can activate your software now");
    }
  }, [checkoutResultQuery.data?.readyToActivate, checkoutResultQuery.data?.licenseKey]);

  const handleCheckout = () => {
    if (!billingPlanId || !customerEmail) {
      toast.error("Please select a plan and enter your email");
      return;
    }

    const origin = window.location.origin;
    checkoutMutation.mutate({
      billingPlanId: Number(billingPlanId),
      customerEmail,
      successUrl: `${origin}/checkout?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?canceled=1`,
    });
  };

  const copyLicenseKey = async (licenseKey: string) => {
    await navigator.clipboard.writeText(licenseKey);
    toast.success("License key copied");
  };

  const purchaseResult = checkoutResultQuery.data;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {APP_TITLE} – License Checkout
          </CardTitle>
          <CardDescription>
            Stripe redirect landing and API test page. End customers purchase inside AnomalyMatrix,
            not on this admin host.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {success && sessionId ? (
            <div className="space-y-4">
              {checkoutResultQuery.isLoading || purchaseResult?.status === "pending" ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Payment received. Preparing your license…
                </div>
              ) : null}

              {purchaseResult?.readyToActivate && purchaseResult.licenseKey ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-3 text-sm text-green-900">
                  <p className="font-medium">Your software is ready to unlock.</p>
                  <div className="rounded bg-white/80 p-3 font-mono text-xs break-all">
                    {purchaseResult.licenseKey}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyLicenseKey(purchaseResult.licenseKey!)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy license key
                    </Button>
                  </div>
                  <p>
                    Enter this key in your application or call{" "}
                    <code>api.activate</code> immediately to unlock all features.
                  </p>
                </div>
              ) : null}

              {purchaseResult?.status === "failed" ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  Checkout expired or failed. Please start a new purchase.
                </div>
              ) : null}
            </div>
          ) : null}

          {success && !sessionId ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Payment successful, but no session ID was returned. Contact support with your payment confirmation.
            </div>
          ) : null}

          {canceled ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Checkout was canceled. You can try again below.
            </div>
          ) : null}

          {!success ? (
            !stripeStatus?.configured ? (
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
                          {plan.productName} – {plan.name} ({billingModelLabel(plan.billingModel)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPlan ? (
                  <div className="rounded-md border p-4 space-y-2 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{billingModelLabel(selectedPlan.billingModel)}</Badge>
                      <Badge variant="outline">{selectedPlan.licenseType}</Badge>
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
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
