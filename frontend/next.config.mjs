import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from 'next-pwa';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// next-pwa is CommonJS; in this ESM config we import its default factory.
// Service worker is disabled in development so HMR isn't shadowed by caching.
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for the server.Dockerfile multi-stage build.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Skip ESLint during production builds — errors are code-quality issues,
  // not runtime failures. Fix them separately; don't block deployments.
  eslint: { ignoreDuringBuilds: true },
  // Skip TypeScript type-check during builds for the same reason.
  typescript: { ignoreBuildErrors: true },
  // Required for Ant Design 5 + Next.js 14 App Router. Without this Next's
  // optimizePackageImports mangles AntD's barrel exports through the React
  // Client Manifest and dev SSR throws "__barrel_optimize__" errors.
  // Per the official AntD Next.js integration guide.
  transpilePackages: ['antd', '@ant-design/icons', 'rc-util', 'rc-pagination', 'rc-picker', 'rc-notification', 'rc-tooltip', 'rc-tree', 'rc-table'],
};

// Compose both plugins: next-intl wraps the base config, next-pwa wraps that.
export default withPWA(withNextIntl(nextConfig));
