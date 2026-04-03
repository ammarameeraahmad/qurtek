import { NextRequest, NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
};

type GlobalStore = typeof globalThis & {
  __qurtekRateLimitStore?: Map<string, RateLimitEntry>;
};

function getStore() {
  const globalStore = globalThis as GlobalStore;
  if (!globalStore.__qurtekRateLimitStore) {
    globalStore.__qurtekRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalStore.__qurtekRateLimitStore;
}

function cleanupExpired(now: number) {
  const store = getStore();
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0];
    if (first?.trim()) return first.trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  return "unknown";
}

export function enforceRateLimit(req: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpired(now);

  const store = getStore();
  const key = `${options.key}:${getClientIp(req)}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return null;
  }

  if (existing.count >= options.maxRequests) {
    const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);

    return NextResponse.json(
      { error: options.message },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  existing.count += 1;
  store.set(key, existing);
  return null;
}
