import crypto from "crypto";
import bcrypt from "bcryptjs";

/** randomSlug(len): produce a short alphanumeric slug */
export const randomSlug = (len = 7) =>
  crypto.randomBytes(16).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, len);

/** hash(s): sha256 hex digest */
export const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** maybeHashIp(ip): anonymize IP by hashing with IP_SALT */
export const maybeHashIp = (ip) => {
  if (!ip) return null;
  const salt = process.env.IP_SALT || "default_salt_change_me";
  return hash(ip + salt);
};

/** password helpers */
export const hashPassword = async (pwd) => await bcrypt.hash(pwd, 10);
export const checkPassword = async (pwd, hash) => await bcrypt.compare(pwd, hash);
