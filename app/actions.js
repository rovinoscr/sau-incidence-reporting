"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createType, createReport, findActiveTypeById, toggleType, updateReportStatus } from "@/lib/db";
import { login, logout, requireAdmin } from "@/lib/admin-session";
import { MAX_PHOTOS, MAX_PHOTO_SIZE_BYTES, STATUS_OPTIONS } from "@/lib/constants";
import { encryptEmail } from "@/lib/crypto";

const allowedStatuses = new Set(STATUS_OPTIONS.map((status) => status.value));
const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function cleanRedirectTarget(target) {
  if (!target || typeof target !== "string" || !target.startsWith("/admin")) {
    return "/admin";
  }

  return target;
}

function withQueryMessage(pathname, key, value) {
  const [basePath, queryString = ""] = pathname.split("?");
  const params = new URLSearchParams(queryString);
  params.set(key, value);
  const nextQuery = params.toString();

  return nextQuery ? `${basePath}?${nextQuery}` : basePath;
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === value;
}

function parseReportInput(formData) {
  const incidenceDate = String(formData.get("incidenceDate") || "").trim();
  const typeId = Number(formData.get("typeId"));
  const reporterHouseNumber = String(formData.get("reporterHouseNumber") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const files = formData.getAll("photos").filter((entry) => entry && typeof entry === "object" && "size" in entry);

  if (!isValidIsoDate(incidenceDate)) {
    throw new Error("Please choose a valid incidence date.");
  }

  if (!Number.isInteger(typeId) || !findActiveTypeById(typeId)) {
    throw new Error("Please choose a valid incidence type.");
  }

  if (!reporterHouseNumber || reporterHouseNumber.length > 40) {
    throw new Error("Please provide a house number up to 40 characters.");
  }

  if (!description || description.length > 2000) {
    throw new Error("Please provide a description up to 2000 characters.");
  }

  if (email && !emailPattern.test(email)) {
    throw new Error("Please provide a valid email address.");
  }

  const uploadedFiles = files.filter((file) => file.size > 0);

  if (uploadedFiles.length > MAX_PHOTOS) {
    throw new Error(`You can upload up to ${MAX_PHOTOS} photos.`);
  }

  return {
    incidenceDate,
    typeId,
    reporterHouseNumber,
    description,
    email,
    uploadedFiles,
  };
}

async function normalizePhotos(uploadedFiles) {
  const photos = [];

  for (const file of uploadedFiles) {
if (!["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(String(file.type || "").toLowerCase())) {
  throw new Error("Only PNG, JPEG, GIF, WebP, or AVIF image uploads are allowed.");
}

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      throw new Error("Each photo must be 5 MB or smaller.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    photos.push({
      fileName: file.name || "photo",
      contentType: file.type,
      data: buffer,
    });
  }

  return photos;
}

export async function submitReportAction(formData) {
  try {
    const input = parseReportInput(formData);
    const photos = await normalizePhotos(input.uploadedFiles);

    createReport({
      incidenceDate: input.incidenceDate,
      typeId: input.typeId,
      reporterHouseNumber: input.reporterHouseNumber,
      description: input.description,
      emailEncrypted: encryptEmail(input.email),
      photos,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit the report.";
    redirect(`/?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/?submitted=1");
}

export async function loginAction(formData) {
  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || "/admin"));
  const password = String(formData.get("password") || "");

  if (!(await login(password))) {
    redirect(withQueryMessage(returnTo, "auth", "failed"));
  }

  redirect(returnTo);
}

export async function logoutAction() {
  await logout();
  redirect("/admin");
}

export async function createTypeAction(formData) {
  await requireAdmin();

  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || "/admin"));
  const name = String(formData.get("name") || "").trim();

  if (!name || name.length > 80) {
    redirect(withQueryMessage(returnTo, "typeError", "Please provide a type name up to 80 characters."));
  }

  try {
    createType(name);
  } catch {
    redirect(withQueryMessage(returnTo, "typeError", "That incidence type already exists."));
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(returnTo);
}

export async function toggleTypeAction(formData) {
  await requireAdmin();

  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || "/admin"));
  const typeId = Number(formData.get("typeId"));

  if (Number.isInteger(typeId)) {
    toggleType(typeId);
    revalidatePath("/");
    revalidatePath("/admin");
  }

  redirect(returnTo);
}

export async function updateReportStatusAction(formData) {
  await requireAdmin();

  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || "/admin"));
  const reportId = Number(formData.get("reportId"));
  const status = String(formData.get("status") || "");

  if (!Number.isInteger(reportId) || !allowedStatuses.has(status)) {
    redirect(withQueryMessage(returnTo, "statusError", "Please choose a valid status."));
  }

  updateReportStatus(reportId, status);
  revalidatePath("/admin");
  redirect(returnTo);
}
