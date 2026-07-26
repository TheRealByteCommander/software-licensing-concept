import type { Express, Request, Response } from "express";
import { processStripeWebhook } from "./stripe";

export function registerStripeWebhookRoute(app: Express) {
  app.post(
    "/api/stripe/webhook",
    async (req: Request, res: Response) => {
      try {
        const payload = req.body as Buffer;
        if (!Buffer.isBuffer(payload) || payload.length === 0) {
          return res.status(400).json({ error: "Invalid webhook payload" });
        }

        const result = await processStripeWebhook(payload, req.headers["stripe-signature"]);
        return res.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Webhook processing failed";
        console.error("[Stripe Webhook]", message);
        return res.status(400).json({ error: message });
      }
    }
  );
}
