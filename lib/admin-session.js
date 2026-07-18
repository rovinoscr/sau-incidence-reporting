import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "sau_admin_session";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "development-session-secret";
}

function createSessionToken(password) {
  return createHmac("sha256", getSessionSecret()).update(password).digest("hex");
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
  return Boolean(getAdminPassword());
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

  return safeEqual(session, createSessionToken(getAdminPassword()));
}

export async function login(password) {
  if (!hasConfiguredAdminPassword() || !safeEqual(password, getAdminPassword())) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(getAdminPassword()), {
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
