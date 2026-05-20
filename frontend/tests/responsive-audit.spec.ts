/**
 * Responsive audit — automated UI/UX sweep.
 *
 * Loops a curated list of representative pages × the operator's
 * 7-viewport table, captures a screenshot per (page, viewport), and
 * machine-measures three concrete bug categories:
 *
 *   1. Horizontal overflow  — documentElement.scrollWidth > clientWidth
 *   2. Tap target size      — visible buttons / links / inputs whose
 *                              bounding box is smaller than 44 × 44
 *   3. Tiny text            — visible non-whitespace text nodes with
 *                              computed font-size below 14px
 *
 * Output:
 *   tests/responsive-audit/report.md       — human-readable summary
 *   tests/responsive-audit/findings.json   — raw measurements
 *   tests/responsive-audit/<slug>/<vp>.png — screenshots
 *
 * NOTE: this spec does NOT assert anything — it's a data-collection
 * run, not a pass/fail gate. The single "audit" test at the end
 * succeeds as long as data was written. Triage happens in the report.
 */

import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ── viewports (operator's table) ──────────────────────────────────────────
const VIEWPORTS = [
  { id: 'mobile-s-iphone-se',     w: 375,  h: 667,  label: 'Mobile S — iPhone SE' },
  { id: 'mobile-m-iphone-13',     w: 390,  h: 844,  label: 'Mobile M — iPhone 12/13/14' },
  { id: 'mobile-l-pixel-7',       w: 412,  h: 915,  label: 'Mobile L — Pixel 7' },
  { id: 'foldable-zfold-folded',  w: 343,  h: 842,  label: 'Foldable folded — Galaxy Z Fold' },
  { id: 'foldable-zfold-open',    w: 673,  h: 842,  label: 'Foldable unfolded — Galaxy Z Fold' },
  { id: 'tablet-s-ipad-mini',     w: 768,  h: 1024, label: 'Tablet S — iPad Mini' },
  { id: 'tablet-l-ipad-pro',      w: 1024, h: 1366, label: 'Tablet L — iPad Pro' },
  { id: 'desktop-1440',           w: 1440, h: 900,  label: 'Desktop (baseline)' },
];

// ── pages to audit ────────────────────────────────────────────────────────
// Representative coverage: public form, user shell + tabs, operator card
// grid, admin shell + tabs, data tables, tree, calendar/modal, forms.
const PAGES = [
  { slug: 'login',                url: '/login',                          auth: false },
  { slug: 'user-dashboard',       url: '/dashboard',                      auth: true  },
  { slug: 'user-myprofile-tab',   url: '/dashboard?tab=myprofile',        auth: true  },
  { slug: 'user-settings-tab',    url: '/dashboard?tab=settings',         auth: true  },
  { slug: 'profile-edit',         url: '/profile/edit',                   auth: true  },
  { slug: 'profile-password',     url: '/profile/password',               auth: true  },
  { slug: 'units',                url: '/units',                          auth: true  },
  { slug: 'admin-dashboard',      url: '/admin/dashboard',                auth: true  },
  { slug: 'admin-users',          url: '/admin/access/users',             auth: true  },
  { slug: 'admin-equipment',      url: '/admin/equipment',                auth: true  },
  { slug: 'admin-equipment-tree', url: '/admin/equipment/tree',           auth: true  },
  { slug: 'admin-shift-schedules',url: '/admin/shift-schedules',          auth: true  },
  { slug: 'admin-shift-edit',     url: '/admin/shift-schedules/4/edit',   auth: true  },
];

const OUT_DIR = path.resolve(__dirname, 'responsive-audit');
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Finding {
  page: string;
  url: string;
  viewport: string;
  width: number;
  height: number;
  horizontalOverflow: { overflow: boolean; scrollWidth: number; clientWidth: number };
  smallTapTargets: number;
  smallTapTargetSamples: Array<{ tag: string; text: string; w: number; h: number }>;
  tinyText: number;
  tinyTextSamples: Array<{ tag: string; text: string; size: number }>;
  errors: string[];
}

const findings: Finding[] = [];

async function measure(page: Page): Promise<Omit<Finding, 'page' | 'url' | 'viewport' | 'width' | 'height'>> {
  return page.evaluate(() => {
    const errors: string[] = [];
    const root = document.documentElement;
    const horizontalOverflow = {
      overflow: root.scrollWidth > root.clientWidth + 1,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };

    // Tap targets — visible buttons / links / inputs / [role=button]
    const smallTargets: Array<{ tag: string; text: string; w: number; h: number }> = [];
    const tapSelectors = 'button:not([disabled]), a[href], input:not([type=hidden]), [role="button"], [role="tab"]';
    const tapNodes = Array.from(document.querySelectorAll<HTMLElement>(tapSelectors));
    for (const el of tapNodes) {
      const r = el.getBoundingClientRect();
      // Skip hidden / zero-sized — they're either off-screen modals or sr-only.
      if (r.width === 0 || r.height === 0) continue;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w < 44 || h < 44) {
        smallTargets.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 40),
          w, h,
        });
      }
    }

    // Tiny text — text nodes with computed font-size < 14
    const tinySamples: Array<{ tag: string; text: string; size: number }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const txt = (node.nodeValue || '').trim();
        if (!txt) return NodeFilter.FILTER_REJECT;
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        const r = node.parentElement.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const el = n.parentElement!;
      const size = parseFloat(window.getComputedStyle(el).fontSize);
      if (size && size < 14) {
        tinySamples.push({
          tag: el.tagName.toLowerCase(),
          text: (n.nodeValue || '').trim().slice(0, 40),
          size: Math.round(size * 10) / 10,
        });
      }
    }

    return {
      horizontalOverflow,
      smallTapTargets: smallTargets.length,
      smallTapTargetSamples: smallTargets.slice(0, 6),
      tinyText: tinySamples.length,
      tinyTextSamples: tinySamples.slice(0, 6),
      errors,
    };
  });
}

