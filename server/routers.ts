import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateLicenseKey, generateLicenseToken, verifyLicenseToken } from "./licenseUtils";
import { TRPCError } from "@trpc/server";
import { twoFARouter } from "./twoFARouter";

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
        expiresAt: z.string().optional(),
        metadata: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { licenseKey, ...data } = input;
        const updateData: any = { ...data };
        if (data.expiresAt) {
          updateData.expiresAt = new Date(data.expiresAt);
        }
        await db.updateLicense(licenseKey, updateData);
        return { success: true };
      }),
    
    revoke: protectedProcedure
      .input(z.object({ licenseKey: z.string() }))
      .mutation(async ({ input }) => {
        await db.revokeLicense(input.licenseKey);
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
        // Get license
        const license = await db.getLicenseByKey(input.licenseKey);
        if (!license) {
          throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });
        }

        // Get product to check if 2FA is required
        const product = await db.getProductById(license.productId);
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        }

        // Check license status
        if (license.status !== "active") {
          throw new TRPCError({ code: "FORBIDDEN", message: `License is ${license.status}` });
        }

        // Check expiration
        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
          await db.updateLicense(input.licenseKey, { status: "expired" });
          throw new TRPCError({ code: "FORBIDDEN", message: "License has expired" });
        }

        // Check if already activated on this device
        const existingActivation = await db.getActivationByDeviceAndLicense(
          input.licenseKey,
          input.deviceId
        );

        if (existingActivation) {
          // Update validation timestamp
          await db.updateActivationValidation(existingActivation.id);
          
          // Generate token
          const token = generateLicenseToken({
            licenseKey: input.licenseKey,
            productId: license.productId,
            deviceId: input.deviceId,
            expiresAt: license.expiresAt,
            features: license.metadata ? JSON.parse(license.metadata).features : [],
          });

          return { success: true, token, message: "Already activated" };
        }

        // NEW ACTIVATION - Check if 2FA is required
        if (product.require2FA) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "2FA required for this product. Use twoFA.initiateActivation endpoint.",
          });
        }

        // Check activation limit
        const activeActivations = await db.getActivationsByLicense(input.licenseKey);
        if (license.maxActivations && activeActivations.length >= license.maxActivations) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Maximum activations (${license.maxActivations}) reached`,
          });
        }

        // Create new activation
        await db.createActivation({
          licenseKey: input.licenseKey,
          deviceId: input.deviceId,
          deviceInfo: input.deviceInfo,
        });

        // Generate token
        const token = generateLicenseToken({
          licenseKey: input.licenseKey,
          productId: license.productId,
          deviceId: input.deviceId,
          expiresAt: license.expiresAt,
          features: license.metadata ? JSON.parse(license.metadata).features : [],
        });

        return { success: true, token, message: "Activation successful" };
      }),

    validate: publicProcedure
      .input(z.object({
        token: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Verify token signature and expiration
          const decoded = verifyLicenseToken(input.token);

          // Get license from database
          const license = await db.getLicenseByKey(decoded.licenseKey);
          if (!license) {
            throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });
          }

          // Check license status
          if (license.status !== "active") {
            return { valid: false, message: `License is ${license.status}` };
          }

          // Check expiration
          if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
            await db.updateLicense(decoded.licenseKey, { status: "expired" });
            return { valid: false, message: "License has expired" };
          }

          // Update validation timestamp
          const activation = await db.getActivationByDeviceAndLicense(
            decoded.licenseKey,
            decoded.deviceId
          );
          if (activation) {
            await db.updateActivationValidation(activation.id);
          }

          return {
            valid: true,
            license: {
              productId: license.productId,
              type: license.type,
              expiresAt: license.expiresAt,
              features: license.metadata ? JSON.parse(license.metadata).features : [],
            },
          };
        } catch (error) {
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
        return { success: true, message: "Deactivation successful" };
      }),
  }),

  // Activations Management
  activations: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllActivations();
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
    
    create: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        company: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createCustomer(input);
        return { success: true };
      }),
  }),
  twoFA: twoFARouter,
});

export type AppRouter = typeof appRouter;
