import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("./db", () => ({
  getBillingPlanById: vi.fn(),
  getProductById: vi.fn(),
  getLicenseByKey: vi.fn(),
  getStripePaymentByCheckoutSessionId: vi.fn(),
  getCustomerByEmail: vi.fn(),
  getCustomerById: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  createLicense: vi.fn(),
  updateStripePayment: vi.fn(),
  createStripePayment: vi.fn(),
  getLicenseByStripeSubscriptionId: vi.fn(),
  revokeLicense: vi.fn(),
  getStripePaymentByInvoiceId: vi.fn(),
  updateLicense: vi.fn(),
  getBillingPlanByStripePriceId: vi.fn(),
  hasProcessedStripeEvent: vi.fn(),
  markStripeEventProcessed: vi.fn(),
}));

vi.mock("./webhooks", () => ({
  dispatchWebhookEvent: vi.fn(),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    stripeSecretKey: "sk_test_mock",
    stripeWebhookSecret: "whsec_mock",
  },
}));

const stripeRetrieveMock = vi.fn();
const stripeSessionRetrieveMock = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: stripeRetrieveMock,
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: stripeSessionRetrieveMock,
      },
    },
  })),
}));

import * as db from "./db";
import {
  getCheckoutResult,
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleSubscriptionCanceled,
  parseBillingPlanFeatures,
} from "./stripe";

describe("parseBillingPlanFeatures", () => {
  it("parses JSON feature arrays", () => {
    expect(parseBillingPlanFeatures('["pro","export"]')).toEqual(["pro", "export"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseBillingPlanFeatures("not-json")).toEqual([]);
  });
});

describe("handleCheckoutSessionCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates customer and license for a completed checkout", async () => {
    vi.mocked(db.getStripePaymentByCheckoutSessionId).mockResolvedValue({
      id: 1,
      billingPlanId: 5,
      customerId: null,
      licenseKey: null,
      stripeCheckoutSessionId: "cs_test_1",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripeInvoiceId: null,
      amountTotal: 9900,
      currency: "eur",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.getBillingPlanById).mockResolvedValue({
      id: 5,
      productId: 2,
      name: "Annual",
      stripePriceId: "price_123",
      billingModel: "subscription",
      licenseType: "subscription",
      maxActivations: 2,
      renewalPeriodDays: 365,
      autoRenew: true,
      features: '["pro"]',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.getCustomerByEmail).mockResolvedValue(undefined);
    vi.mocked(db.createCustomer).mockResolvedValue(undefined as never);
    vi.mocked(db.getCustomerByEmail)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: 9,
        userId: null,
        email: "buyer@example.com",
        name: "Buyer",
        company: null,
        stripeCustomerId: "cus_123",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    stripeRetrieveMock.mockResolvedValue({
      current_period_end: 1893456000,
    });

    const session = {
      id: "cs_test_1",
      metadata: { billingPlanId: "5" },
      customer_details: { email: "buyer@example.com", name: "Buyer" },
      customer: "cus_123",
      subscription: "sub_123",
      amount_total: 9900,
      currency: "eur",
    } as Stripe.Checkout.Session;

    const result = await handleCheckoutSessionCompleted(session);

    expect(result.handled).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(db.createLicense).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 2,
        customerId: 9,
        stripeSubscriptionId: "sub_123",
        type: "subscription",
        maxActivations: 2,
        status: "active",
      })
    );
    expect(db.updateStripePayment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        licenseKey: expect.any(String),
        status: "completed",
      })
    );
  });

  it("skips duplicate checkout fulfillment", async () => {
    vi.mocked(db.getStripePaymentByCheckoutSessionId).mockResolvedValue({
      id: 1,
      billingPlanId: 5,
      customerId: 9,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      stripeCheckoutSessionId: "cs_test_1",
      stripeSubscriptionId: "sub_123",
      stripeCustomerId: "cus_123",
      stripeInvoiceId: null,
      amountTotal: 9900,
      currency: "eur",
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handleCheckoutSessionCompleted({
      id: "cs_test_1",
    } as Stripe.Checkout.Session);

    expect(result.duplicate).toBe(true);
    expect(db.createLicense).not.toHaveBeenCalled();
  });
});

