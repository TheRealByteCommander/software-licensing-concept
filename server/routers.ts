import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { evaluateAdminUserChange } from "@shared/adminUsers";
import { generateLicenseKey, verifyLicenseToken } from "./licenseUtils";
import { TRPCError } from "@trpc/server";
import { buildLicenseAccessGrant, toActivationPayload } from "./licenseGrant";
import { normalizeFeatureList, serializeFeatureList } from "@shared/licenseMetadata";
import { twoFARouter } from "./twoFARouter";
import { webhooksRouter } from "./webhooksRouter";
import { stripeRouter } from "./stripeRouter";
import { filterActiveActivations, isActivationStale, isSeatLimitReached } from "./licensePolicy";
import {
  prepareLicenseForUse,
  licensesToCsv,
  releaseLicenseSeat,
  resolveExpectedProductId,
} from "./licenseFlow";
import { dispatchWebhookEvent } from "./webhooks";
import type { Product } from "../drizzle/schema";

function mapProductRow(product: Product) {
  return {
    ...product,
    defaultFeatures: normalizeFeatureList(product.defaultFeatures),
  };
}

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
      const rows = await db.getAllProducts();
      return rows.map(mapProductRow);
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const row = await db.getProductById(input.id);
        return row ? mapProductRow(row) : undefined;
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        defaultFeatures: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createProduct({
          name: input.name,
          description: input.description,
          defaultFeatures: serializeFeatureList(input.defaultFeatures),
        });
        return { success: true, id, name: input.name };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        defaultFeatures: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, defaultFeatures, ...data } = input;
        await db.updateProduct(id, {
          ...data,
          ...(defaultFeatures !== undefined
            ? { defaultFeatures: serializeFeatureList(defaultFeatures) ?? null }
            : {}),
        });
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
        productId: z.number().int().positive().optional(),
        expectedProductId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input }) => {
        const { license, metadata } = await prepareLicenseForUse(input.licenseKey, {
          expectedProductId: resolveExpectedProductId(input),
        });

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
          const grant = buildLicenseAccessGrant({
            license,
            product,
            deviceId: input.deviceId,
          });
          return toActivationPayload(grant, "Already activated");
        }

        if (product.require2FA) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "2FA required for this product. Use twoFA.initiateActivation endpoint.",
          });
        }

        let occupiedSeats = filterActiveActivations(await db.getActivationsByLicense(input.licenseKey));

        if (metadata.staleActivationDays && metadata.staleActivationDays > 0) {
          const staleIds = occupiedSeats
            .filter(a => isActivationStale(a.lastValidatedAt, metadata.staleActivationDays!))
            .map(a => a.id);

          if (staleIds.length > 0) {
            await db.deactivateActivations(staleIds);
            occupiedSeats = occupiedSeats.filter(a => !staleIds.includes(a.id));
          }
        }

        if (isSeatLimitReached(occupiedSeats.length, license.maxActivations)) {
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

        const grant = buildLicenseAccessGrant({
          license,
          product,
          deviceId: input.deviceId,
        });

        void dispatchWebhookEvent("license.activated", {
          licenseKey: input.licenseKey,
          productId: license.productId,
          deviceId: input.deviceId,
        });

        return toActivationPayload(grant, "Activation successful");
      }),

    validate: publicProcedure
      .input(z.object({
        token: z.string(),
        productId: z.number().int().positive().optional(),
        expectedProductId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const decoded = verifyLicenseToken(input.token);
          const { license } = await prepareLicenseForUse(decoded.licenseKey, {
            expectedProductId: resolveExpectedProductId(input),
          });

          const activation = await db.getActivationByDeviceAndLicense(
            decoded.licenseKey,
            decoded.deviceId
          );
          if (!activation) {
            return { valid: false, message: "Activation not found for this device" };
          }

          await db.updateActivationValidation(activation.id);

          const product = await db.getProductById(license.productId);
          const grant = buildLicenseAccessGrant({
            license,
            product,
            deviceId: decoded.deviceId,
          });

          return {
            valid: true,
            token: grant.token,
            license: {
              productId: license.productId,
              type: license.type,
              expiresAt: license.expiresAt,
              features: grant.features,
              offlineGraceHours: grant.offlineGraceHours,
              offlineUntil: grant.offlineUntil,
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
        const { alreadyReleased } = await releaseLicenseSeat(input.licenseKey, input.deviceId);

        if (!alreadyReleased) {
          void dispatchWebhookEvent("license.deactivated", {
            licenseKey: input.licenseKey,
            deviceId: input.deviceId,
          });
        }

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

  // Admin portal accounts (OAuth + local-auth users table). Not license customers.
  users: router({
    list: adminProcedure.query(async () => {
      await db.ensureLocalAdminUser();
      return await db.getAllUsers();
    }),

    setRole: adminProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const [target, allUsers] = await Promise.all([
          db.getUserById(input.id),
          db.getAllUsers(),
        ]);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const decision = evaluateAdminUserChange({
          actorId: ctx.user.id,
          target,
          users: allUsers,
          action: { type: "setRole", role: input.role },
        });
        if (!decision.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: decision.message });
        }

        await db.updateUser(input.id, { role: input.role });
        return { success: true };
      }),

    setDisabled: adminProcedure
      .input(z.object({
        id: z.number(),
        disabled: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const [target, allUsers] = await Promise.all([
          db.getUserById(input.id),
          db.getAllUsers(),
        ]);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const decision = evaluateAdminUserChange({
          actorId: ctx.user.id,
          target,
          users: allUsers,
          action: { type: "setDisabled", disabled: input.disabled },
        });
        if (!decision.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: decision.message });
        }

        await db.updateUser(input.id, { disabled: input.disabled });
        return { success: true };
      }),
  }),
  twoFA: twoFARouter,
  webhooks: webhooksRouter,
  stripe: stripeRouter,
});

export type AppRouter = typeof appRouter;
