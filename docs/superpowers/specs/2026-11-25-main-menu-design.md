# Main menu

Design, 2026-11-25. Short form: a small change to the screens that exist.

## What the owner asked for

The first page a visitor sees is a main menu with no class picker on it:
Play solo, Play online, How to play, Controls. Choosing a class comes after
pressing a Play button and before the hall (the lobby). The class can still
be changed from the pause screen. From the hall and from inside a dungeon
the player can exit to the main menu, and from a dungeon also back to the
hall. Play online is shown to every visitor; the `?coop=1` address is no
longer needed.

Why: the page now has two ways to play, and the front page should offer
them plainly rather than hide one behind an address.

## Goals

- A visitor sees four choices and nothing else to work out.
- Co-op is one click from the front page, for everyone.
- A player can get back to the front page without reloading.

## Non-goals

- The hall as a shared co-op lobby. Co-op still goes from the room screen
  straight into the cave.
- A "are you sure" prompt on exit. Nothing is lost yet, as with Return to
  base today.
- New art, a new backdrop or a new layout style. The menu uses the styles
  the title screen has.

## Anti-goals

- A returning player made to do more than two clicks to reach the hall.
- An address that used to work (`?coop=1`) stops working.

## Approaches

1. **Keep the title screen as the main menu and reuse the class screen
   (picked).** The state stays `title`; the picker comes off it. The
   existing `class` screen, which the pause screen already opens, gains a
   forward button when it is opened from the main menu. Least new code, and
   the pad, touch Back and Esc rules for menus already cover it.
2. **A new `menu` state and a separate class screen for starting.** Reads
   cleaner in the code, but renames a state that the touch, pad, co-op and
   test code all name, and builds a second class screen beside the one
   that exists. No visible gain.
3. **Choose the class inside the hall** (a stand to walk up to). Not what
   was asked, and co-op never visits the hall.

## The screens

**Main menu** (state `title`, `#scr-title`). Heading, the blurb, the touch
note, the co-op message line, then one row:

    [ Play solo ]  [ Play online ]  [ How to play ]  [ Controls ]

- `#btnSolo` "Play solo" (the pad's first focus) opens the class screen for
  a solo start.
- `#btnCoop` "Play online" opens the class screen for an online start. It
  is always shown. `coopButton` and the reading of `?coop=1` are removed;
  an address that still carries it works and the parameter does nothing.
- No `.picker` on this screen.
- The hall still sways behind it as now.
- With nothing focused, Enter or Space does what Play solo does (it used to
  start play).
- If WebGL 2 cannot start, the message goes where it does now and both Play
  buttons are disabled.

**Class screen** (state `class`, `#scr-class`), three uses:

| Opened from | Line under the heading | Forward button (`#btnPlay`) | Back goes to |
| --- | --- | --- | --- |
| Play solo | none | "Enter the hall": starts play in the hall | main menu |
| Play online | none | "Continue": opens the room screen | main menu |
| Pause screen | "Switching mid-run keeps your place in the cave and your share of health." | hidden | pause screen |

The forward button is the pad's first focus when shown (the class cards
come before it). The saved class is preselected, so a returning player
presses Play solo, then Enter the hall.

**Room screen** (`#scr-coop`). Heading "Play online". Its line reads "One
of you hosts a room and sends the other its code. You play the class you
just chose." Back, Esc, the pad's back button and the touch Back gesture
go to the main menu, ending a room not yet entered, as now. (Builder's
call: Back does not return to the class screen. Menus keep one level of
"where I came from", and a class change is two clicks away.)

**Pause screen.** Resume, Change class, How to play, Controls, Return to
base (in a dungeon only, as now), and new `#btnExit` "Exit to main menu".

**Death screen.** Rise again, Return to base, and new `#btnDeadExit` "Exit
to main menu".

**Win screen.** Return to base, and new `#btnWinExit` "Exit to main menu".
(Builder's addition: after a co-op run ends at the gate, this is the way to
a new room.)

## Exit to main menu

One function, `toTitle()`: `enterHub()`, then `show("title")`.

- `enterHub()` builds a fresh hall with the player at its start, and ends a
  co-op run for this page before the world goes (it already does).
- In co-op that means: the friend exiting leaves the host playing on; the
  host exiting closes the room and the friend reads "The host has left."
- Pointer lock is released by `show`, as for every screen that is not play.
  Fullscreen is left as it is.
- A message from co-op ending ("The host has left." and the others) shows
  on the main menu above the row of buttons. `coopSay` now places it before
  that row, since the picker it used to sit before is gone.
- Nothing is saved or lost that is not saved or lost today.

## To be checked while building, not promised

The docs say that for another co-op run both players reload the page. That
was written because nothing led back to the title screen. With Exit to main
menu a second room may work without a reload. A test hosts a second room
after an exit; if it passes, the README and the first-session checklist
drop the reload line, and if it fails they keep it.

## Tests

- `test.mjs`: the `smoke` and `hub` modes press Play solo, then Enter the
  hall. Every test script goes through this.
- Updated: `t8`, `t10`, `t16`, `t18`, `t26`, `t29`, `coop-e2e`, which name
  the title's picker, `#btnPlay` on the title, `#btnCoop` or `?coop=1`.
- New steps: the main menu has four buttons and no picker; Play online
  shows without `?coop=1`; solo flow reaches the hall; online flow reaches
  the room screen with the chosen class in its slot; the class screen from
  pause has no forward button; exit from the hall, a cave, the death screen
  and the win screen each lands on the main menu in a fresh hall with the
  HUD hidden; exit as a co-op friend and as a co-op host; a co-op ending
  message shows on the main menu; pad focus, back and press on the new
  screens; the touch Back gesture from the class and room screens; Enter
  on the main menu.
- Screenshots to look at: the main menu and the class screen on the
  desktop page and on the smallest phone in `tests/devices.mjs`.

## Docs

`README.md` (Play, Co-op), `CLAUDE.md` (the screens, the room screen, where
the project stands) and `docs/coop-first-session.md` (the link and who
clicks what) are brought up to date in the same change.

## Left to the builder

Names of helpers, how the class screen remembers what it was opened for,
and the exact wording of the main menu's blurb now that it no longer says
"Pick a class".
