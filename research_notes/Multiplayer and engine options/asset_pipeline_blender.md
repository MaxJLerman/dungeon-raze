# 3D asset and animation pipeline for a solo developer: Blender's role and the route to each engine (as of 20 November 2026)

Reading notes for the report writer:

- Everything under "Cited Findings" was read this session unless marked "(search snippet)", which means the fact came from a search result summary and the page itself was not opened.
- Several official pages refused automated reads and were not retried: blender.org (403, release pages and the Lab MCP page), projects.blender.org (403), helpx.adobe.com Mixamo FAQ (403), tripo3d.ai/pricing (403), cgchannel.com (403), syntystore.com collections (429). move.ai/pricing, the three.js manual page and two Blender manual URLs returned 404. Where a third-party source stands in for one of these, it is flagged.
- Vendor blogs (3D AI Studio, StraySpark, Cinevva, Pixune) sell what they describe. They are used for dated prices and are labelled.
- Prices on Meshy and Fab were served in GBP to this session.

## 1. Blender's role, current version, and whether UPBGE or Armory3D are credible engines

### Takeaway
Blender is the authoring and conversion tool, not the runtime: it is where meshes, rigs, animation clips, UVs and textures are made or cleaned up, and where files are converted (for example FBX in, GLB out) before an engine loads them. The current release is Blender 5.3 (10 November 2026) with 5.2 LTS (July 2026) the safer base for add-ons; UPBGE is still alpha and Armory3D is a small Haxe project, so neither is a credible base for a 4 to 5 player co-op action game.

