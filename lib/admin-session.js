import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "sau_admin_session";

function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD || "";
}

function getSessionSecret() {
  if (process.env.ADMIN_SESSION_SECRET) {
    return process.env.ADMIN_SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET must be configured in production.");
  }

  return "development-session-secret";
}

function createSessionToken() {
  return createHmac("sha256", getSessionSecret()).update("authenticated").digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasConfiguredAdminPassword() {
  return Boolean(getAdminPasswordHash());
}

export async function isAuthenticated() {
  if (!hasConfiguredAdminPassword()) {
    return false;
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;

  if (!session) {
    return false;
  }

  return safeEqual(session, createSessionToken());
}

export async function login(password) {
  const hash = getAdminPasswordHash();
  if (!hasConfiguredAdminPassword()) {
    return false;
  }

  let passwordMatches;
  try {
    passwordMatches = await bcrypt.compare(password, hash);
  } catch {
    return false;
  }

  if (!passwordMatches) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return true;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireAdmin() {
  if (!(await isAuthenticated())) {
    redirect("/admin?auth=required");
  }
}
