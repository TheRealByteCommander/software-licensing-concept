import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import type { BillingPlan } from "../drizzle/schema";
import { ENV } from "./_core/env";
import * as db from "./db";
import { generateLicenseKey } from "./licenseUtils";
import { buildLicenseMetadata, parseLicenseMetadata, resolveLicenseFeatures } from "./licensePolicy";
import { dispatchWebhookEvent } from "./webhooks";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (!ENV.stripeSecretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(ENV.stripeSecretKey);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(ENV.stripeSecretKey);
}

export function parseBillingPlanFeatures(features?: string | null): string[] {
  if (!features) return [];
  try {
    const parsed = JSON.parse(features) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function serializeBillingPlanFeatures(features?: string[]): string | undefined {
  if (!features?.length) return undefined;
  return JSON.stringify(features);
}

export type CheckoutResult = {
  status: "pending" | "completed" | "failed";
  readyToActivate: boolean;
  sessionId: string;
  licenseKey?: string;
  productId?: number;
  productName?: string;
  licenseType?: BillingPlan["licenseType"];
  billingModel?: BillingPlan["billingModel"];
  expiresAt?: string | null;
  features?: string[];
  customerEmail?: string;
};

function getCheckoutMode(plan: BillingPlan): Stripe.Checkout.SessionCreateParams.Mode {
  return plan.billingModel === "subscription" ? "subscription" : "payment";
}

function computeInitialExpiry(plan: BillingPlan, periodEnd?: number | null): Date | undefined {
  if (plan.licenseType === "perpetual") return undefined;
  if (periodEnd) return new Date(periodEnd * 1000);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (plan.renewalPeriodDays ?? 365));
  return expiresAt;
}

function buildLicenseMetadataForPlan(plan: BillingPlan, productDefaultFeatures?: unknown): string | undefined {
  return buildLicenseMetadata({
    features: resolveLicenseFeatures(productDefaultFeatures, parseBillingPlanFeatures(plan.features)),
    autoRenew: plan.billingModel === "subscription" ? plan.autoRenew : false,
    renewalPeriodDays: plan.renewalPeriodDays ?? 365,
  });
}

async function buildCheckoutResult(input: {
  sessionId: string;
  licenseKey: string;
  billingPlanId: number;
  customerEmail?: string | null;
}): Promise<CheckoutResult> {
  const [license, plan, product] = await Promise.all([
    db.getLicenseByKey(input.licenseKey),
    db.getBillingPlanById(input.billingPlanId),
    db.getLicenseByKey(input.licenseKey).then(async licenseRow => {
      if (!licenseRow) return undefined;
      return db.getProductById(licenseRow.productId);
    }),
  ]);

  const planFeatures = parseBillingPlanFeatures(plan?.features);
  const licenseFeatures = parseLicenseMetadata(license?.metadata).features;
  const features = resolveLicenseFeatures(product?.defaultFeatures, [
    ...planFeatures,
    ...(licenseFeatures ?? []),
  ]);

  return {
    status: "completed",
    readyToActivate: Boolean(license && license.status === "active"),
    sessionId: input.sessionId,
    licenseKey: input.licenseKey,
    productId: license?.productId,
    productName: product?.name,
    licenseType: plan?.licenseType ?? license?.type,
    billingModel: plan?.billingModel,
    expiresAt: license?.expiresAt ? new Date(license.expiresAt).toISOString() : null,
    features,
    customerEmail: input.customerEmail ?? undefined,
  };
}

function getSessionEmail(session: Stripe.Checkout.Session): string | undefined {
  return session.customer_details?.email ?? session.customer_email ?? undefined;
}

function emailsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return true;
  return a.toLowerCase() === b.toLowerCase();
}

async function verifyCheckoutAccess(input: {
  sessionId: string;
  email?: string;
  customerId?: number | null;
  session?: Stripe.Checkout.Session;
}) {
  if (!input.email) return;

  if (input.customerId) {
    const customer = await db.getCustomerById(input.customerId);
    if (customer && !emailsMatch(customer.email, input.email)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Email does not match checkout session",
      });
    }
    return;
  }

  const session =
    input.session ??
    (await getStripeClient()?.checkout.sessions.retrieve(input.sessionId));

  if (session && !emailsMatch(getSessionEmail(session), input.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Email does not match checkout session",
    });
  }
}

async function upsertCustomerFromStripe(input: {
  email: string;
  name?: string | null;
  stripeCustomerId?: string | null;
}) {
  const existing = await db.getCustomerByEmail(input.email);
  if (existing) {
    if (input.stripeCustomerId && existing.stripeCustomerId !== input.stripeCustomerId) {
      await db.updateCustomer(existing.id, { stripeCustomerId: input.stripeCustomerId });
      return { ...existing, stripeCustomerId: input.stripeCustomerId };
    }
    return existing;
  }

  await db.createCustomer({
    email: input.email,
    name: input.name ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    userId: null,
  });

  return (await db.getCustomerByEmail(input.email))!;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const firstItem = subscription.items?.data?.[0];
  return firstItem?.current_period_end ?? null;
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent && typeof fromParent === "object") return fromParent.id;

  for (const line of invoice.lines.data) {
    if (typeof line.subscription === "string") return line.subscription;
    if (line.subscription && typeof line.subscription === "object") return line.subscription.id;
  }

  return null;
}

