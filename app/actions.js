"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createType, createReport, findActiveTypeById, toggleType, updateReportStatus } from "@/lib/db";
import { login, logout, requireAdmin } from "@/lib/admin-session";
import {
  MAX_PHOTOS,
  MAX_PHOTO_SIZE_BYTES,
  MAX_REPORTER_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TYPE_NAME_LENGTH,
  STATUS_VALUES,
} from "@/lib/constants";
import { encryptEmail } from "@/lib/crypto";
import { withLocale, stripLocalePrefix } from "@/lib/locale-path";

const allowedStatuses = new Set(STATUS_VALUES);
const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function getFormLocale(formData) {
  const locale = String(formData.get("locale") || "");
  return locale === "en" ? "en" : "es";
}

function cleanRedirectTarget(target) {
  if (!target || typeof target !== "string" || !stripLocalePrefix(target).startsWith("/admin")) {
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

class ReportValidationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function parseReportInput(formData) {
  const incidenceDate = String(formData.get("incidenceDate") || "").trim();
  const typeId = Number(formData.get("typeId"));
  const reporterHouseNumber = String(formData.get("reporterHouseNumber") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const files = formData.getAll("photos").filter((entry) => entry && typeof entry === "object" && "size" in entry);

  if (!isValidIsoDate(incidenceDate)) {
    throw new ReportValidationError("invalidDate");
  }

  if (!Number.isInteger(typeId) || !findActiveTypeById(typeId)) {
    throw new ReportValidationError("invalidType");
  }

  if (!reporterHouseNumber || reporterHouseNumber.length > MAX_REPORTER_LENGTH) {
    throw new ReportValidationError("invalidReporter");
  }

  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ReportValidationError("invalidDescription");
  }

  if (email && !emailPattern.test(email)) {
    throw new ReportValidationError("invalidEmail");
  }

  const uploadedFiles = files.filter((file) => file.size > 0);

  if (uploadedFiles.length > MAX_PHOTOS) {
    throw new ReportValidationError("tooManyPhotos");
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
      throw new ReportValidationError("invalidPhotoType");
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      throw new ReportValidationError("photoTooLarge");
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
  const locale = getFormLocale(formData);

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
    const code = error instanceof ReportValidationError ? error.code : "generic";
    redirect(withLocale(locale, `/?error=${encodeURIComponent(code)}`));
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  redirect(withLocale(locale, "/?submitted=1"));
}

export async function loginAction(formData) {
  const locale = getFormLocale(formData);
  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || withLocale(locale, "/admin")));
  const password = String(formData.get("password") || "");

  if (!(await login(password))) {
    redirect(withQueryMessage(returnTo, "auth", "failed"));
  }

  redirect(returnTo);
}

export async function logoutAction(formData) {
  const locale = getFormLocale(formData);
  await logout();
  redirect(withLocale(locale, "/admin"));
}

export async function createTypeAction(formData) {
  await requireAdmin();

  const locale = getFormLocale(formData);
  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || withLocale(locale, "/admin")));
  const name = String(formData.get("name") || "").trim();

  if (!name || name.length > MAX_TYPE_NAME_LENGTH) {
    redirect(withQueryMessage(returnTo, "typeError", "nameRequired"));
  }

  try {
    createType(name);
  } catch {
    redirect(withQueryMessage(returnTo, "typeError", "nameExists"));
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  redirect(returnTo);
}

export async function toggleTypeAction(formData) {
  await requireAdmin();

  const locale = getFormLocale(formData);
  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || withLocale(locale, "/admin")));
  const typeId = Number(formData.get("typeId"));

  if (Number.isInteger(typeId)) {
    toggleType(typeId);
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
  }

  redirect(returnTo);
}

export async function updateReportStatusAction(formData) {
  await requireAdmin();

  const locale = getFormLocale(formData);
  const returnTo = cleanRedirectTarget(String(formData.get("returnTo") || withLocale(locale, "/admin")));
  const reportId = Number(formData.get("reportId"));
  const status = String(formData.get("status") || "");

  if (!Number.isInteger(reportId) || !allowedStatuses.has(status)) {
    redirect(withQueryMessage(returnTo, "statusError", "invalidStatus"));
  }

  updateReportStatus(reportId, status);
  revalidatePath("/admin", "layout");
  redirect(returnTo);
}
