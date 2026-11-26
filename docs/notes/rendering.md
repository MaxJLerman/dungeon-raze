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
- **The seal's heaps** (`coop.md`) are `G.chunks` entries that carry their
  own `ends`: `drawChunks` heaps them from one end to the other (3.27 m)
  in place of 0.95 m either side of the centre, so the 24 meet end to end
  with no gap; the crocodile's chunks have no `ends` and are drawn as
  before. Their warning is `drawDust`'s. `tests/t32.mjs` takes
  `shots/t32-warn.png` and `shots/t32-ring.png`.
- **The dark of the Warden for two's last phase** (`coop.md`).
  `darkK(f)` (`06b`) is `1 + (f - 1) * G.dark.v`, which is 1 whenever
  `G.dark.v` is 0, so the hall, the sewer and a solo cave draw as they
  always did. `WARDEN2.dark` has three floors, each applied in `07_render.js`
  by `darkK`: `floor` 0.12 for the cave's crystals (`darkMul()`: the strength
  of every light from `world.lights` in `buildLights`, the alpha of the
  non-lamp halo sprites, and, through `R.env.glow` and uniform `uGlow`, the
  glow a world vertex carries in its alpha byte, `glow=vC.a*uGlow`, before
  the water's own glow is added); `amb` 0.12 for the cave's ambient light
  (`R.env.ambK`, which `R.begin` multiplies into `uAmb`); and `lamp` 0.25
  for the player's own lamp, the first light of `buildLights`. Not dimmed:
  the Warden's light, the exit gate's, shrines and flashes, shots, rings,
  sparks, the aftershock ring, the dust warnings, the HUD, and the fog
  colour (already near black). Figures draw with glow 0, so `uGlow` does not
  touch them, but they are lit by the ambient light and the lamp and so
  darken with them.
  **Why three.** The first build dimmed only the crystals, as the spec said,
  and the sealed frame came out only 2 to 4% darker: the cave's red
  crystals weigh little in luminance, and what lights the cave is the
  player's lamp (1.55, radius 20) and the ambient light, which the gamma
  lifts. Even a crystal floor of 0 left 94%. So the room only reads as dark
  when those two go down too.
  **How the values were found** (screenshots from the door spot, 9 m from
  the Warden, and a mean over the canvas with the Warden out of view). With
  the sealed frame at full light as the baseline, `amb` and `lamp` of 0.4
  and 0.4 gave 67% of it, 0.25 and 0.3 gave 60%, 0.15 and 0.2 gave 51%. The
  chosen 0.12 and 0.25 give 57% of the frame before the seal (the heaps of
  rock add a little light, so that baseline is lower), with the brightest
  tenth of the Warden's wind-up frame at 82% of the lit one. Looked at: the
  Warden's raised arms in the slam wind-up and the wide arms of the seize
  read clearly at 8 to 9 m by its own red glow; the player's figure shows
  against the lamp-lit floor, which is lit a few metres round it; the rubble
  wall can be made out from 3 m. The player's own body is dark teal and
  reads mostly by its rim and the lamp, so do not go much lower on `lamp`.
  `tests/t32.mjs` reads the
  canvas in the same task as the draw (it wraps `R.end` and copies the
  canvas to a 2D one; the drawing buffer is not kept), checks the sealed
  frame is under 60% of the frame before the seal and the Warden's
  wind-up frame's brightest tenth at least 70%, and takes `shots/t32-dark`
  and `shots/t32-lit`.
- **The roar pose** (`poseEnemy`'s `"roar"`) fills the roar's own length,
  `def.roarT[phase]` (the Warden for two's phase 4 roar is 2.2 s), and 1.2 s
  for a definition without it.
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
