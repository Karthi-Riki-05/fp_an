# FP Analyzer v3 · Web app design

Written for: the team that builds the web app and the client reviewers who approve it.

Every screen people use in a browser: managers, supervisors, maintenance, quality, planners and viewers at the customer, plus FP staff and partners. Pick a role to see exactly their menu and screens.

Open `index.html` in a browser. No server and no internet are needed except for the fonts.

- **173 screens** in 19 module files, taken from the v3 design documents (docs/lld S00–S20).
- **Roles:** pick one on the start page or in the bar at the top of every screen. You see only that role's menu and screens.
- **Journeys:** step-by-step flows with a Next button at the bottom-left.
- **Ask FP** (the ✦ button, or Ctrl J) is on every screen.

Roles in this pack:

- **Company admin** (Lena Holm): Sets up the plant, people, shifts, reasons and the plan. Sees everything at Nordvik Trä.
- **Production manager** (Erik Nyström): Runs the plant day to day: OEE, losses, orders, improvement.
- **Supervisor** (Sami Koski): Leads the shift: fills missing reasons, answers andon, follows actions.
- **Maintenance** (Nils Dahl): Takes requests, plans service, keeps machine documents.
- **Quality** (Aino Virtanen): Follows scrap and quality loss, keeps scrap reasons.
- **Planner** (Hanna Lund): Plans orders, products, rates and shifts.
- **Viewer** (Karin Åberg): Reads dashboards and reports. Changes nothing.
- **FP platform admin** (Pekka Niemi): FP staff. Everything on the platform: companies, templates, security.
- **FP support** (Mira Sandell): FP staff. Helps customers, with their approval for support sessions.
- **FP operations** (Tobias Wik): FP staff. Keeps servers, backups, jobs and deploys healthy.
- **FP billing** (Sara Holmgren): FP staff. Plans, subscriptions and the monthly statement run.
- **Partner** (Johan Ek): An installer or integrator: API docs and their commission.

This pack is generated from the master design in `docs/design` by `docs/design/tools/build-packs.js`. Change the master, then build again; do not edit this folder by hand.
All names, companies and numbers are fictional.
