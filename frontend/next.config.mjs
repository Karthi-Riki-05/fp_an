import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for the server.Dockerfile multi-stage build.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Phase 4 will add experimental.serverActions config etc. as needed.
};

export default withNextIntl(nextConfig);
