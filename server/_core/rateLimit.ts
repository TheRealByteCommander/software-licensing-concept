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

export function isPublicApiPath(path: string): boolean {
  return (
    path.startsWith("/api.activate") ||
    path.startsWith("/api.validate") ||
    path.startsWith("/api.deactivate") ||
    path.startsWith("/twoFA.initiateActivation") ||
    path.startsWith("/twoFA.confirmActivation")
  );
}
