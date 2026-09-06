import type { Request, Response, NextFunction } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim();

  return forwarded || req.ip || "unknown";
}

function cleanupExpired(now: number) {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    cleanupExpired(now);

    const key = `${getClientKey(req)}:${req.path}`;
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      return res.status(429).json({
        error: "Too many requests",
        retryAfterSeconds,
      });
    }

    existing.count += 1;
    return next();
  };
}

export function getRequestClientKey(req: Request): string {
  return getClientKey(req);
}

export class AttemptLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly maxAttempts: number
  ) {}

  consume(req: Request): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const now = Date.now();
    this.buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    });

    const key = getClientKey(req);
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true };
    }

    if (existing.count >= this.maxAttempts) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return { ok: true };
  }

  reset() {
    this.buckets.clear();
  }
}

export function isPublicApiPath(path: string): boolean {
  return (
    path.startsWith("/api.activate") ||
    path.startsWith("/api.validate") ||
    path.startsWith("/api.deactivate") ||
    path.startsWith("/twoFA.initiateActivation") ||
    path.startsWith("/twoFA.confirmActivation") ||
    path.startsWith("/stripe.createCheckoutSession") ||
    path.startsWith("/stripe.getCheckoutResult")
  );
}

export function isLocalAuthPath(path: string): boolean {
  return /auth\.(localLogin|localVerifyTotp|localSetupStart|localSetupConfirm)\b/.test(path);
}
