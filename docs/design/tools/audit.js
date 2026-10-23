// Audits the master prototype like a customer would. Read-only: it opens screens and clicks, it never writes to docs/design.
// Written for: whoever changes the v3 design. Run from the repo root:
//   node docs/design/tools/audit.js [outDir]        (default outDir: ./design-audit-out)
// Needs Playwright with Chrome (uses frontend/node_modules/playwright).
// Writes links.json, clicks.json, homes.json and prints a summary.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../../../frontend/node_modules/playwright'));

const DIR = path.resolve(__dirname, '..');
const D = 'file://' + DIR + '/';
const OUT = path.resolve(process.argv[2] || 'design-audit-out');
fs.mkdirSync(OUT, { recursive: true });
const { C, ROLES, allowed, metaOf } = require(DIR + '/assets/fp.js');

/* role blocks: <div data-for="a b"> inside a screen, only the signed-in role's block shows (first block when none matches) */
function roleBlocks(html) {
  const out = []; const re = /<div[^>]*data-for="([^"]+)"[^>]*>/g; let x;
  while ((x = re.exec(html))) {
    let depth = 1, i = re.lastIndex; const tag = /<\/?div\b[^>]*>/g; tag.lastIndex = i; let t;
    while (depth && (t = tag.exec(html))) depth += t[0][1] === '/' ? -1 : 1;
    out.push({ roles: x[1].split(' '), a: x.index, b: tag.lastIndex }); re.lastIndex = tag.lastIndex;
  }
  return out;
}
function viewFor(html, blocks, rk) {
  if (!blocks.length || rk === '*') return html;
  const keep = blocks.some(b => b.roles.includes(rk)) ? b => b.roles.includes(rk) : (b, i) => i === 0;
  let h = html; blocks.map((b, i) => [b, keep(b, i)]).reverse().forEach(([b, k]) => { if (!k) h = h.slice(0, b.a) + h.slice(b.b); });
  return h;
}
function destsIn(html, file) {
  const d = [];
  for (const r of html.matchAll(/data-to="([^"]+)"/g)) d.push(r[1]);
  for (const r of html.matchAll(/data-go="([^"]+)"/g)) d.push(file + '#' + r[1]);
  for (const r of html.matchAll(/href="(s\d\d-[a-z0-9-]+)\.html(?:#([^"]*))?"/g)) d.push(r[1] + '#' + (r[2] || ''));
  return d;
}

/* 1. links: where every link and button points, and whether each role may open the target */
function links() {
  const byFile = {}; C.forEach(m => (byFile[m.file] = m));
  const SEC = /<section class="screen" id="([^"]+)"[\s\S]*?<\/section>/g;
  const out = { broken: [], noaccess: {}, links: 0 };
  for (const m of C) {
    const html = fs.readFileSync(DIR + '/screens/' + m.file + '.html', 'utf8');
    let x;
    while ((x = SEC.exec(html))) {
      const srcS = m.s.find(s => s[0] === x[1]);
      if (!srcS) { out.broken.push({ src: m.file + '#' + x[1], why: 'section not in catalogue' }); continue; }
      const blocks = roleBlocks(x[0]);
      for (const rk of ['*', ...Object.keys(ROLES)]) {
        if (rk !== '*' && !allowed(rk, m, srcS)) continue;
        for (const d of destsIn(viewFor(x[0], blocks, rk), m.file)) {
          if (d === '@home') continue;
          const [f, id] = d.split('#'); const dm = byFile[f];
          const dS = dm && (id ? dm.s.find(s => s[0] === id) : dm.s[0]);
          if (rk === '*') { out.links++; if (!dS) out.broken.push({ src: m.id + ':' + x[1], dest: d }); continue; }
          if (dS && !allowed(rk, dm, dS)) (out.noaccess[rk] = out.noaccess[rk] || []).push({ src: m.id + ':' + x[1], dest: dm.id + ':' + dS[0] });
        }
      }
    }
  }
  return out;
}

