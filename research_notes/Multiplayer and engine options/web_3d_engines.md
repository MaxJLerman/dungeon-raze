# Web-native 3D engines and frameworks as an upgrade path for DungeonRaze (as of 20 November 2026)

Notes on method. Read on 20 November 2026. Version numbers and dates come from each project's GitHub releases page or official site unless stated. GitHub release pages show day and month only; years are inferred from today's date and cross-checked against dated secondary articles where possible. Several comparison articles used here are vendor blogs (Utsubo is a Three.js agency, Cinevva sells its own WebGPU engine, Summer Engine sells a Godot-compatible engine); their stake is flagged where they are cited. Items marked "background knowledge" were not verified in this session and are kept out of Cited Findings.

## 1. State of each engine in late 2026 (version, cadence, licence, backing, WebGPU and WebGL2, mobile and iOS, bundle size)

### Takeaway
Three.js (r187), Babylon.js (9.37.1) and PlayCanvas (2.24.2) are all actively released, permissively licensed and all run WebGPU with an automatic WebGL2 fallback; WebGPU now works in iOS Safari 26 and later, but WebGL2 is still the safe baseline for phones. Three.js is by far the most used and the smallest, Babylon.js is the most complete and the largest, and PlayCanvas sits between with the strongest mobile defaults and an editor.

### Cited Findings

