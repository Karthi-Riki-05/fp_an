# FP Analyzer v3 · Line terminal and TV design

Written for: the team that builds the line terminal and tv and the client reviewers who approve it.

The shared tablet at the line in kiosk mode, operators sign in with badge or PIN, and the TV boards on the wall. Big buttons, readable at arm’s length, works offline.

Open `index.html` in a browser. No server and no internet are needed except for the fonts.

- **30 screens** in 8 module files, taken from the v3 design documents (docs/lld S00–S20).
- **Roles:** pick one on the start page or in the bar at the top of every screen. You see only that role's menu and screens.
- **Journeys:** step-by-step flows with a Next button at the bottom-left.
- **Ask FP** (the ✦ button, or Ctrl J) is on every screen.

Roles in this pack:

- **Operator** (Elin Sand): Works at the line: badge in, register stops, run orders, checklists, handover.
- **Terminal setup** (Lena Holm): Pairs a new tablet to a line and checks its status.
- **Wall TV (no sign-in)** (Board Line 2): Not a user: a TV paired to a board. It rotates line status, this hour and the huddle page, and shows andon as a banner. Set up in Boards on the web.

This pack is generated from the master design in `docs/design` by `docs/design/tools/build-packs.js`. Change the master, then build again; do not edit this folder by hand.
All names, companies and numbers are fictional.
