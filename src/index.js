import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import Joi from "joi";
import { PrismaClient } from "@prisma/client";
import rateLimit from "./rateLimit.js";
import QRCode from "qrcode";
import { randomSlug, maybeHashIp, hashPassword, checkPassword } from "./utils.js";

const prisma = new PrismaClient();
const app = express();

const {
  BASE_URL = "http://localhost:3000",
  ADMIN_API_KEY,
  PORT = 3000
} = process.env;

app.set("trust proxy", true); // trust x-forwarded-for when behind ALB/proxy
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));
app.use(rateLimit({ limit: 120, windowMs: 60_000 }));

// small middleware for admin endpoints
const adminOnly = (req, res, next) => {
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "Server admin key not configured" });
  if (req.header("x-api-key") !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
};

/**
 * POST /api/shorten
 * Body: { target, customSlug?, expiresAt?, password? }
 */
app.post("/api/shorten", async (req, res) => {
  const schema = Joi.object({
    target: Joi.string().uri().required(),
    customSlug: Joi.string().alphanum().min(4).max(64).optional(),
    expiresAt: Joi.date().optional(),
    password: Joi.string().min(4).max(128).optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const slug = value.customSlug || randomSlug(7);
  const existing = await prisma.link.findUnique({ where: { slug } });
  if (existing) return res.status(409).json({ error: "Slug already taken" });

  const passwordHash = value.password ? await hashPassword(value.password) : null;

  const link = await prisma.link.create({
    data: {
      slug,
      target: value.target,
      expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
      passwordHash
    }
  });

  return res.json({
    slug,
    shortUrl: `${BASE_URL.replace(/\/$/, "")}/${slug}`,
    expiresAt: link.expiresAt
  });
});

/**
 * POST /api/:slug/unlock
 * Body: { password }
 * If correct password, returns { target } so client can redirect.
 */
app.post("/api/:slug/unlock", async (req, res) => {
  const { slug } = req.params;
  const { password } = req.body || {};
  const link = await prisma.link.findUnique({ where: { slug } });
  if (!link || !link.isActive) return res.status(404).json({ error: "Not found" });
  if (!link.passwordHash) return res.status(400).json({ error: "Not password protected" });
  const ok = await checkPassword(password || "", link.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid password" });
  return res.json({ target: link.target });
});

/**
 * GET /api/:slug/stats
 * Public limited stats — in production require admin/auth
 */
app.get("/api/:slug/stats", async (req, res) => {
  const { slug } = req.params;
  const link = await prisma.link.findUnique({
    where: { slug },
    include: { clicks: { select: { id: true, at: true, referer: true, ua: true }, take: 50, orderBy: { at: "desc" } } }
  });
  if (!link) return res.status(404).json({ error: "Not found" });
  return res.json({
    slug,
    target: link.target,
    isActive: link.isActive,
    expiresAt: link.expiresAt,
    totalClicks: link.totalClicks,
    recentClicks: link.clicks
  });
});

/**
 * PATCH /api/:slug  (admin only)
 * Body: { isActive?, expiresAt?, rotateSlug? }
 */
app.patch("/api/:slug", adminOnly, async (req, res) => {
  const { slug } = req.params;
  const schema = Joi.object({
    isActive: Joi.boolean().optional(),
    expiresAt: Joi.date().allow(null).optional(),
    rotateSlug: Joi.boolean().optional()
  });
  const { error, value } = schema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });

  const data = {};
  if ("isActive" in value) data.isActive = value.isActive;
  if ("expiresAt" in value) data.expiresAt = value.expiresAt ? new Date(value.expiresAt) : null;
  if (value.rotateSlug) data.slug = randomSlug(7);

  try {
    const updated = await prisma.link.update({ where: { slug }, data });
    return res.json({ ok: true, slug: updated.slug });
  } catch (e) {
    return res.status(404).json({ error: "Not found or update failed" });
  }
});

/** GET /api/:slug/qr -> returns PNG of QR for the short url */
app.get("/api/:slug/qr", async (req, res) => {
  const { slug } = req.params;
  const link = await prisma.link.findUnique({ where: { slug } });
  if (!link) return res.status(404).send("Not found");
  const url = `${BASE_URL.replace(/\/$/, "")}/${link.slug}`;
  res.setHeader("Content-Type", "image/png");
  const buffer = await QRCode.toBuffer(url, { width: 512 });
  res.end(buffer);
});

/** Redirect route: GET /:slug */
app.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const link = await prisma.link.findUnique({ where: { slug } });
  if (!link || !link.isActive) return res.status(404).send("Not found");
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return res.status(410).send("Link expired");
  if (link.passwordHash) return res.status(401).send("Password required");

  // best-effort record
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0];
  const ipHash = maybeHashIp(ip);
  const ua = req.headers["user-agent"];
  const referer = req.headers["referer"];

  prisma.$transaction([
    prisma.click.create({ data: { linkId: link.id, ipHash, ua, referer } }),
    prisma.link.update({ where: { id: link.id }, data: { totalClicks: { increment: 1 } } })
  ]).catch(() => { /* ignore failures to not break redirect */ });

  return res.redirect(link.target);
});

/** Health */
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`Server listening on port ${PORT}`);
  } catch (e) {
    console.error("Prisma connection failed", e);
    process.exit(1);
  }
});