**Three.js**
- Latest release is r187 (`three@0.187.0`), published 30 October 2026; r186 was 8 September 2026 with patch 0.186.1 on 24 September; r185 on 1 July, r184 on 16 April. In 2026 releases landed every 7 to 11 weeks. — [three.js releases](https://github.com/mrdoob/three.js/releases); [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Every release removes previously deprecated code and has breaking changes: r187 removed code deprecated in r177 and changed PMREM and render-target viewport behaviour; r186 removed `PCFSoftShadowMap`, made renderer `dispose()` async and renamed `Source` to `TextureSource`. — [three.js releases](https://github.com/mrdoob/three.js/releases)
- Licence MIT, community backed (mrdoob); about 116K GitHub stars; 12,184,549 weekly npm downloads in the week of 15 to 21 September 2026 (versus 314,621 for `@babylonjs/core` and 56,681 for `playcanvas`; counts include CI installs). — [Utsubo comparison, updated 24 Sep 2026](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- WebGPU: `three/webgpu` and `three/tsl` entry points arrived in r171 (29 November 2024); `WebGPURenderer` falls back to WebGL 2 automatically; r184 added TSL and node materials on the classic `WebGLRenderer` through a compatibility layer. — [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed)
- The project's own `llms.txt` (pinned to `three@0.187.0`) still says to use `WebGLRenderer` by default ("Maximum browser compatibility... Most examples and tutorials use this") and `WebGPURenderer` when you need TSL custom materials, compute shaders or node materials. — [threejs.org/docs/llms.txt](https://threejs.org/docs/llms.txt)
- Forum reports exist of `WebGPURenderer` being slower than `WebGLRenderer` in some scenes; the Utsubo article recommends profiling before migrating for speed alone and gives no numeric benchmarks. — [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Bundle size (min + gzip, full import, Bundlephobia for 0.186.0): about 185 kB for `three`, about 300 kB for `three/webgpu`. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison); a different vendor article gives "about 150 KB" without a source — [Cinevva comparison, June 2026](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- 600+ official examples, 230 of them for WebGPU (September 2026); `llms.txt` docs for AI coding tools were added in r183; AI assistants trained on older code may suggest deprecated APIs. — [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed)

**Babylon.js**
- Latest release is 9.37.1 on 18 November 2026; ten releases between 27 October and 18 November (9.32.1 to 9.37.1), so the cadence is several per week. — [Babylon.js releases](https://github.com/BabylonJS/Babylon.js/releases)
- Babylon.js 9.0 was announced on 26 March 2026 by Microsoft. Headline features: clustered lighting ("hundreds or even thousands of lights", on WebGPU and WebGL 2), textured area lights, volumetric lighting (WebGPU compute with WebGL 2 fallback), Frame Graph v1, Node Particle Editor, animation retargeting, outline renderer, SDF text, nav mesh updates, Inspector v2, OpenPBR (alpha). — [Microsoft Windows Developer Blog, "Announcing Babylon.js 9.0"](http://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/); [Babylon.js "What's New"](https://doc.babylonjs.com/whats-new)
- Licence Apache 2.0, backed by Microsoft; about 26K GitHub stars; WebGPU supported since 5.0 (May 2022), native WGSL since 8.0 (March 2025); `EngineFactory.CreateAsync()` picks WebGPU when available and falls back to WebGL. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- Bundle size: about 1.8 MB for all of `@babylonjs/core` (9.27.1); ES modules tree-shake so real apps ship less. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- Recent point releases (9.32 to 9.37) are dominated by Babylon Native parity, Gaussian splats, Inspector "Lite" features and WebGPU fixes (for example 9.37.1 "fixes for WebGPU shadows and reflections"). — [Babylon.js releases](https://github.com/BabylonJS/Babylon.js/releases)

**PlayCanvas**
- Latest engine release is v2.24.2 on 18 November 2026; v2.24.0 on 9 November, v2.23.0 on 1 October; patch releases roughly weekly. — [PlayCanvas engine releases](https://github.com/playcanvas/engine/releases)
- Engine licence MIT; about 17.3k stars; built on WebGL2 and WebGPU; README example prefers WebGPU and falls back to WebGL2. — [playcanvas/engine README](https://github.com/playcanvas/engine)
- Backed by Snap Inc.; WebGPU described as "Beta in official docs", per-project setting in the cloud editor; bundle about 615 kB for the full engine (2.22.4); "optimized out of the box" for mobile (ASTC on mobile, DXT on desktop, automatic format selection). — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- Much recent engine work is Gaussian splatting (SOG v3, SPZ v3, splat LOD and budgets, splat shadows); v2.23.0 was the largest WebGPU update (instance matrices in a persistent storage buffer, retained pipelines) and added gravity scale and a "tightened physics API surface"; v2.24.0 added a CameraFrame effect system (SMAA, auto exposure, lens flare). — [PlayCanvas engine releases](https://github.com/playcanvas/engine/releases)
- In October 2026 Snapchat began supporting PlayCanvas games (Snap "Web Lenses"); a 9 November 2026 post reports 300 million views on Snapchat with PlayCanvas. — [PlayCanvas blog](https://blog.playcanvas.com/)

**Others**
- React Three Fiber: latest stable v9.8.2 (15 October), adding React 19.3 compatibility in 9.8.0; v10.0.0-alpha.6 (17 October) is titled "Going WebGPU First", makes `WebGPURenderer` the default with WebGL2 fallback, moves apps needing custom GLSL to `@react-three/fiber/legacy`, and requires three >= 0.185. No stable v10 yet. — [react-three-fiber releases](https://github.com/pmndrs/react-three-fiber/releases)
- Needle Engine: docs reference "Needle Engine 5" (March 2026) and Needle Engine for Blender 1.0.0 (April 2026); it offers Unity, Blender and three.js workflows. — [Needle Engine docs](https://engine.needle.tools/docs/)
- Needle licensing: the free version is non-commercial only (with watermark); commercial projects need a Pro licence, listed in a search snapshot at EUR 49 per user per month billed annually; Enterprise is custom. — [Needle Cloud FAQ](https://cloud.needle.tools/faq/can-i-use-needle-engine-for-commercial-projects); [needle.tools/pricing](https://needle.tools/pricing) (price seen only in a search snippet; the live page did not render for me)
- Wonderland Engine: latest version 1.6.1, released 23 April 2026; 1.6.0 (19 March 2026) added meshlets and SSAO. Standard licence is free up to USD 120k revenue per year across all Wonderland projects, then a 10% royalty; seated and enterprise licences are priced on request. — [Wonderland Engine news](https://wonderlandengine.com/news/); [Wonderland Engine pricing](https://wonderlandengine.com/pricing/)
- Galacean Engine: latest stable is v1.6.13 (29 December, fixing an iOS 26.2 audio bug); v2.0.0 is in alpha (alpha.42 on 24 August) adding trail rendering, MeshColliderShape and particle sub-emitters. — [galacean/engine releases](https://github.com/galacean/engine/releases)
- Bevy: 0.20 on 8 October 2026 (0.20.1 on 28 October), 0.19 on 19 June 2026, 0.18 on 13 January 2026. The 0.20 post states "Mesh shaders are not supported on web platforms" and that the scene editor itself is not yet delivered (Feathers widgets are described as components of one, not "the editor itself"). — [Bevy news](https://bevy.org/news/); [Bevy 0.20 release post](https://bevy.org/news/bevy-0-20/)

**WebGPU reach in browsers**
- Chrome/Edge desktop since v113; Chrome on Android since v121 (Android 12+); Firefox since v141 on Windows and v145/147 on macOS, with Linux and Android behind a flag; Safari since v26 (September 2025) on macOS, iOS, iPadOS and visionOS. — [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Global WebGPU support is about 87% per caniuse, including partial support. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)

### Inferences
- For a game that must run on iPhones that have not updated to iOS 26, and on Android below 12, WebGL2 is the path most players will hit. All three main engines keep WebGL2 as a first-class backend, so WebGPU is an optional upside, not a reason to pick one over another.
- Bundle size matters less than it looks for this project: even Babylon's full core is in the range of a few skinned character models. It does matter for the "one HTML page" publishing rule; Three.js is the only one that can be inlined at roughly the weight of a large image.
- Release cadence cuts both ways for AI agents: Three.js breaks APIs every 7 to 11 weeks (so pin a version and feed agents the matching `llms.txt`), Babylon.js keeps strong backward compatibility across a very high release rate, PlayCanvas moved to engine v2 and now releases weekly.
- PlayCanvas's and Babylon's 2026 release notes show heavy investment in Gaussian splats and (for Babylon) geospatial and native parity. Neither is neglecting games, but game animation and combat tooling is not where the visible new work is.

### Gaps
- Could not read the Babylon.js 9.0 Medium post (HTTP 403); used Microsoft's blog instead.
- No measured, current, like-for-like mobile benchmarks (frame time on a mid-range Android phone or an iPhone) for the three engines were found.
- Needle's live pricing page returned empty content; the EUR 49 figure is from a search snippet and may be a promotion.
- Galacean's maintainer is, from background knowledge, Ant Group; the releases page did not state this. Wonderland's current WebGPU status was not confirmed.
- Bevy's current WebGL2/WebGPU wasm status, wasm binary size and threading limits on the web were not confirmed from a 2026 source.
- PlayCanvas plan page lists "Unlimited Private Projects" in the Free column while the FAQ implies private projects are a paid feature; unresolved.

## 2. Skeletal animation and imported characters

### Takeaway
All three load glTF/GLB skinned characters and blend clips; Babylon.js has the widest built-in set (weighted and additive blending, frame events, two-bone IK, retargeting in 9.0, bone attachment), PlayCanvas has the only built-in animation state machine (state graph with blend trees, layers, masks, events), and Three.js gives a solid mixer with crossfades and additive blending but leaves state machines, events and root motion to the developer.

### Cited Findings

**Three.js**
- `AnimationAction` provides `fadeIn`/`fadeOut`, `crossFadeTo`/`crossFadeFrom` (with optional time warp), `setEffectiveWeight`, `setEffectiveTimeScale`, `warp`, `halt`, `syncWith`, `blendMode` of `NormalAnimationBlendMode` or `AdditiveAnimationBlendMode`, `clampWhenFinished`, and loop modes `LoopRepeat`, `LoopOnce`, `LoopPingPong`. — [three.js docs, AnimationAction](https://threejs.org/docs/pages/AnimationAction.html)
- IK is an addon, not core: `CCDIKSolver` (`three/addons/animation/CCDIKSolver.js`) solves chains on a `SkinnedMesh` by cyclic coordinate descent, with per-link rotation limits, iteration count and a blend factor; bone indices and chains are configured by hand. — [three.js docs, CCDIKSolver](https://threejs.org/docs/pages/CCDIKSolver.html)
- A shipped Three.js action game used compressed `.glb` from Blender via `GLTFLoader` and `DRACOLoader`, with runtime blending of several poses. — [three.js forum, Savanna Sam, 2 May 2025](https://discourse.threejs.org/t/3d-action-browser-game-made-with-three-js-savanna-sam/81902)
- A vendor comparison summarises Three.js animation as "mixer, with blending left to you". — [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- `SkeletonUtils.clone(model)` clones skinned models but does not reduce draw calls; Three.js has no built-in batching for skinned meshes. — [three.js forum, "How to batch skinned mesh?"](https://discourse.threejs.org/t/how-to-batch-skinned-mesh/30348.md)

**Babylon.js**
- Blending: `enableBlending` blends a new animation "FROM the current object's state"; `AnimationPropertiesOverride` sets blending for a whole skeleton; `scene.beginWeightedAnimation` returns an Animatable with a `weight` (0 to 1); `syncWith()` synchronises clips of different lengths; additive animation via `isAdditive` and `MakeAnimationAdditive`; `AnimationGroup` carries `weight` and `isAdditive`. — [Babylon.js docs, Advanced Animation Methods](https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations)
- Animation events: `animation.addEvent(new AnimationEvent(frame, callback, once))` runs a callback at a given frame. — [Babylon.js docs, Advanced Animation Methods](https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations)
- Deterministic lockstep: engine options `deterministicLockstep: true` and `lockstepMaxSteps` fix animation and physics to discrete time steps, with `onBeforeStepObservable`/`onAfterStepObservable` for game logic. — [Babylon.js docs, Advanced Animation Methods](https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations)
- Bones: `mesh.attachToBone(bone, referenceMesh)` makes a rigid mesh (a weapon) follow a bone; `BoneIKController` solves a two-bone chain to a target with a pole target; `BoneLookController` aims a bone; 4 influences per vertex by default (up to 8, 3 on low-end hardware); bone matrices are stored in a texture by default; `mesh.computeBonesUsingShaders = false` moves skinning to the CPU for weak devices. — [Babylon.js docs, Bones and Skeletons](https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons)
- Retargeting: 9.0 "lets you apply an animation made for one character to a different character, even with different skeletons, bone proportions, or naming"; an interactive Animation Retargeting Tool exists. It was added in 8.51.1 with follow-ups in 8.52.1. — [Microsoft blog, Babylon.js 9.0](http://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/); [Babylon.js "What's New"](https://doc.babylonjs.com/whats-new)
- Baked vertex animation textures (VAT) move skinning cost off the CPU and work with thin instances for many identical meshes, but animations cannot be blended, there is no frame interpolation, and baking should be done at build time. — [Babylon.js docs, Baked Texture Animations](https://doc.babylonjs.com/features/featuresDeepDive/animation/baked_texture_animations)

**PlayCanvas**
- Clips come from imported GLB or FBX or are built in code and bind to nodes by name. The Anim component plays clips through a state graph: states, transitions and parameters set from code; blend trees mix clips within a state; layers and masks let several graphs drive parts of one model; animation events fire at chosen times in a clip. State graphs can be loaded from code with `entity.anim.loadStateGraph()`. — [PlayCanvas manual, Animation](https://developer.playcanvas.com/user-manual/animation/)
- A vendor comparison rates retargeting as "limited" in PlayCanvas and "partial" in Babylon.js. — [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)

### Inferences
- For Soulslike melee, the features that matter are: frame-accurate events (hit windows, cancel windows), crossfades that can be interrupted, additive hit reactions, upper and lower body layering, weapon attachment to a hand bone, and optional root motion for lunges. DungeonRaze already keeps all timing in data tables (`MOVES` with `wind`, `act`, `rec` in seconds), so gameplay timing would stay in the simulation and the animation only needs to be driven to match. That reduces the need for engine animation events and root motion on any engine: the sim owns position (the 2D field) and timing, and the animation is a view.
- Given that, Three.js's lack of a state machine and events is a smaller gap than it looks: a 200 to 400 line controller that maps the player and enemy state names (`free`, `attack`, `dodge`, `wind`, `act`, `rec`, `stagger`) to actions and crossfades is the usual approach. Babylon's weighted and additive `AnimationGroup` API and PlayCanvas's state graph give more out of the box if the sim's states are to be mirrored in data.
- Babylon's `deterministicLockstep` is relevant to co-op only if the engine owned the simulation; if the game keeps its own fixed-step sim (it already steps at 60 Hz in tests), it is not needed.
- The Blender or Mixamo workflow is the same for all three: export GLB (one file per character, or a character plus separate animation GLBs sharing a skeleton), compress with Draco or Meshopt, load, and look clips up by name. Background knowledge, not verified this session: Mixamo exports FBX with in-place options, so a conversion step through Blender or a converter is needed; Three.js `SkeletonUtils` also has `retarget`/`retargetClip` helpers that are regarded as fiddly.
- The current characters are boxes posed in code. A lower-risk intermediate step exists on every engine: keep code-posed primitives but render them through the new engine first, then replace one figure at a time with a skinned GLB.

### Gaps
- Root motion support was not documented on any of the pages read (Three.js: none in core per the fetch tool's own note, unverified; Babylon and PlayCanvas pages do not mention it). Treat root motion as do-it-yourself on all three.
- PlayCanvas state graph file format (JSON schema) could not be read: the state-graph docs page returned empty content. Whether a state graph can be kept as a text file in git and loaded without the Editor is likely (via `loadStateGraph`) but not confirmed in detail.
- The three.js `SkeletonUtils` docs page returned 404; `retargetClip` is from background knowledge.
- No source was found that compares the three engines specifically for third-person melee animation quality.

## 3. Rendering features (shadows, toon versus PBR, post-processing, particles, instancing, LOD, culling, custom shaders)

### Takeaway
Each engine adds shadows, post-processing, PBR and GPU particles over the current renderer; Babylon.js has the most built-in pieces relevant to this game (clustered lights on WebGL2, outline renderer, node particle and material editors), PlayCanvas ships an HDR post pipeline and clustered lighting, and Three.js offers everything through core plus addons with TSL as the forward-looking shader path. None of them gives portal or cell culling for dungeon interiors out of the box, so the game's own `visiblePieces` system remains valuable.

### Cited Findings
- Three.js: TSL (Three.js Shading Language) is recommended "instead of raw GLSL for custom materials" with `WebGPURenderer`, "Works with both WebGL and WebGPU backends", with "No string manipulation or onBeforeCompile hacks"; node materials include `MeshStandardNodeMaterial`, `MeshPhysicalNodeMaterial`, `SpriteNodeMaterial`. — [threejs.org/docs/llms.txt](https://threejs.org/docs/llms.txt)
- Three.js: under R3F v10 alpha, apps needing custom GLSL must use the legacy (WebGL) entry point, which indicates raw GLSL `ShaderMaterial` code does not carry to `WebGPURenderer`. — [react-three-fiber releases](https://github.com/pmndrs/react-three-fiber/releases)
- Three.js: r183 improved WebGPU shadows (old bias values may need changing); r186 removed `PCFSoftShadowMap` and reduced the sun-light cascade count to 2; r186 added a native Gaussian splat renderer; `InstancedMesh` is a core object. — [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed); [three.js releases](https://github.com/mrdoob/three.js/releases); [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison); [threejs.org/docs/llms.txt](https://threejs.org/docs/llms.txt)
- Three.js in practice: a shipped game used "a modified version of three.js's cartoon shader for the comic look, plus cascading shadow maps", a hand-rolled two-level LOD system, and a forked particle library (three-nebula) because it was unmaintained. — [three.js forum, Savanna Sam](https://discourse.threejs.org/t/3d-action-browser-game-made-with-three-js-savanna-sam/81902)
- Babylon.js 9.0: clustered lighting groups lights into screen-space tiles and depth slices so each pixel only computes lights that affect it, on WebGPU and WebGL 2; volumetric lighting; Frame Graph v1 (a graph of rendering tasks, editable in the Node Render Graph Editor or in code, with reported GPU memory savings of 40% or more in some cases); Node Particle Editor with emission shapes, sprite sheets and sub-emitters; particle flow maps and attractors; a new outline renderer. — [Microsoft blog, Babylon.js 9.0](http://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/); [Babylon.js "What's New"](https://doc.babylonjs.com/whats-new)
- Babylon.js built-ins listed by a third party: audio, particles, GUI, collision detection, Node Material Editor, Playground, native XR. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- PlayCanvas: physically based materials, clustered lighting, soft shadows, WebGPU compute shaders; an HDR post pipeline with bloom, SSAO, TAA, depth of field and colour grading; GPU-accelerated particles; glTF 2.0 with Draco, Meshopt and Basis. — [playcanvas/engine README](https://github.com/playcanvas/engine)
- PlayCanvas: each mesh instance is one draw call; Batch Groups merge instances; each shadow-casting omni light renders the scene six times; frustum culling is per camera and optional. — [PlayCanvas manual, Optimization Guidelines](https://developer.playcanvas.com/user-manual/optimization/guidelines/)

### Inferences
- The current look (faceted normals from screen-space derivatives, three-step toon lighting for characters, vertex-colour world with a per-vertex material byte, procedural brick and water in the fragment shader, additive sprites and ribbons) is fully reproducible on all three, because all three allow custom vertex attributes and custom fragment shaders. The cost differs: on Three.js `WebGLRenderer` or Babylon `ShaderMaterial` the existing GLSL can be ported nearly as is; on Three.js `WebGPURenderer` it must be rewritten in TSL; on PlayCanvas it goes through its shader material or chunk system (background knowledge, not verified this session).
- The fastest route to "looks properly made" is not PBR. It is: one shadow-casting light, bloom on the existing additive effects, an outline or rim pass on characters, and skinned characters. All three provide the first two with little code.
- Eight point lights chosen per frame is the present limit. Clustered lighting (Babylon 9 on WebGL2 and WebGPU, PlayCanvas) would lift that for sewer lamps and crystals without the per-frame light picking in `buildLights()`. Three.js on WebGL has no clustered path in core (background knowledge), so the existing nearest-lights selection would stay.
- Occlusion for interiors: the game already cuts the sewer into pieces with a precomputed `sees` set and draws only those. That is a potentially-visible-set system and is better suited to tunnels than anything the engines provide generally. It maps onto any engine as "one mesh per piece, toggle visibility per frame". Babylon has GPU occlusion queries and Three.js `WebGPURenderer` has occlusion testing (both background knowledge, not verified this session); neither replaces a PVS.
- Omni-light shadows cost six scene passes per light, so on phones shadows should come from at most one spot or directional-style light (for example the player's lamp as a spot) or be blob shadows as now.

### Gaps
- No verification this session of Babylon's `ShaderMaterial`, material plugins or Node Material Editor specifics, of PlayCanvas's custom shader API, or of Three.js post-processing classes (the docs pages are large or script-rendered); they are well established but stated here from background knowledge.
- Built-in LOD and occlusion culling details for each engine were not confirmed from docs.
- No source was found on toon or cel shading quality comparisons between the engines.

## 4. Editors and tooling, code-only workflow, TypeScript, headless testing

### Takeaway
PlayCanvas has the only full collaborative editor, now with an MIT-licensed frontend and an official MCP server exposing 130 tools to coding agents, but projects live in its cloud; Babylon.js offers the best inspection and node-editor tools around a code-first engine plus a headless `NullEngine`; Three.js is purely code and text, which suits a git-and-agents workflow best but provides the least tooling.

### Cited Findings

**PlayCanvas**
- Plans (playcanvas.com/plans, read 20 Nov 2026): Free USD 0 per month with 1 GB storage, free app hosting and "Download Apps for Self-hosting"; Personal USD 15 per month with 10 GB and unlimited private projects; Organization USD 50 per seat per month with 50 GB. If a paid plan is cancelled, private projects become locked; published apps are unaffected. — [PlayCanvas plans](https://playcanvas.com/plans)
- The Editor frontend is open source under MIT (about 1.4k stars), built on the engine, Observer, PCUI and PCUI-Graph. A local build is loaded through playcanvas.com with a `use_local_frontend` parameter; the backend is not described as self-hostable. — [playcanvas/editor](https://github.com/playcanvas/editor); contradicted in part by [Cinevva, June 2026](https://app.cinevva.com/blog/2026-06-08-why-we-built-our-own-webgpu-engine), which says the hosted editor is "commercial, not open source" (true of the hosted service and backend, not of the frontend code)
- Official MCP server: `@playcanvas/editor-mcp-server` exposes 130 tools in 15 categories (entities, scripts, assets, scenes, settings, runtime launch, screenshots, logs, input simulation). The MCP client is built into the Editor (no extension), needs Node.js 22.18+, acts on the one project open in the connected Editor, and allows one agent at a time. The tool definitions use about 43,000 tokens of context (about 1,000 with Claude Code's tool search). — [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server)
- An October 2026 Editor update added projects over MCP (an agent can list, create, rename and open projects before one is open). — [PlayCanvas blog](https://blog.playcanvas.com/)
- The engine can be used without the Editor: `npm install playcanvas`, register only the component systems needed, or use `@playcanvas/react`, `@playcanvas/web-components` or the `create-playcanvas` scaffold. The package ships TypeScript declarations and scripts can be TypeScript or JavaScript. — [playcanvas/engine README](https://github.com/playcanvas/engine)
- The cloud editor has real-time multi-user collaboration. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)

**Babylon.js**
- The Babylon.js Editor is a desktop app for Windows, macOS and Linux with scene editing, scripting, physics, asset management and project building; it is credited to community member Julien Moreau Mathis. — [Microsoft blog, Babylon.js 9.0 tooling post](https://blogs.windows.com/windowsdeveloper/?p=57722)
- Inspector v2 is a ground-up rebuild (React UI, extensible with custom panes and property editors); it replaced v1 in 8.49.0. Recent releases add skeleton, morph, particle, physics, audio and texture inspection. — [Microsoft blog, Babylon.js 9.0 tooling post](https://blogs.windows.com/windowsdeveloper/?p=57722); [Babylon.js "What's New"](https://doc.babylonjs.com/whats-new); [Babylon.js releases](https://github.com/BabylonJS/Babylon.js/releases)
- The Playground gained multi-file editing, local ES module imports, NPM imports via esm.sh and local session history in 9.0. — [Microsoft blog, Babylon.js 9.0 tooling post](https://blogs.windows.com/windowsdeveloper/?p=57722)
- `NullEngine` is a headless engine that "does not produce any rendering", meant for tests, server-side versions of a game and services such as glTF loading; scenes, mesh loading and a render loop run without a GPU; `camera.attachControl` and `DynamicTexture` are unavailable. — [Babylon.js docs, Server Side](https://doc.babylonjs.com/setup/support/serverSide)

**Three.js**
- "MIT, no editor"; code-first; ships `llms.txt` for LLM-assisted coding. — [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison); [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- The `llms.txt` contains explicit "Instructions for Large Language Models", recommends import maps pinned to an exact version, and steers generated code to current APIs. — [threejs.org/docs/llms.txt](https://threejs.org/docs/llms.txt)

### Inferences
- "Everything in code and text files" is true for Three.js and Babylon.js without qualification, and true for PlayCanvas only in engine-only mode. PlayCanvas's main advantage (the Editor and its asset pipeline) lives in a cloud project, outside the git repository the current agents work in. The MCP server makes the Editor drivable by an agent, but it is a second source of truth beside git, needs a live browser session, and allows one agent at a time, which conflicts with the plan to run several agents in parallel lanes.
- The project's test strategy (drive `DF.sim` at a fixed step in headless Chromium, take screenshots under SwiftShader) is renderer-independent for the logic tests. For the screenshot tests, WebGL2 under SwiftShader should keep working on all three engines; WebGPU in headless Chromium is less certain. That is another reason to target WebGL2 first.
- Babylon's `NullEngine` or simply running the game's own simulation in Node (it has no DOM needs outside rendering and input) both give a path to an authoritative co-op server that shares code with the client. The second is engine-independent and is the stronger option.
- All three are TypeScript-friendly (Babylon is written in TypeScript; PlayCanvas ships declarations; Three.js types come from the community `@types/three` package: last two points partly background knowledge). The game is 19,000 lines of plain JavaScript concatenated into one function scope with no imports, so any engine adoption forces a move to ES modules and a bundler first. That step is independent of engine choice and is the natural first migration task.

### Gaps
- Whether the PlayCanvas Free plan really allows private projects (plan table says yes, FAQ implies no).
- No documentation was found on running the PlayCanvas engine headlessly in Node for tests.
- The Three.js editor (threejs.org/editor) was not assessed; from background knowledge it is a scene tinkering tool, not a game editor.
- No AI or MCP tooling for Babylon.js was found in the pages read; Three.js has `llms.txt`; PlayCanvas has the MCP server.

## 5. Physics and character controllers, and whether to keep the grid-field collision

### Takeaway
Keep the game's own 2D scalar-field collision: it is the simulation, it is deterministic, cheap, shared by collision, sight, routes, shots and the camera, and it runs without any engine on a server. Add a physics engine only for cosmetic effects (ragdolls, debris) if wanted; Rapier (any engine) or Havok (Babylon) are the current choices, and ammo.js (PlayCanvas default) is the oldest.

### Cited Findings
- Three.js includes no physics; the usual options are Rapier and cannon-es. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- Babylon.js: the Havok plugin is "available free to use under the MIT license", installed with `npm install @babylonjs/havok`; it requires WebAssembly SIMD, which iOS versions earlier than 16.4 do not support. — [Babylon.js docs, Havok plugin](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin)
- Babylon.js character controller: takes a shape or builds a capsule, `moveWithCollisions` moves to a target synchronously, supports kinematic platforms, trigger observables, and a per-frame loop of surface check, desired velocity, `integrate`. — [Babylon.js docs, Character Controller](https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController)
- PlayCanvas integrates ammo.js; v2.21 added a physics backend abstraction, and v2.23.0 added gravity scale, joints in the Editor (Editor 2.34 era) and a "tightened physics API surface". — [playcanvas/engine README](https://github.com/playcanvas/engine); [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison); [PlayCanvas engine releases](https://github.com/playcanvas/engine/releases); [PlayCanvas blog](https://blog.playcanvas.com/)
- Rapier's JavaScript kinematic character controller (docs for JS version 0.21) supports max slope climb angle, min slide angle, autostep over obstacles, snap-to-ground, collision reporting and optional impulses to dynamic bodies. — [Rapier docs, Character Controller (JavaScript)](https://rapier.rs/docs/user_guides/javascript/character_controller)
- A team building a web engine tried Rapier and then wrote its own kinematic solver because "they only need one capsule to move correctly against terrain"; their engine has "no rigid-body dynamics by design". — [Cinevva, "Why we built our own WebGPU engine", June 2026](https://app.cinevva.com/blog/2026-06-08-why-we-built-our-own-webgpu-engine); [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- A shipped Three.js game used cannon-es for collisions, copying transforms each frame. — [three.js forum, Savanna Sam](https://discourse.threejs.org/t/3d-action-browser-game-made-with-three-js-savanna-sam/81902)
- PlayCanvas guidance: keep dynamic rigid bodies to a minimum on mobile and use low-resolution collision meshes. — [PlayCanvas manual, Optimization Guidelines](https://developer.playcanvas.com/user-manual/optimization/guidelines/)

### Inferences
- The field model has properties a general physics engine would lose: one function (`fieldAt`) drives collision, line of sight, camera collision, spawn checks and routing; rubble is "only ever a change to the field"; hits are resolved in 2D on a flat floor. Replacing it would mean re-deriving every rule the tests check (t12, t20, t22, t24, t25) for no gameplay gain, since the floor is flat and there is no jump yet.
- For co-op the field model is an asset: a server needs only the field arrays and the sim, not a physics WASM module, and floating-point divergence between clients is far easier to control in a few hundred lines of own code than across a physics engine.
- A physics engine becomes worth adding only if the design gains real 3D movement (jumps onto ledges, vertical levels) or wants ragdolls and physical debris. Rapier is the engine-neutral choice; Havok is the most capable but ties to Babylon's plugin API and excludes iOS below 16.4.
- If a jump is added later (backlog item 7), a height value per body on top of the 2D field (as the game already does for `e.y` and falling shots) is still cheaper than adopting a controller.

### Gaps
- Jolt (JoltPhysics.js) and its character controller were not researched this session; Havok WASM size was not found on the docs page.
- Current Rapier JS package version number beyond "0.21" in the docs, and its bundle size, were not confirmed.
- No source was found comparing determinism of Rapier, Havok and ammo.js across browsers for lockstep networking.

## 6. Multiplayer pairings

### Takeaway
None of the engines ships netcode. Colyseus (now 0.18) is the common pairing, with official tutorials for Babylon.js and PlayCanvas and an example for Three.js; Playroom Kit is the low-effort hosted option and lists Three.js, React Three Fiber and PlayCanvas but not Babylon.js.

### Cited Findings
- PlayCanvas, Three.js and Babylon.js are all "bring your own" for multiplayer; PlayCanvas examples cite Photon or Colyseus. — [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- Colyseus docs (banner: "Colyseus 0.18 is out!") list tutorials for Phaser, Unity, PlayCanvas, Babylon.js (Basics, and Hide and Seek) and Cocos Creator; examples for JavaScript, Phaser, PixiJS, Babylon.js, KAPLAY, Three.js, Defold, Discord Activity; SDKs for TypeScript, React, Unity, Godot and others. Three.js appears as an example only, not a tutorial. — [Colyseus docs](https://docs.colyseus.io/)
- Playroom Kit is "a focused multiplayer layer" providing rooms, shared state and participants without running a backend; it lists React Three Fiber, Three.js, PlayCanvas, Phaser, PixiJS, Godot and Unity among integrations (Babylon.js is not listed); it exposes `isHost()` and `transferHost()`; claims "sub-50ms latency globally" and a "generous free tier". — [Playroom Kit docs](https://docs.joinplayroom.com/)
- Steam lobbies and P2P are reachable from a wrapped web game: steamworks.js exposes `matchmaking.createLobby(lobbyType, maxMembers)`, `joinLobby`, `getLobbies`, lobby data and member functions, and `networking.sendP2PPacket`, `readP2PPacket`, `acceptP2PSession`. — [steamworks.js client.d.ts](https://github.com/ceifa/steamworks.js/blob/main/client.d.ts)
- Babylon.js offers deterministic lockstep stepping for "replays and consistent results across clients", and `NullEngine` for "a server-side version of an application or game". — [Babylon.js docs, Advanced Animation Methods](https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations); [Babylon.js docs, Server Side](https://doc.babylonjs.com/setup/support/serverSide)

### Inferences
- The engine choice barely constrains netcode for this game, because the simulation (`update(dt)` over `G`) is already separate from rendering and already runs at a fixed step under test. Whatever transport the other researchers recommend can sit beside any of the three.
- Babylon and PlayCanvas have first-party-quality Colyseus tutorials; with Three.js the developer adapts the generic TypeScript SDK. For an AI-agent workflow this difference is small.
- A host-authoritative model over Steam P2P (steamworks.js) plus WebRTC or WebSocket for the browser build would need two transports behind one interface; that is a design consideration for the networking researcher, flagged here only because steamworks.js makes the Steam side possible from JavaScript.

### Gaps
- The Colyseus Babylon.js tutorial page URL I tried returned 404, so its content (interpolation, prediction, server authority) was not read; the tutorial's existence is confirmed by the docs index only.
- Colyseus licence and Colyseus Cloud pricing, Playroom's player caps, pricing and transport were not stated on the pages read. These belong to the networking researcher's scope.

## 7. Procedural meshes at run time

### Takeaway
All three engines accept run-time geometry built from typed arrays with custom vertex attributes, so the marching-squares cave and sewer builders and the per-vertex colour and material byte can be kept; the work is in wrapping `meshSink` output in each engine's geometry object and in re-expressing the world shader.

### Cited Findings
- Three.js lists `BufferGeometry` and `BufferAttribute` in its core API and `InstancedMesh` under objects. — [threejs.org/docs/llms.txt](https://threejs.org/docs/llms.txt)
- PlayCanvas: clips and assets "can be built in code", the engine can be used standalone and only needed component systems registered; v2.23.0 keeps mesh instance matrices in a persistent storage buffer on WebGPU. — [PlayCanvas manual, Animation](https://developer.playcanvas.com/user-manual/animation/); [playcanvas/engine README](https://github.com/playcanvas/engine); [PlayCanvas engine releases](https://github.com/playcanvas/engine/releases)
- Babylon.js: skinning data is plain per-vertex buffers (bone indices and weights), and meshes and skeletons can be created in code. — [Babylon.js docs, Bones and Skeletons](https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons)

### Inferences
- The current pipeline produces `P` (positions), `C` (square-root encoded RGBA bytes, alpha as glow) and `M` (one material byte per vertex), with normals computed per pixel from derivatives. In Three.js that is a `BufferGeometry` with `position`, a normalised `Uint8` `color` attribute and a custom `aMat` attribute, drawn with a `ShaderMaterial` (WebGL) that reuses the existing GLSL nearly unchanged, or a node material in TSL. The sewer's pieces map to draw ranges or geometry groups, or to one mesh per piece.
- In Babylon.js the equivalent is a `Mesh` with `VertexData` plus custom vertex buffers and a `ShaderMaterial` or material plugin; in PlayCanvas a `Mesh` built through its vertex format and buffer API with a custom shader material (both background knowledge, not verified this session). Babylon and PlayCanvas default to wanting normals; derivative-based normals in a custom shader avoid that.
- Rubble and fallen ceiling are drawn as separate meshes over a field change, and the field change does not re-mesh the world, so dynamic buffer updates are not a hot path. This removes the main performance risk of procedural worlds on any engine.
- Indexed geometry and merged static meshes would cut memory versus the current triangle soup, but the measured budget (cave 99 at about 82k triangles drawn whole; a sewer frame at about 28k) is small for all three engines.

### Gaps
- No doc page was read this session for Babylon `VertexData`/custom vertex buffers, PlayCanvas procedural `Mesh` API or Three.js `BufferGeometry` update flags; they are long-standing features stated from background knowledge.

## 8. Migration cost and whether it can be incremental

### Takeaway
Three.js is the only one of the three designed to be used as a rendering library under someone else's game loop and scene representation, which makes an incremental, behind-the-`R`-interface migration realistic; Babylon.js and PlayCanvas can be driven from an external loop but expect the game to live in their scene graph (and, for PlayCanvas, their entity-component and asset system), so they pay off most when adopted more fully.

### Cited Findings
- Three.js is described as "a rendering library with no editor, physics, or entity system, so you build everything above the renderer yourself", the choice "if you want full control, a minimal base". — [Cinevva, "Why we built our own WebGPU engine"](https://app.cinevva.com/blog/2026-06-08-why-we-built-our-own-webgpu-engine); [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- Babylon.js is "a strong default, but only if you're happy working within its structure"; "a full-featured game engine that happens to run in the browser". — [Cinevva, "Why we built our own WebGPU engine"](https://app.cinevva.com/blog/2026-06-08-why-we-built-our-own-webgpu-engine); [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- PlayCanvas is "a full game engine with a visual editor" with an entity-component system, asset pipeline, CDN hosting and deployment; it can also be installed from npm and run with only the component systems needed. — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison); [playcanvas/engine README](https://github.com/playcanvas/engine)
- Three.js migration between its own renderers "is usually an import change to `three/webgpu`", but `WebGPURenderer` requires async initialisation and custom GLSL needs porting to TSL. — [threejs.org/docs/llms.txt](https://threejs.org/docs/llms.txt); [react-three-fiber releases](https://github.com/pmndrs/react-three-fiber/releases)
- Three.js removes deprecated APIs on a rolling basis (r187 removed what r177 deprecated, about ten releases later). — [three.js releases](https://github.com/mrdoob/three.js/releases)

### Inferences
- The game's renderer is already a narrow interface: `R.setWorld`, `R.drawWorld(ids)`, figure drawing from `Nd` node trees, `R.sprite`, `R.ribbon`, `R.ring`, `R.blob`, `R.flat`, `R.nodePos`, `R.toScreen`, `R.boxVisible`, `R.env`, `R.stats`, and a light list from `buildLights()`. A staged migration is therefore possible on Three.js:
  1. Move `src/*.js` from concatenation into ES modules with a bundler (needed for any engine; mechanical but touches every file because names are currently global to one function scope).
  2. Re-implement `R` on Three.js `WebGLRenderer` with the existing GLSL in `ShaderMaterial`s, keeping every test and screenshot comparison. The game looks the same at the end of this step.
  3. Add what the old renderer lacked, one at a time: shadows from one light, bloom, outlines.
  4. Replace box figures with skinned GLB characters, one class or enemy type at a time, behind `EFIG`/`EPOSE`-style tables that already exist for D enemies.
- On Babylon.js the same staging works but step 2 is more of a rewrite into `Scene`, `TransformNode`, `Mesh` and its material system; it is feasible to call `scene.render()` from the game's own loop (background knowledge). The game's axis convention (forward is `(sin yaw, 0, cos yaw)`, right is `(-cos yaw, 0, sin yaw)`, Y up) is right-handed like glTF and Three.js; Babylon is left-handed by default and would need `scene.useRightHandedSystem = true` (background knowledge, not verified this session), which is a known source of subtle bugs for agents.
- On PlayCanvas, using the engine as a library without the Editor forfeits most of what distinguishes it, while using the Editor moves scenes and assets out of the repository. A procedural, seed-generated game with primitive characters has little for a scene editor to edit today; that changes only if hand-built levels (the hall, boss arenas) and authored characters become the norm.
- The one-HTML-page publishing constraint (content policy blocks loading from other sites) is compatible with Three.js inlined plus base64 GLB assets, but skinned characters with textures will push page size up quickly. The GitHub Pages build can serve separate same-origin files, so the single-file build may need to become a secondary target.
- Rough cost ordering for this codebase, lowest to highest: Three.js as renderer only; Babylon.js with its scene graph but own sim; PlayCanvas engine-only; PlayCanvas with the Editor; any Rust or WASM engine (a rewrite of 19,000 lines).

### Gaps
- No postmortem was found of a team moving a custom WebGL renderer onto one of these engines, so the staging above is reasoned from the project's code structure, not from a documented precedent.
- Effort in person-weeks or agent-hours cannot be sourced; any figure would be a guess.

## 9. Shipping beyond the browser (Steam, desktop, mobile stores, consoles) and shipped games

### Takeaway
Wrapped web games do ship on Steam, mostly through Electron or NW.js with steamworks.js for Steam features, and one Three.js action game is documented on Steam (running on Steam Deck) and on Google Play via Capacitor; but large commercial 3D action or co-op titles on these engines are rare, and consoles have no supported path.

### Cited Findings
- Savanna Sam, a 3D action game built on Three.js (GLB from Blender, cannon-es, modified toon shader, cascaded shadows), was packaged with Electron for Steam (app 3038250), "even runs on the Steam Deck", and with Capacitor for the Google Play Store. — [three.js forum, 2 May 2025](https://discourse.threejs.org/t/3d-action-browser-game-made-with-three-js-savanna-sam/81902)
- Krunker reached Steam in February 2021 in an Electron container per SteamDB; its Steam store page now says it is no longer available on the store. — [SteamDB, app 1408720](https://steamdb.info/app/1408720); [Steam store page](https://store.steampowered.com/app/1408720/Krunker/)
- Babylon.js's official games page lists 50 titles, including Minecraft Classic (Mojang), Temple Run 2 (Imangi, on Poki), Shell Shockers, and several with Steam links: Tuggowar, CottageCore, Path Defenders, Space Intruders Alliance, Jigsaw Puzzle Palace, Crystalline Bliss, Terachain, They Are Adorable. — [babylonjs.com/games](https://babylonjs.com/games/)
- PlayCanvas names as users Disney, Facebook, King, Miniclip, Nickelodeon, PikPok, PlaySide, Snap, Spry Fox, Zeptolab and Zynga, and showcases After The Flood, Casino, Swooop, Master Archer and others. — [playcanvas/engine README](https://github.com/playcanvas/engine)
- steamworks.js is an MIT "implementation of the Steamworks SDK for HTML/JS and NodeJS based applications" (about 640 stars) for Electron and NW.js; namespaces include achievement, apps, auth, cloud, input, localplayer, matchmaking, networking, overlay, stats, workshop. Electron renderer use needs `contextIsolation: false` and `nodeIntegration: true`; `electronEnableSteamOverlay()` enables the overlay. — [steamworks.js](https://github.com/ceifa/steamworks.js); [client.d.ts](https://github.com/ceifa/steamworks.js/blob/main/client.d.ts)
- Wrapper guidance (vendor article, Summer Engine, which sells a Godot-compatible alternative): Electron is the default because it bundles Chromium so WebGL behaves the same everywhere, at the largest download; NW.js is similar (CrossCode ships on it); Tauri uses the system webview (minimal app under 600 KB), has no Node runtime so Steam calls go through Rust, and WebGL must be tested on WebView2, WKWebView and webkit2gtk. Greenworks is "best-effort maintenance"; new projects start with steamworks.js. Electron's `backgroundThrottling` defaults to true. Steam Direct costs USD 100 per game. — [Summer Engine, "three.js games on Steam"](https://www.summerengine.com/make-great-games/threejs-game-on-steam.md)
- 2D precedents: Vampire Survivors launched on Steam Early Access in December 2021 in Phaser and moved to Unity in version 1.6 (August 2023); CrossCode ships in NW.js and had to update NW.js for memory leaks and crashes. — [Summer Engine, "three.js games on Steam"](https://www.summerengine.com/make-great-games/threejs-game-on-steam.md)
- One developer's account says most broken-window reports for a Tauri app came from the Linux webview and graphics stack. — [HackerNoon, "Six months with Tauri"](https://hackernoon.com/six-months-with-tauri-the-benefits-and-the-bill)
- Havok on Babylon requires iOS 16.4+ (WASM SIMD), which also applies inside an iOS wrapper. — [Babylon.js docs, Havok plugin](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin)
- A Babylon forum thread asks why 3D web games have not reached RuneScape's scale and notes wrapping with Electron or Capacitor as the route to Steam. — [Babylon.js forum](https://forum.babylonjs.com/t/why-havent-3d-web-games-reached-the-scale-of-runescape-despite-advanced-web-tech/43405)

### Inferences
- For Steam: Electron plus steamworks.js is the documented, lowest-risk route for any of the three engines, and it gives Steam lobbies and P2P from JavaScript. Tauri is attractive for size but puts Steam Deck (Linux, webkit2gtk) rendering at risk and has no ready JS Steam binding.
- For iOS and Android stores: Capacitor wraps the same page in the system webview (WKWebView on iOS), so performance equals mobile Safari or Chrome; one shipped example exists for Android. A PWA is already effectively what the game is on GitHub Pages.
- Consoles: no supported path was found for web engines. Babylon Native exists and is actively developed (many "native parity" items in the release notes) but no console shipping story was found. If consoles are a real goal, that points to the native engines covered by other researchers.
- The honest reading of the shipped-games evidence: web engines have many browser hits (.io shooters, Poki titles, brand games) and a handful of small Steam releases, but no well-known third-person action or Soulslike on Steam. The Vampire Survivors move from Phaser to Unity after success is the cautionary precedent: a web stack was good enough to find the audience, and was replaced when performance and platform reach mattered.

### Gaps
- That Krunker uses Three.js, and the engines behind Venge.io and other PlayCanvas shooters and whether they are on Steam, are background knowledge that my searches did not confirm.
- No Steam sales or review data for any wrapped Three.js, Babylon.js or PlayCanvas 3D game was gathered.
- Console prospects: no source found either way; stated as an absence of evidence.
- Capacitor and WKWebView specifics in 2026 (WebGPU inside WKWebView, memory limits, audio and fullscreen rules) were not researched.
- Steam overlay behaviour in Tauri on Linux and Steam Deck: no current source.

## 10. Performance ceilings (draw calls, skinned characters, mid-range phones)

### Takeaway
The target of 5 players plus about 30 enemies is within reach on mid-range phones on any of the three engines if each character is one skinned mesh with one material and a modest bone count, because the binding limit on mobile is draw calls (roughly 100 to 200 on low-end devices) and per-frame skeleton updates on the CPU, not triangles. No engine has a decisive measured advantage in the sources found.

### Cited Findings
- "100-200 draw calls is a rough target for low end mobile devices"; high-end desktops handle thousands per frame at 60 fps. Each mesh instance is a draw call. — [PlayCanvas manual, Optimization Guidelines](https://developer.playcanvas.com/user-manual/optimization/guidelines/)
- Skinned meshes get a per-bone bounding box recomputed every frame even off-screen unless a custom AABB is set; enabling device pixel ratio "can significantly lower frame rate"; each shadow-casting omni light renders the scene six times; per-frame allocations cause GC freezes. — [PlayCanvas manual, Optimization Guidelines](https://developer.playcanvas.com/user-manual/optimization/guidelines/)
- Three.js: a developer reported a bottleneck with 20 avatars made of many parts (over 200 skinned meshes); there is no built-in batching for skinned meshes and `SkeletonUtils.clone` does not reduce draw calls. — [three.js forum, "How to batch skinned mesh?"](https://discourse.threejs.org/t/how-to-batch-skinned-mesh/30348.md)
- A community `InstancedSkinnedMesh` approach for Three.js was reported as unable to hold 60 fps with hundreds of characters. — [DEV Community post](https://dev.to/sagacheng/using-instancedskinnedmesh-in-threejs-enabling-the-rendering-of-hundreds-of-3d-characters-on-screen-simultaneously-15gm)
- Babylon.js: bone matrices are stored in a texture by default; on weak devices skinning can be moved to the CPU; with many instances GPU bone computation costs texture reads per vertex per instance; baked vertex animation textures with thin instances scale to many identical characters but cannot blend animations. — [Babylon.js docs, Bones and Skeletons](https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons); [Babylon.js docs, Baked Texture Animations](https://doc.babylonjs.com/features/featuresDeepDive/animation/baked_texture_animations)
- A guide for React Three Fiber suggests fewer than 60 bones for a mobile character and notes mobile GPUs may be limited to 256 or 512 vertex uniform vectors. — [TechNetExperts, R3F SkinnedMesh mobile fix](https://www.technetexperts.com/react-three-fiber-skinnedmesh-mobile-fix/)
- WebGPU's benefit is "greatly reduced JavaScript workload for the same graphics" (Chrome team, via Utsubo), with the largest gains in particle-heavy scenes using compute; PlayCanvas v2.23.0 moved instance matrices to a persistent storage buffer and retains pipelines between draws on WebGPU. — [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed); [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison); [PlayCanvas engine releases](https://github.com/playcanvas/engine/releases)
- PlayCanvas is said to start faster on phones than Unity web builds (empty Unity web build 8 MB or more versus a 1 to 2 MB PlayCanvas runtime). — [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)

### Inferences
- Budget sketch for the worst case: 35 characters at one draw call each, plus weapons attached to bones (one more each if separate meshes), plus the world (a handful of visible sewer pieces, or one cave mesh), plus batched effects, is on the order of 80 to 120 draw calls without shadows. A single shadow-casting spot or directional light roughly doubles the character and world calls. That sits at the edge of the PlayCanvas "low-end mobile" figure and comfortably inside mid-range, on any of the three engines.
- The current game draws each figure as many primitive boxes; `R.stats` counts figures toward `draws`. Moving to one skinned mesh per character may reduce draw calls compared with today, so skinned characters are not automatically a performance regression. The new cost is CPU-side bone matrix updates (35 skeletons times 30 to 60 bones) and animation mixing, which is where JavaScript engines differ least.
- Enemy crowds of identical types (rats from a brood mother) are candidates for instancing or VAT on Babylon, but blending restrictions make VAT a poor fit for enemies with hit reactions. Ordinary skinning is sufficient at 30 enemies.
- Practical levers common to all engines: cap device pixel ratio on phones, keep one material per character, set fixed bounding boxes on skinned meshes, pool vectors, keep omni-light shadows off, and update distant or off-screen skeletons at a lower rate.
- With 5 players the fight count rises (more enemies awake at once than the present two-attacker token rule assumes), so the enemy count on screen is a design variable as much as an engine one.

### Gaps
- No current, measured benchmark of skinned-character counts on a named mid-range phone for Three.js, Babylon.js or PlayCanvas was found; the numbers above are guidance figures and anecdotes, several of them old.
- Thermal throttling and memory limits in iOS Safari for a long co-op session were not researched.
- Whether Three.js `BatchedMesh` or WebGPU paths help skinned meshes was not confirmed.

## 11. Ranked recommendation if the game stays on the web, with the main risks of each

### Takeaway
For this specific codebase (own simulation, own collision, procedural worlds, code-only agent workflow, single-page publishing), the ranking is: 1. Three.js as a rendering and animation library under the existing game; 2. Babylon.js if the owner wants a full engine's built-ins and tooling and accepts adopting its scene graph; 3. PlayCanvas if a visual editor and mobile-first pipeline become the priority; the remaining options are poor fits. This ranking is my inference from the findings above, not a sourced verdict.

### Cited Findings
- Third-party decision rules: "Free complete engine with physics: Babylon.js. Full control on a bare renderer with engineers: Three.js. Studio wanting an editor-driven browser workflow: PlayCanvas." — [Cinevva comparison](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- Another: for browser games, "Babylon.js or PlayCanvas ... with PlayCanvas favored for mobile-first or collaborative teams"; Three.js favoured for long-term, community-driven longevity, while "Babylon.js and PlayCanvas depend on Microsoft and Snap priorities". — [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- Three.js has roughly 39 times the weekly npm downloads of `@babylonjs/core` and 215 times those of `playcanvas`, about 20,900 Stack Overflow questions versus about 470 and about 20, and ships `llms.txt` aimed at AI coding tools. — [Utsubo, "What's New in Three.js (2026)"](https://www.utsubo.com/blog/threejs-2026-what-changed); [Utsubo comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- Needle Engine needs a paid Pro licence for commercial use; Wonderland takes a 10% royalty above USD 120k per year; Galacean's 2.0 is alpha; Bevy 0.20 has no shipped editor and limits on the web; R3F v10 is alpha. — [Needle Cloud FAQ](https://cloud.needle.tools/faq/can-i-use-needle-engine-for-commercial-projects); [Wonderland pricing](https://wonderlandengine.com/pricing/); [galacean/engine releases](https://github.com/galacean/engine/releases); [Bevy 0.20 post](https://bevy.org/news/bevy-0-20/); [react-three-fiber releases](https://github.com/pmndrs/react-three-fiber/releases)

### Inferences

**1. Three.js (r187), `WebGLRenderer` first, used as a library**
- Why: it is the only option meant to sit under an existing loop and scene representation; the existing GLSL (derivative normals, brick, water, toon steps) ports directly to `ShaderMaterial`; the piece-visibility system, field collision, tests and the `R` interface survive; it is small enough to inline; its training-data and example footprint is the largest by far, which matters when AI agents write the code; glTF, skinning, crossfades, additive blending, shadows and post-processing are all there.
- Risks: no animation state machine, events or root motion (build a small controller); no editor or inspector of Babylon's quality; breaking changes every 7 to 11 weeks and agents suggesting deprecated APIs (pin the version, supply `llms.txt`); the ecosystem is mid-transition from GLSL on `WebGLRenderer` to TSL on `WebGPURenderer`, so custom GLSL written now will need a TSL port to ever use WebGPU; addon libraries can be abandoned (the Savanna Sam developer had to fork a particle library); no clustered lighting on the WebGL path, so the eight-light picking stays.

**2. Babylon.js (9.37)**
- Why: the most complete built-in set for where the game is going: weighted and additive animation groups, frame events, two-bone IK, bone attachment, retargeting, clustered lighting on WebGL2 as well as WebGPU, outline renderer, node particle and material editors, Inspector v2, `NullEngine`, Havok under MIT with a character controller if ever needed, Apache 2.0, written in TypeScript, strong backward compatibility, official Colyseus tutorials, and a games page with several Steam releases.
- Risks: it wants the game inside its `Scene`, so the renderer swap is closer to a rewrite of the drawing layer and less incremental; left-handed default versus the game's right-handed conventions; larger bundle (about 1.8 MB full core before tree-shaking); smaller community and far less AI training data than Three.js; direction is set by Microsoft, and 2026 work leans to splats, geospatial and native parity; Havok excludes iOS below 16.4.

**3. PlayCanvas (engine 2.24, Editor)**
- Why: the strongest mobile defaults and the only real collaborative editor; built-in animation state graph with blend trees, layers, masks and events; HDR post pipeline and clustered lighting; MIT engine; an official MCP server that lets coding agents drive the Editor; Snap distribution (PlayCanvas games now run inside Snapchat).
- Risks: its advantages are in the cloud Editor, which keeps scenes and assets outside git, costs USD 15 per month for private projects (USD 50 per seat for an organisation) and allows one MCP agent at a time; engine-only use gives up most of that; physics is ammo.js; WebGPU still labelled beta; smallest community of the three; direction is set by Snap and is heavily splat-focused in 2026; a procedural, code-posed game has little for a scene editor to do until authored content arrives.

**4. Not recommended for this game**
- React Three Fiber: a React layer over Three.js; useful for React apps, adds a framework and a reconciler to a game that has its own loop and no React. v10 is alpha.
- Needle Engine: Three.js-based with Unity and Blender authoring; commercial licence required, and it adds a proprietary layer over the engine the game would be using anyway.
- Wonderland Engine: closed source, WebXR-focused, royalty above USD 120k.
- Galacean: stable 1.6 with 2.0 in alpha; smaller English-language community (background knowledge), no clear advantage here.
- Bevy or other Rust-to-WASM engines: would discard 19,000 lines of JavaScript and the test suite; pre-1.0 with breaking releases about every four months; no editor yet. If a rewrite is on the table, the native engines covered by other researchers are the comparison, not Bevy on the web.

**Cross-cutting risks of staying on the web**
- Shipped evidence for 3D action games on Steam from these engines is thin; consoles have no path; a successful web game may still be ported later (the Vampire Survivors precedent).
- iOS Safari remains the tightest platform: WebGPU only from Safari 26, fullscreen and audio rules, memory limits; none of that changes with engine choice.
- Any option requires first converting the concatenated global-scope source into modules with a bundler, and deciding whether the single self-contained HTML page remains a release target once binary character assets exist.

**A staged plan that keeps options open**
- Modules and bundler first; then put Three.js behind the existing `R` interface with visual parity; then shadows and bloom; then one skinned GLB character as a spike (player class or the Warden) measured on a real mid-range phone and an iPhone before committing to replacing every figure. If the spike shows the animation controller work is larger than expected, Babylon.js is the fallback, and the module conversion and asset pipeline carry over.

### Gaps
- The ranking rests on fit to the code structure described in the project notes and on vendor-authored comparisons; no independent, neutral 2026 benchmark or postmortem supports choosing one engine over another for a third-person co-op action game.
- The owner's weighting of "built properly with the correct tools" may favour an editor-driven workflow more than this ranking assumes; that is a preference question, not a research finding.
- Cost and time estimates for each path could not be sourced.
- Search budget: 9 of the 18 allowed web searches were used; remaining gaps above were left open rather than pursued further.
