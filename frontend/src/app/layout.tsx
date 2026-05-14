import type { Metadata } from 'next';
import { Lato, Poppins } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Providers } from './providers';
import './globals.css';

// Lato is the legacy backend body font (variable-overrides.scss line 2);
// Poppins is the legacy marketing/operator display font (style.css @font-face).
// Both via next/font/google = no local font files, no CLS, automatic
// preloading, automatic subsetting.
const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-lato',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FP Analyzer',
  description: 'Manufacturing OEE platform',
  icons: {
    icon: '/apple-touch-icon.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
  // Disable Google Translate page-wide. The browser extension rewrites
  // text nodes in place, which races React's reconciler and triggers
  // "Failed to execute 'insertBefore' on 'Node'" crashes (especially on
  // pages with AntD Table/Modal/Tabs). The `translate=no` body attribute
  // below is the modern equivalent; meta is the legacy fallback.
  other: { google: 'notranslate' },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  // request.ts hardcodes 'sv' (Phase 1 stub, no locale routing yet).
  // getLocale() without a next-intl middleware falls back to Accept-Language
  // and returns 'en' for English browsers, causing a server/client lang mismatch.
  // Keep this in sync with request.ts until proper locale routing is built.
  const locale = 'sv';

  return (
    <html
      lang={locale}
      className={`${lato.variable} ${poppins.variable} notranslate`}
      translate="no"
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