test.describe('Responsive audit — /new_fp', () => {
  test.use({ storageState: 'tests/.auth/user.json' });
  // The audit walks 13 pages × 8 viewports — well over the project's
  // default 45s. setTimeout inside the test() is too late once the
  // clock has started, so configure the whole describe block here.
  test.describe.configure({ timeout: 600_000 });

  test('capture + measure all pages × viewports', async ({ browser }) => {
    for (const pg of PAGES) {
      const slugDir = path.join(OUT_DIR, pg.slug);
      fs.mkdirSync(slugDir, { recursive: true });
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
          ignoreHTTPSErrors: true,
          viewport: { width: vp.w, height: vp.h },
          storageState: pg.auth ? 'tests/.auth/user.json' : { cookies: [], origins: [] },
        });
        // Force Swedish so we audit the locale users actually see.
        await ctx.addCookies([{
          name: 'NEXT_LOCALE', value: 'sv',
          domain: 'fptest.com', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
        }]);
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text().slice(0, 200)}`); });

        let measurement: Awaited<ReturnType<typeof measure>> | null = null;
        try {
          await page.goto(`https://fptest.com${pg.url}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          // Brief settle — networkidle is unreliable on dashboards w/ poll loops.
          await page.waitForTimeout(1200);
          measurement = await measure(page);
        } catch (e) {
          errors.push(`navigation: ${(e as Error).message}`);
        }

        // Screenshot regardless — even a half-rendered page tells us
        // something.
        const shot = path.join(slugDir, `${vp.id}.png`);
        try {
          await page.screenshot({ path: shot, fullPage: true });
        } catch {
          // ignore — page may have been torn down.
        }

        findings.push({
          page: pg.slug,
          url: pg.url,
          viewport: vp.id,
          width: vp.w,
          height: vp.h,
          horizontalOverflow: measurement?.horizontalOverflow ?? { overflow: false, scrollWidth: 0, clientWidth: 0 },
          smallTapTargets: measurement?.smallTapTargets ?? 0,
          smallTapTargetSamples: measurement?.smallTapTargetSamples ?? [],
          tinyText: measurement?.tinyText ?? 0,
          tinyTextSamples: measurement?.tinyTextSamples ?? [],
          errors: [...errors, ...(measurement?.errors ?? [])],
        });

        await ctx.close();
        // eslint-disable-next-line no-console
        console.log(`  ✓ ${pg.slug.padEnd(28)} ${vp.id.padEnd(25)} ${(measurement?.horizontalOverflow.overflow ? 'OVERFLOW' : 'ok')}`);

        // Persist progress on every step so a later crash still leaves a
        // usable report behind.
        fs.writeFileSync(path.join(OUT_DIR, 'findings.json'), JSON.stringify(findings, null, 2));
      }
    }

    // ── write outputs ──────────────────────────────────────────────────
    // Always persist what we have, even if the loop crashes mid-way —
    // the audit is too slow to redo from zero on every iteration.
    fs.writeFileSync(path.join(OUT_DIR, 'findings.json'), JSON.stringify(findings, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'), buildReport(findings));

    // sanity: at least one row collected (don't require completeness —
    // we want partial reports for triage, not zero output).
    expect(findings.length).toBeGreaterThan(0);
  });
});

