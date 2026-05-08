/**
 * Asset URL helper.
 *
 * Brand artwork ships with the frontend bundle (frontend/public/brand/...).
 * Tenant-uploaded artwork (CMS images, equipment icons, slider) lives in S3
 * in production but is mirrored to frontend/public/cms,equipment-icons,slider
 * for local dev. The helper switches based on NEXT_PUBLIC_ASSET_BASE; if that
 * env is set, it prefixes all returned URLs.
 */

const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? '';

/** Brand artwork (logos, favicons) — always local. */
export const brand = {
  logo:        '/brand/logo.png',
  logoSmall:   '/brand/logo-40.png',
  logoFooter:  '/brand/footer-logo.png',
  appleTouch:  '/apple-touch-icon.png',
  tile:        '/tile.png',
  tileWide:    '/tile-wide.png',
};

/** CMS-uploaded image. Phase 6 stores S3 paths; for now we serve from /cms/<path>. */
export function cmsImage(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${ASSET_BASE}/cms/${path.replace(/^\/+/, '')}`;
}

/** Equipment icon. Same dual-source pattern. */
export function equipmentIcon(path: string | null | undefined): string {
  if (!path) return '/brand/logo-40.png'; // safe fallback
  if (path.startsWith('http')) return path;
  return `${ASSET_BASE}/equipment-icons/${path.replace(/^\/+/, '')}`;
}

/** Slider image. */
export function sliderImage(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${ASSET_BASE}/slider/${path.replace(/^\/+/, '')}`;
}