/* 1b. reach: starting at the role's home and following only what a customer can click (menu, links, buttons), which allowed screens can never be opened? */
function reach(extra) {
  const { NAVTO } = require(DIR + '/assets/fp.js');
  const byFile = {}; C.forEach(m => (byFile[m.file] = m));
  const html = {}; for (const m of C) html[m.id] = fs.readFileSync(DIR + '/screens/' + m.file + '.html', 'utf8');
  const secHtml = (m, id) => { const h = html[m.id]; const a = h.indexOf('<section class="screen" id="' + id + '"'); return a < 0 ? '' : h.slice(a, h.indexOf('</section>', a)); };
  const key = (m, s) => m.id + ':' + s[0];
  const find = d => { const [f, id] = d.split('#'); const m = byFile[f]; const s = m && (id ? m.s.find(x => x[0] === id) : m.s[0]); return s ? [m, s] : null; };
  const res = {};
  for (const [rk, r] of Object.entries(ROLES)) {
    const all = []; for (const m of C) for (const s of m.s) if (allowed(rk, m, s)) all.push([m, s]);
    const seen = new Set(), q = [], push = t => { if (t && allowed(rk, t[0], t[1]) && !seen.has(key(...t))) { seen.add(key(...t)); q.push(t); } };
    push(find(r.home));
    while (q.length) {
      const [m, s] = q.shift(); const sh = secHtml(m, s[0]);
      const v = viewFor(sh, roleBlocks(sh), rk);
      for (const d of destsIn(v, m.file)) if (d !== '@home') push(find(d));
      const t = metaOf(m, s);
      if (t.shell === 'company' || t.shell === 'platform') { for (const n of r.nav || []) if (NAVTO[n]) push(find(NAVTO[n])); push(find('s07-alerts-andon#centre')); }
      if (t.shell === 'company' || t.shell === 'platform') for (const [mm, ss] of all) { const tt = metaOf(mm, ss); if (tt.nav === t.nav && ['auth', 'device', 'bare'].indexOf(tt.shell) < 0) push([mm, ss]); }
      push(find('s01-identity-access#account'));
      (extra && extra(rk, m, s) || []).forEach(d => push(find(d)));
    }
    const hidden = all.filter(([m, s]) => !seen.has(key(m, s)) && metaOf(m, s).shell !== 'auth');
    res[rk] = { total: all.length, reached: all.length - hidden.length, hidden: hidden.map(([m, s]) => key(m, s) + ' ' + s[1]) };
  }
  return res;
}

/* 2. clicks: open every screen as a role that may see it, click every clickable thing, record what happened */
const CAND = `(()=>{const sec=document.querySelector('section.screen:not([hidden])');if(!sec)return [];
 const sel='button, a[href], [data-go], [data-to], [data-toast], [role=button], .switch, [data-t], [data-pick] > *, [data-multi] > *, summary';
 return [...sec.querySelectorAll(sel)].filter(e=>!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&e.getClientRects().length>0);})()`;
const LIST = `(()=>{const els=${CAND};return els.map(e=>({label:((e.getAttribute('aria-label')||e.textContent||e.title||'').replace(/\\s+/g,' ').trim().slice(0,48))||'(icon)',
 tag:e.tagName.toLowerCase(),cls:(e.className&&e.className.toString().slice(0,40))||''}));})()`;
const CLICK = `(async(i)=>{const els=${CAND};const el=els[i];if(!el)return {gone:true};
 el.scrollIntoView({block:'center'});let m=0;
 const obs=new MutationObserver(rs=>{for(const rc of rs){if(rc.type==='childList'&&rc.addedNodes.length&&[...rc.addedNodes].every(x=>x.nodeType===1&&x.classList.contains('toast')))continue;
  const n=rc.target.nodeType===1?rc.target:rc.target.parentElement;if(!n||n.closest('.toast,[data-run]'))continue;m++;}});
 obs.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
 const sid0=(document.querySelector('section.screen:not([hidden])')||{}).id,h0=location.href;
 el.click();await new Promise(r=>setTimeout(r,160));obs.disconnect();
 const t=document.querySelector('.toast');const toast=t&&t.classList.contains('show')?t.textContent.trim():'';
 const sid1=(document.querySelector('section.screen:not([hidden])')||{}).id;
 return {m,toast,nav:(sid0!==sid1||h0!==location.href),noacc:!!document.querySelector('#noacc'),dialog:!!document.querySelector('.fp-ov,.fp-menu')};})`;