function buildReport(rows: Finding[]): string {
  const lines: string[] = [];
  lines.push('# Responsive audit — /new_fp');
  lines.push('');
  lines.push(`Pages audited: **${new Set(rows.map((r) => r.page)).size}**`);
  lines.push(`Viewports: **${new Set(rows.map((r) => r.viewport)).size}**`);
  lines.push(`Total rows: **${rows.length}**`);
  lines.push('');

  // Issue counts overall
  const overflowCount = rows.filter((r) => r.horizontalOverflow.overflow).length;
  const targetIssues = rows.reduce((a, r) => a + r.smallTapTargets, 0);
  const tinyIssues = rows.reduce((a, r) => a + r.tinyText, 0);
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Rows with **horizontal overflow**: ${overflowCount}`);
  lines.push(`- Total **tap targets < 44px**: ${targetIssues}`);
  lines.push(`- Total **text < 14px nodes**: ${tinyIssues}`);
  lines.push('');

  // Per-page table
  lines.push('## Per-page × viewport matrix (overflow flag)');
  lines.push('');
  const pageSlugs = Array.from(new Set(rows.map((r) => r.page)));
  const vps = Array.from(new Set(rows.map((r) => r.viewport)));
  lines.push(`| Page | ${vps.join(' | ')} |`);
  lines.push(`|------|${vps.map(() => '---').join('|')}|`);
  for (const slug of pageSlugs) {
    const cells = vps.map((v) => {
      const r = rows.find((x) => x.page === slug && x.viewport === v);
      if (!r) return ' ';
      const o = r.horizontalOverflow.overflow ? `❌ ${r.horizontalOverflow.scrollWidth}px` : '✓';
      return o;
    });
    lines.push(`| \`${slug}\` | ${cells.join(' | ')} |`);
  }
  lines.push('');

  // Pages that have problems — collapsible details
  lines.push('## Findings per page');
  lines.push('');
  for (const slug of pageSlugs) {
    const pageRows = rows.filter((r) => r.page === slug);
    const totalOverflow = pageRows.filter((r) => r.horizontalOverflow.overflow).length;
    const totalTaps = pageRows.reduce((a, r) => a + r.smallTapTargets, 0);
    const totalTiny = pageRows.reduce((a, r) => a + r.tinyText, 0);
    const totalErrors = pageRows.reduce((a, r) => a + r.errors.length, 0);
    if (totalOverflow + totalTaps + totalTiny + totalErrors === 0) continue;
    lines.push(`### \`${slug}\`  →  ${pageRows[0].url}`);
    lines.push(`overflow=${totalOverflow}  small-targets=${totalTaps}  tiny-text=${totalTiny}  errors=${totalErrors}`);
    lines.push('');
    lines.push('| viewport | overflow | targets<44 | text<14 | errors |');
    lines.push('|---|---|---|---|---|');
    for (const r of pageRows) {
      const oFlag = r.horizontalOverflow.overflow ? `❌ ${r.horizontalOverflow.scrollWidth}>${r.horizontalOverflow.clientWidth}` : '✓';
      lines.push(`| ${r.viewport} | ${oFlag} | ${r.smallTapTargets} | ${r.tinyText} | ${r.errors.length} |`);
    }
    // Sample small targets — one viewport-row deep enough to be useful
    const sampleRow = pageRows.find((r) => r.smallTapTargetSamples.length > 0);
    if (sampleRow) {
      lines.push('');
      lines.push(`<details><summary>Sample small tap targets (${sampleRow.viewport})</summary>`);
      lines.push('');
      for (const s of sampleRow.smallTapTargetSamples) {
        lines.push(`- \`${s.tag}\` (${s.w}×${s.h}px) — "${s.text}"`);
      }
      lines.push('');
      lines.push('</details>');
    }
    const sampleTiny = pageRows.find((r) => r.tinyTextSamples.length > 0);
    if (sampleTiny) {
      lines.push('');
      lines.push(`<details><summary>Sample tiny text (${sampleTiny.viewport})</summary>`);
      lines.push('');
      for (const s of sampleTiny.tinyTextSamples) {
        lines.push(`- \`${s.tag}\` (${s.size}px) — "${s.text}"`);
      }
      lines.push('');
      lines.push('</details>');
    }
    const errSamples = pageRows.flatMap((r) => r.errors.map((e) => ({ vp: r.viewport, e })));
    if (errSamples.length > 0) {
      lines.push('');
      lines.push(`<details><summary>Errors (${errSamples.length})</summary>`);
      lines.push('');
      for (const s of errSamples.slice(0, 10)) {
        lines.push(`- \`${s.vp}\`: ${s.e}`);
      }
      lines.push('');
      lines.push('</details>');
    }
    lines.push('');
  }
  return lines.join('\n');
}
