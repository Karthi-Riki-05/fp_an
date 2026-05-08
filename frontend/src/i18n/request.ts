import { getRequestConfig } from 'next-intl/server';

// Phase 1 minimal config — Phase 4 expands this with proper locale negotiation
// from cookie / Accept-Language / tenant default. See MIGRATION_NOTES.md §9 + §17.
const SUPPORTED = ['sv', 'en'] as const;
type Locale = (typeof SUPPORTED)[number];

export default getRequestConfig(async () => {
  const locale: Locale = 'sv';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Europe/Stockholm',
  };
});
