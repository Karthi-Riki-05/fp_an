/**
 * FP Analyzer — design tokens.
 *
 * Source of every value: the legacy fpanalyzer SCSS / CSS / logo.
 * No values are guesses; every hex traces back to a file path noted in
 * UI_SPEC.md. The Phase 1 placeholder palette (#954cfe purple) was wrong —
 * confirmed via the actual logo (gray "fp" + teal "analyzer") and the
 * marketing-site CSS (#00768D dark teal header, #4BBACF accent, #01b9d0
 * info). Phase 4a aligns to that.
 */

export const colors = {
  // ---- brand teal palette ----
  // Primary — the cyan in the logo and the "info" color throughout the
  // backend. Consistent across both legacy systems.
  brandPrimary: '#01b9d0',

  // Marketing site header bg in legacy `style.css` — used as a deeper brand
  // tone for hero / CTA accents.
  brandDeep: '#00768D',

  // Active-nav highlight color in legacy marketing site.
  brandLight: '#4BBACF',

  // Used in time-slider + submit-btn in legacy backend-custom.css. Kept as
  // a secondary accent (Phase 1 had this as primary; corrected to secondary).
  brandAccent: '#954cfe',

  // ---- semantic ----
  success: '#00a65a',  // AdminLTE green
  warning: '#f39c12',  // AdminLTE orange
  error:   '#dd4b39',  // AdminLTE red
  info:    '#01b9d0',  // = brandPrimary (legacy info aqua)

  // ---- machine status (Flow Monitor / Units screens) ----
  // Pulled from legacy machine_status enum + tbl_machines.signal_type.
  status: {
    running:  '#00a65a',  // green — actively producing
    idle:     '#bfbfbf',  // grey  — connected, no output
    stopped:  '#dd4b39',  // red   — stopped (manual or fault)
    warning:  '#f39c12',  // orange — running with warning signal
    offline:  '#999999',  // dark grey — disconnected
  },

  // ---- neutrals ----
  bgBody:        '#ecf0f5',  // AdminLTE body background
  bgCard:        '#ffffff',
  bgSiderDark:   '#222d32',  // AdminLTE dark sidebar
  bgSiderHover:  '#1e282c',  // darker hover
  bgHeader:      '#ffffff',
  borderLight:   '#f4f4f4',  // AdminLTE box border
  borderDefault: '#d2d6de',  // AdminLTE form/box default border
  textPrimary:   '#333333',
  textSecondary: '#666666',
  textMuted:     '#999999',
  textInverse:   '#ffffff',
};

export const typography = {
  // Lato (SCSS variable-overrides.scss line 2) is the body sans for the
  // backend. Poppins (style.css @font-face) is the marketing/operator
  // display font. Both are on Google Fonts; we load via next/font/google.
  fontFamilySans:    'var(--font-lato), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyDisplay: 'var(--font-poppins), var(--font-lato), -apple-system, sans-serif',
  fontSizeBase: 14,
  fontSizeSm:   12,
  fontSizeLg:   16,
  fontSizeXl:   20,
  // Display sizes for hero headings on marketing pages.
  fontSizeHero: 48,
  lineHeightBase:    1.5,
  lineHeightHeading: 1.25,
};

/** AdminLTE's spacing rhythm is roughly 8-based; AntD's defaults are 8/16. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  // AdminLTE uses 3px. AntD defaults to 6px. Adopt 6px globally for the
  // modern look; documented in UI_SPEC.md as a deliberate divergence.
  base: 6,
  sm:   4,
  lg:   8,
};

export const shadows = {
  // Softer than AntD defaults; closer to AdminLTE's `0 1px 1px rgba(0,0,0,.1)`.
  card:    '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.08)',
  raised:  '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
  popover: '0 6px 16px rgba(0, 0, 0, 0.08), 0 3px 6px rgba(0, 0, 0, 0.06)',
};

/** Layout dimensions (legacy AdminLTE used 270px sider; AntD's 240px feels right). */
export const layout = {
  siderWidth: 240,
  siderCollapsedWidth: 80,
  headerHeight: 64,
  contentMaxWidth: 1440, // for marketing pages; admin/user pages flex to viewport
};

export const breakpoints = {
  xs: 480,
  sm: 576,
  md: 768,   // factory-floor tablet target — every screen must work at 768
  lg: 992,
  xl: 1200,
  xxl: 1600,
};