function getPriceIdFromInvoiceLine(line: Stripe.InvoiceLineItem): string | null {
  const price = line.pricing?.price_details?.price;
  if (typeof price === "string") return price;
  if (price && typeof price === "object") return price.id;
  return null;
}

export async function createCheckoutSession(input: {
  billingPlanId: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe is not configured (STRIPE_SECRET_KEY missing)",
    });
  }

  const plan = await db.getBillingPlanById(input.billingPlanId);
  if (!plan || !plan.active) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Billing plan not found or inactive" });
  }

  const product = await db.getProductById(plan.productId);
  if (!product) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Linked product not found" });
  }

  const mode = getCheckoutMode(plan);
  const metadata = { billingPlanId: String(plan.id) };

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.customerEmail,
    metadata,
    subscription_data:
      mode === "subscription"
        ? { metadata }
        : undefined,
    payment_intent_data:
      mode === "payment"
        ? { metadata }
        : undefined,
  });

  await db.createStripePayment({
    billingPlanId: plan.id,
    stripeCheckoutSessionId: session.id,
    amountTotal: session.amount_total ?? undefined,
    currency: session.currency ?? undefined,
    status: "pending",
  });

  return {
    sessionId: session.id,
    url: session.url,
    billingModel: plan.billingModel,
  };
}

export async function getCheckoutResult(input: {
  sessionId: string;
  email?: string;
}): Promise<CheckoutResult> {
  const existingPayment = await db.getStripePaymentByCheckoutSessionId(input.sessionId);

  if (existingPayment?.licenseKey) {
    await verifyCheckoutAccess({
      sessionId: input.sessionId,
      email: input.email,
      customerId: existingPayment.customerId,
    });

    return buildCheckoutResult({
      sessionId: input.sessionId,
      licenseKey: existingPayment.licenseKey,
      billingPlanId: existingPayment.billingPlanId,
      customerEmail: input.email,
    });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe is not configured",
    });
  }

  const session = await stripe.checkout.sessions.retrieve(input.sessionId);
  await verifyCheckoutAccess({
    sessionId: input.sessionId,
    email: input.email,
    session,
  });

  if (session.payment_status === "unpaid") {
    return {
      status: "pending",
      readyToActivate: false,
      sessionId: input.sessionId,
      customerEmail: getSessionEmail(session),
    };
  }

  if (session.payment_status === "no_payment_required") {
    return {
      status: "pending",
      readyToActivate: false,
      sessionId: input.sessionId,
      customerEmail: getSessionEmail(session),
    };
  }

  if (session.status === "expired") {
    return {
      status: "failed",
      readyToActivate: false,
      sessionId: input.sessionId,
      customerEmail: getSessionEmail(session),
    };
  }

  if (session.payment_status === "paid") {
    const fulfillment = await handleCheckoutSessionCompleted(session);
    if (fulfillment.licenseKey) {
      const payment = await db.getStripePaymentByCheckoutSessionId(input.sessionId);
      return buildCheckoutResult({
        sessionId: input.sessionId,
        licenseKey: fulfillment.licenseKey,
        billingPlanId: payment?.billingPlanId ?? Number(session.metadata?.billingPlanId),
        customerEmail: getSessionEmail(session),
      });
    }
  }

  return {
    status: "pending",
    readyToActivate: false,
    sessionId: input.sessionId,
    customerEmail: getSessionEmail(session),
  };
}

