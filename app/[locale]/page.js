import { getTranslations, setRequestLocale } from "next-intl/server";
import styles from "@/app/page.module.css";
import { submitReportAction } from "@/app/actions";
import { listActiveTypes } from "@/lib/db";
import { MAX_PHOTOS, MAX_PHOTO_SIZE_BYTES, MAX_REPORTER_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/constants";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/app/language-switcher";

export const dynamic = "force-dynamic";

function Banner({ kind, children }) {
  return <p className={`${styles.banner} ${kind === "error" ? styles.error : styles.success}`}>{children}</p>;
}

const ERROR_VALUES = {
  invalidReporter: { max: MAX_REPORTER_LENGTH },
  invalidDescription: { max: MAX_DESCRIPTION_LENGTH },
  tooManyPhotos: { max: MAX_PHOTOS },
  photoTooLarge: { maxMb: MAX_PHOTO_SIZE_BYTES / (1024 * 1024) },
};

function resolveErrorMessage(tErrors, code) {
  if (!code || !tErrors.has(code)) {
    return tErrors("generic");
  }

  return tErrors(code, ERROR_VALUES[code]);
}

export default async function Home({ params, searchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const search = await searchParams;
  const t = await getTranslations("Home");
  const tErrors = await getTranslations("Errors");
  const types = listActiveTypes();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p>{t("description")}</p>
        </div>
        <div className={styles.heroActions}>
          <LanguageSwitcher />
          <Link className={styles.adminLink} href="/admin">
            {t("adminLink")}
          </Link>
        </div>
      </section>

      <section className={styles.card}>
        {search.submitted ? <Banner kind="success">{t("submitted")}</Banner> : null}
        {search.error ? <Banner kind="error">{resolveErrorMessage(tErrors, search.error)}</Banner> : null}

        <form action={submitReportAction} className={styles.form}>
          <input type="hidden" name="locale" value={locale} />

          <label>
            <span>{t("incidenceDateLabel")}</span>
            <input name="incidenceDate" type="date" required />
          </label>

          <label>
            <span>{t("typeLabel")}</span>
            <select name="typeId" required defaultValue="">
              <option value="" disabled>
                {t("selectType")}
              </option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t("reporterLabel")}</span>
            <input
              name="reporterHouseNumber"
              type="text"
              maxLength={MAX_REPORTER_LENGTH}
              placeholder={t("reporterPlaceholder")}
              required
            />
          </label>

          <label>
            <span>{t("descriptionLabel")}</span>
            <textarea
              name="description"
              rows="5"
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder={t("descriptionPlaceholder")}
              required
            />
          </label>

          <label>
            <span>{t("photosLabel")}</span>
            <input name="photos" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple />
            <small>{t("photosHelp", { max: MAX_PHOTOS })}</small>
          </label>

          <label>
            <span>{t("emailLabel")}</span>
            <input name="email" type="email" placeholder={t("emailPlaceholder")} />
            <small>{t("emailHelp")}</small>
          </label>

          <button className={styles.primaryButton} type="submit">
            {t("submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
