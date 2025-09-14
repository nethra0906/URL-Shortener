// Very simple in-memory per-IP token bucket limiting.
// For production, replace with Redis or API Gateway/WAF.

const buckets = new Map();

export default function rateLimit({ limit = 120, windowMs = 60_000 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    const b = buckets.get(ip) || { tokens: limit, ts: now };
    const elapsed = now - b.ts;
    const refillWindows = Math.floor(elapsed / windowMs);
    if (refillWindows > 0) {
      b.tokens = Math.min(limit, b.tokens + refillWindows * limit);
      b.ts = now;
    }
    if (b.tokens <= 0) return res.status(429).json({ error: "Too many requests" });
    b.tokens -= 1;
    buckets.set(ip, b);
    next();
  };
}
