import crypto from "crypto";
import axios from "axios";
import * as db from "./db";

export const WEBHOOK_EVENTS = [
  "license.activated",
  "license.deactivated",
  "license.revoked",
  "license.expired",
  "license.renewed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
};

function signPayload(secret: string | null | undefined, body: string): string | undefined {
  if (!secret) return undefined;
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const hooks = await db.getActiveWebhooksForEvent(event);
  if (!hooks.length) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    hooks.map(async hook => {
      const signature = signPayload(hook.secret, body);
      await axios.post(hook.url, payload, {
        timeout: 8000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ByteCommander-LicenseServer/1.0",
          ...(signature ? { "X-License-Signature": signature } : {}),
        },
        validateStatus: () => true,
      });
    })
  );
}