### Cited Findings
- Blender 5.3 is "current stable release - November 10, 2026". Blender 5.2 LTS was released 14 July 2026 and is supported until July 2028. Blender 4.5 LTS (15 July 2025) is supported until July 2027. 5.1 was 17 March 2026, 5.0 was 18 November 2025. 5.4 is in alpha. — [Blender developer release notes index](https://developer.blender.org/docs/release_notes/)
- Blender 5.0 made the new C++ FBX importer the default ("New C++ based FBX importer (added in 4.5 as experimental) is the default FBX importer now"); scripts should move from `bpy.ops.import_scene.fbx` to `bpy.ops.wm.fbx_import`. — [Blender 5.0 Pipeline & I/O notes](https://developer.blender.org/docs/release_notes/5.0/pipeline_io/)
- Blender 5.0 removed Collada: "Collada (`.dae`) import & export has been removed." — [Blender 5.0 Pipeline & I/O notes](https://developer.blender.org/docs/release_notes/5.0/pipeline_io/)
- Blender 5.0 compatibility breaks include removal of Intel Mac support, higher minimum GPU requirements, and blend-file compression on by default. — [Blender 5.0 release notes](https://developer.blender.org/docs/release_notes/5.0/)
- Blender's glTF exporter handles the game-relevant data types: meshes (quads and n-gons are triangulated on export), Principled BSDF base colour, metallic and roughness, tangent-space normal maps, object transforms, pose-bone animation and shape-key values. Other animated properties such as "physics, lights, or materials" are ignored. — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- Add-on support lags releases: Auto-Rig Pro lists Blender 2.93 to 5.2 as supported (5.3 not yet listed when read). — [Auto-Rig Pro on Superhive](https://superhivemarket.com/products/auto-rig-pro)
- UPBGE's latest builds are automated weekly builds of "UPBGE 0.53 Alpha", marked pre-release on GitHub, for Linux x86_64 and Windows x86_64 only; the most recent was 15 November. — [UPBGE releases](https://github.com/UPBGE/upbge/releases)
- Armory is "an open-source 3D game engine focused on portability, minimal footprint and performance", Zlib licensed, written in Haxe, shipped as a Blender add-on; the repository shows 3.4k stars, 374 open issues and 25 open pull requests, with no release listed on the page read. — [armory3d/armory](https://github.com/armory3d/armory)
- Armory's site presents two products: ArmorPaint (texture painting) and the Armory 3D Engine ("Build games in Blender"). — [armory3d.org](https://armory3d.org/)

### Inferences
- The owner's question ("a Blender model or Unity or Unreal") mixes two different decisions. Blender is needed, or at least useful, on every engine path including staying on the current custom renderer; choosing Unity, Unreal, Godot or a web engine does not remove the need for an art source, it only changes the export format and the retargeting tools.
- UPBGE is not credible here: it has no stable release, no macOS build on the releases page (the owner works on macOS), and no web target was found. Armory is not credible either: small community, no visible release cadence, and its language (Haxe) has far less AI-agent training coverage than JavaScript, C#, GDScript or C++. Both judgements rest on thin evidence (see Gaps).
- Blender 5.2 LTS is the pragmatic version to standardise on in late 2026: paid add-ons list support up to 5.2, the official MCP server needs 5.1 or newer (section 6), and LTS support runs to July 2028.
- That Blender's built-in game engine was removed in 2.80 is the premise given in the brief; it was not re-verified this session.

### Gaps
- blender.org release pages returned 403, so 5.1 to 5.3 feature headlines (animation, rigging, asset browser changes) were not read. Only 5.0's I/O notes were.
- UPBGE's website returned only a title, so its Blender base version, licence implications (Blender is GPL, which matters for shipped game code) and platform list could not be confirmed.
- Armory's last release date, supported Blender version, export targets and networking were not on the pages read.

## 2. Export paths and their pitfalls (glTF/GLB, .blend, FBX, USD; axes, scale, baking, root motion, shape keys, materials; Draco, meshopt, KTX2)

### Takeaway
glTF 2.0 binary (GLB) is the right interchange format for web engines and Godot, and FBX remains the practical one for Unity and Unreal; the recurring failures are un-applied transforms and scale, actions that are silently not exported, non-deforming bones, and materials that only survive as base colour, metallic, roughness and normal. For the web, use meshopt (not Draco) for animated characters and KTX2 or WebP for textures.

### Cited Findings
**glTF from Blender**
- Animation export modes: "Actions (default)" exports only actions that are active or stashed to an NLA track; unassociated actions are "not exported". "NLA Tracks" makes each track a separate glTF animation. "Scene" exports what the viewport shows, sampled. — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- Skinning: the exporter can write a chosen number of joint influences, but values other than 4 or 8 "may appear incorrectly in many viewers". "Export Deformation Bones only" bakes animation onto deform bones. — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- Shape keys export as morph targets; shape-key drivers based on bones need the mesh to be a direct child of the armature. — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- Materials: metal/rough PBR and unlit (`KHR_materials_unlit`) export; metallic and roughness should sit in the B and G channels or the add-on "may attempt to adapt the image"; normal maps must be tangent space; baked ambient occlusion needs a custom `glTF Material Output` node group; Blend alpha "may show visual artifacts in non-trivial scenes". — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- Compression in Blender's exporter is Draco only (`KHR_draco_mesh_compression`, export only); textures can be written as PNG, JPEG or WebP. "glTF Embedded" is "the least efficient" format. — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- Discontinuous UVs and flat shading raise vertex counts on export. — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)

**Godot**
- Godot recommends glTF 2.0 (`.gltf` and `.glb`). It also imports `.blend` directly by calling Blender to export glTF during import; this needs Blender 3.0 or later ("we recommend using Blender 3.5 or later"), every team member needs Blender installed, and it is not available in the Android and web editors. — [Godot docs, available 3D formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)
- Godot 4.3 and later import FBX natively through ufbx; the older FBX2glTF route needs an external executable and is discouraged. USD is not in Godot's list of supported scene formats (glTF, .blend, DAE, OBJ, FBX). — [Godot docs, available 3D formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)
- Godot pitfalls from Blender: with shape keys, enable "Export Deformation Bones Only" or shading can be wrong; Blender leaves backface culling off by default, so Godot materials import with culling disabled unless it is turned on in Blender. — [Godot docs, available 3D formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)

**FBX from Blender (Unity, Unreal)**
- Blender's FBX exporter scale: "10 is the default because this fits best with the scale most applications import FBX to." Blender is Y forward, Z up, so a Y-up application needs "-Z Forward, Y Up". — [Blender 4.5 manual, FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html)
- Bake Animation "All Actions": "When disabled only the currently assigned action is exported." FBX bones are -X aligned while Blender's are Y aligned, so bones may look wrong in other applications. Constraints are exported as keyframes, not constraints. — [Blender 4.5 manual, FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html)
- The same manual page still lists Apply Scalings, Apply Transform, Add Leaf Bones, Only Deform Bones, Key All Bones and NLA Strips as "Todo" with no description, and its limitations list is partly stale (it says shape keys and material textures are missing). — [Blender 4.5 manual, FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html)
- A 2026 vendor guide gives per-engine settings: Unreal, FBX at scale 1.0 with the scene in metres, "Forward: -Y Forward, Z Up", apply modifiers; Unity, FBX with import scale factor 1.0; Godot, GLB with modifiers applied; in every case apply all transforms (Ctrl+A) before export. — [StraySpark, Blender to game engine pipeline, 1 Apr 2026 (vendor)](https://strayspark.studio/blog/blender-to-game-engine-pipeline-2026)

**Web engines and compression**
- Babylon.js: glTF is right-handed and Babylon scenes are left-handed by default, so the loader adds a `__root__` node carrying the conversion (rotation quaternion [0, 1, 0, 0] and scaling [1, 1, -1]); do not mirror imported meshes a second time. Draco, meshopt and KTX2 (`KHR_texture_basisu`) are supported; decoders load from the Babylon CDN by default and can be self-hosted. — [Babylon.js glTF loader docs](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF)
- three.js: `GLTFLoader` reads `KHR_mesh_quantization` and `EXT_texture_webp` with no setup; Draco needs `DRACOLoader` with a decoder path, KTX2 needs `KTX2Loader` with a transcoder path, meshopt needs `MeshoptDecoder`. — [Cinevva, optimize GLB for web, Sept 2026 (vendor guide)](https://app.cinevva.com/guides/optimize-glb-for-web)
- For animated characters use meshopt, not Draco: "Draco leaves animation tracks and morph targets untouched". gltfpack's `-af 30` resamples at 30 Hz and quantizes translations to 16 bits and rotations to 12. Skip join and flatten on rigged models, and simplify carefully near joints because collapsing vertices also collapses skin weights. — [Cinevva, optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)
- Measured on one 28.7 MB static test model: quantize 22.8 MB (8.1 MB gzipped, no decoder needed), meshopt 5.1 MB (3.3 MB gzipped), gltfpack meshopt 4.4 MB, Draco 2.6 MB. — [Cinevva, optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)
- Texture memory: a mipmapped 2048 texture is about 22 MB as RGBA8 in VRAM, about 5.6 MB as UASTC and 2.8 MB as ETC1S; WebP cuts download size but not VRAM. A 2.2 MB prop with three 1024 PNGs dropped to 246 KB with WebP alone. — [Cinevva, optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)
- glTF Transform CLI commands: `optimize`, `draco`, `meshopt`, `quantize`, `resample` ("losslessly removes duplicate keyframes"), `prune`, `dedup`, `simplify`, `instance`, and texture commands `etc1s`, `uastc`, `webp`, `avif`, `resize`. Installed with `npm install --global @gltf-transform/cli`. — [glTF Transform CLI](https://gltf-transform.dev/cli)

**USD**
- Blender 5.0's USD changes were about curves and primvars (NURBS kept as curves, `nurb_weight` export), not game character pipelines. — [Blender 5.0 Pipeline & I/O notes](https://developer.blender.org/docs/release_notes/5.0/pipeline_io/)

### Inferences
- Format by destination: three.js, Babylon.js, PlayCanvas and Godot take GLB; Unity and Unreal take FBX most reliably, and both can also import glTF. USD is not worth adopting for this project: Godot does not import it, the web engines do not use it, and nothing found this session shows a solo character pipeline benefiting from it.
- Blender works as a universal converter. Most paid animation packs ship FBX or engine-native files, and the web path needs GLB, so the standing chore is "import FBX in Blender, retarget or rename, export GLB". Since 5.0 the fast FBX importer is the default, and this conversion can run headless (section 6).
- Root motion: the game today moves bodies in code (`lunge` distances and timings in the `MOVES` table), so in-place clips fit the existing design best. Packs commonly ship both in-place and root-motion variants (section 3). Using root motion would mean handing movement authority from the simulation to the animation, which also complicates co-op netcode.
- Purchased clips carry their own wind-up, active and recovery timings. Either each clip is time-scaled per phase to match the `wind`, `act` and `rec` values in the data tables, or the tables are retuned to the clips. This is a design cost that does not show up in asset prices.
- Background knowledge not fetched this session: glTF is defined as +Y up, metres, right-handed and Blender's exporter converts from Z up; Unreal's unit is the centimetre, which is the source of the classic 0.01 or 100 scale mismatch on armatures exported from Blender; three.js has no built-in root-motion extraction. Treat these as unverified here.

### Gaps
- No official Unreal or Unity import page for Blender FBX was read, so the centimetre scale issue, leaf bones and root-bone conventions are not sourced. The one vendor guide read did not cover them.
- The Blender manual's FBX page is largely "Todo", so there is no authoritative statement of what Apply Transform or Add Leaf Bones do.
- PlayCanvas import documentation was not read.
- The three.js manual page on glTF returned 404; three.js loader facts come from a vendor guide.

## 3. Humanoid character and animation sources for melee combat, with licences

### Takeaway
A complete humanoid melee set can be assembled for nothing from CC0 sources (Quaternius Universal Animation Library, KayKit) plus Mixamo, and for 15 to 50 USD per weapon style from marketplace packs; the licences that matter are that Fab's Standard licence and the Unity Asset Store EULA both permit use outside their own engines, while Synty forbids sharing source files and any generative-AI use. Mixamo still works but is unmaintained, and its official terms could not be read this session.

### Cited Findings
**Free and CC0**
- Quaternius Universal Animation Library 2: 130+ animations, CC0 ("Free to use in personal, educational and commercial projects"), covering melee, armed combos, 3 and 4 hit combos split into separate hits with recoveries, parkour movement and zombie locomotion; a universal humanoid rig "ready for retargeting"; tested with "Any version of Godot and Unity | Unreal Engine over 5". The free Standard tier is 60 to 70% of the pack; Source tier adds .blend files and engine projects; Patreon tiers are $10, $20 and $50 a month for claim credits. — [Quaternius UAL 2](https://quaternius.com/packs/universalanimationlibrary2.html)
- Quaternius also lists Universal Base Characters ("Rigged", "Retargetable"), Bestiary - Dungeon Monsters Kit ("Rigged", "Retargetable"), Modular Dungeon packs, RPG Character Pack, Animated Monster Pack, Ultimate Monsters and Ultimate Animated Animal Pack. — [quaternius.com](https://quaternius.com/)
- KayKit Character Animations: 161 humanoid animations (free tier 150+), categories General, Movement, Melee Combat, Ranged, Simulation, Special and Tool, for a medium rig (100+ clips) and a large rig (23 to 25+); CC0, "Free for personal and commercial use, no attribution required"; FBX and GLTF; source .blend files for $14.99 or more. — [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations)
- KayKit also offers rigged and animated low-poly Adventurers and Skeletons character packs, and paid "Mystery Monthly" series of 14 to 15 rigged characters at $19.99 each. — [Kay Lousberg on itch.io](https://kaylousberg.itch.io/)
- Kenney: "all game assets on the [asset pages] are public domain licensed (CC0)"; "You're free to use them, even in commercial projects"; credit is optional. — [Kenney support](https://kenney.nl/support)

**Mixamo (official FAQ refused, third-party only)**
- A guide whose vendor claims were checked 20 September 2026 says Mixamo is free with an Adobe ID, royalty-free for personal, commercial and nonprofit projects, and that its auto-rigger and library are limited to "bipedal humanoids only". — [Cinevva, free character animations and rigging (updated 13 Nov 2026)](https://app.cinevva.com/guides/free-character-animations-rigging)
- A second guide from the same publisher (Sept 2026) says Mixamo exports FBX, allows commercial game use with no attribution, forbids redistributing raw files, and is "in maintenance mode, so the catalogue is fixed". — [Cinevva, AI animation generators (Sept 2026)](https://app.cinevva.com/guides/ai-animation-generators-3d)
- (search snippet) Adobe's community-hosted FAQ text says no licensing or royalty fees for commercial use; an Adobe employee confirmed commercial use in a June 2025 forum reply; one guide reports several days of server errors in June 2025; Adobe has announced no shutdown date. — [Adobe community Mixamo FAQ thread](https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775)

**Fab (Epic)**
- Fab Standard licence: "Use the assets with any compatible tools (usage is not limited to Unreal Engine)"; "Commercially distribute your Projects with the Fab assets incorporated into it"; may not "Resell or redistribute the asset for free on a standalone basis or allow others to do the same"; may "Share the asset (directly, via a private repository or in the Project) with your collaborators"; Personal and Professional tiers "grant you the same scope of rights". — [Fab licence summary](https://www.fab.com/eula)
- The Personal tier is for buyers who "have not generated more than $100,000 USD" in gross revenue over the last 12 months. Licence types on Fab are CC-BY, Standard, and a legacy UE Marketplace License on some migrated products, flagged in a listing's Details. — [Epic, licences and pricing in Fab](https://dev.epicgames.com/documentation/fab/licenses-and-pricing-in-fab)
- (search snippets, forum and blog sources) Epic-made content such as Paragon assets, MetaHumans and Epic sample projects is Unreal-only; older "UE-Only" marketplace content stays Unreal-only; content bought before Fab keeps its original licence. — [Epic forum thread on UE-only licensing](https://forums.unrealengine.com/t/fab-ue-only-content-licensing/2082870); [GameFromScratch on using store assets in other engines](https://gamefromscratch.com/using-asset-store-assets-in-other-engines-is-it-legal/)
- Example Fab listing: "GreatSword Action RPG Animation Pack" by AniBearlee, GBP 14.51 before tax, 112 sequences, root-motion and in-place versions, format listed as Unreal Engine (4 and 5) only. — [Fab listing](https://www.fab.com/listings/58dbe678-f46e-41c3-86a1-4389ca77f94b)
- (search snippet) Frank Climax's packs appear as legacy Unreal Marketplace listings; "Frank RPG Great Sword" is described as not migrated to Fab by the seller and available only through the launcher vault, and the seller quotes about $150 per custom motion. — [Frank RPG Great Sword listing](https://www.unrealengine.com/marketplace/en-US/product/frank-rpg-great-sword)

**Unity Asset Store**
- Unity's support article (updated 2 July 2025): "You can use Unity Asset Store assets with other engines" under the EULA; "Assets cannot be redistributed as standalone items" and users of the project should not be able to extract the raw asset files; some assets carry separate "Restricted Asset" or open-source terms. — [Unity support: Asset Store assets with other engines](https://support.unity.com/hc/en-us/articles/34387186019988-Can-I-use-assets-from-the-Asset-Store-with-other-engines)
- The EULA licenses incorporation into an "electronic application or digital media" as an embedded component that "does not comprise a substantial portion of the Licensed Product"; standard assets may be installed on unlimited computers belonging to the end user; editor extensions are per seat; each contractor needs their own licence. — [Unity Asset Store terms and EULA](https://unity.com/legal/as-terms)
- The EULA prohibits using assets "for purposes such as training an artificial intelligence or machine learning model" without consent, and use "as inputs for artificial intelligence or machine learning model programs". — [Unity Asset Store terms and EULA](https://unity.com/legal/as-terms)
- (search snippets) Soulslike-suitable packs and prices: GreatSword_Animset $49.99 (8 executions, 45 battle, 8 dodge, 20 hit, 37 movement, in-place and root motion); Longsword Animset Pro by Kubold $50 (205 mocap animations); Animset Dual Swords $24.99 (185 cycles including parry). — [GreatSword Animset](https://assetstore.unity.com/packages/3d/animations/greatsword-animset-160113); [Longsword Animset Pro](https://marketplace.unity.com/packages/3d/animations/longsword-animset-pro-92239); [Animset Dual Swords](https://assetstore-fallback.unity.com/packages/3d/animations/animset-dual-swords-221770)
- (search snippet) Kubold's site says some of its animation sets were deprecated on the Unity Asset Store and that for now the Unreal marketplace is the place to buy them. — [kubold.com](https://kubold.com/)

**Synty**
- POLYGON Dungeon Realms: $199.99 list ($100 on sale when read), 19 characters, 69 attachments, 480 environment pieces, 373 props, 81 weapons, 32 FX, over 1,118 prefabs; Unity 2022.3+ and Unreal 5.3+; characters work with Mecanim and "no animations are included". SyntyPass starts at $30 a month for 150+ packs. — [Synty POLYGON Dungeon Realms](https://syntystore.com/products/polygon-dungeon-realms)
- Synty one-time licence: "not limited by game engine, OS, platform or device"; royalty-free; five seats per purchase (Humble Bundle purchases one seat); "You must not share the source files of any Assets outside your team"; prohibits NFT and blockchain use, "Metaverse-related and/or Game Creation Software", inclusion "in datasets utilised by Generative AI Programs", "Generation of 3D models utilising Generative AI Programs", and uploading "source files or models to third party services for the purpose of 3D model generation". — [Synty EULA](https://syntystore.com/pages/end-user-licence-agreement)

**Motion libraries and video mocap**
- Rokoko Studio plans: Starter $0 (FBX export, 30 s a month of Vision AI video mocap), Basic $12 a month ($10 annual; BVH, 600 s), Plus $28 ($20 annual; 3,000 s), Pro $70 ($50 annual; 15,000 s). The page's summary cards show different prices from its detail sections. — [Rokoko pricing](https://www.rokoko.com/pricing)
- Move One (Move.ai, iPhone app): Free 30 one-time credits and 30 s videos; Starter $18 a month for 60 credits; Standard $48 for 180; Plus $225 for 240; Advanced $490 for 700. Gen 1 costs 1 credit per person per second, Gen 2 costs 2. Videos up to 60 s. — [Move One pricing docs](https://docs.move.ai/knowledge/move-one-pricing)
- (search snippet) An older Move.ai help article lists a different structure (Starter $15 a month with 180 credits), so Move.ai's own pages conflict. — [Move.ai help: Move One pricing](https://help.move.ai/en/articles/8851451-move-one-pricing)
- DeepMotion Animate 3D: free tier up to 60 s a month, personal and non-commercial only; 1 credit is 1 second; face and hand tracking add 0.5 credit a second each; output FBX, BVH, GLB, MP4. — [DeepMotion Animate 3D pricing](https://www.deepmotion.com/pricing-animate3d)
- Third-party price list (Sept 2026): DeepMotion paid from $15 a month with commercial rights; Plask free 15 s a day, Standard $18 a month billed annually with 10 minutes of capture, Pro $50; Rokoko Vision single-camera free and dual-camera paid; Cascadeur free version, Indie about 12 EUR a month, Pro about 49 EUR; all video mocap shows "foot sliding and jitter on fast motion". — [Cinevva, AI animation generators (Sept 2026)](https://app.cinevva.com/guides/ai-animation-generators-3d)
- Solo developers with little animation background have used Cascadeur for melee combat animation (search snippet). — [Cascadeur indie spotlight](https://cascadeur.com/blog/general/indie-game-spotlight-deformed)

### Inferences
- The cheapest credible humanoid plan is CC0 first: Quaternius UAL 1 and 2 plus KayKit give roughly 300 clips with no licence obligations, which matters for a game whose files are served openly on the web (section 11). Paid weapon-specific packs (greatsword, dual blades, executions) fill the gaps at 15 to 50 USD each.
- Marketplace animation packs are frequently engine-native. The Fab greatsword pack lists only "Unreal Engine" format, so using it on the web or in Godot means opening it in Unreal Editor and exporting FBX, then converting in Blender. The licence allows this; the labour is the cost. Unity packs usually include FBX.
- Unity's guidance that users "shouldn't be able to extract the raw asset files" is in tension with a web game that serves GLB files at plain URLs. CC0 assets avoid the question entirely. For paid assets on the web, bundling into a non-standard container is a mitigation, not a guarantee; this deserves a direct question to the seller if a paid pack becomes central.
- If the game's repository is public (it publishes through GitHub Pages), committing purchased source assets to it would be redistribution under the Fab, Unity and Synty terms. Fab explicitly names a private repository as the allowed way to share with collaborators. Paid assets would need a private repo or a separate private asset store with only built files published.
- Synty's AI clauses and Unity's "inputs for AI" clause plausibly forbid feeding purchased models into Meshy, Tripo or similar services for re-rigging or retexturing. Driving Blender with a coding agent to convert files is a different act, but the clauses are broad enough that the owner should read them before building an AI-heavy pipeline around paid packs.
- Video mocap is a poor fit for Soulslike weapon combat by a non-performer: the allowances are small (Move One Starter is 30 to 60 seconds a month), fast motion jitters, and the performance still has to be good. It suits a few bespoke moves, not a moveset.
- Mixamo is usable but should not be a dependency: it is unmaintained with no stated future. Download what is needed once and keep the FBX files.

### Gaps
- Adobe's Mixamo FAQ returned 403. Licence wording, AI-training restrictions and current status are from third parties.
- ActorCore motion pricing and AccuRig details: the Reallusion page returned empty content.
- Rokoko Motion Library pricing was not on the pricing page ("for free or at low cost").
- Synty's animation packs and Sidekick character prices (collections page returned 429) and SyntyPass terms after cancellation were not read. The Dungeon Realms page showed "Sold out", which was not explained.
- The full Fab EULA text on "UE-Only" content was not read; the Unreal-only rules for Epic-made content come from forum and blog posts.
- Whether Frank Climax packs are purchasable on Fab in late 2026, and at what price, was not established.
- Marketplace listing prices from search snippets may be out of date.

## 4. Retargeting animation between rigs, in Blender and in each engine

### Takeaway
All three full engines retarget humanoid animation natively (Unity's Humanoid Avatar, Unreal's IK Retargeter, Godot's BoneMap on import), so on those paths one shared clip library can drive every humanoid class with little Blender work. On a web engine or the current custom renderer there is no equivalent, so retargeting has to be done offline in Blender (Auto-Rig Pro Remap or the free Rokoko add-on) or avoided by putting every humanoid on one skeleton.

### Cited Findings
- Unity 6.6 (6000.6): "Use retargeting to apply the same animation to different humanoid models without having to restructure skeletons or rename bones." "Each humanoid model must use the Humanoid animation type and have a configured Avatar." "When you configure an Avatar, your model must be in a T-stance." — [Unity manual, retargeting humanoid animation](https://docs.unity.com/en-us/engine/current/manual/animation-section/animation-mecanim/avatar-creationand-setup/retargeting)
- Unreal (page titled for 5.9): IK Rigs let you "Share and transfer animation between characters of any size"; source and target skeletons can differ in bone count, names and orientation; limbs are defined as retarget chains matched by fuzzy name matching; a pelvis bone on both rigs transfers root motion proportionally; retarget poses handle A-pose versus T-pose; "Export Selected Animations" bakes clips for the target skeleton, and retargeting can also run at runtime through an anim node. — [Unreal docs, IK Rig animation retargeting](https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine)
- Godot: "you can't share animations between multiple Skeletons just by using the same bone names", because rest poses differ. Retargeting is set at import with a BoneMap and `SkeletonProfileHumanoid`, with auto-mapping from common English bone names. "Overwrite Axis" is "the most important option for sharing animations in Godot 4". "Fix Silhouette" "cannot fix silhouettes which are too different". Keeping position tracks only for the root and hips avoids the animation changing body shape. — [Godot docs, retargeting 3D skeletons](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/retargeting_3d_skeletons.html)
- Godot's retargeting documentation assumes the humanoid preset; for other rigs a custom SkeletonProfile can be exported from the editor. — [Godot docs, retargeting 3D skeletons](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/retargeting_3d_skeletons.html)
- Auto-Rig Pro: $50 for the full package (rig, Smart, Remap, FBX and GLTF export), $25 Lite. Remap retargets between armatures with different bone names and orientations, works with Auto-Rig Pro, Rigify and custom rigs, and takes imported BVH and FBX including Mixamo. Export presets cover Unity, Unreal (Mannequin naming) and Godot, with root-motion support. — [Auto-Rig Pro on Superhive](https://superhivemarket.com/products/auto-rig-pro)
- Rokoko's Blender add-on retargets between armatures ("Build Bone List", verify mapping, "Retarget Animation"), needs both armatures in the same pose, supports Blender 2.80 or higher, and is open source on GitHub (the page shows both LGPL-3.0 and an MIT badge). — [Rokoko Studio Live for Blender](https://github.com/Rokoko/rokoko-studio-live-blender)
- Meshy's rigging API can output a biped skeleton in named templates including `mixamo`, `ue5_mannequin`, `unity_humanoid`, `blender_rigify_basic_human` and `maya_human_ik`. — [Meshy rigging and animation API docs](https://docs.meshy.ai/en/api/rigging-and-animation)
- KayKit's animations are built for its own rigs; other humanoids can use them "through engine retargeting, though they may not look as good". — [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations)

### Inferences
- The lowest-effort design is one humanoid skeleton for all seven classes and every humanoid enemy, differing only in mesh and proportions. Then no retargeting is needed at run time on any engine, and one clip library serves all. The game's primitive-built figures already share a body plan, so this matches how the code is organised today.
- Retargeting is the largest concrete pipeline advantage of Unity, Unreal and Godot over a web engine for this game. In three.js or Babylon, clips must be baked to the target skeleton offline, which is scriptable in Blender but is another step to maintain.
- Retargeting does not rescue non-humanoids. Unity's system is humanoid only; Godot's and Unreal's can map other rigs but there are no stock libraries to map from (section 5).

### Gaps
- Rigify's own documentation was not read; it appears here only through Auto-Rig Pro's and Meshy's mentions.
- Whether three.js or Babylon.js ship a usable retargeting helper in late 2026 was not checked (other researchers cover the engines).
- Unreal's automatic retarget templates and quadruped support were referenced by the page read but not described there.

## 5. Non-humanoid creatures (rat, crocodile boss, eel, wall-mounted arm) and procedural animation

### Takeaway
Stock libraries barely cover these: generic quadruped auto-rigging and a few stock crocodile models exist, but nothing supplies a death roll, a tunnel-perched plate throw or a grate arm. The realistic options are to keep driving these bodies procedurally, as the game already does, or to commission them; the procedural route has shipped in respected indie games.

### Cited Findings
- Mixamo's auto-rigger and library cover "bipedal humanoids only". — [Cinevva, free character animations and rigging](https://app.cinevva.com/guides/free-character-animations-rigging)
- Meshy's rigging API accepts four-legged animals with `animation_type: "quadruped"`; quadruped rigs come with a walking and running clip, which "may be empty strings" if Meshy cannot generate one; "Non-humanoid, non-quadruped assets aren't suitable"; skeleton templates and finger bones are biped only. — [Meshy rigging and animation API docs](https://docs.meshy.ai/en/api/rigging-and-animation)
- UniRig (MIT) predicts a skeleton and skin weights for varied shapes including animals; generation needs a CUDA GPU with at least 8 GB VRAM; skinning quality "can drop sharply if the skeleton is inaccurate", with missing tail or wing bones given as the example; the repository now points to a successor, SkinTokens. — [VAST-AI-Research/UniRig](https://github.com/VAST-AI-Research/UniRig)
- Auto-Rig Pro rigs non-humanoids manually (horse and dog given as examples), with limbs duplicated or removed for creatures like spiders and a 3-bone IK option for quadruped legs; its Smart auto-placement is for humanoids. — [Auto-Rig Pro on Superhive](https://superhivemarket.com/products/auto-rig-pro)
- Quaternius lists CC0-style creature packs: Bestiary - Dungeon Monsters Kit (rigged, retargetable), Animated Monster Pack, Ultimate Monsters and Ultimate Animated Animal Pack. — [quaternius.com](https://quaternius.com/)
- (search snippets) Stock rigged crocodiles exist: Fab listings with dead, eat, walk, run, idle and swim, or attack and swimming clips; a Unity Asset Store stylised crocodile character at $19.99 with attack, bite and death; CGTrader models from $6.99 to $79.99, one at $29.99 with 76 animations; several CGTrader items carry a no-AI-use term. — [Fab crocodile listing](https://www.fab.com/listings/9aba071b-d1ed-4945-a140-950b223a11a7?lang=es-mx); [Unity Asset Store crocodile](https://assetstore-fallback.unity.com/packages/3d/characters/creatures/crocodile-man-monster-low-poly-stylized-306985); [CGTrader saltwater crocodile](https://www.cgtrader.com/3d-models/animal/reptile/saltwater-crocodile-animated-w-skin-variants)
- HY-Motion 1.0 (text to motion) lists "Non-humanoid characters, such as animals or creatures" as not supported. — [HY-Motion 1.0 repository](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
- Procedural precedent: David Rosen's GDC 2014 talk "Animation Bootcamp: An Indie Approach to Procedural Animation" covers simple procedural techniques that rely on "very few key frames", with Overgrowth, Receiver and Black Shades as examples. — [GDC Vault](https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach)
- Rain World's animation process was presented at GDC 2016 by Joar Jakobsson and James Therrien ("Animation Bootcamp: 'Rainworld' Animation Process"). — [GDC Vault](https://www.gdcvault.com/play/1023475/Animation-Bootcamp-Rain-World-Animation)

### Inferences
- The crocodile is the clearest case for staying procedural. Its fight depends on state the simulation owns: an eight-segment tail, a body that rolls about its long axis, a hip pitch for the rear, a perched pose in a wall outlet. A stock crocodile's walk, bite and swim clips would cover perhaps a third of that, and the rest would need custom animation at roughly 150 USD or more per motion (section 10), on a rig someone else designed.
- A hybrid is available without a full art pipeline: give the existing code-posed figures a real skeleton and a skinned mesh, and keep driving the bones from the existing pose functions. The pose code becomes the animation source; only the mesh is authored. This works on any engine, since every engine exposes bone transforms to code, and it preserves the determinism the test suite relies on.
- The eel, the grate arm and tails are chains: spline or spring-bone motion is the standard answer and needs no clips. The rat is a quadruped small enough that a stock or auto-rigged asset with walk and run would do, with the pounce handled in code.
- Auto-rigging tools fail exactly where these creatures are unusual (tails, jaws, long bodies), which UniRig's own caveat about missing tail bones illustrates.

### Gaps
- The Rain World GDC page had no abstract, so its procedural approach is not described by a source here; that it is a known example of procedural creature animation is background knowledge.
- No source was found pricing a commissioned non-humanoid boss rig with a custom moveset.
- Licences and current prices of the stock crocodile listings were not opened.

## 6. AI-assisted asset creation in late 2026, and driving Blender from a coding agent

### Takeaway
AI 3D generators in late 2026 are useful for props and static set dressing at roughly 0.25 to 0.80 USD a model, are still "hit or miss" for deforming characters, can auto-rig bipeds and simple quadrupeds, and do not yet replace an animator: text-to-motion is humanoid only and cannot make loops. Blender is fully scriptable headless, and since April 2026 has an official MCP server, so an AI coding agent can run the conversion and batch-processing parts of the pipeline reliably; it cannot yet be trusted to model good characters unaided.

### Cited Findings
**Generation prices and licences**
- Meshy (prices served in GBP): Free 100 credits a month, output under CC BY 4.0; Pro £16 a month for 1,000 credits; Premium £32 for 3,000; Ultra £80 for 8,000; paid plans give private, customer-owned assets and API access; exports FBX, OBJ, USDZ, GLB, STL, BLEND, 3MF; the free plan uses "Meshy 6 Lite". — [Meshy pricing](https://www.meshy.ai/pricing)
- Cross-vendor prices checked 1 November 2026 by a competitor: Meshy Pro $20 a month (about $0.60 per textured Meshy 6 model); Tripo Pro $20 a month billed yearly for 3,000 credits, Max $90 for 25,000, free-plan models public and non-commercial; Rodin (Hyper3D) Creator $30 a month, API needs Business at $120, about $0.50 per Gen-2.5 High model; Hunyuan3D through Tencent Cloud at $15 per 1,000 credits, about $0.38 per textured model; 3D AI Studio $19 to $29 a month, about $0.25 to $0.33 per model. — [3D AI Studio pricing comparison (vendor)](https://www.3daistudio.com/3d-generator-ai-comparison-alternatives-guide/ai-3d-generator-pricing-compared)
- (search snippet) Third-party sources disagree on Tripo's entry price ($15.90, $19.90 or $20 a month) and free credits (200 or 300); they agree commercial rights need a paid plan. — [Tripo getting-started guide](https://www.tripo3d.ai/getting-started/zero-to-3d-getting-started-credits-pricing-guide)

**Open models**
- Hunyuan3D-2.1 (released 13 June 2025) is image to 3D with PBR textures and needs "10 GB VRAM for shape generation, 21GB for texture generation and 29GB for shape and texture generation in total". — [Hunyuan3D-2.1 repository](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)
- Its licence "DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA"; outputs may not be used, distributed or displayed outside the licensed territory; a separate licence is needed above 1 million monthly active users. — [Hunyuan3D-2.1 LICENSE](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2.1/main/LICENSE)
- TRELLIS.2 (Microsoft) is a 4B-parameter image-to-3D model, MIT licensed, exporting GLB with base colour, roughness, metallic and opacity; it needs an NVIDIA GPU with at least 24 GB and is tested only on Linux. — [microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2)
- A TRELLIS.2 output used as a test file had 978,226 triangles and 28.7 MB before optimisation. — [Cinevva, optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)

**Quality and rig-readiness**
- A vendor's own assessment: topology is generally clean for static props but for animated characters is "hit or miss" because the AI "doesn't know which edge loops are important for deformation"; strongest on props, environment assets and weapons, weakest on characters. — [3D AI Studio, can AI generate game-ready models (vendor, undated 2026)](https://www.3daistudio.com/3d-generator-ai-comparison-alternatives-guide/can-ai-generate-game-ready-3d-models)
- Generated props often still need geometry repair, retopology, UVs, baking, LODs and correct scale before engine import, and automated retopology does not replace hand-built edge loops for deforming hero characters. — [StraySpark, official Blender MCP comparison (25 Sept 2026, vendor)](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026)
- AI meshes commonly arrive with non-manifold geometry, internal faces, flipped normals and textures that do not follow PBR conventions. — [StraySpark, Blender to game engine pipeline (1 Apr 2026, vendor)](https://strayspark.studio/blog/blender-to-game-engine-pipeline-2026)

**Auto-rigging**
- Meshy rigging: GLB input only, must be textured, at most 380,000 triangles, face pointing +Z; bipeds and quadrupeds; output FBX and GLB with walking and running clips; a sample task consumed 5 credits; failed rigs are refunded; hands modelled as one shape get fewer finger bones. — [Meshy rigging and animation API docs](https://docs.meshy.ai/en/api/rigging-and-animation)
- Meshy offers 600+ preset animation clips and no text-to-motion; Tripo has rigging with FBX and GLB export and no text-to-motion. — [Cinevva, AI animation generators (Sept 2026)](https://app.cinevva.com/guides/ai-animation-generators-3d)
- UniRig: MIT, open checkpoints, 8 GB VRAM for inference, FBX and GLB in and out. — [VAST-AI-Research/UniRig](https://github.com/VAST-AI-Research/UniRig)
- AccuRig is a desktop rigging tool with FBX and USD export; ActorCore motions are a separate offering with their own licence. — [Cinevva, free character animations and rigging](https://app.cinevva.com/guides/free-character-animations-rigging)

**Text to motion and video to motion**
- HY-Motion 1.0 (Tencent, code and weights released 30 December 2025) generates skeleton-based human animation from text; needs 26 GB VRAM (24 GB for the Lite model); not supported: non-humanoids, multi-person interaction, and "Seamless loop or in-place animations". — [HY-Motion 1.0 repository](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
- (search snippet) An industry comparison says generative animation in 2026 still struggles with floaty, uncanny movement while calling text-to-motion production-viable. — [Metavert, mocap vs generative animation](https://metavert.io/compare/mocap-vs-generative-animation)
- Video mocap prices are in section 3.

**Driving Blender from code or an agent**
- Blender 5.3 command line: `-b`/`--background` "Run in background (often used for UI-less rendering)"; `-P`/`--python <filepath>` "Run the given Python script file"; `--python-expr`; `--` "End option processing, following arguments passed unchanged. Access via Python's `sys.argv`"; `--addons`; `--python-exit-code` sets a non-zero exit code when a script raises. — [Blender 5.3 manual, command line arguments](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html)
- The official Blender Lab MCP server reached v1.0.0 on 27 April 2026 (v1.0.3 on 11 September), needs Blender 5.1 or newer, is GPL-3.0-or-later, exposes 26 tools (code execution, blend-file and object summaries, screenshots, viewport renders, search over bundled API docs), is "deliberately small", runs LLM-generated code "without any guards" with a virtual machine recommended, has no generation integrations, and is the server behind Anthropic's Blender connector for Claude. — [StraySpark, official Blender MCP comparison (vendor; the official pages returned 403)](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026)
- (search snippet) Anthropic's Claude connector for Blender was announced 28 April 2026 alongside a corporate-patron donation to the Blender Development Fund. — [mcp.directory guide, 29 April 2026](https://mcp.directory/blog/claude-blender-connector-guide)
- The community server (ahujasid, MIT, 35.1k stars, renamed "MCP for Blender") is "not affiliated with the Blender Foundation"; it lets the model create and modify objects, run Blender Python, and take viewport, wireframe and render captures to review its own work; it integrates Poly Haven (CC0, no API key), Sketchfab, Poly Pizza, Hyper3D Rodin, Hunyuan3D, Meshy and Tripo; it supports Claude Code among other clients. — [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Its risks: `execute_blender_code` runs arbitrary Python and is "potentially dangerous"; the socket has no authentication or encryption; an opt-in safe mode (`BLENDER_MCP_SAFE_MODE=1`) checks scripts first. — [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Four CVEs were published against the community project in 2026. Known failure modes of LLM-driven Blender work: models trained on older code call functions changed or removed in 5.x; Blender returns `FINISHED` when an operator runs, not when it produced the intended result; screenshots do not reveal non-manifold geometry or an empty export. — [StraySpark, official Blender MCP comparison (vendor)](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026)

### Inferences
- For this owner the most valuable AI use is not generation but automation: `blender -b -P convert.py -- in.fbx out.glb` scripts, written and maintained by the coding agent, that import a purchased or CC0 file, rename bones to the house skeleton, strip non-deform bones, push every action to an NLA track so it exports, and write GLB. This is deterministic, testable in CI the way the game's own tests are, and uses no interactive session. The `FINISHED` caveat means each script should assert on its output (bone count, clip count, non-empty file) rather than trust the operator's return value.
- AI generation fits this game's props (sewer clutter, crates, rubble, plaques, weapons), where topology does not matter and flat or vertex-colour shading hides texture flaws. Budget: a 1,000-credit month at about 20 USD yields a few dozen textured props.
- AI-generated characters are not a shortcut to animated combatants. The chain "generate, auto-rig, apply library clips" works for bipeds in a T or A pose, but the weak link is deformation quality at shoulders and hips and the absence of weapon-combat clips in generator libraries (walk and run are what the rig step returns).
- The Hunyuan3D licence excludes the UK and EU by territory. If the owner is based in either, the open Hunyuan weights are not licensed for them, and hosted services that wrap Hunyuan need their own terms checked. TRELLIS.2 (MIT) has no such restriction but needs a 24 GB NVIDIA GPU on Linux, which a Mac-based developer does not have locally, so hosted services are the practical route.
- Meshy's free tier is CC BY 4.0: usable commercially but requires attribution and leaves outputs public. One paid month removes that for the assets made in it.

### Gaps
- Tripo's official pricing page returned 403; its plan names, credit costs for rigging and licence terms are unconfirmed. Hyper3D's own pricing page was not read.
- Meshy's per-operation credit costs are not on its pricing page.
- No independent, controlled comparison of generator topology or rig deformation quality was found; nearly every source is a vendor.
- Stable Fast 3D and its successors were not researched. Later Hunyuan3D versions (2.5, 3.x) and their licences were not found on the repository read.
- HY-Motion's licence text and output format were not on the page read; whether it shares Hunyuan3D's territorial exclusion is unknown.
- SayMotion pricing and quality were not read.
- AI texturing tools were not researched beyond the generators' built-in texturing.
- The official Blender Lab MCP pages (blender.org/lab, projects.blender.org) returned 403, so every detail about it is second-hand from a vendor that sells a competing server.

## 7. Art direction that suits a solo developer

### Takeaway
The proven pattern for solo and tiny teams is a deliberately low-fidelity, uniform style (low-poly, small or no textures, modern lighting on top), bought or reused animation, modular environments, and everything on one shared rig; the common thread in the examples found is that the developer was not an animator and bought the animation.

### Cited Findings
- Memoirium (solo Soulslike with a PS1 look): the developer built assets in Blender, capped textures at 256 by 256, and said "I knew that if I wanted to finish this game within my lifetime, I had to work quickly and efficiently"; not being an animator, they bought most animations from the Unreal Marketplace; they planned 3 to 4 years, part-time for the first two. — [80 Level, Memoirium](https://80.lv/articles/memoirium-building-a-soulslike-retro-game-as-a-solo-developer)
- Voin (solo hack-and-slash action RPG in Unreal): "retro modern graphics", meaning low-resolution textures and low-poly meshes with dynamic lighting and volumetric fog, chosen as "a compromise between a visually appealing game and one that runs smoothly"; bought marketplace packs and modified their textures; reusing marketplace assets is "essentially the only viable approach" for a solo developer, at the cost that some players recognise them. — [80 Level, Voin](https://80.lv/articles/making-hack-and-slash-action-rpg-voin-as-solo-developer/)
- KayKit's dungeon pack textures 200+ models from a single 1024 by 1024 gradient atlas that can be downsampled to 128 by 128. — [KayKit Dungeon Pack](https://kaylousberg.itch.io/kaykit-dungeon-remastered)
- Mortal Shell's small team kept character modelling in-house and outsourced retopology (search snippet). — [Epic developer interview, Mortal Shell](https://www.unrealengine.com/developer-interviews/mortal-shell-embodies-how-a-small-studio-can-punch-above-its-weight-class)
- Overgrowth, Receiver and Black Shades are cited as games animated with "very few key frames" plus procedural techniques. — [GDC Vault, An Indie Approach to Procedural Animation](https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach)
- (search snippet) A solo developer's postmortem found committing to "as low-poly as I can get" kept visuals cohesive and fast to produce. — [Dear Clockmaker postmortem](https://dreamnoid.itch.io/dear-clockmaker/devlog/1065157/dear-clockmaker-postmortem)

### Inferences
- The game's current look (faceted, per-pixel flat normals, vertex colour, three-step toon lighting on characters, procedural brick and water) is already a coherent low-poly style of the kind these developers chose on purpose. The gap a player will notice first is motion, not surface: box limbs posed by functions read as stiff next to skinned, clip-driven bodies. That argues for spending on animation and skeletons before meshes and textures.
- Three art directions in rising cost: (1) keep primitive-built bodies, add a skeleton and blend real clips onto it, nearly zero art cost; (2) swap in CC0 low-poly characters (KayKit, Quaternius) on a shared rig with flat or gradient-atlas materials, which matches the existing shader with no texture pipeline; (3) stylised PBR characters from packs such as Synty, which need textures, a new material path and a matching environment kit so nothing looks out of place.
- Mixing sources is the main risk to cohesion. Memoirium's rule (third-party models only if they blend in) and the single-atlas approach are the practical guards: one palette, one texel density, one shading model.
- For co-op with seven classes, readable silhouettes and class colour matter more than detail, which low-poly handles well.

### Gaps
- Neither 80 Level article gave hours or costs for art. No source quantified what share of solo development time art took.
- Well-known small-team examples such as Lethal Company, Valheim or Deep Rock Galactic were not researched this session, so they are not cited.

## 8. Environment art: kits, procedural texturing, and procedural placement

### Takeaway
The environments are the part least in need of a Blender pipeline: the cave, sewer and hall are generated from a scalar field with shader-drawn materials, which no kit can replace without rewriting collision and generation. Kits earn their place as dressing and props placed by the existing seeded generators, not as walls.

### Cited Findings
- KayKit Dungeon Pack: over 200 CC0 models free (275+ with the $7.95 tier), modular walls, floors, stairs and doors plus props (chests, barrels, tables, crates, traps, banners), FBX, GLTF and OBJ, 31 MB download, one shared gradient atlas. — [KayKit Dungeon Pack](https://kaylousberg.itch.io/kaykit-dungeon-remastered)
- Quaternius lists Modular Dungeon packs. — [quaternius.com](https://quaternius.com/)
- Synty POLYGON Dungeon Realms has 480 environment pieces, 62 buildings described as fully modular dungeons, and 373 props. — [Synty POLYGON Dungeon Realms](https://syntystore.com/products/polygon-dungeon-realms)
- Poly Haven supplies CC0 HDRIs, textures and models with no API key, and is reachable from the community Blender MCP server. — [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Blender's glTF exporter supports GPU instancing (`EXT_mesh_gpu_instancing`) for objects sharing mesh data, with the limits that instances must be meshes without children and share materials. — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- A solo developer building an open world made modularity the first rule, assembling the game from reusable blocks (search snippet). — [80 Level, Easy Delivery Co.](https://80.lv/articles/inside-the-making-of-easy-delivery-co)

### Inferences
- The game's worlds are not tile grids. Walls come from marching squares over a one-unit field, and the same field drives collision, sight, routing and the camera. Modular wall kits assume a grid of fixed-size pieces, so adopting one for structure would mean a new generator and new collision, and would break the rule that what is drawn matches what blocks. Kits should be limited to things that block nothing or have simple footprints.
- The sewer already has a dressing pass that places ribs, pipes, grates, lamps, brick heaps and plinths from a seeded stream. Authored props slot into exactly that pass: the generator picks a prop id and a transform from the seed, and the renderer instances a loaded mesh instead of a generated one. Determinism is preserved, which matters for co-op where every client must build the same world from a seed.
- Authored and generated meshes coexist cleanly if the authored ones follow the world's conventions: Y up, metres, vertex colours stored the way the world shader expects (or a second shader path), and no textures if the look stays flat. A build-time script can bake a prop's material colours into vertex colours so the page still needs no texture loads.
- Procedural texturing in the shader (the brick and water materials) should stay. Trim sheets and tiling PBR textures are the conventional alternative on Unity, Unreal or Godot, but they add a texture budget and UV work for no gain in a look that is already cohesive.
- On a full engine, the same seeded generators can emit engine meshes at run time (procedural mesh APIs exist in all of them) and scatter kit props. The generation code is the asset here, and it ports as logic, not as art.

### Gaps
- No source was read on procedural placement of kit pieces (wave function collapse, grid-based dungeon assembly) or on trim-sheet workflow; the statements above are reasoning from the project's own design.
- Kenney's modular dungeon kit page and formats were not read.
- No source was read on run-time mesh generation APIs per engine (other researchers cover the engines).

## 9. VFX and audio in brief

### Takeaway
Effects are code and small textures on every path, not Blender work: the game already draws slash ribbons, rings, sprites and blobs procedurally, and each engine has a particle system that replaces those calls. Sound is well served by free, royalty-free libraries.

### Cited Findings
- three.quarks is an MIT-licensed particle and VFX library for three.js with billboard, stretched billboard, mesh and ribbon-trail renderers, batched rendering for WebGL and WebGPU, a visual editor exporting JSON, and import of Unity Shuriken particle systems. — [three.quarks](https://github.com/Alchemist0823/three.quarks)
- Synty's Dungeon Realms pack includes 32 FX among its prefabs. — [Synty POLYGON Dungeon Realms](https://syntystore.com/products/polygon-dungeon-realms)
- Sonniss GDC Game Audio Bundles (2015 to 2024 archived, the 2024 bundle 23.5 GB in 9 parts, no 2025 bundle, a 2026 bundle on its own page): "All of the sounds are royalty free and commercially usable", no attribution, unlimited projects, may not be redistributed as sound effects, and "Use for AI/ML training is strictly prohibited under our license terms." — [Sonniss GDC game audio archive](https://sonniss.com/gameaudiogdc/)
- Kenney's game assets are CC0 and usable commercially without credit. — [Kenney support](https://kenney.nl/support)

### Inferences
- Background knowledge, not fetched this session: Unity's particle tools are the Shuriken Particle System and VFX Graph; Unreal's is Niagara; Godot's are GPUParticles3D and CPUParticles3D; Babylon.js and PlayCanvas have built-in particle systems; three.js has none built in, hence libraries such as three.quarks. Marketplace VFX packs are engine-specific (a Niagara system or VFX Graph asset does not move between engines), unlike meshes and animations.
- The game's current effects (ribbons for slashes, additive sprites for sparks, rings for warnings, ground blobs for shadows) are a small procedural effects system that would port to any engine as particle and trail emitters. Slash trails specifically are usually a ribbon attached to a weapon bone, which becomes easier once characters have real skeletons.
- Audio today is synthesised in code. Moving to sampled sound adds files to serve (compressed audio, typically the second largest download after textures) and a licence to track; Sonniss and Kenney cover most needs at no cost.

### Gaps
- Engine VFX documentation (Niagara, VFX Graph, Godot particles) was not read; the engine names above are unsourced background.
- Freesound, paid sound libraries and music sources were not researched.
- The 2026 Sonniss bundle page and its size were not read.

## 10. Budget and time

### Takeaway
Three tiers: 0 USD with CC0 assets and the owner's time; roughly 150 to 500 USD buys Auto-Rig Pro, a few weapon animation packs, a character or dungeon pack and a month or two of an AI generator; commissioning the full cast at 2026 studio rates is tens of thousands of dollars. No reliable source gives hours per character for a non-artist; the anecdotes point to modelling being quick and rigging, weight painting and animation being where beginners stall.

### Cited Findings
- Studio outsourcing ranges (vendor guide updated 6 September 2026): 3D character $1,000 to $6,000 (the body text says up to $10,000); character or prop rig $500 to $2,500; animation $200 to $600 per cycle (body text up to $1,000); hourly $60 to $150+ in North America and Western Europe, $30 to $80 in Eastern Europe, $20 to $60 in Southeast Asia. — [Pixune, game art outsourcing price guide (vendor)](https://pixune.com/blog/game-art-outsourcing-price/)
- (search snippets) Other 2026 figures: batch-priced NPC rosters at $800 to $2,500 per character; a stylised hero character takes two to four weeks; low-poly models $100 to $300; an Upwork rigged hand-painted character lists an animation add-on at +$75; a beginner Fiverr gig lists a rigged textured character at $50 to $100. — [Game-Ace, game artists for hire](https://game-ace.com/blog/game-artists-for-hire/); [Framesixty, 3D character modeling services](https://framesixty.com/3d-character-modeling-services/); [Upwork listing](https://www.upwork.com/services/product/video-audio-3d-character-with-hand-painted-textures-rigged-and-ready-for-animation-1966472059489542469)
- (search snippet) An animation pack seller quotes about $150 per custom or modified motion. — [Frank RPG Great Sword listing](https://www.unrealengine.com/marketplace/en-US/product/frank-rpg-great-sword)
- Tool and pack prices read this session: Auto-Rig Pro $50 ($25 Lite); KayKit source tiers $7.95 to $14.99 and character series $19.99; Synty Dungeon Realms $199.99 ($100 on sale) or SyntyPass from $30 a month; Fab greatsword pack GBP 14.51; Meshy Pro £16 a month; Rokoko Basic $12 a month; Move One Starter $18 a month; Quaternius Patreon $10 to $50 a month. — [Auto-Rig Pro](https://superhivemarket.com/products/auto-rig-pro); [KayKit Dungeon Pack](https://kaylousberg.itch.io/kaykit-dungeon-remastered); [Synty Dungeon Realms](https://syntystore.com/products/polygon-dungeon-realms); [Fab listing](https://www.fab.com/listings/58dbe678-f46e-41c3-86a1-4389ca77f94b); [Meshy pricing](https://www.meshy.ai/pricing); [Rokoko pricing](https://www.rokoko.com/pricing); [Move One pricing](https://docs.move.ai/knowledge/move-one-pricing); [Quaternius UAL 2](https://quaternius.com/packs/universalanimationlibrary2.html)
- Marketplace animation packs at $24.99 to $50 contain 100 to 200 clips each (search snippets). — [GreatSword Animset](https://assetstore.unity.com/packages/3d/animations/greatsword-animset-160113); [Longsword Animset Pro](https://marketplace.unity.com/packages/3d/animations/longsword-animset-pro-92239)
- Cascadeur has a free version and an Indie plan at about 12 EUR a month. — [Cinevva, AI animation generators (Sept 2026)](https://app.cinevva.com/guides/ai-animation-generators-3d)

### Inferences
- Tier (a), all free: Quaternius and KayKit animations and characters, Kenney and KayKit dungeon props, Mixamo for extra humanoid clips, Poly Haven, Sonniss audio, Blender, the Rokoko retarget add-on. Cash cost zero. The cost is integration time and a look constrained to what those packs offer.
- Tier (b), a few hundred dollars, an illustrative basket: Auto-Rig Pro $50, three weapon animation packs about $120, a stock crocodile $30 to $80, KayKit source files about $40, two months of Meshy about $40, Cascadeur Indie for three months about $40. Total roughly $320 to $370. A Synty pack or SyntyPass pushes it to $450 to $600.
- Tier (c), commissioned, my arithmetic on the Pixune low end: 20 characters at $1,000 for the model plus $500 for the rig is $30,000; about 10 bespoke clips each at $200 is another $40,000; so about $70,000 at the bottom of studio rates, and several times that at mid rates. Freelance marketplaces can undercut this by an order of magnitude with matching risk in quality and consistency. Commissioning only what cannot be bought (the crocodile's rig and special moves, perhaps a signature set per class) is the sensible use of this tier: at about $150 to $600 a clip, ten boss clips is $1,500 to $6,000.
- Price per clip is the striking ratio: packs work out at well under a dollar a clip, commissions at $150 to $600. Design the movesets around what packs contain wherever possible.
- Hours for a non-artist, an estimate without a citable source: a blocky low-poly humanoid mesh is an afternoon to a couple of days for a first attempt; rigging and weight painting by hand is where first-timers lose days, and auto-rigging (Mixamo, Auto-Rig Pro Smart, Meshy) cuts that to under an hour for bipeds; hand-animating a combat moveset is weeks per class for a beginner and is the step to buy rather than do. Integrating a bought pack per class (retarget, trim, time to the data tables, test) is plausibly one to three days with scripted conversion. These numbers are judgement, not data.

### Gaps
- No rate survey from a neutral body was found; every price guide is a vendor's blog, and they disagree with each other.
- Hours per character for a beginner: the search surfaced only anecdotes (a viewer comment of about 7 hours to model a stylised low-poly character following a tutorial; a student devlog reporting under 2 hours for a very simple model after failing at weight painting a detailed one). Those pages were not opened, so they are not cited.
- No per-second animation rate was found.

## 11. Web delivery constraints and download sizes

### Takeaway
Moving from one self-contained HTML page to a page plus asset files is technically simple on same-origin hosting but breaks the single-file publishing target unless assets are inlined, and it forces a choice between writing a small GLB loader for the custom renderer or adopting an engine. With a low-poly, shared-skeleton, untextured or atlas-textured style, a cast of about 20 animated characters can plausibly ship in single-digit to low tens of megabytes; unique 2K PBR textures per character multiply that several times.

### Cited Findings
- Quantization (`KHR_mesh_quantization`) needs no decoder, while Draco, meshopt and KTX2 need decoder or transcoder code shipped with the page; three.js reads quantized and WebP files with no setup. — [Cinevva, optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)
- Babylon.js loads its Draco, meshopt and KTX2 decoders from the Babylon CDN by default; they can be self-hosted by configuration. — [Babylon.js glTF loader docs](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF)
- Meshopt compresses vertex attributes, indices, morph deltas and animation keyframes; Draco leaves animation tracks untouched; resampling removes redundant keyframes, and on a clip baked at 60 fps "this can be most of the file" (the last from a search snippet of the same guide). — [Cinevva, optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)
- Textures dominate small models: a 680-triangle prop was 2.2 MB of which 98% was three 1024 PNGs, and 96 KB after resizing to 512 and converting to WebP. — [Cinevva, optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)
- A whole CC0 dungeon kit of 200+ models with its single atlas is a 31 MB download in three formats at once (FBX, GLTF, OBJ). — [KayKit Dungeon Pack](https://kaylousberg.itch.io/kaykit-dungeon-remastered)
- (search snippet, non-authoritative skills page) Suggested per-model budgets: mobile web 2 MB, 50K triangles, 1024 textures; desktop web 5 MB, 200K triangles, 2048 textures. — [asset-pipeline-3d skill page](https://skills.cat/skills/anthemflynn/dwc/asset-pipeline-3d)
- Unity's Asset Store guidance says users of a project should not be able to extract the raw asset files. — [Unity support: Asset Store assets with other engines](https://support.unity.com/hc/en-us/articles/34387186019988-Can-I-use-assets-from-the-Asset-Store-with-other-engines)
- Blender's exporter can write GLB (single binary), glTF Separate, or glTF Embedded, the last being "the least efficient". — [Blender 4.5 manual, glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)

### Inferences
- What changes when assets become files: (1) the build gains an asset step (Blender headless export, then glTF Transform or gltfpack) and `dist/` becomes a folder, not one file; (2) the project's rule of no run-time requests except fonts has to become "same-origin requests only"; decoders must be self-hosted, never pulled from a CDN; (3) loading becomes asynchronous, so the game needs a loading screen and the tests need assets available under headless Chromium; (4) the second publishing target, a single hosted HTML page whose content policy blocks outside loads, can only be kept by inlining assets as base64 (about a third larger, and all of it parsed before first frame), which is fine for a few megabytes and poor for tens; (5) pages opened from `file://` cannot fetch sibling files in most browsers, so the "open the file directly" route ends and a local server is needed for development.
- The custom renderer can load GLB without a dependency. GLB is a JSON chunk plus binary buffers; a loader for uncompressed or quantized meshes, skins and animation samplers is a few hundred lines, and skinning is one more vertex attribute pair (joints, weights) and a bone-matrix uniform array or texture in the existing shader. Avoiding Draco, meshopt and KTX2 keeps the no-dependency rule at the cost of larger files; gzip or brotli from the host recovers much of the difference for quantized data (8.1 MB gzipped versus 3.3 MB for meshopt in the one measured example above).
- Size estimate for about 20 animated characters, my arithmetic with stated assumptions: a low-poly character of 5,000 to 15,000 triangles is about 0.3 to 0.8 MB raw and 0.1 to 0.3 MB quantized and compressed; a rotation-only clip on a 50-bone skeleton at 30 Hz is about 24 KB per second raw, so a shared humanoid library of 100 clips averaging 1.5 seconds is about 3.6 MB raw and on the order of 1 MB after resampling and compression; creature clips add perhaps 1 to 2 MB. With vertex colours or one shared gradient atlas, the whole cast is roughly 5 to 15 MB. With a unique 2048 PBR set per character (base colour, normal, packed occlusion-roughness-metallic) at about 1 to 3 MB each as WebP, textures alone add 20 to 60 MB and several hundred megabytes of VRAM unless KTX2 is used. The style decision in section 7 is therefore also the download-size decision.
- Sharing one skeleton and one clip library across humanoids is the single biggest size lever: per-character baked animation copies would multiply the animation payload by the number of characters.
- Publicly served GLB files are trivially downloadable, which is harmless for CC0 assets and a licence question for paid ones (section 3).
- Co-op raises the stakes on load time and determinism: every client must have identical assets and the same generated world, so asset versions need cache-busting names and the seed-driven generators must not depend on asset load order.

### Gaps
- No measured sizes for a real cast of rigged, animated low-poly characters were found; the estimate above is arithmetic, not measurement. The quickest check would be to download the free KayKit Adventurers and Quaternius UAL files and run `gltf-transform inspect` on them.
- GitHub Pages limits on site size, file size and bandwidth were not checked this session.
- The typical-budget figures come from an unvetted skills page.
- PlayCanvas and three.js official documentation on compressed asset loading were not read directly.
