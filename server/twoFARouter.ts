import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateTwoFASecret, generateQRCodeDataUrl, verifyTOTP, generateBackupCodes } from "./twoFAUtils";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { prepareLicenseForUse } from "./licenseFlow";
import { dispatchWebhookEvent } from "./webhooks";

export const twoFARouter = router({
  /**
   * Setup 2FA for a product (admin only)
   */
  setupTwoFA: protectedProcedure
    .input(z.object({
      productId: z.number(),
    }))
    .mutation(async ({ input }) => {
      // Generate new secret
      const { secret } = generateTwoFASecret(`Product ${input.productId}`);
      
      // Generate backup codes
      const backupCodes = generateBackupCodes(10);
      
      // Save to database
      await db.createTwoFASecret({
        productId: input.productId,
        secret,
        backupCodes: JSON.stringify(backupCodes),
      });

      // Generate QR code
      const qrCode = await generateQRCodeDataUrl(secret, `Product ${input.productId}`);

      return {
        success: true,
        secret,
        qrCode,
        backupCodes,
      };
    }),

  /**
   * Get 2FA setup status for a product
   */
  getStatus: protectedProcedure
    .input(z.object({
      productId: z.number(),
    }))
    .query(async ({ input }) => {
      const twoFASecret = await db.getTwoFASecretByProductId(input.productId);
      const product = await db.getProductById(input.productId);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      return {
        productId: input.productId,
        require2FA: product.require2FA,
        isConfigured: !!twoFASecret,
      };
    }),

  /**
   * Enable 2FA requirement for a product
   */
  enableFor2FA: protectedProcedure
    .input(z.object({
      productId: z.number(),
    }))
    .mutation(async ({ input }) => {
      // Check if 2FA secret exists
      const twoFASecret = await db.getTwoFASecretByProductId(input.productId);
      if (!twoFASecret) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA must be configured before enabling",
      });
      }

      // Enable 2FA requirement
      await db.updateProduct(input.productId, { require2FA: true });

      return { success: true };
    }),

  /**
   * Disable 2FA requirement for a product
   */
  disableFor2FA: protectedProcedure
    .input(z.object({
      productId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await db.updateProduct(input.productId, { require2FA: false });
      return { success: true };
    }),

  /**
   * Initiate license activation (returns activation token)
   */
  initiateActivation: publicProcedure
    .input(z.object({
      licenseKey: z.string(),
      deviceId: z.string(),
      deviceInfo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { license } = await prepareLicenseForUse(input.licenseKey);

      const product = await db.getProductById(license.productId);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      // Check if 2FA is required
      if (!product.require2FA) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use regular activation endpoint for non-2FA products",
        });
      }

      const existingActivation = await db.getActivationByDeviceAndLicense(
        input.licenseKey,
        input.deviceId
      );
      if (existingActivation) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "License is already activated on this device",
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

      // Create activation token
      const activationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await db.createActivationToken({
        token: activationToken,
        licenseKey: input.licenseKey,
        deviceId: input.deviceId,
        deviceInfo: input.deviceInfo,
        expiresAt,
      });

      return {
        success: true,
        activationToken,
        expiresIn: 600, // 10 minutes in seconds
      };
    }),

  /**
   * Confirm activation with TOTP code
   */
  confirmActivationWith2FA: publicProcedure
    .input(z.object({
      activationToken: z.string(),
      totpCode: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Get activation token
      const token = await db.getActivationTokenByToken(input.activationToken);
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Activation token not found or expired",
        });
      }

      if (new Date(token.expiresAt) < new Date()) {
        await db.deleteActivationToken(input.activationToken);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Activation token has expired",
        });
      }

      const { license } = await prepareLicenseForUse(token.licenseKey);

      const product = await db.getProductById(license.productId);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      // Get 2FA secret
      const twoFASecret = await db.getTwoFASecretByProductId(product.id);
      if (!twoFASecret) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA not configured for this product",
      });
      }

      // Verify TOTP code
      const isValid = verifyTOTP(twoFASecret.secret, input.totpCode);
      if (!isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid TOTP code",
      });
      }

      // Delete the activation token
      await db.deleteActivationToken(input.activationToken);

      const activeActivations = await db.getActivationsByLicense(token.licenseKey);
      if (license.maxActivations && activeActivations.length >= license.maxActivations) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Maximum activations (${license.maxActivations}) reached`,
        });
      }

      // Create activation
      await db.createActivation({
        licenseKey: token.licenseKey,
        deviceId: token.deviceId,
        deviceInfo: token.deviceInfo,
      });

      // Generate license token
      const { generateLicenseToken } = await import("./licenseUtils");
      const metadata = license.metadata ? JSON.parse(license.metadata) : {};
      const licenseToken = generateLicenseToken({
        licenseKey: token.licenseKey,
        productId: license.productId,
        deviceId: token.deviceId,
        expiresAt: license.expiresAt,
        features: metadata.features ?? [],
      });

      void dispatchWebhookEvent("license.activated", {
        licenseKey: token.licenseKey,
        productId: license.productId,
        deviceId: token.deviceId,
        via2FA: true,
      });

      return {
        success: true,
        token: licenseToken,
        message: "2FA verification successful, license activated",
      };
    }),
});
