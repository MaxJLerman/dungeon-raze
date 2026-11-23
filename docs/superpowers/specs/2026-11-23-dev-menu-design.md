# Dev menu

## Intent

A menu for the owner to test the game faster: unlock the hidden classes,
enter any gate, jump straight to a boss fight and turn on god mode. It is
for the local build only (`npm run dev`, http://localhost:8000) and must
never be reachable on the published GitHub Pages page.

## Goals

- Unlock the hidden classes (Enforcer, Sapper, Riftwalker) for the session.
- Enter any gate, E to S, ignoring locks.
- Jump to any boss fight: the Warden (E) and Old Sluicejaw (D).
- Toggle god mode: no damage, unlimited consumables and stamina.

## Non-goals and anti-goals

- No dev code in the published build. A hidden switch in public code is a
  failure even if it works.
- Dev actions never touch the save. Real unlocks and cleared grades stay as
  the player earned them.
- No change to how the game plays with the menu unused.

## Approaches

1. **Left out of the release build, plus a hostname gate (picked).** Dev code
   lives in `src/dev/`; `node build.mjs` includes it, `node build.mjs
   --release` leaves it out, and the Pages workflow uses `--release`. At run
   time the menu also turns on only for `localhost`, `127.0.0.1` and
   `file:`.
2. **Hostname gate only.** Simpler, but the code ships publicly and anyone
   serving a saved copy locally gets it.

The owner picked 1.

## Design

- **Build.** `build.mjs` concatenates `src/*.js` as now, then `src/dev/*.js`
  after them unless `--release` is passed. `.github/workflows/pages.yml` runs
  `node build.mjs --release`.
- **Seam.** Core code declares `let DEV = null` once and reads it in a few
  named places (god mode in `hurtPlayer` and `grabPlayer`, the refill in
  `update`, the save filter in `saveOpt`, the class check in `classOpen`).
  In a release build `DEV` stays null and every check is inert. The dev file
  sets `DEV` only when the hostname gate passes.
- **Opening.** A Dev button on the title and pause screens and the backquote
  key, both added by the dev file. `dev` joins `SCREENS` and `MENUS`, so
  Back, Esc and the pad's back button return to the screen it came from.
  The screen's DOM is built in JS, so the template carries nothing.
- **Unlock hidden classes.** Adds them to `DEV.unlocked`, which `classOpen`
  reads beside `UNLOCKED`. Never saved.
- **Enter any gate.** One button per grade E to S; a fresh seed, ignoring
  `portalOpen`. C to S fall back to `genWorld` as `WORLD_GEN` already does.
- **Jump to boss.** A fresh run of E or D started at the last rest point
  before the boss chamber (`world.shrines` last), which is made the
  checkpoint, so a death returns there.
- **God mode.** `DEV.god`, off on each load. `hurtPlayer` takes nothing,
  `grabPlayer` refuses, and each update keeps health, stamina, flasks, tool
  charges and focus full.

## Builder's calls (made in conversation, owner approved)

- Session-only unlocks; focus included in god mode; a phone on the LAN IP
  does not get the menu.

## Left to the builder

- Layout and wording of the dev screen, in the style of the other menus.
- Exact names of the seams.

## Tests

`tests/t26.mjs`: each action, the hostname gate, and a check that a
`--release` build contains no dev code. Docs in `CLAUDE.md` and `README.md`.
