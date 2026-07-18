import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TYPES, STATUS_OPTIONS } from "@/lib/constants";

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "sau-incidence-reporting.db");
const allowedStatuses = new Set(STATUS_OPTIONS.map((status) => status.value));

function ensureDatabaseDirectory() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

let database;

function initializeDatabase() {
  ensureDatabaseDirectory();

  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS incidence_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incidence_date TEXT NOT NULL,
      type_id INTEGER NOT NULL REFERENCES incidence_types(id),
      reporter_house_number TEXT NOT NULL,
      description TEXT NOT NULL,
      email_encrypted TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      data BLOB NOT NULL
    );
  `);

  const insertType = db.prepare(
    "INSERT OR IGNORE INTO incidence_types (name, is_active, created_at) VALUES (?, 1, ?)"
  );
  const now = new Date().toISOString();

  for (const typeName of DEFAULT_TYPES) {
    insertType.run(typeName, now);
  }

  return db;
}

function getDb() {
  if (!database) {
    database = initializeDatabase();
  }

  return database;
}

export function listActiveTypes() {
  return getDb()
    .prepare("SELECT id, name FROM incidence_types WHERE is_active = 1 ORDER BY lower(name)")
    .all();
}

export function listTypes() {
  return getDb()
    .prepare("SELECT id, name, is_active FROM incidence_types ORDER BY lower(name)")
    .all()
    .map((type) => ({ ...type, is_active: Boolean(type.is_active) }));
}

export function createType(name) {
  const trimmedName = name.trim();
  const result = getDb()
    .prepare("INSERT INTO incidence_types (name, is_active, created_at) VALUES (?, 1, ?)")
    .run(trimmedName, new Date().toISOString());

  return result.lastInsertRowid;
}

export function toggleType(id) {
  getDb()
    .prepare("UPDATE incidence_types SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?")
    .run(id);
}

export function findActiveTypeById(id) {
  return getDb()
    .prepare("SELECT id, name FROM incidence_types WHERE id = ? AND is_active = 1")
    .get(id);
}

export function createReport({ incidenceDate, typeId, reporterHouseNumber, description, emailEncrypted, photos }) {
  const db = getDb();
  const insertReport = db.prepare(
    `INSERT INTO reports (incidence_date, type_id, reporter_house_number, description, email_encrypted, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'new', ?)`
  );
  const insertPhoto = db.prepare(
    "INSERT INTO photos (report_id, file_name, content_type, data) VALUES (?, ?, ?, ?)"
  );

  const transaction = db.transaction((payload) => {
    const reportResult = insertReport.run(
      payload.incidenceDate,
      payload.typeId,
      payload.reporterHouseNumber,
      payload.description,
      payload.emailEncrypted,
      new Date().toISOString()
    );

    const reportId = Number(reportResult.lastInsertRowid);

    for (const photo of payload.photos) {
      insertPhoto.run(reportId, photo.fileName, photo.contentType, photo.data);
    }

    return reportId;
  });

  return transaction({
    incidenceDate,
    typeId,
    reporterHouseNumber,
    description,
    emailEncrypted,
    photos,
  });
}

export function listReports(filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.typeId) {
    conditions.push("reports.type_id = ?");
    values.push(filters.typeId);
  }

  if (filters.incidenceDate) {
    conditions.push("reports.incidence_date = ?");
    values.push(filters.incidenceDate);
  }

  if (filters.reporter) {
    conditions.push("lower(reports.reporter_house_number) LIKE ?");
    values.push(`%${filters.reporter.trim().toLowerCase()}%`);
  }

  if (filters.status && allowedStatuses.has(filters.status)) {
    conditions.push("reports.status = ?");
    values.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const reports = getDb()
    .prepare(
      `SELECT
         reports.id,
         reports.incidence_date,
         reports.reporter_house_number,
         reports.description,
         reports.status,
         reports.created_at,
         reports.email_encrypted,
         incidence_types.name AS type_name,
         incidence_types.id AS type_id
       FROM reports
       INNER JOIN incidence_types ON incidence_types.id = reports.type_id
       ${whereClause}
       ORDER BY reports.incidence_date DESC, reports.created_at DESC`
    )
    .all(...values);

  if (reports.length === 0) {
    return [];
  }

  const photoRows = getDb()
    .prepare(
      `SELECT id, report_id, file_name
       FROM photos
       WHERE report_id IN (${reports.map(() => "?").join(", ")})
       ORDER BY id`
    )
    .all(...reports.map((report) => report.id));

  const photosByReportId = new Map();

  for (const photo of photoRows) {
    if (!photosByReportId.has(photo.report_id)) {
      photosByReportId.set(photo.report_id, []);
    }

    photosByReportId.get(photo.report_id).push(photo);
  }

  return reports.map(({ email_encrypted, ...report }) => ({
    ...report,
    has_email: Boolean(email_encrypted),
    photos: photosByReportId.get(report.id) || [],
  }));
}

export function updateReportStatus(id, status) {
  if (!allowedStatuses.has(status)) {
    throw new Error("Invalid status.");
  }

  getDb().prepare("UPDATE reports SET status = ? WHERE id = ?").run(status, id);
}

export function getPhotoById(photoId) {
  return getDb()
    .prepare("SELECT id, content_type, data, file_name FROM photos WHERE id = ?")
    .get(photoId);
}