async function clicks(browser) {
  const tasks = [];
  for (const m of C) for (const s of m.s) { const rk = Object.keys(ROLES).find(k => allowed(k, m, s)); if (rk) tasks.push({ m, s, rk }); }
  const results = [];
  async function worker() {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await ctx.route('**/*', r => (r.request().url().startsWith('file:') || r.request().url().startsWith('blob:') ? r.continue() : r.abort()));
    const p = await ctx.newPage(); p.on('pageerror', () => {}); p.on('dialog', d => d.dismiss());
    await p.addInitScript(() => { window.print = () => {}; HTMLInputElement.prototype.click = function () { if (this.type !== 'file') return HTMLElement.prototype.click.call(this); }; });
    while (tasks.length) {
      const { m, s, rk } = tasks.shift(); const url = D + 'screens/' + m.file + '.html?role=' + rk + '#' + s[0];
      const rec = { mod: m.id, id: s[0], title: s[1], role: rk, items: [] };
      const load = async () => { for (let k = 0; k < 4; k++) { try { await p.goto('about:blank'); await p.goto(url, { waitUntil: 'load' }); await p.waitForSelector('section.screen:not([hidden])', { timeout: 4000 }); await p.waitForTimeout(120); return; } catch (e) { if (k === 3) throw e; await p.waitForTimeout(200); } } };
      try {
        await load();
        const list = await p.evaluate(LIST);
        rec.sidebar = await p.evaluate(`[...document.querySelectorAll('#side [data-nav],.bnav [data-nav]')].filter(x=>x.getClientRects().length).length`);
        for (let i = 0; i < list.length; i++) {
          let res;
          try { res = await p.evaluate(CLICK + '(' + i + ')'); } catch (e) { res = { nav: true, m: 0, toast: '' }; await p.waitForLoadState('load').catch(() => {}); await p.waitForTimeout(150); res.noacc = await p.evaluate(`!!document.querySelector('#noacc')`).catch(() => false); }
          let out = 'none';
          if (res.gone) out = 'gone';
          else if (res.noacc) out = 'noaccess';
          else if (res.nav) out = 'nav';
          else if (/^Demo only/.test(res.toast)) out = 'demo';
          else if (res.dialog || res.m > 0) out = 'state';
          else if (res.toast) out = 'message';
          rec.items.push({ ...list[i], out, toast: res.toast || '' });
          if (out !== 'none' && i < list.length - 1) await load();
        }
      } catch (e) { rec.error = String(e).slice(0, 160); }
      results.push(rec);
    }
    await ctx.close();
  }
  await Promise.all([1, 2, 3].map(worker));
  return results;
}

/* 2b. reach by real clicks (phone and kiosk roles): start at the home screen, click everything, follow where each click lands */
async function reachDyn(browser, rks) {
  const out = {};
  for (const rk of rks) {
    const r = ROLES[rk]; const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route('**/*', q => (q.request().url().startsWith('file:') ? q.continue() : q.abort()));
    const p = await ctx.newPage(); p.on('pageerror', () => {}); p.on('dialog', d => d.dismiss());
    await p.addInitScript(() => { window.print = () => {}; HTMLInputElement.prototype.click = function () { if (this.type !== 'file') return HTMLElement.prototype.click.call(this); }; });
    const seen = new Set(), q = [r.home], find = d => { const [f, id] = d.split('#'); const m = C.find(x => x.file === f); return m && m.s.find(s => s[0] === id) ? m.id + ':' + id : null; };
    seen.add(find(r.home));
    while (q.length) {
      const dest = q.shift(); const [f, id] = dest.split('#'); const url = D + 'screens/' + f + '.html?role=' + rk + '#' + id;
      const load = async () => { for (let k = 0; k < 4; k++) { try { await p.goto('about:blank'); await p.goto(url); await p.waitForSelector('section.screen:not([hidden])', { timeout: 4000 }); await p.waitForTimeout(100); return; } catch (e) { if (k === 3) throw e; } } };
      try {
        await load(); const list = await p.evaluate(LIST);
        for (let i = 0; i < list.length; i++) {
          let res; try { res = await p.evaluate(CLICK + '(' + i + ')'); } catch (e) { await p.waitForLoadState('load').catch(() => {}); await p.waitForTimeout(150); }
          const at = await p.evaluate(() => ({ f: location.pathname.split('/').pop().replace('.html', ''), id: (document.querySelector('section.screen:not([hidden])') || {}).id, no: !!document.querySelector('#noacc') })).catch(() => null);
          if (at && at.id && !at.no) { const d = at.f + '#' + at.id, key = find(d); if (key && !seen.has(key)) { seen.add(key); q.push(d); } }
          if (at && (at.f + '#' + at.id) !== dest) await load();
        }
      } catch (e) { /* screen failed to load: counted as not reached below */ }
    }
    const all = []; for (const m of C) for (const s of m.s) if (allowed(rk, m, s) && metaOf(m, s).shell !== 'auth') all.push([m.id + ':' + s[0], s[1]]);
    out[rk] = { total: all.length, reached: all.filter(([k]) => seen.has(k)).length, hidden: all.filter(([k]) => !seen.has(k)).map(([k, t]) => k + ' ' + t) };
    await ctx.close();
  }
  return out;
}