async function issueLicenseForPlan(input: {
  plan: BillingPlan;
  customerId: number;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  periodEnd?: number | null;
}) {
  const licenseKey = generateLicenseKey();
  const product = await db.getProductById(input.plan.productId);
  const metadata = buildLicenseMetadataForPlan(input.plan, product?.defaultFeatures);

  await db.createLicense({
    licenseKey,
    productId: input.plan.productId,
    customerId: input.customerId,
    stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
    type: input.plan.licenseType,
    maxActivations: input.plan.maxActivations ?? 1,
    expiresAt: computeInitialExpiry(input.plan, input.periodEnd),
    metadata,
    status: "active",
  });

  void dispatchWebhookEvent("license.created", {
    licenseKey,
    productId: input.plan.productId,
    customerId: input.customerId,
    billingModel: input.plan.billingModel,
    source: "stripe",
  });

  return licenseKey;
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const existingPayment = session.id
    ? await db.getStripePaymentByCheckoutSessionId(session.id)
    : undefined;
  if (existingPayment?.licenseKey) {
    return { handled: true, licenseKey: existingPayment.licenseKey, duplicate: true };
  }

  const billingPlanId = Number(session.metadata?.billingPlanId);
  if (!Number.isFinite(billingPlanId)) {
    throw new Error("Missing billingPlanId in checkout session metadata");
  }

  const plan = await db.getBillingPlanById(billingPlanId);
  if (!plan) {
    throw new Error(`Billing plan ${billingPlanId} not found`);
  }

  const email =
    session.customer_details?.email ??
    session.customer_email ??
    undefined;

  if (!email) {
    throw new Error("Checkout session has no customer email");
  }

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  const customer = await upsertCustomerFromStripe({
    email,
    name: session.customer_details?.name,
    stripeCustomerId,
  });

  let stripeSubscriptionId: string | null = null;
  let periodEnd: number | null = null;

  if (typeof session.subscription === "string") {
    stripeSubscriptionId = session.subscription;
    const stripe = getStripeClient();
    if (stripe) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      periodEnd = getSubscriptionPeriodEnd(subscription);
    }
  }

  const licenseKey = await issueLicenseForPlan({
    plan,
    customerId: customer.id,
    stripeSubscriptionId,
    stripeCustomerId,
    periodEnd,
  });

  if (existingPayment) {
    await db.updateStripePayment(existingPayment.id, {
      customerId: customer.id,
      licenseKey,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      stripeCustomerId: stripeCustomerId ?? undefined,
      amountTotal: session.amount_total ?? existingPayment.amountTotal ?? undefined,
      currency: session.currency ?? existingPayment.currency ?? undefined,
      status: "completed",
    });
  } else {
    await db.createStripePayment({
      billingPlanId: plan.id,
      customerId: customer.id,
      licenseKey,
      stripeCheckoutSessionId: session.id,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      stripeCustomerId: stripeCustomerId ?? undefined,
      amountTotal: session.amount_total ?? undefined,
      currency: session.currency ?? undefined,
      status: "completed",
    });
  }

  return { handled: true, licenseKey, duplicate: false };
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    return { handled: false, reason: "not_subscription_invoice" };
  }

  const license = await db.getLicenseByStripeSubscriptionId(subscriptionId);
  if (!license) {
    return { handled: false, reason: "license_not_found" };
  }

  const existingInvoice = invoice.id
    ? await db.getStripePaymentByInvoiceId(invoice.id)
    : undefined;
  if (existingInvoice?.status === "completed") {
    return { handled: true, licenseKey: license.licenseKey, duplicate: true };
  }

  const periodEnd = invoice.lines.data[0]?.period?.end;
  const expiresAt = periodEnd ? new Date(periodEnd * 1000) : undefined;

  if (expiresAt) {
    await db.updateLicense(license.licenseKey, {
      expiresAt,
      status: "active",
    });

    void dispatchWebhookEvent("license.renewed", {
      licenseKey: license.licenseKey,
      productId: license.productId,
      expiresAt: expiresAt.toISOString(),
      source: "stripe",
    });
  }

  if (existingInvoice) {
    await db.updateStripePayment(existingInvoice.id, {
      status: "completed",
      amountTotal: invoice.amount_paid ?? existingInvoice.amountTotal ?? undefined,
      currency: invoice.currency ?? existingInvoice.currency ?? undefined,
    });
  } else {
    const planId = Number(invoice.metadata?.billingPlanId);
    const firstLine = invoice.lines.data[0];
    const billingPlanId = Number.isFinite(planId)
      ? planId
      : (await db.getBillingPlanByStripePriceId(getPriceIdFromInvoiceLine(firstLine) ?? ""))?.id;

    if (billingPlanId) {
      await db.createStripePayment({
        billingPlanId,
        customerId: license.customerId ?? undefined,
        licenseKey: license.licenseKey,
        stripeSubscriptionId: subscriptionId,
        stripeInvoiceId: invoice.id,
        stripeCustomerId:
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
        amountTotal: invoice.amount_paid ?? undefined,
        currency: invoice.currency ?? undefined,
        status: "completed",
      });
    }
  }

  return { handled: true, licenseKey: license.licenseKey, duplicate: false };
}

export async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const license = await db.getLicenseByStripeSubscriptionId(subscription.id);
  if (!license) {
    return { handled: false, reason: "license_not_found" };
  }

  if (license.status === "revoked") {
    return { handled: true, licenseKey: license.licenseKey, duplicate: true };
  }

  await db.revokeLicense(license.licenseKey);
  void dispatchWebhookEvent("license.revoked", {
    licenseKey: license.licenseKey,
    productId: license.productId,
    source: "stripe",
  });

  return { handled: true, licenseKey: license.licenseKey, duplicate: false };
}

export async function processStripeWebhook(payload: Buffer, signature: string | string[] | undefined) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }
  if (!ENV.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  if (!signature || Array.isArray(signature)) {
    throw new Error("Missing Stripe signature header");
  }

  const event = stripe.webhooks.constructEvent(payload, signature, ENV.stripeWebhookSecret);

  if (await db.hasProcessedStripeEvent(event.id)) {
    return { received: true, duplicate: true, type: event.type };
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.status === "canceled" || subscription.status === "unpaid") {
        await handleSubscriptionCanceled(subscription);
      }
      break;
    }
    default:
      break;
  }

  await db.markStripeEventProcessed({
    stripeEventId: event.id,
    eventType: event.type,
  });

  return { received: true, duplicate: false, type: event.type };
}
