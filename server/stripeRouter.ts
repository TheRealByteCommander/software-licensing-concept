import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  cancelSubscription,
  createCheckoutSession,
  createCustomerPortalSession,
  getCheckoutResult,
  getLicenseBilling,
  isStripeConfigured,
  parseBillingPlanFeatures,
  serializeBillingPlanFeatures,
} from "./stripe";
import { ENV } from "./_core/env";
import { formatProductLabel } from "@shared/productLabel";

const billingModelSchema = z.enum(["subscription", "one_time"]);

const licenseTypeSchema = z.enum([
  "subscription",
  "perpetual",
  "node_locked",
  "user_based",
  "feature_based",
]);

export const stripeRouter = router({
  status: publicProcedure.query(() => ({
    configured: isStripeConfigured(),
    publishableKey: ENV.stripePublishableKey || null,
  })),

  plans: router({
    listPublic: publicProcedure.query(async () => {
      const plans = await db.getActiveBillingPlans();
      const products = await db.getAllProducts();
      const productNameById = new Map(products.map(product => [product.id, product.name]));

      return plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        productId: plan.productId,
        productName: productNameById.get(plan.productId) ?? `Product #${plan.productId}`,
        billingModel: plan.billingModel,
        licenseType: plan.licenseType,
        maxActivations: plan.maxActivations,
        renewalPeriodDays: plan.renewalPeriodDays,
        features: parseBillingPlanFeatures(plan.features),
      }));
    }),

    list: protectedProcedure.query(async () => {
      const [plans, products] = await Promise.all([
        db.getAllBillingPlans(),
        db.getAllProducts(),
      ]);
      const productNameById = new Map(products.map(product => [product.id, product.name]));

      return plans.map(plan => ({
        ...plan,
        productName: formatProductLabel(plan.productId, productNameById.get(plan.productId)),
        features: parseBillingPlanFeatures(plan.features),
      }));
    }),

    create: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          name: z.string().min(1),
          stripePriceId: z.string().min(1),
          billingModel: billingModelSchema,
          licenseType: licenseTypeSchema,
          maxActivations: z.number().int().min(1).default(1),
          renewalPeriodDays: z.number().int().min(1).default(365),
          autoRenew: z.boolean().default(true),
          features: z.array(z.string()).optional(),
          active: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        if (!isStripeConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Stripe is not configured",
          });
        }

        const product = await db.getProductById(input.productId);
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        }

        await db.createBillingPlan({
          productId: input.productId,
          name: input.name,
          stripePriceId: input.stripePriceId,
          billingModel: input.billingModel,
          licenseType: input.licenseType,
          maxActivations: input.maxActivations,
          renewalPeriodDays: input.renewalPeriodDays,
          autoRenew: input.autoRenew,
          features: serializeBillingPlanFeatures(input.features),
          active: input.active,
        });

        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          stripePriceId: z.string().min(1).optional(),
          billingModel: billingModelSchema.optional(),
          licenseType: licenseTypeSchema.optional(),
          maxActivations: z.number().int().min(1).optional(),
          renewalPeriodDays: z.number().int().min(1).optional(),
          autoRenew: z.boolean().optional(),
          features: z.array(z.string()).optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, features, ...rest } = input;
        const updateData: Record<string, unknown> = { ...rest };

        if (features !== undefined) {
          updateData.features = serializeBillingPlanFeatures(features);
        }

        await db.updateBillingPlan(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteBillingPlan(input.id);
        return { success: true };
      }),
  }),

  payments: router({
    list: protectedProcedure.query(async () => {
      const [payments, plans, customers] = await Promise.all([
        db.getAllStripePayments(),
        db.getAllBillingPlans(),
        db.getAllCustomers(),
      ]);

      const planNameById = new Map(plans.map(plan => [plan.id, plan.name]));
      const customerLabelById = new Map(
        customers.map(customer => [
          customer.id,
          customer.name ? `${customer.name} <${customer.email}>` : customer.email,
        ])
      );

      return payments.map(payment => ({
        ...payment,
        planName: planNameById.get(payment.billingPlanId) ?? `#${payment.billingPlanId}`,
        customerLabel: payment.customerId
          ? customerLabelById.get(payment.customerId) ?? `#${payment.customerId}`
          : null,
      }));
    }),
  }),

  createCheckoutSession: publicProcedure
    .input(
      z.object({
        billingPlanId: z.number(),
        customerEmail: z.string().email(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      return await createCheckoutSession(input);
    }),

  getCheckoutResult: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        email: z.string().email().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getCheckoutResult(input);
    }),

  getLicenseBilling: publicProcedure
    .input(
      z.object({
        licenseKey: z.string().min(1),
        customerEmail: z.string().email(),
      })
    )
    .query(async ({ input }) => {
      return await getLicenseBilling(input);
    }),

  createCustomerPortalSession: publicProcedure
    .input(
      z.object({
        licenseKey: z.string().min(1),
        customerEmail: z.string().email(),
        returnUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      return await createCustomerPortalSession(input);
    }),

  cancelSubscription: publicProcedure
    .input(
      z.object({
        licenseKey: z.string().min(1),
        customerEmail: z.string().email(),
        cancelAtPeriodEnd: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await cancelSubscription(input);
    }),
});
