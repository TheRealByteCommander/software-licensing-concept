import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateLicenseKey, generateLicenseToken, verifyLicenseToken } from "./licenseUtils";
import { TRPCError } from "@trpc/server";
import { twoFARouter } from "./twoFARouter";
import { webhooksRouter } from "./webhooksRouter";
import { stripeRouter } from "./stripeRouter";
import { isActivationStale } from "./licensePolicy";
import { prepareLicenseForUse, licensesToCsv } from "./licenseFlow";
import { dispatchWebhookEvent } from "./webhooks";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Products Management
  products: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllProducts();
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createProduct(input);
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProduct(input.id);
        return { success: true };
      }),
  }),

  // Licenses Management
  licenses: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllLicenses();
    }),
    
    get: protectedProcedure
      .input(z.object({ licenseKey: z.string() }))
      .query(async ({ input }) => {
        return await db.getLicenseByKey(input.licenseKey);
      }),
    
    create: protectedProcedure
      .input(z.object({
        productId: z.number(),
        customerId: z.number().optional(),
        type: z.enum(["subscription", "perpetual", "node_locked", "user_based", "feature_based"]),
        maxActivations: z.number().default(1),
        expiresAt: z.string().optional(), // ISO date string
        metadata: z.string().optional(), // JSON string
      }))
      .mutation(async ({ input }) => {
        const licenseKey = generateLicenseKey();
        await db.createLicense({
          licenseKey,
          productId: input.productId,
          customerId: input.customerId,
          type: input.type,
          maxActivations: input.maxActivations,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          metadata: input.metadata,
          status: "active",
        });
        return { success: true, licenseKey };
      }),
    
    update: protectedProcedure
      .input(z.object({
        licenseKey: z.string(),
        status: z.enum(["active", "expired", "revoked", "grace_period"]).optional(),
        maxActivations: z.number().optional(),
        customerId: z.number().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
        metadata: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { licenseKey, ...data } = input;
        const updateData: Record<string, unknown> = {};

        if (data.status !== undefined) updateData.status = data.status;
        if (data.maxActivations !== undefined) updateData.maxActivations = data.maxActivations;
        if (data.customerId !== undefined) updateData.customerId = data.customerId;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;

        if (data.expiresAt === null) {
          updateData.expiresAt = null;
        } else if (data.expiresAt) {
          updateData.expiresAt = new Date(data.expiresAt);
        }

        await db.updateLicense(licenseKey, updateData);
        return { success: true };
      }),

    exportCsv: protectedProcedure.query(async () => {
      const [licenseRows, productRows, customerRows] = await Promise.all([
        db.getAllLicenses(),
        db.getAllProducts(),
        db.getAllCustomers(),
      ]);

      const productNameById = new Map(productRows.map(product => [product.id, product.name]));
      const customerLabelById = new Map(
        customerRows.map(customer => [
          customer.id,
          customer.name ? `${customer.name} <${customer.email}>` : customer.email,
        ])
      );

      const csv = licensesToCsv(licenseRows, productNameById, customerLabelById);
      const filename = `licenses-${new Date().toISOString().slice(0, 10)}.csv`;

      return { csv, filename };
    }),
    
    revoke: protectedProcedure
      .input(z.object({ licenseKey: z.string() }))
      .mutation(async ({ input }) => {
        const license = await db.getLicenseByKey(input.licenseKey);
        await db.revokeLicense(input.licenseKey);
        void dispatchWebhookEvent("license.revoked", {
          licenseKey: input.licenseKey,
          productId: license?.productId,
        });
        return { success: true };
      }),
  }),

  // License Activation & Validation (Public API)
  api: router({
    activate: publicProcedure
      .input(z.object({
        licenseKey: z.string(),
        deviceId: z.string(),
        deviceInfo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { license, metadata } = await prepareLicenseForUse(input.licenseKey);

        const product = await db.getProductById(license.productId);
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        }

        const existingActivation = await db.getActivationByDeviceAndLicense(
          input.licenseKey,
          input.deviceId
        );

        if (existingActivation) {
          await db.updateActivationValidation(existingActivation.id);

          const token = generateLicenseToken({
            licenseKey: input.licenseKey,
            productId: license.productId,
            deviceId: input.deviceId,
            expiresAt: license.expiresAt,
            features: metadata.features ?? [],
          });

          return { success: true, token, message: "Already activated" };
        }

        if (product.require2FA) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "2FA required for this product. Use twoFA.initiateActivation endpoint.",
          });
        }

        let activeActivations = await db.getActivationsByLicense(input.licenseKey);

        if (metadata.staleActivationDays && metadata.staleActivationDays > 0) {
          const staleIds = activeActivations
            .filter(a => isActivationStale(a.lastValidatedAt, metadata.staleActivationDays!))
            .map(a => a.id);

          if (staleIds.length > 0) {
            await db.deactivateActivations(staleIds);
            activeActivations = activeActivations.filter(a => !staleIds.includes(a.id));
          }
        }

        if (license.maxActivations && activeActivations.length >= license.maxActivations) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Maximum activations (${license.maxActivations}) reached`,
          });
        }

        await db.createActivation({
          licenseKey: input.licenseKey,
          deviceId: input.deviceId,
          deviceInfo: input.deviceInfo,
        });

        const token = generateLicenseToken({
          licenseKey: input.licenseKey,
          productId: license.productId,
          deviceId: input.deviceId,
          expiresAt: license.expiresAt,
          features: metadata.features ?? [],
        });

        void dispatchWebhookEvent("license.activated", {
          licenseKey: input.licenseKey,
          productId: license.productId,
          deviceId: input.deviceId,
        });

        return { success: true, token, message: "Activation successful" };
      }),

    validate: publicProcedure
      .input(z.object({
        token: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const decoded = verifyLicenseToken(input.token);
          const { license, metadata } = await prepareLicenseForUse(decoded.licenseKey);

          const activation = await db.getActivationByDeviceAndLicense(
            decoded.licenseKey,
            decoded.deviceId
          );
          if (!activation) {
            return { valid: false, message: "Activation not found for this device" };
          }

          await db.updateActivationValidation(activation.id);

          return {
            valid: true,
            license: {
              productId: license.productId,
              type: license.type,
              expiresAt: license.expiresAt,
              features: metadata.features ?? [],
            },
          };
        } catch (error) {
          if (error instanceof TRPCError) {
            return { valid: false, message: error.message };
          }
          return { valid: false, message: "Invalid or expired token" };
        }
      }),

    deactivate: publicProcedure
      .input(z.object({
        licenseKey: z.string(),
        deviceId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const activation = await db.getActivationByDeviceAndLicense(
          input.licenseKey,
          input.deviceId
        );

        if (!activation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Activation not found" });
        }

        await db.deactivateActivation(activation.id);

        void dispatchWebhookEvent("license.deactivated", {
          licenseKey: input.licenseKey,
          deviceId: input.deviceId,
        });

        return { success: true, message: "Deactivation successful" };
      }),
  }),

  // Activations Management
  activations: router({
    list: protectedProcedure
      .input(
        z
          .object({
            productId: z.number().optional(),
            status: z.enum(["active", "deactivated", "all"]).optional(),
            licenseKey: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return await db.getAllActivations(input ?? undefined);
      }),
    
    byLicense: protectedProcedure
      .input(z.object({ licenseKey: z.string() }))
      .query(async ({ input }) => {
        return await db.getActivationsByLicense(input.licenseKey);
      }),
  }),

  // Customers Management
  customers: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCustomers();
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerById(input.id);
      }),

    licenses: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLicensesByCustomerId(input.customerId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        company: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createCustomer({
          userId: ctx.user?.id && ctx.user.id > 0 ? ctx.user.id : null,
          email: input.email,
          name: input.name,
          company: input.company,
        });
        return { success: true };
      }),
  }),
  twoFA: twoFARouter,
  webhooks: webhooksRouter,
  stripe: stripeRouter,
});

export type AppRouter = typeof appRouter;
