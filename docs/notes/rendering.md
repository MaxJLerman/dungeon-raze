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
  the pieces within the world's own `w.cut` metres of the camera (0 and
  `pieces: null` in the cave and hall, which are drawn whole).
- `R.nodePos(node, x, y, z)` returns a world position on a figure, valid after
  that figure has been drawn in the current frame.
- `R.toScreen(x, y, z)` projects to CSS pixels for HUD elements.

## Known problems

- The camera can pass through characters at close range.
