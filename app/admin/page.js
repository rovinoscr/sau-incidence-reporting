import styles from "@/app/page.module.css";
import {
  createTypeAction,
  loginAction,
  logoutAction,
  toggleTypeAction,
  updateReportStatusAction,
} from "@/app/actions";
import { hasConfiguredAdminPassword, isAuthenticated } from "@/lib/admin-session";
import { listReports, listTypes } from "@/lib/db";
import { STATUS_OPTIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function buildReturnTo(params) {
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function Message({ children, kind = "error" }) {
  return <p className={`${styles.banner} ${kind === "error" ? styles.error : styles.success}`}>{children}</p>;
}

function LoginPanel({ params }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeader}>
        <div>
          <h1>Admin dashboard</h1>
          <p className={styles.helperText}>Sign in with the admin password to review and update incidence reports.</p>
        </div>
      </div>
      {params.auth === "failed" ? <Message>Invalid admin password.</Message> : null}
      {params.auth === "required" ? <Message>Please sign in to continue.</Message> : null}
      <form action={loginAction} className={styles.form}>
        <input type="hidden" name="returnTo" value="/admin" />
        <label>
          <span>Admin password</span>
          <input name="password" type="password" required />
        </label>
        <button className={styles.primaryButton} type="submit">
          Sign in
        </button>
      </form>
    </section>
  );
}

export default async function AdminPage({ searchParams }) {
  const params = new URLSearchParams(await searchParams);

  if (!hasConfiguredAdminPassword()) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Admin setup required</h1>
          <p className={styles.helperText}>
            Set <code>ADMIN_PASSWORD</code> in your environment before using the admin dashboard.
          </p>
        </section>
      </main>
    );
  }

  if (!(await isAuthenticated())) {
    return (
      <main className={styles.page}>
        <LoginPanel params={Object.fromEntries(params.entries())} />
      </main>
    );
  }

  const typeFilter = params.get("typeId") || "";
  const incidenceDate = params.get("incidenceDate") || "";
  const reporter = params.get("reporter") || "";
  const status = params.get("status") || "";
  const returnTo = buildReturnTo(params);

  const types = listTypes();
  const reports = listReports({
    typeId: typeFilter ? Number(typeFilter) : undefined,
    incidenceDate,
    reporter,
    status,
  });

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Admin</span>
            <h1>Incidence dashboard</h1>
            <p className={styles.helperText}>
              Filter reports, update statuses, and manage the public incidence type dropdown.
            </p>
          </div>
          <form action={logoutAction}>
            <button className={styles.secondaryButton} type="submit">
              Sign out
            </button>
          </form>
        </div>

        {params.get("typeError") ? <Message>{params.get("typeError")}</Message> : null}
        {params.get("statusError") ? <Message>{params.get("statusError")}</Message> : null}

        <form className={styles.filterGrid}>
          <label>
            <span>Type</span>
            <select name="typeId" defaultValue={typeFilter}>
              <option value="">All types</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input name="incidenceDate" type="date" defaultValue={incidenceDate} />
          </label>
          <label>
            <span>Reporter</span>
            <input name="reporter" type="text" defaultValue={reporter} placeholder="House number" />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.primaryButton} type="submit">
            Apply filters
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Incidence types</h2>
            <p className={styles.helperText}>Admins control the options available in the public dropdown.</p>
          </div>
        </div>

        <form action={createTypeAction} className={styles.inlineForm}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>
            <span>New incidence type</span>
            <input name="name" type="text" maxLength={80} placeholder="Add a new type" required />
          </label>
          <button className={styles.primaryButton} type="submit">
            Add type
          </button>
        </form>

        <div className={styles.list}>
          {types.map((type) => (
            <div className={styles.listItem} key={type.id}>
              <div className={styles.sectionHeader}>
                <strong>{type.name}</strong>
                <form action={toggleTypeAction}>
                  <input type="hidden" name="typeId" value={type.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className={styles.inlineButton} type="submit">
                    {type.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </div>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>{type.is_active ? "Active in form" : "Hidden from form"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Submitted incidences</h2>
            <p className={styles.helperText}>{reports.length} report(s) match the current filters.</p>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className={styles.emptyState}>No incidences match the current filters.</div>
        ) : (
          <div className={styles.list}>
            {reports.map((report) => (
              <article className={styles.reportCard} key={report.id}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>
                      {report.type_name} · {report.reporter_house_number}
                    </h3>
                    <div className={styles.metaRow}>
                      <span className={styles.badge}>Date: {report.incidence_date}</span>
                      <span className={styles.badge}>Submitted: {new Date(report.created_at).toLocaleString()}</span>
                      <span className={styles.badge}>{report.has_email ? "Encrypted email on file" : "No email provided"}</span>
                    </div>
                  </div>
                  <span className={styles.statusBadge}>
                    {STATUS_OPTIONS.find((option) => option.value === report.status)?.label || report.status}
                  </span>
                </div>

                <p className={styles.reportText}>{report.description}</p>

                <div className={styles.photoRow}>
                  {report.photos.length === 0 ? (
                    <span className={styles.helperText}>No photos attached.</span>
                  ) : (
                    report.photos.map((photo, index) => (
                      <a className={styles.photoLink} href={`/photos/${photo.id}`} key={photo.id} target="_blank" rel="noreferrer">
                        Photo {index + 1}
                      </a>
                    ))
                  )}
                </div>

                <form action={updateReportStatusAction} className={styles.inlineForm}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label>
                    <span>Status</span>
                    <select name="status" defaultValue={report.status}>
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className={styles.primaryButton} type="submit">
                    Save status
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