/* 3. homes: what each role sees first */
async function homes(browser, lk) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  const p = await ctx.newPage(); const out = {};
  for (const [rk, r] of Object.entries(ROLES)) {
    const [f, id] = r.home.split('#');
    await p.goto(D + 'screens/' + f + '.html?role=' + rk + '#' + id); await p.waitForTimeout(250);
    const m = await p.evaluate(() => { const s = document.querySelector('section.screen:not([hidden])'); const h1 = ((s.querySelector('h1') || {}).textContent || '').trim();
      return { kpi: s.querySelectorAll('.kpi,.kpi-ov,.md-kpi,.md-kst').length, charts: s.querySelectorAll('svg.chart,svg.md-chart').length, bars: s.querySelectorAll('.hb,.tl').length, tables: s.querySelectorAll('table').length, text: s.innerText.replace(h1, '').replace(/\s+/g, ' ') }; });
    const modId = (C.find(x => x.file === f) || {}).id;
    out[rk] = { home: r.home, pf: r.pf, name: r.name, kpi: m.kpi, charts: m.charts, bars: m.bars, tables: m.tables,
      sig: crypto.createHash('md5').update(m.text).digest('hex').slice(0, 6),
      noAccessOnHome: [...new Set((lk.noaccess[rk] || []).filter(a => a.src === modId + ':' + id).map(a => a.dest))] };
  }
  await ctx.close(); return out;
}

if (process.argv.includes('--reach-dyn')) {
  (async () => { const b = await chromium.launch({ channel: 'chrome' }); const rks = Object.keys(ROLES).filter(k => ROLES[k].pf !== 'web');
    const r = await reachDyn(b, rks); await b.close(); let n = 0;
    for (const [k, v] of Object.entries(r)) { n += v.hidden.length; console.log(k.padEnd(10), v.reached + '/' + v.total, v.hidden.length ? 'not reached: ' + v.hidden.join(' | ') : ''); }
    console.log('total not reached', n); })();
} else if (process.argv.includes('--reach')) {
  const r = reach(); let n = 0;
  for (const [k, v] of Object.entries(r)) { n += v.hidden.length; console.log(k.padEnd(10), v.reached + '/' + v.total, 'cannot be reached by clicking:', v.hidden.length); }
  if (process.argv.includes('--list')) for (const [k, v] of Object.entries(r)) if (v.hidden.length) console.log('\n' + k + '\n  ' + v.hidden.join('\n  '));
  console.log('total', n); process.exit(0);
}
if (!process.argv.includes('--reach') && !process.argv.includes('--reach-dyn')) (async () => {
  const lk = links(); fs.writeFileSync(OUT + '/links.json', JSON.stringify(lk, null, 1));
  const browser = await chromium.launch({ channel: 'chrome' });
  const hm = await homes(browser, lk); fs.writeFileSync(OUT + '/homes.json', JSON.stringify(hm, null, 1));
  const ck = await clicks(browser); fs.writeFileSync(OUT + '/clicks.json', JSON.stringify(ck));
  await browser.close();
  const all = ck.flatMap(r => r.items); const t = {}; all.forEach(i => (t[i.out] = (t[i.out] || 0) + 1));
  const verb = /^(\+\s*)?(add|new|create|save|invite|send|delete|remove|apply|submit|confirm|register|start|publish|approve|reject|accept|discard|revoke|connect|retry|restart|update|import|rotate|end)/i;
  const act = all.filter(i => verb.test(i.label) && (i.tag === 'button' || /btn/.test(i.cls)));
  const stuck = ck.filter(r => !r.sidebar && !r.items.some(i => i.out === 'nav'));
  console.log('screens', ck.length, 'errors', ck.filter(r => r.error).length, '| clicks', all.length, t);
  console.log('action buttons', act.length, 'not real', act.filter(i => ['demo', 'message', 'none'].includes(i.out)).length);
  console.log('stuck screens', stuck.length, '| broken links', lk.broken.length, '| no-access links', Object.values(lk.noaccess).reduce((a, l) => a + new Set(l.map(x => x.src + x.dest)).size, 0));
  const na = ck.flatMap(r => r.items.filter(i => i.out === 'noaccess').map(i => r.mod + ':' + r.id + ' (' + r.role + ') → ' + i.label));
  console.log('clicks that land on No access', na.length); na.slice(0, 40).forEach(x => console.log('  ' + x));
  console.log('output in', OUT);
})();
