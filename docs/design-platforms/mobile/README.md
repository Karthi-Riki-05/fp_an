# FP Analyzer v3 · Mobile app design

Written for: the team that builds the mobile app and the client reviewers who approve it.

The FP app on a personal phone: operators register from their own phone, supervisors get alerts and follow the line, maintenance answers calls. iOS and Android, works offline.

Open `index.html` in a browser. No server and no internet are needed except for the fonts.

- **37 screens** in 5 module files, taken from the v3 design documents (docs/lld S00–S20).
- **Roles:** pick one on the start page or in the bar at the top of every screen. You see only that role's menu and screens.
- **Journeys:** step-by-step flows with a Next button at the bottom-left.
- **Ask FP** (the ✦ button, or Ctrl J) is on every screen.

Roles in this pack:

- **Operator** (Elin Sand): Registers stops, checklists and handover from her own phone.
- **Supervisor** (Sami Koski): Gets andon and stop alerts, follows the line, asks FP.
- **Maintenance** (Nils Dahl): Answers maintenance calls and reads machine instructions.

This pack is generated from the master design in `docs/design` by `docs/design/tools/build-packs.js`. Change the master, then build again; do not edit this folder by hand.
All names, companies and numbers are fictional.
