# Asking before a gate is entered

A small change. Date: 2026-11-27.

## Intent

Walking into an open gate in the hall takes the player into its dungeon at
once. The owner wants to be able to back out after walking in by accident. So
the gate asks first, and saying no throws the player back out of the arch.

## Goals

- Stepping into an open hall gate opens a question, "Enter gate E?" (the
  gate's letter), with two answers: **Enter** and **Stay out**.
- **Enter** does exactly what stepping in does today.
- **Stay out** throws the player out of the arch with the dodge, and the
  camera stays pointing where it was. The look the owner named is Mario
  leaving a painting in Super Mario 64.
- It works with mouse, keyboard, controller and touch.

## Non-goals

- The exit gate over a dead boss. It still ends the run at once.
- Any text about the dungeon on the question. The owner asked for the
  question alone, with no second line.
- Sealed gates, which stay solid frames.

## Anti-goals

- A press already on its way (a dodge, an attack click) must not answer the
  question. That would bring the accident back.
- Saying no must never leave the player where the question opens again at
  once.

## Approaches

- **A. A small screen over the game, like pause (chosen by the owner).** The
  mouse is freed and the buttons can be clicked; keys, a controller and touch
  answer it through the menu handling that exists. Solo, the game stops
  under it. Cost: on a desktop the mouse unlocks and locks again.
- **B. A card in the HUD, like the plaque close-up.** The mouse stays locked
  and a key answers. Smoother on a desktop, but nothing can be clicked, and
  it needs a new player state, which reaches the co-op wire, the touch
  layout and the pad bindings.
- **C. Stand in the arch and press a key to enter.** Dropped: no question
  and nothing to back out of.

## The design

Decided by the owner: approach A, the wording of the question, hall gates
only, the dodge backwards with the camera left alone. The rest below is the
designer's call and open to correction.

**The question.** A new screen and game state (suggested name `enter`, since
`G.gate` is already the exit gate), with the heading "Enter gate E?" and two
buttons, Enter and Stay out. It is not one of `MENUS`. The HUD stays up
under it as it does under pause. What is being asked is held in new per-run
state (suggested `G.ask = { grade }`), cleared in `resetRun`.

**When it opens.** The portal check at the end of `update` opens it where it
calls `startTrans` or `NET.onPortal` today. Core code has no DOM, so it sets
the state and the frame loop shows the screen, as it does for the win
screen. The check does nothing while the question is open.

**Answering.**

- Mouse and touch: the two buttons.
- Keyboard: Enter is Enter. Esc is Stay out. Space does nothing, because
  Space is the dodge and a player dodging into a gate would answer by
  accident.
- Controller: Enter has the focus when the screen opens, A presses the
  focused button, B is Stay out.
- Touch: the Back gesture is Stay out.
- For the first 0.35 s the screen takes no answer, so a click or press made
  before it appeared does nothing.

**Enter.** Closes the question, returns to play and then does what the
check does today: `startTrans(grade)`, or `NET.onPortal(grade)` in co-op.
Reduced motion still cuts.

**Stay out.** Closes the question, returns to play and starts a free dodge
(`startDodge` with `free`): straight out of the arch along the gate's `yaw`,
the class's full dodge distance, no stamina spent, the figure's facing and
lock left as they were, `cam` not touched. The shortest dodge is 3.8 m and
the circle reaches 1 m, so the player always lands outside it. The gate does
not ask again until the player has been outside its circle.

**The mouse.** `show` frees it and `play` locks it again, as pause does. A
browser will not lock the mouse from an Esc press, so after Esc the lock
comes back on the next click, and the refusal must not set `G.noLock`.

**Co-op.** Only the host's own page (the one that leads) is asked. The hall
runs on under the question as it does under pause, with the player standing
still. A friend who steps in is told "Only the host can open a gate." as
today and is not asked or thrown out. The host copy never asks. A world swap
or an exit while the question is open closes it.

## Left to the builder

- Names, the markup and style of the screen (follow the pause screen), and
  how core code learns that this page leads without naming anything from
  `07` on.
- How the re-ask guard is held.
- Tests: new steps in `tests/t8.mjs` (it asks, Enter goes in, Stay out lands
  outside the circle with `cam.yaw` and stamina unchanged, walking in
  sideways is still thrown straight out, no second question until the
  player has left, an early press is ignored, Space does not answer), a
  screenshot of the question on the desktop page and on the smallest phone,
  and a co-op check that the host is asked and the friend is not. Every
  existing script that walks into a gate (t8, t9, t18, t22, t25 to t29,
  coop-e2e, coop-host) answers Enter where it expected the trip.
- Notes in the same commit: `zones.md`, `coop.md`, the README's test table.
