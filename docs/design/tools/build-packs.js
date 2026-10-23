// Builds the per-platform design packs from the master prototype.
// Written for: whoever updates the v3 design. Edit docs/design (the master), then run:
//   node docs/design/tools/build-packs.js
// Output: docs/design-platforms/{web,mobile,kiosk}/ — each folder stands alone and can be zipped and sent.
// A pack keeps only the screens that one of its roles can open (roles live in assets/fp.js),
// and on mixed device screens only the frames for that platform (phones in mobile, tablets and TVs in kiosk).
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');
const OUT = path.resolve(SRC, '..', 'design-platforms');
const data = require(path.join(SRC, 'assets', 'fp.js'));
const PACKS = ['web', 'mobile', 'kiosk'];

const SECTION = /<section class="screen" id="([^"]+)"[\s\S]*?<\/section>\n?/g;
const FRAME = /\n?[ \t]*<div(?: style="[^"]*")?><div class="(phone|tablet|tv)">[\s\S]*?<p class="dev-cap">[\s\S]*?<\/p><\/div>/g;

function rmrf(dir) { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }

for (const pf of PACKS) {
  const dir = path.join(OUT, pf);
  rmrf(dir);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'screens'), { recursive: true });

  const js = fs.readFileSync(path.join(SRC, 'assets', 'fp.js'), 'utf8');
  if (!js.includes("var PF='all';")) throw new Error('fp.js: PF marker not found');
  fs.writeFileSync(path.join(dir, 'assets', 'fp.js'), js.replace("var PF='all';", "var PF='" + pf + "';"));
  fs.copyFileSync(path.join(SRC, 'assets', 'fp.css'), path.join(dir, 'assets', 'fp.css'));
  fs.copyFileSync(path.join(SRC, 'index.html'), path.join(dir, 'index.html'));

  const roles = data.rolesIn(pf);
  let screens = 0, files = 0;
  for (const m of data.C) {
    const keep = new Set(m.s.filter(s => roles.some(k => data.allowed(k, m, s))).map(s => s[0]));
    if (!keep.size) continue;
    let html = fs.readFileSync(path.join(SRC, 'screens', m.file + '.html'), 'utf8');
    html = html.replace(SECTION, (sec, id) => {
      if (!keep.has(id)) return '';
      if (pf === 'mobile') return sec.replace(FRAME, (f, kind) => (kind === 'phone' ? f : ''));
      if (pf === 'kiosk') return sec.replace(FRAME, (f, kind) => (kind === 'phone' ? '' : f));
      return sec;
    });
    fs.writeFileSync(path.join(dir, 'screens', m.file + '.html'), html);
    screens += keep.size; files++;
  }

  const p = data.PFS[pf];
  const rl = roles.map(k => '- **' + data.ROLES[k].name + '** (' + data.ROLES[k].who + '): ' + data.ROLES[k].does).join('\n');
  fs.writeFileSync(path.join(dir, 'README.md'),
`# FP Analyzer v3 · ${p.name} design

Written for: the team that builds the ${p.name.toLowerCase()} and the client reviewers who approve it.

${p.text}

Open \`index.html\` in a browser. No server and no internet are needed except for the fonts.

- **${screens} screens** in ${files} module files, taken from the v3 design documents (docs/lld S00–S20).
- **Roles:** pick one on the start page or in the bar at the top of every screen. You see only that role's menu and screens.
- **Journeys:** step-by-step flows with a Next button at the bottom-left.
- **Ask FP** (the ✦ button, or Ctrl J) is on every screen.

Roles in this pack:

${rl}

This pack is generated from the master design in \`docs/design\` by \`docs/design/tools/build-packs.js\`. Change the master, then build again; do not edit this folder by hand.
All names, companies and numbers are fictional.
`);
  console.log(pf.padEnd(7), screens, 'screens in', files, 'files ->', path.relative(process.cwd(), dir));
}
