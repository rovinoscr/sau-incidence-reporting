"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "@/app/page.module.css";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("LanguageSwitcher");

  return (
    <nav className={styles.langSwitcher} aria-label="Language">
      <Link href={pathname} locale="es" className={locale === "es" ? styles.langSwitcherActive : undefined}>
        {t("es")}
      </Link>
      <Link href={pathname} locale="en" className={locale === "en" ? styles.langSwitcherActive : undefined}>
        {t("en")}
      </Link>
    </nav>
  );
}
