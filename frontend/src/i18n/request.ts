import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED = ['sv', 'en'] as const;
type Locale = (typeof SUPPORTED)[number];

export default getRequestConfig(async () => {
  // Cookie-based locale — set by the LocaleSwitcher component.
  // Fallback to 'sv' (legacy default). Proper Accept-Language negotiation
  // is deferred to Phase 5 per MIGRATION_NOTES.md §9.
  const cookieLocale = cookies().get('NEXT_LOCALE')?.value;
  const locale: Locale = (SUPPORTED as readonly string[]).includes(cookieLocale ?? '')
    ? (cookieLocale as Locale)
    : 'sv';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Europe/Stockholm',
  };
});
