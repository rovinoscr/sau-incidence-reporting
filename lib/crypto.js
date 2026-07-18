import { createCipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const secret = process.env.EMAIL_ENCRYPTION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_ENCRYPTION_SECRET must be configured in production.");
    }

    return createHash("sha256").update("local-development-only-secret").digest();
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptEmail(email) {
  if (!email) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(email.trim().toLowerCase(), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}
