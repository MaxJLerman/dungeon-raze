# Input and bindings

- `keys[code]` is true while held and `taps[code]` is true for one update after
  a press. Codes are `KeyboardEvent.code` values, and mouse buttons are
  `Mouse0`, `Mouse1`, `Mouse2`.
- Game code never reads raw codes. It calls `held('action')` and
  `hit('action')`, which look the code up in `BIND`.
- To add an action: add it to `DEFAULT_BINDS` and `ACTIONS`, then read it with
  `held` or `hit`. The controls menu picks it up automatically.
- `interact` is G and pad A or Cross (`P:0`). Dodge is Space on the keyboard.
  The plaques release had dodge on B and Interact on Space; `loadOpt` moves a
  save holding exactly that pair to Space and G, unless G is taken.
  In the hall, a free player at a plaque opens it with `interact` before
  any other action is read. The jump planned for the same button must keep
  that priority.
- A touch button does not go through `BIND`. It sets `keys["T:" + action]`
  and `taps["T:" + action]`, and `held(a)` and `hit(a)` read that key beside
  the bound one. `hit` reads both taps so that both are consumed. The stick
  sets `T:sprint` when it is pushed past its ring. An action with a touch
  button needs an entry in `TOUCH_BTNS` and `LOOK` (see `touch.md`).
- A pad button sets `keys["P:i"]` and `taps["P:i"]`, where `i` is the index in
  the standard mapping. `held(a)` and `hit(a)` read it through `PAD_BIND`
  beside the key and the touch button. `hit` reads all three taps so that all
  are consumed. To give an action a pad default, add it to `DEFAULT_PAD`.
  Movement has no entry, because it is the left stick.

## Known problems

- In the controls menu, Escape cannot be bound, and the pause key in the
  no-pointer-lock fallback is fixed to P.