describe("handleInvoicePaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extends subscription license expiry", async () => {
    vi.mocked(db.getLicenseByStripeSubscriptionId).mockResolvedValue({
      id: 1,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      productId: 2,
      customerId: 9,
      stripeSubscriptionId: "sub_123",
      type: "subscription",
      status: "active",
      maxActivations: 1,
      expiresAt: new Date("2025-01-01"),
      metadata: '{"autoRenew":true}',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getStripePaymentByInvoiceId).mockResolvedValue(undefined);

    const invoice = {
      id: "in_123",
      amount_paid: 9900,
      currency: "eur",
      customer: "cus_123",
      metadata: {},
      parent: {
        type: "subscription_details",
        subscription_details: {
          subscription: "sub_123",
          metadata: {},
        },
        quote_details: null,
      },
      lines: {
        data: [{
          period: { end: 1924992000 },
          pricing: {
            type: "price_details",
            price_details: { price: "price_123", product: "prod_123" },
          },
        }],
      },
    } as Stripe.Invoice;

    vi.mocked(db.getBillingPlanByStripePriceId).mockResolvedValue({
      id: 5,
      productId: 2,
      name: "Annual",
      stripePriceId: "price_123",
      billingModel: "subscription",
      licenseType: "subscription",
      maxActivations: 1,
      renewalPeriodDays: 365,
      autoRenew: true,
      features: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handleInvoicePaid(invoice);

    expect(result.handled).toBe(true);
    expect(db.updateLicense).toHaveBeenCalledWith(
      "AAAA-BBBB-CCCC-DDDD",
      expect.objectContaining({
        status: "active",
        expiresAt: new Date(1924992000 * 1000),
      })
    );
  });
});

describe("getCheckoutResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns completed license immediately when payment is already fulfilled", async () => {
    vi.mocked(db.getStripePaymentByCheckoutSessionId).mockResolvedValue({
      id: 1,
      billingPlanId: 5,
      customerId: 9,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      stripeCheckoutSessionId: "cs_test_1",
      stripeSubscriptionId: null,
      stripeCustomerId: "cus_123",
      stripeInvoiceId: null,
      amountTotal: 9900,
      currency: "eur",
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.getLicenseByKey).mockResolvedValue({
      id: 1,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      productId: 2,
      customerId: 9,
      stripeSubscriptionId: null,
      type: "perpetual",
      status: "active",
      maxActivations: 1,
      expiresAt: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.getBillingPlanById).mockResolvedValue({
      id: 5,
      productId: 2,
      name: "Lifetime",
      stripePriceId: "price_999",
      billingModel: "one_time",
      licenseType: "perpetual",
      maxActivations: 1,
      renewalPeriodDays: 365,
      autoRenew: false,
      features: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(db.getProductById).mockResolvedValue({
      id: 2,
      name: "Desktop App",
      description: null,
      require2FA: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getCheckoutResult({ sessionId: "cs_test_1" });

    expect(result.readyToActivate).toBe(true);
    expect(result.licenseKey).toBe("AAAA-BBBB-CCCC-DDDD");
    expect(result.billingModel).toBe("one_time");
  });
});

describe("handleSubscriptionCanceled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes linked license", async () => {
    vi.mocked(db.getLicenseByStripeSubscriptionId).mockResolvedValue({
      id: 1,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      productId: 2,
      customerId: 9,
      stripeSubscriptionId: "sub_123",
      type: "subscription",
      status: "active",
      maxActivations: 1,
      expiresAt: new Date("2026-01-01"),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handleSubscriptionCanceled({
      id: "sub_123",
      status: "canceled",
    } as Stripe.Subscription);

    expect(result.handled).toBe(true);
    expect(db.revokeLicense).toHaveBeenCalledWith("AAAA-BBBB-CCCC-DDDD");
  });
});
