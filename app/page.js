import styles from "./page.module.css";
import { submitReportAction } from "@/app/actions";
import { listActiveTypes } from "@/lib/db";
import { MAX_PHOTOS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function Banner({ kind, children }) {
  return <p className={`${styles.banner} ${kind === "error" ? styles.error : styles.success}`}>{children}</p>;
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const types = listActiveTypes();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Santa Ana Urbano</span>
          <h1>Incidence reporting form</h1>
          <p>
            Use this public form to report issues in the community. Optional emails are stored encrypted and are
            never shown in the admin dashboard.
          </p>
        </div>
        <a className={styles.adminLink} href="/admin">
          Open admin dashboard
        </a>
      </section>

      <section className={styles.card}>
        {params.submitted ? <Banner kind="success">Thanks, your incidence report was submitted.</Banner> : null}
        {params.error ? <Banner kind="error">{params.error}</Banner> : null}

        <form action={submitReportAction} className={styles.form}>
          <label>
            <span>Date of incidence</span>
            <input name="incidenceDate" type="date" required />
          </label>

          <label>
            <span>Type of incidence</span>
            <select name="typeId" required defaultValue="">
              <option value="" disabled>
                Select a type
              </option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Reporter: house number</span>
            <input name="reporterHouseNumber" type="text" maxLength={40} placeholder="e.g. House 24B" required />
          </label>

          <label>
            <span>Description</span>
            <textarea name="description" rows="5" maxLength={2000} placeholder="Describe what happened" required />
          </label>

          <label>
            <span>Photos (optional)</span>
            <input name="photos" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple />
            <small>Upload up to {MAX_PHOTOS} photos in JPG, PNG, GIF, WebP, or AVIF format.</small>
          </label>

          <label>
            <span>Email (optional)</span>
            <input name="email" type="email" placeholder="name@example.com" />
            <small>Stored encrypted and never displayed to admins.</small>
          </label>

          <button className={styles.primaryButton} type="submit">
            Submit report
          </button>
        </form>
      </section>
    </main>
  );
}
