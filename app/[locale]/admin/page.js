import { getTranslations, setRequestLocale } from "next-intl/server";
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
import { MAX_TYPE_NAME_LENGTH, STATUS_VALUES } from "@/lib/constants";
import { withLocale } from "@/lib/locale-path";
import LanguageSwitcher from "@/app/language-switcher";

export const dynamic = "force-dynamic";

function buildReturnTo(locale, params) {
  const nextParams = new URLSearchParams(params);
  nextParams.delete("auth");
  nextParams.delete("statusError");
  nextParams.delete("typeError");
  const query = nextParams.toString();
  return withLocale(locale, query ? `/admin?${query}` : "/admin");
}

function Message({ children, kind = "error" }) {
  return <p className={`${styles.banner} ${kind === "error" ? styles.error : styles.success}`}>{children}</p>;
}

function LoginPanel({ t, params, returnTo, locale }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeader}>
        <div>
          <h1>{t("loginTitle")}</h1>
          <p className={styles.helperText}>{t("loginHelp")}</p>
        </div>
        <LanguageSwitcher />
      </div>
      {params.auth === "failed" ? <Message>{t("authFailed")}</Message> : null}
      {params.auth === "required" ? <Message>{t("authRequired")}</Message> : null}
      <form action={loginAction} className={styles.form}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label>
          <span>{t("passwordLabel")}</span>
          <input name="password" type="password" required />
        </label>
        <button className={styles.primaryButton} type="submit">
          {t("signIn")}
        </button>
      </form>
    </section>
  );
}

export default async function AdminPage({ params: paramsPromise, searchParams }) {
  const { locale } = await paramsPromise;
  setRequestLocale(locale);

  const t = await getTranslations("Admin");
  const tStatus = await getTranslations("Status");
  const params = new URLSearchParams(await searchParams);

  if (!hasConfiguredAdminPassword()) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{t("setupRequiredTitle")}</h1>
          <p className={styles.helperText}>{t("setupRequiredBody")}</p>
        </section>
      </main>
    );
  }

  if (!(await isAuthenticated())) {
    return (
      <main className={styles.page}>
        <LoginPanel
          t={t}
          params={Object.fromEntries(params.entries())}
          returnTo={buildReturnTo(locale, params)}
          locale={locale}
        />
      </main>
    );
  }

  const typeFilter = params.get("typeId") || "";
  const incidenceDate = params.get("incidenceDate") || "";
  const reporter = params.get("reporter") || "";
  const status = params.get("status") || "";
  const returnTo = buildReturnTo(locale, params);

  const types = listTypes();
  const reports = listReports({
    typeId: typeFilter ? Number(typeFilter) : undefined,
    incidenceDate,
    reporter,
    status,
  });

  const typeErrorKey = params.get("typeError");
  const statusErrorKey = params.get("statusError");

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>{t("eyebrow")}</span>
            <h1>{t("dashboardTitle")}</h1>
            <p className={styles.helperText}>{t("dashboardHelp")}</p>
          </div>
          <div className={styles.heroActions}>
            <LanguageSwitcher />
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button className={styles.secondaryButton} type="submit">
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>

        {typeErrorKey === "nameRequired" ? <Message>{t("typeErrorNameRequired", { max: MAX_TYPE_NAME_LENGTH })}</Message> : null}
        {typeErrorKey === "nameExists" ? <Message>{t("typeErrorNameExists")}</Message> : null}
        {statusErrorKey ? <Message>{t("statusErrorInvalid")}</Message> : null}

        <form className={styles.filterGrid}>
          <label>
            <span>{t("filterTypeLabel")}</span>
            <select name="typeId" defaultValue={typeFilter}>
              <option value="">{t("allTypes")}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("filterDateLabel")}</span>
            <input name="incidenceDate" type="date" defaultValue={incidenceDate} />
          </label>
          <label>
            <span>{t("filterReporterLabel")}</span>
            <input name="reporter" type="text" defaultValue={reporter} placeholder={t("reporterPlaceholder")} />
          </label>
          <label>
            <span>{t("filterStatusLabel")}</span>
            <select name="status" defaultValue={status}>
              <option value="">{t("allStatuses")}</option>
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {tStatus(value)}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.primaryButton} type="submit">
            {t("applyFilters")}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{t("typesTitle")}</h2>
            <p className={styles.helperText}>{t("typesHelp")}</p>
          </div>
        </div>

        <form action={createTypeAction} className={styles.inlineForm}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>
            <span>{t("newTypeLabel")}</span>
            <input name="name" type="text" maxLength={MAX_TYPE_NAME_LENGTH} placeholder={t("newTypePlaceholder")} required />
          </label>
          <button className={styles.primaryButton} type="submit">
            {t("addType")}
          </button>
        </form>

        <div className={styles.list}>
          {types.map((type) => (
            <div className={styles.listItem} key={type.id}>
              <div className={styles.sectionHeader}>
                <strong>{type.name}</strong>
                <form action={toggleTypeAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="typeId" value={type.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className={styles.inlineButton} type="submit">
                    {type.is_active ? t("deactivate") : t("reactivate")}
                  </button>
                </form>
              </div>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>{type.is_active ? t("activeInForm") : t("hiddenFromForm")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{t("reportsTitle")}</h2>
            <p className={styles.helperText}>{t("reportsCount", { count: reports.length })}</p>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className={styles.emptyState}>{t("noReportsMatch")}</div>
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
                      <span className={styles.badge}>
                        {t("dateLabel")}: {report.incidence_date}
                      </span>
                      <span className={styles.badge}>
                        {t("submittedLabel")}: {new Date(report.created_at).toLocaleString(locale)}
                      </span>
                      <span className={styles.badge}>{report.has_email ? t("hasEmail") : t("noEmail")}</span>
                    </div>
                  </div>
                  <span className={styles.statusBadge}>{tStatus(report.status)}</span>
                </div>

                <p className={styles.reportText}>{report.description}</p>

                <div className={styles.photoRow}>
                  {report.photos.length === 0 ? (
                    <span className={styles.helperText}>{t("noPhotos")}</span>
                  ) : (
                    report.photos.map((photo, index) => (
                      <a className={styles.photoLink} href={`/photos/${photo.id}`} key={photo.id} target="_blank" rel="noreferrer">
                        {t("photoLabel", { index: index + 1 })}
                      </a>
                    ))
                  )}
                </div>

                <form action={updateReportStatusAction} className={styles.inlineForm}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label>
                    <span>{t("statusLabel")}</span>
                    <select name="status" defaultValue={report.status}>
                      {STATUS_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {tStatus(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className={styles.primaryButton} type="submit">
                    {t("saveStatus")}
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
