import axios from "axios";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { WEBHOOK_EVENTS } from "./webhooks";

export const webhooksRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllWebhooks();
  }),

  create: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        secret: z.string().optional(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      await db.createWebhook({
        url: input.url,
        secret: input.secret ?? crypto.randomBytes(16).toString("hex"),
        events: JSON.stringify(input.events),
        active: input.active,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        url: z.string().url().optional(),
        secret: z.string().optional(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db.getWebhookById(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const { id, events, ...rest } = input;
      const updateData: {
        url?: string;
        secret?: string;
        events?: string;
        active?: boolean;
      } = { ...rest };

      if (events) {
        updateData.events = JSON.stringify(events);
      }

      await db.updateWebhook(id, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteWebhook(input.id);
      return { success: true };
    }),

  test: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const hook = await db.getWebhookById(input.id);
      if (!hook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const payload = {
        event: "webhook.test",
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          webhookId: hook.id,
          message: "Byte Commander webhook test event",
        },
      };
      const body = JSON.stringify(payload);
      const signature = hook.secret
        ? crypto.createHmac("sha256", hook.secret).update(body).digest("hex")
        : undefined;

      await axios.post(hook.url, payload, {
        timeout: 8000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Byte Commander License Server/1.0",
          ...(signature ? { "X-License-Signature": signature } : {}),
        },
        validateStatus: () => true,
      });

      return { success: true };
    }),
});
