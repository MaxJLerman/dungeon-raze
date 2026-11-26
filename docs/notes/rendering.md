# Rendering

## Renderer (`R` in `02_gl.js`)

- One lit shader for everything solid. Normals are computed per pixel from
  screen-space derivatives, which gives the faceted look and makes triangle
  winding irrelevant.
- Up to eight point lights per frame, chosen in `buildLights()` in
  `07_render.js`: the player's lamp first, then shrines, gate, flashes, the
  boss (not while it is hidden), then the nearest crystals.
- `uToon` switches characters to three-step lighting. The world uses smooth
  wrapped lighting.
- Effects go through `R.sprite`, `R.ribbon`, `R.ring` and `R.blob`. They are
  batched and drawn after the solid pass: blobs darken the ground, everything
  else is additive. `R.blob(x, z, s, a, yaw, len, y)` takes an optional
  heading, a stretch along it (an ellipse `len` times as long as wide) and
  a height (0.12 by default).
- **Aftershock rings** (`G.waves`, the Warden for two's slam, `coop.md`) are
  drawn straight from the list, not from `G.rings`: in the effects pass after
  the rings, `R.ring` from `rr - band / 2` to `rr + band / 2` at height 0.2 in
  `RED`, where `rr` is the radius `wavesUpdate` judges
  (`(t - o.wait) * o.speed`), so what is drawn is where it hurts. Nothing is
  drawn before `o.wait`. `tests/t32.mjs` takes `shots/t32-wave.png`.
- **The Warden for two's seize** (`coop.md`). `atkPose` style `"seize"`:
  the wind-up throws both arms wide (Z out to 1.35 rad, a little forward),
  the act sweeps them in together. `poseEnemy`'s `"hold"` case, only for a
  holder whose `atk.kind` is `"seize"` (D's holders keep their own poses):
  right arm raised, left arm across its chest. A player held by such a
  holder (this player through `p.hold.by`, a mate through `m.heldBy`, set
  by the host's `held` event) is drawn in `posePlayer` with its root moved
  to just in front of the holder's chest (half its depth plus the player's
  depth and 0.15 m) and raised so the two chests meet, facing it; the
  player's own position, its blob shadow and its camera stay on the floor
  in front. `tests/t32.mjs` takes `shots/t32-seize-wind.png` and
  `shots/t32-held.png`.
- **Materials.** The world mesh has one material byte per vertex, a fourth
  attribute (`aMat`, location 3). `MAT` in `03_world.js` names the values:
  0 plain, `MAT.BRICK` 1, `MAT.WATER` 2. `meshSink` takes a `mat` argument on
  `tri` and `triC` and returns `M` beside `P` and `C`. The cave and the hall
  write 0 everywhere (`world.mat` is `null` or all zero), so they draw as they
  always did. The fragment shader draws brick (courses, mortar, per-brick
  shade, dark and missing bricks) and moving water from world position and
  `uTime`, which `R.env.t` sets from the game clock. Missing and dark bricks
  are the shader's, not geometry (the walls stay straight). A mesh with no
  material reads plain.
- `R.setWorld(pos, col, mat, pieces)` uploads the world and frees the one it
  replaces. `R.drawWorld(ids)` draws the whole world when `ids` is `null` or
  the world has no pieces, otherwise only those pieces (ranges of the
  vertices). `R.stats` is `{ draws, tris }`, reset in `begin` each frame, so
  `R.stats.tris` after a frame is the world triangles that frame drew (figures
  count toward `draws` only, effects toward neither). `R.boxVisible(box)`
  tests `[x0, y0, z0, x1, y1, z1]` against the view of the current frame.
  `render()` passes `R.drawWorld` the ids from `visiblePieces`, which keeps
  the pieces within the world's own `w.cut` metres of the camera. The sewer
  and the big co-op cave are drawn by pieces; the small cave and the hall
  have `pieces: null` and `cut: 0` and are drawn whole.
- `R.nodePos(node, x, y, z)` returns a world position on a figure, valid after
  that figure has been drawn in the current frame.
- `R.toScreen(x, y, z)` projects to CSS pixels for HUD elements.

## Known problems

- The camera can pass through characters at close range.
