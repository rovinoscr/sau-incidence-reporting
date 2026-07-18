import { routing } from "@/i18n/routing";

const localePrefixPattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

export function withLocale(locale, path) {
  if (locale === routing.defaultLocale) {
    return path;
  }

  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

export function stripLocalePrefix(pathname) {
  const match = pathname.match(localePrefixPattern);

  if (!match) {
    return pathname;
  }

  const rest = pathname.slice(match[0].length);
  return rest === "" ? "/" : rest;
}
