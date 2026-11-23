# AI agent development workflow by engine (as of 20 November 2026)

Reading notes for the writer. Web pages were read through a fetch tool that summarises with a small model, so quotes are short and some page details may be missing. GitHub figures (stars, last push) were read from the GitHub API on 2026-11-20. "Vendor" marks a source that sells a related product. "Snippet" marks a claim seen only in a search result, with the page itself not opened. Model names are given as the sources give them.

## 1. How much of a project is plain text an agent can read, diff and edit safely?

### Takeaway
A web engine used as a library and Godot 4 are text all the way down. Unity is text on disk but its scene and prefab YAML is a reference graph that agents get wrong often enough that Unity itself steers them to editor APIs. PlayCanvas editor projects live in the cloud editor and Unreal's gameplay assets (Blueprints, levels, materials) are reached only through editor tools.

### Cited Findings
- Current method: all `src/*.js` is concatenated by `node build.mjs`, tests drive `window.DF` at a fixed 60 steps per second in headless Chromium and write screenshots; everything is text in git. — [CLAUDE.md, local repo](/Users/maxlerman/Documents/Research/.research/dungeon-raze/CLAUDE.md)
- Godot 4.7 docs describe `.tscn` as "mostly human-readable and easy for version control systems to manage", with sections for external resources, internal resources, nodes and connections. Hand-written files are allowed; default-valued properties and `;` comments are dropped when the editor saves. Scenes saved by 4.6+ carry a numeric `unique_id` per node; `load_steps` is deprecated. — [Godot docs, TSCN format](https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html)
- Godot 4.4 added `.uid` sidecar files for scripts and shaders. They must be committed ("make sure .uid files are committed to version control"), and a script moved outside the editor must have its `.uid` moved with it or scenes that reference it warn until re-saved. Article dated 15 January 2025. — [Godot blog, UID changes](https://godotengine.org/article/uid-changes-coming-to-godot-4-4/)
- Independent report (ABA Games, 1 March, year not shown, Godot 4.6.1): "Godot's `.tscn` and `project.godot` files are plain text", references are less likely to break than under Unity's `.meta` and GUID model, and no MCP server is needed because the agent edits files and runs `godot --headless`. — [dev.to, ABA Games](https://dev.to/abagames/godot-is-well-suited-for-game-development-with-ai-coding-agents-2lcm)
- Independent report: an author built a whole UI with Claude Code editing `.tscn` and `.gd` files from the terminal and never opened the Godot editor ("Nothing about the toolchain demands a GUI"). — [vivecuervo7 dev blog](https://vivecuervo7.github.io/dev-blog/p/claude-code-godot)
- Unity prefab instances are stored as `PrefabInstance` documents whose source reference always uses fileID 100100000 with only the guid varying, and objects that live in a prefab but are referenced from a scene appear as "stripped placeholder" elements (snippet from the Unity 6.5 manual). — [Unity manual, prefab YAML](https://docs.unity3d.com/Manual/yaml-prefab-serialization.html)
- Unity staff post (thomas_jacobsen_unity, 23 October 2026, tagged Official): serialized assets are better handled through Editor APIs or the Unity CLI, because direct file edits risk invalid references or corrupted data. — [Unity Discussions](https://discussions.unity.com/t/tips-and-tricks-for-using-claude-code-codex-with-the-unity-cli/1740182)
- Vendor article (StraySpark, 21 October 2026, sells a Unity MCP server) quoting developers: the agent "gets the C# right and then does something daft with serialization or prefab instances"; Force Text serialization makes scenes and prefabs readable YAML that Claude Code can read and diff. — [StraySpark](https://www.strayspark.studio/blog/claude-code-unity-what-works-2026)
- Unity UI Toolkit layouts (UXML and USS) are plain text; the Project Aegis author calls this "probably the single biggest enabler" for agent-built UI. — [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog)
- Community guide: replacing a Unity prefab by hand needs the guid in the `.prefab.meta` and at least the root Transform fileID changed together (snippet). — [Uninomicon](https://uninomicon.com/metafiles)
- Unreal: Epic's own MCP plugin exists precisely to expose "engine functionality as tools that an AI agent can call" for Blueprints, Widget Blueprints, materials, MetaSounds, PCG, Niagara and Sequencer content, that is, for assets with no text route. — [Epic docs, Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor)
- Unreal text scripting alternative: Hazelight's UnrealEngine-Angelscript is "a set of engine modifications and a plugin for UE5"; scripts "can be reloaded instantly in the editor"; Split Fiction and It Takes Two "shipped with the majority of their gameplay written in angelscript". — [Hazelight Angelscript](https://angelscript.hazelight.se/)
- Epic said at State of Unreal (reported 19 June 2026) that in UE6 Verse largely replaces C++ as the core programming system and Blueprints will eventually be phased out over years, with UE6 early access expected "late next year" ("ish"). — [Edge, State of Unreal 2026](https://knowledge.edge-online.com/p/ai-goes-native-in-unreal-engine-the-five-main-takeaways-from-state-of-unreal-2026)
- PlayCanvas engine can be used standalone ("set up a project with npm and Vite"), published as ES modules, and can run headless in Node.js. — [PlayCanvas engine manual](https://developer.playcanvas.com/user-manual/engine/)
- PlayCanvas's official editor MCP server acts on "the project open in the connected Editor, one Editor at a time", and includes a VCS tool category, meaning editor project data is reached through the live browser editor and not through local files. — [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server)
- PlayCanvas Director (playcanvas org, created 2026-10-21, 2 commits, 1 star) is a local editor for engine-only apps where "the agent writes your edits into the source"; it "runs entirely on your machine". — [playcanvas/director](https://github.com/playcanvas/director)

### Inferences
- Rough share of a project an agent can edit as text with no engine tool running: web library route about 100%; Godot about 100% of authored data (scenes, resources, input map and settings in `project.godot`, animation trees as resources), with imported art still binary; Unity 100% readable but only code, UXML/USS, asmdefs and simple ScriptableObject YAML are safe to hand-edit; Unreal C++ plus `.ini` config only; PlayCanvas editor route close to none locally.
- Unreal `.uasset` and `.umap` files are binary, and a C++-only project still needs a map and usually data assets. This is long-standing background knowledge and was not confirmed from a page read this session. A script-heavy route (C++ that spawns everything, or Angelscript, which needs Hazelight's modified engine) reduces but does not remove editor-owned binaries.
- UE6's move to Verse means UE5 C++ and Blueprint gameplay code written in 2027 faces a port. That is a workflow risk particular to the Unreal route.
- The Godot `.uid` rule is the one text-format trap for a file-editing agent: create, move and delete `.uid` files with their scripts, and let `godot --headless --import` regenerate what is missing.

### Gaps
- No measured failure rate for agent hand edits of Unity YAML was found; the evidence is practitioner quotes and Unity's own advice.
- Whether Unreal 5.8/5.9 offers any text asset format for Blueprints was not found (the Edge article does not cover it).
- Where PlayCanvas editor projects are stored and how its built-in version control maps to git was not on the page read.

## 2. Can the engine build, run and test from the command line without a GUI, on macOS and in CI? Iteration time?

### Takeaway
All five can run tests from a terminal, but they differ in what "headless" loses: Chromium and Godot are light and scriptable, Unity needs a licence and loses rendering under `-nographics`, and Unreal needs a full editor process. No source gave trustworthy edit-to-result timings for Unity domain reloads or Unreal C++ builds.

### Cited Findings
- Godot 4.7 CLI: `--headless` is "`--display-driver headless --audio-driver Dummy`. Useful for servers and with `--script`"; `--fixed-fps` "Force a fixed number of frames per second. This setting disables real-time synchronization"; `--import` "Starts the editor, waits for any resources to be imported, and then quits"; `--export-release`; `--quit-after`; `--check-only` "Only parse for errors and quit (use with `--script`)"; `--time-scale`; `--write-movie`. — [Godot docs, command line](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)
- Godot Movie Maker mode records "non-real-time" output with "perfect frame pacing", to AVI or a "PNG image sequence", with `--write-movie`, `--fixed-fps` and `--quit-after N`. — [Godot docs, creating movies](https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html)
- ABA Games hit sandbox problems running Godot headless under an agent: default user-data directories may be unwritable, fixed by pointing `XDG_*` variables at project-local directories; web export needs export templates installed first. — [dev.to, ABA Games](https://dev.to/abagames/godot-is-well-suited-for-game-development-with-ai-coding-agents-2lcm)
- Unity 6.0: `-batchmode` suppresses dialogs and exits with code 1 on script exceptions; "You can't open a project in batch mode while the Editor has the same project open; only a single instance of Unity can run at a time". `-nographics`: "Unity doesn't initialize the graphics device", and "Automated workflows only work when you have a window in focus, otherwise you can't send simulated input commands". — [Unity manual, editor command line](https://docs.unity.com/en-us/engine/6000.0/manual/unity-editor/command-line-arguments/editor)
- Unity Test Framework CLI: `-runTests -batchmode -projectPath ... -testResults results.xml -testPlatform EditMode|PlayMode|<BuildTarget>`, `-testFilter`; `-runSynchronously` is Edit Mode only. The editor manual warns that with `-quit` the editor quits before in-progress tests finish. — [Unity Test Framework 1.4 reference](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html)
- Unity licence on a headless machine: Personal needs a `.ulf` file made once through Unity Hub and stored as a secret; Pro uses serial, email and password; a licence server gives floating seats. GameCI warns "Even if a license appears in Unity Hub, a `.ulf` file may not have been created". — [GameCI activation](https://game.ci/docs/github/activation)
- Unity CLI (official, 2026): `unity test . --mode EditMode --output results.xml`; "The CLI also works with no AI agent at all" for installing editors, headless builds and test suites; driving a running Editor needs the Pipeline package and Unity 6.0 LTS or later; `unity command` and `unity eval` drive the Editor without MCP and are described as faster and cheaper in tokens than MCP. "The CLI is free and separate from Unity AI." — [Unity CLI docs](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli); [Unity Discussions](https://discussions.unity.com/t/tips-and-tricks-for-using-claude-code-codex-with-the-unity-cli/1740182)
- Unreal (docs labelled 5.9): tests run from the editor or client executable with `-ExecCmds="Automation RunTest MySet.MySubSet;Quit"`, `-ReportExportPath=<path>` writes JSON and HTML, `-ResumeRunTest` continues a crashed run. — [Epic docs, run automation tests](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine)
- Unreal Gauntlet runs "all of the processes needed to execute a game" as a session, for example "four clients and a server", and needs no game-side test code. — [Epic docs, Gauntlet](https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-in-unreal-engine)
- Iteration evidence, Unreal via Epic's MCP (Puget Systems, 9 July 2026, independent, Claude Opus 4.8): agent responses took about 5 to 15 minutes each, "which broke the usual edit-test-adjust loop". — [Puget Systems hands-on](https://www.pugetsystems.com/?p=48127)
- Iteration evidence, Unity: Project Aegis's gate was compile, run tests, enter Play mode, check exceptions, exit; "press Play and fix" took 2 to 4 iterations per feature. StraySpark quotes a developer who stopped using an MCP bridge because "it kept disconnecting" during recompiles. — [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog); [StraySpark (vendor)](https://www.strayspark.studio/blog/claude-code-unity-what-works-2026)
- Iteration evidence, web: the current project's headless Chromium needs SwiftShader flags and takes "a few seconds per screenshot", which is why tests step the simulation directly. — [CLAUDE.md, local repo](/Users/maxlerman/Documents/Research/.research/dungeon-raze/CLAUDE.md)
- Claude of Duty (Three.js, about 55k lines) used GPU-backed headless Chromium with `baseline.mjs`, a per-pixel `imagediff.mjs` gate, `profile.mjs` and a scripted `playtest.mjs`. — [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty)

### Inferences
- Godot's `--headless` selects the headless display driver, so a screenshot run has to be windowed (fine on a Mac; a virtual display or GPU runner in Linux CI). Logic and network tests can stay headless. Godogen advertises "headless screenshots and video" recipes, so a workable capture route exists, but its mechanism was not read.
- Unity screenshot tests must run without `-nographics`, and the single-instance rule means each parallel agent needs its own project copy or worktree with its own import cache.
- Expected edit-to-result order, fastest first: web (rebuild plus Chromium launch), Godot (no compile step for GDScript), Unity (C# compile and domain reload each edit, then Play mode entry), Unreal (C++ build, editor start). This order is consistent with the reports above but the Unity and Unreal figures are not measured here.

### Gaps
- No sourced numbers for Unity 6 domain reload time or Unreal C++ incremental build time on a Mac.
- `UnrealEditor-Cmd`, `-nullrhi` and `-unattended` are not on the Epic page read; their current behaviour is unconfirmed.
- Whether Unity Play Mode tests and Unreal functional tests can capture real frames on macOS CI runners was not confirmed.

## 3. Automated gameplay testing: frameworks, fixed timestep, fake input, screenshots, and several networked instances on one machine

### Takeaway
The owner's pattern (step a simulation at fixed dt, assert on state, save screenshots) is native to the web route and has direct equivalents in Godot; Unity can do it through Play Mode tests; Unreal has the frameworks but the heaviest setup. For 4 to 5 player co-op, only the web and Godot routes make "launch N instances headlessly" trivial; Unity's editor tool tops out at four editor players.

### Cited Findings
- GUT 9.x targets Godot 4.x (9.7.1 for 4.7.x); runs as `godot -d -s --path "$PWD" addons/gut/gut_cmdln.gd` with `-gdir`, `-gtest`, `-gexit`, `-gjunit_xml_file`; exit code 0 on pass, 1 on failure. 2,785 stars, last push 2026-08-18. — [GUT command line docs](https://gut.readthedocs.io/en/latest/Command-Line.html); [bitwes/Gut](https://github.com/bitwes/Gut)
- gdUnit4 (master v7.0.0 for Godot 4.7; v6.2.x for 4.5 to 4.7.1) offers a CI runner, JUnit XML and HTML reports, a scene runner that simulates mouse, keyboard, input actions and touch, C# tests through VSTest, and a GitHub Action. — [gdUnit4](https://github.com/MikeSchulze/gdUnit4)
- A home-made Godot runner closest to the owner's method: each step is a GDScript file returning `""` or an error, chained from CLI flags, with `fast_*` steps that set state through the API and `ui_*` steps that send real clicks, writing JSONL plus timestamped screenshots that Claude reads; a file-polling `CommandWatcher` sends commands to the running game. — [vivecuervo7 dev blog](https://vivecuervo7.github.io/dev-blog/p/claude-code-godot)
- Godot tests can be plain scripts extending `SceneTree` run with `--script`; a screenshot with debug collision shapes let the agent fix in one pass a bug it could not fix from text, and some collision bugs passed headless tests, so human playtesting stayed necessary. — [dev.to, ABA Games](https://dev.to/abagames/godot-is-well-suited-for-game-development-with-ai-coding-agents-2lcm)
- The Flockbay benchmark runs each GDScript task "headless on Godot 4.7.2 at a fixed 60 fps" with a check scene that drives the code, which shows the fixed-step headless pattern working in Godot. — [dev.to, Flockbay (vendor)](https://dev.to/orellanaed/the-best-llm-for-godot-37fo)
- Unity Test Framework separates Edit Mode tests from "Play Mode tests that run in the Editor" and tests on a built player. Project Aegis reached 589 test methods by keeping game rules in pure C# testable without Play mode. — [Unity Test Framework reference](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html); [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog)
- Unity Multiplayer Play Mode 3.0: the main Editor player plus up to three additional Editor instances, and up to four locally built instances; requires Unity 6.3 LTS or later on Windows or Mac; additional instances cannot edit GameObjects. Since 2.0 most of it is part of the engine. The page does not say it can be driven from the command line or the Test Framework. — [Unity MPPM 3.0 docs](https://docs.unity3d.com/Packages/com.unity.multiplayer.playmode@3.0/manual/index.html)
- IvanMurzak/Unity-MCP provides `tests-run` (Edit and Play Mode), `screenshot-isolated`, console queries, a CLI that can start a headless editor, and tools that run inside a compiled game. — [IvanMurzak/Unity-MCP](https://github.com/IvanMurzak/Unity-MCP)
- Unreal: Epic's MCP plugin lists "running automation tests", screenshot tools, and image results dumped to disk; the community EngineWire server lists Play-In-Editor control, synthetic input and screenshots under `control_editor`. — [Epic docs, Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor); [ChiR24/Unreal_mcp](https://github.com/ChiR24/Unreal_mcp)
- Web multiplayer by agents, a caution: Simon Willison's Battle Drones (20 October 2026; TypeScript, Three.js, a stateless WebSocket relay; 321 agent commits) tested multiplayer by hand on real devices; WebRTC failed even on the same WiFi, and browser math differences desynchronised replays until `Math.sin` and `Math.cos` were replaced. — [Simon Willison](https://simonwillison.net/2026/Oct/20/battledrones/)
- Playwright drives Chromium, Firefox and WebKit from one API (100,623 stars, pushed 2026-11-20). — [microsoft/playwright](https://github.com/microsoft/playwright)

### Inferences
- Web: the present `test.mjs` harness extends to co-op by opening four or five pages (or browser contexts) against a local Node server in one test process and stepping each page's simulation. No new tool is needed.
- Godot: N instances are N processes (`godot --headless --path . -- --server`, then clients), each controllable by arguments after `--`; logic-level co-op tests can run fully headless and one windowed client can take screenshots.
- Unity: five players exceeds the four Editor players of Multiplayer Play Mode, so a 5-player automated test needs locally built players or batch-mode processes started by a script.
- Unreal: Gauntlet is the documented multi-process route and generally works against a built game, which makes each run minutes long.

### Gaps
- The New Stack article on agents testing 3D apps with Playwright refused the fetch (HTTP 403); not read.
- No write-up was found of agents running automated multi-client tests in Unity, Godot or Unreal.
- Whether gdUnit4 input simulation works under `--headless` is not stated on the page read.

## 4. Editor bridges for agents as of late 2026 (MCP servers, CLIs, vendor statements)

### Takeaway
Unity and Epic both shipped first-party agent access in 2026 (Unity: an official CLI with MCP mode and skills, after deprecating its in-editor MCP server; Epic: an experimental Unreal MCP plugin in 5.8 and an Unreal Assistant panel that hosts Claude Code). Godot has no first-party bridge but several active community ones, and its text formats make a bridge optional. PlayCanvas has an official editor MCP server.

### Cited Findings
- Unity, official: "Unity has deprecated the MCP server component of the in-editor AI assistant package `com.unity.ai.assistant`... The `unity mcp` command in the Unity CLI replaces the in-Editor server." "The MCP mode in the Unity CLI is not part of the deprecation." Commands include `unity pipeline install`, `unity mcp configure <client>` (claude, cursor, vscode, windsurf), `unity skill install <agent-name>`, `unity command`, `unity eval`. The local pipeline server accepts localhost only. — [Unity CLI docs](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)
- Unity's earlier in-editor MCP (AI Assistant 2.0.0-pre.1 docs): built-in tools for "scene management, asset operations, script editing, and console access", custom tools by attribute, and "Multiple MCP clients can connect to the same Unity instance simultaneously". It launched with the Unity AI open beta in May 2026 (snippet). — [Unity AI Assistant docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html); [Unity blog](https://unity.com/blog/unity-ai-mcp-how-to-get-started)
- Vendor claim, not confirmed on a Unity page: Unity's official Claude Code plugin with 29 skills launched 9 September 2026. — [StraySpark (vendor)](https://www.strayspark.studio/blog/claude-code-unity-what-works-2026)
- Unity, community: CoplayDev/unity-mcp, 16,079 stars, pushed 2026-11-17, v10.3.0 (2026-10-04), MIT, Unity 2021.3 LTS to 6.x, "50 focused MCP tool entrypoints" (scenes, GameObjects, C# scripts, assets, tests, profiling, builds), multi-instance routing, "maintained by Aura", which sells a paid assistant. IvanMurzak/Unity-MCP, 4,670 stars, pushed 2026-11-19, Unity 2022.3+, CI on 2022.3 through 6000.6, Apache-2.0 with PolyForm Shield parts. CoderGamester/mcp-unity, 2,019 stars, pushed 2026-10-11. — [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp); [IvanMurzak/Unity-MCP](https://github.com/IvanMurzak/Unity-MCP); [CoderGamester/mcp-unity](https://github.com/CoderGamester/mcp-unity)
- Unreal, official: "Unreal MCP is Experimental. Many features are still under development and APIs and data formats may change at any time." It runs inside the editor process on `http://127.0.0.1:8000/mcp`, has no authentication layer, runs tool calls one at a time on the game thread, and needs `-ModelContextProtocolStartServer` under a commandlet. The Unreal Assistant panel supports Claude Code, Codex, Cursor and OpenCode. — [Epic docs, Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor)
- Unreal, official statements: UE 5.8 shipped the MCP plugin in June 2026 and Epic demoed Claude controlling a project (Edge, 19 June 2026). Marcus Wassmer, EVP of Development, said Epic is "definitely using AI to develop code and features for Unreal Engine" with Claude and Codex (Game Developer, 28 October 2026). — [Edge](https://knowledge.edge-online.com/p/ai-goes-native-in-unreal-engine-the-five-main-takeaways-from-state-of-unreal-2026); [Game Developer](https://www.gamedeveloper.com/programming/unreal-engine-will-be-developed-with-ai-code-confirms-epic)
- Unreal, independent test of Epic's MCP (Puget Systems, 9 July 2026): a six-room greybox and a Blueprint light trigger worked in about five minutes; switching to ground-based player controls took over 25 minutes and "input still did not work"; a PCG city failed and the agent "acknowledged that it did not have the ability to construct PCG graphs from scratch"; conclusion "I would reach for MCP to accelerate iteration, not to fill a knowledge gap". — [Puget Systems](https://www.pugetsystems.com/?p=48127)
- Unreal, community: chongdashu/unreal-mcp, 2,120 stars, last push 2025-04-22 (stale); flopperam/unreal-engine-mcp, 1,120 stars, "now owned by Aura"; ChiR24/Unreal_mcp (EngineWire), 1,050 stars, pushed 2026-11-19, v0.6.0, UE 5.0 to 5.8, native C++ plugin covering Blueprints, levels, materials, Animation Blueprints, Niagara, PIE, input, screenshots, logs, tests; binaries work only with the engine minor they were built for. — [chongdashu/unreal-mcp](https://github.com/chongdashu/unreal-mcp); [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp); [ChiR24/Unreal_mcp](https://github.com/ChiR24/Unreal_mcp)
- Godot, community: Coding-Solo/godot-mcp, 6,711 stars, last push 2026-04-16 (launch editor, run project, capture debug output); hi-godot/godot-ai, 3,617 stars, created 2026-04-12, pushed 2026-11-19, MIT, needs Godot 4.7+, "46 tools and 120+ operations", self-reports "21,000+ monthly active installs", C# support is text-only; youichi-uda/godot-mcp-pro, 647 stars, "162 MCP tools" including input simulation and runtime analysis. — [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp); [hi-godot/godot-ai](https://github.com/hi-godot/godot-ai); [youichi-uda/godot-mcp-pro](https://github.com/youichi-uda/godot-mcp-pro)
- Godot's stance: no first-party agent tooling was found. The Foundation's contribution policy (reported 1 July 2026) bans "autonomous AI agent use or vibe coding" for contributions to the engine itself; the report says nothing about using AI to make games with Godot. — [GamingOnLinux](https://www.gamingonlinux.com/2026/07/godot-engine-to-get-stricter-on-ai-contributed-code/)
- PlayCanvas, official: editor-mcp-server (151 stars, pushed 2026-11-11, MIT), about 130 tools in 15 categories, client built into the Editor, supports Claude Code, Claude Desktop, Cursor and Codex; tool definitions cost about 43,000 tokens unless the client's tool search is used; "two servers take turns owning the Editor port". — [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server)
- Blender: the community MCP for Blender (ahujasid, 35,059 stars, pushed 2026-11-18) runs arbitrary Python, returns viewport and render views, and pulls from Poly Haven, Sketchfab and AI generators; its socket "has no authentication or encryption". An official Blender Lab MCP server (Blender 5.1+, add-on v1.0.3 of 2026-09-11) and an Anthropic Blender connector (28 April 2026) are reported by secondary sources (snippets). — [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender); [StraySpark on the official Blender server (vendor)](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026)
- Three.js and Babylon.js: the GitHub search found no widely used engine MCP server (largest Babylon.js one has 9 stars); Godogen's `engine-guide` skill covers Godot, Bevy, Babylon.js and three.js with headless capture recipes (7,370 stars, pushed 2026-11-19). — [davidvanstory/babylonjs-mcp](https://github.com/davidvanstory/babylonjs-mcp); [htdt/godogen](https://github.com/htdt/godogen)

### Inferences
- Every editor bridge shares one constraint: a running editor with one main thread. Epic states tool calls run one at a time; PlayCanvas allows one Editor per server; Unity forbids two processes on one project. Bridges therefore serialise agents where plain files and CLIs do not.
- The Unity move from in-editor MCP to a CLI, and Godogen dropping its bundled references because "each of those became something the agent does better on its own", point the same way: shell commands plus text are winning over large tool catalogues.
- Community bridges churn quickly (one leading Unreal server stale since April 2025, two taken over by the vendor Aura), so a workflow should depend on first-party CLIs and its own test harness, with MCP as an extra.

### Gaps
- The Epic page read is labelled 5.9; the exact tool list in 5.8 was not confirmed. A news report that "Unreal Engine 5.9 Preview was built mostly by AI agents" was seen only as a snippet.
- Blender Foundation's own page for its MCP server was not opened.
- Unity CLI release date and full command list were not on the pages read (the reference says to run `unity --help`).
- Whether the Babylon.js Editor ships its own MCP server is suggested only by a third-party repository description.

## 5. How well do frontier models write each language and API?

### Takeaway
By late 2026 the old GDScript weakness has largely gone for frontier models, and sources agree agents write solid Unity C#. The remaining weak spots are niche APIs (Unity DOTS), editor-owned data, and Unreal, for which no independent benchmark or strong report was found.

### Cited Findings
- Godot 4 benchmark (Flockbay, vendor, tests run 6 October 2026, 15 single-file GDScript tasks on APIs that changed from Godot 3, judged by running headless on 4.7.2): Claude Opus 5.5, Claude Sonnet 5.5 and GPT-6.1 Sol each 15/15 first try; Claude Haiku 4.5 11/15, with errors including a Godot 3 call ("Nonexistent function 'add_animation' in base 'AnimationPlayer'") and an untyped Array returned for `Array[Vector2i]`. Tasks are small and say nothing about large-project coherence. Repo has 0 stars. — [dev.to, Flockbay](https://dev.to/orellanaed/the-best-llm-for-godot-37fo); [flockbay/godot-llm-bench](https://github.com/flockbay/godot-llm-bench)
- Godogen once bundled an 828-line GDScript reference and 860 class pages to cover thin training data, then dropped them: "As models got better, each of those became something the agent does better on its own." — [htdt/godogen](https://github.com/htdt/godogen)
- Vendor opinion (Summer Engine, snippet): the main recurring GDScript failure is Godot 3 syntax learned from old tutorials. — [Summer Engine](https://www.summerengine.com/blog/best-llm-for-godot)
- Unity C#: "It writes solid C#" (developer quoted by StraySpark). Project Aegis: 328 C# files, 42,628 lines, 0 compile errors at the end, but "ECS/Burst work was the hardest area" because DOTS is less represented in training data, and Opus hallucinated less than weaker models. — [StraySpark (vendor)](https://www.strayspark.studio/blog/claude-code-unity-what-works-2026); [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog)
- TypeScript and Three.js: agents wrote about 55k lines across 11 subsystems for Claude of Duty with `three` as the only dependency, and Battle Drones' author "reviewed almost none of the code". — [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty); [Simon Willison](https://simonwillison.net/2026/Oct/20/battledrones/)
- Unreal: the AutoUE paper (ACL 2026 Findings) uses retrieval over UE tool documentation specifically "to reduce tool-use hallucinations". Epic's MCP docs note Live Coding does not pick up new `UFUNCTION` declarations, so some C++ changes need an editor restart. — [arXiv 2603.07106](https://arxiv.org/abs/2603.07106); [Epic docs, Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor)

### Inferences
- For this project the language risk ranks: TypeScript or JavaScript (lowest, and the existing 19,000 lines carry over), Unity C#, GDScript (now close to C# for frontier models; pin "Godot 4.7, typed GDScript" in CLAUDE.md), Unreal C++ (macros, reflection, modules and build files give more ways to fail, each failure costing a long build).
- Godot with C# is weaker for agents than GDScript in tooling terms: godot-ai's C# support is text-only and reports no compiler errors.

### Gaps
- No independent benchmark compares the same model across GDScript, Unity C#, Unreal C++ and Three.js.
- No experience report with numbers was found for agents writing Unreal C++.
- Babylon.js was not separately evidenced; reports found were Three.js.

## 6. Documented cases of substantial games built mostly by agents, per engine

### Takeaway
The strongest documented cases are web (Three.js) and Unity; Godot has many small ones plus the Godogen pipeline; Unreal has demos and announcements but no detailed agent-built game report was found. Everywhere, the human work that remained was playtesting, direction and art judgement.

### Cited Findings
- Web: DungeonRaze itself, about 19,000 lines with a custom WebGL renderer, built by one agent and verified by about 25 scripts and screenshots, never hand-tuned for feel. — [CLAUDE.md, local repo](/Users/maxlerman/Documents/Research/.research/dungeon-raze/CLAUDE.md)
- Web: Claude of Duty (repo created 2026-07-25, 3,532 stars), "three rounds of six agents each owning one directory" plus "eleven independent adversarial critics"; scores rose from 3.59 to 5.05 out of 10 and "every critic in every round picked the real Call of Duty frame"; 28 to 30 fps at Retina resolution; single-player. — [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty)
- Web: Battle Drones (July to October 2026), an RTS in TypeScript and Three.js with online play through a WebSocket relay, built by Claude Code with overnight multi-agent runs; early versions were not fun; multi-agent orchestration "burns tokens like there's no tomorrow". — [Simon Willison](https://simonwillison.net/2026/Oct/20/battledrones/)
- Unity: Project Aegis (17 March 2026), Unity 6, URP, DOTS, UI Toolkit; about 20 days, 309 sessions, 42,628 lines, 589 tests, 57 auto-created prefabs; "Not a single click was made in Unity3D" using Claude Code and MCP for Unity. Problems: Claude "silently dropped hero abilities and unit auto-engagement", the MCP bridge slowed, fixes addressed symptoms, context rot caused unrequested refactors, and playtesting still found bugs. — [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog)
- Godot: an RTS where Claude wrote all code (June 2025) was abandoned; the author "had lost control over how it worked and couldn't fix it myself". — [dev.to, Lucca Sanwald](https://dev.to/datadeer/part-1-building-an-rts-in-godot-what-if-claude-writes-all-code-49f9)
- Godot: Godogen (7,370 stars) began as a pipeline generating complete Godot 4 projects from a prompt (demos dated 14 March 2026) and is now a pair of skills that "does not plan the work, check the agent's output, or decide when a task is done". — [htdt/godogen](https://github.com/htdt/godogen)
- Godot: other reports found by search and not opened include a hanafuda card game shipped in two days and a 3D tower defense built by an agent. — [dev.to, morinaga](https://dev.to/morinaga/i-shipped-a-polished-hanafuda-card-game-in-2-days-with-claude-and-godot-5a7j); [dev.to, salvo10f](https://dev.to/salvo10f/an-ai-agent-built-a-complete-3d-tower-defense-in-godot-heres-how-lpd)
- Unreal: a solo action RPG author (21 June 2026) describes AI as "a structured development partner" while "I still make the design decisions, review the code, validate the behavior in Unreal Engine"; no tools, sizes or failures are given. — [Unreal forums](https://forums.unrealengine.com/t/ai-assisted-solo-development-of-a-modular-unreal-engine-5-action-rpg/2730299)

### Inferences
- The projects that held together (Aegis, DungeonRaze, Claude of Duty) share a strict architecture, a written plan and an automated gate. The one that collapsed (the Godot RTS) had informal playtesting only. The method matters more than the engine, and the engine matters to the extent it lets the gate run unattended.
- None of the documented agent-built games is an online co-op action game with 4 to 5 players and automated multi-client tests. That part is unproven in every engine.

### Gaps
- No PlayCanvas editor project built mainly by agents was found.
- No verified Unreal game built mostly by agents with a write-up of what failed was found; forum claims of 100k-line projects were not verified.
- Fly.pieter.com and other 2025 vibe-coded web games were not researched this session.

## 7. Parallel agents and version control

### Takeaway
Parallel agents on branches work as today on the web and Godot routes because every file merges as text. Unity can do it with worktrees and care around scenes. PlayCanvas's editor and Unreal's binary assets push toward one writer at a time.

### Cited Findings
- Unity staff advice: use a Git checkpoint or isolated worktree before long tasks and "Split by task, not by code layer"; splitting one feature across two subagents produced mismatched events and fields. — [Unity Discussions](https://discussions.unity.com/t/tips-and-tricks-for-using-claude-code-codex-with-the-unity-cli/1740182)
- Unity ships UnityYAMLMerge, which "merges scene and prefab files in a semantically correct way" for `.unity`, `.prefab` and `.meta`; other YAML assets (`.asset`, `.mat`, `.controller`) need `--force`; "Always check the exit code. Exit code `2` or `3` means that conflicts remain", and on macOS it can return 0 even when the fallback tool errors. — [Unity manual, Smart Merge](https://docs.unity.com/en-us/engine/current/manual/get-started/project-configuration/version-control/smart-merge)
- Unity allows one process per project. CoplayDev's server documents multi-instance routing for several editors. — [Unity manual, editor command line](https://docs.unity.com/en-us/engine/6000.0/manual/unity-editor/command-line-arguments/editor); [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp)
- Project Aegis abandoned per-phase sub-agents because they needed too much confirmation. — [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog)
- Godot: the vivecuervo7 project used `.claude/rules/` files to front-load conventions for parallel background agents. — [vivecuervo7 dev blog](https://vivecuervo7.github.io/dev-blog/p/claude-code-godot)
- Unreal: before One File Per Actor, editing a level "locked other team members out of that file"; OFPA stores each actor in its own external file, warns that partial submits can leave "dangling references", and its changelist support works only with Perforce. — [Epic docs, One File Per Actor](https://dev.epicgames.com/documentation/en-us/unreal-engine/one-file-per-actor-in-unreal-engine)
- Unreal's MCP server runs tool calls one at a time on the game thread, and clients should not send overlapping calls. — [Epic docs, Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor)
- PlayCanvas: one Editor per MCP server, and each agent needs its own server entry because "two servers take turns owning the Editor port". — [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server)
- Claude of Duty's rule for parallel agents: each of six agents owned one directory. — [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty)

### Inferences
- Web and Godot: git worktrees, one branch per agent, no locks. In Godot keep scenes small and composed so two agents rarely touch one `.tscn`.
- Unity: one worktree and one editor per agent, each paying its own import cache; UnityYAMLMerge configured as the merge driver; scenes assembled by code or by editor scripts so that few branches edit `.unity` files.
- Unreal: binary assets cannot be merged, so parallel agents must own disjoint assets or keep to C++; the engine's team workflow assumes Perforce locking.
- Git LFS is needed wherever binary art enters (all engines with imported models and textures) and is essential for Unreal content. This is general practice and was not sourced this session.

### Gaps
- No report was found of several agents working concurrently on one Unity, Godot or Unreal project with measured conflict rates.
- How PlayCanvas editor branches behave with several agents was not researched.

## 8. Tasks that still need a human at a GUI, and whether a script route exists

### Takeaway
Scripted routes now exist for almost every editor task in every engine, but reports agree that spatial layout, animation and game feel are where agents are weakest regardless of tool, and that a human still has to play the game.

### Cited Findings
- Unity: with editor access an agent can do structural scene work such as spawning a grid and renaming a hundred objects; positions, animation and game feel stay weak ("No tool fixes these"); "runtime bugs are still entirely mine to find" without a way to play. — [StraySpark (vendor)](https://www.strayspark.studio/blog/claude-code-unity-what-works-2026)
- Unity: Project Aegis needed no editor clicks; prefabs, ScriptableObjects, UXML layouts and scene changes were all generated, and specific event-to-feedback plans worked better for juice than "make kills feel impactful". — [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog)
- Unreal: tools exist for Blueprints, Widget Blueprints, materials, MetaSounds, PCG, Niagara and Sequencer, yet in an independent test PCG graph authoring failed and player input setup failed after 25 minutes. — [Epic docs, Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor); [Puget Systems](https://www.pugetsystems.com/?p=48127)
- Unreal community server lists Animation Blueprints, montages, Control Rig, ragdolls and Niagara modules as scriptable. — [ChiR24/Unreal_mcp](https://github.com/ChiR24/Unreal_mcp)
- Godot: godot-ai covers scenes, signals, UI, materials, animation, particles, cameras and environments; godot-mcp-pro lists animation, physics, particles, audio and shaders. — [hi-godot/godot-ai](https://github.com/hi-godot/godot-ai); [youichi-uda/godot-mcp-pro](https://github.com/youichi-uda/godot-mcp-pro)
- Godot layout by text: positioning by description was "genuinely frustrating" until a dev grid overlay gave author and agent shared coordinates. — [vivecuervo7 dev blog](https://vivecuervo7.github.io/dev-blog/p/claude-code-godot)
- PlayCanvas editor MCP has Animation, Templates, Viewport and Assets tool categories. — [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server)
- Art pipeline: MCP for Blender lets an agent run Python and inspect viewport and render views; skills packs for Blender cover modelling, UVs, baking and rigging (EL4CTEO/blender-skills, 2,454 stars, created 2026-10-14). Godogen's `asset-gen` covers textured and rigged 3D through paid APIs or a local NVIDIA GPU. — [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender); [EL4CTEO/blender-skills](https://github.com/EL4CTEO/blender-skills); [htdt/godogen](https://github.com/htdt/godogen)
- Web: in Claude of Duty every texture, mesh, animation and sound is generated from code, and the stated weak points are hands, close-range surfaces and distant enemies. — [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty)

### Inferences
- Per task, script route by engine. Animation state machines: code in web; text resources or code in Godot; `.controller` YAML through editor API in Unity; Animation Blueprint tools in Unreal (least proven). Level layout: generated in code in all (as DungeonRaze does now), which avoids the weakest agent skill. Materials and VFX: code or shader text in web and Godot; Shader Graph and VFX Graph in Unity and Niagara in Unreal are graph assets needing a bridge. Import and retargeting of animations: Blender scripting before the engine in every route.
- The work that stays human in all five: playing for feel, judging screenshots for art quality, and deciding scope. Moving to an engine does not remove the owner's unanswered playtest.

### Gaps
- No source measured agent success at animation state machine authoring or retargeting in any engine.
- Unity Shader Graph and VFX Graph editing by agents was not evidenced either way.

## 9. Ranking by agent-friendliness for this project, and the setup for each route

### Takeaway
For an owner who does not hand-write code and whose method is text, one build command, fixed-step tests and screenshots, the order is: web engine as a library (1), Godot 4 (2), Unity 6 (3), PlayCanvas editor-centric (4), Unreal 5 (5). Places 1 and 2 keep the method intact; 3 keeps it with an editor in the loop; 4 and 5 replace it with a live-editor bridge. The gap between 3 and 4 is a judgement call.

### Cited Findings
- Route 1 evidence: the method already works at 19,000 lines here; 55k-line and multiplayer Three.js projects were agent-built in 2026; Playwright and headless Chromium are the test substrate. — [CLAUDE.md, local repo](/Users/maxlerman/Documents/Research/.research/dungeon-raze/CLAUDE.md); [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty); [Simon Willison](https://simonwillison.net/2026/Oct/20/battledrones/)
- Route 2 evidence: text scenes, a full CLI with `--headless`, `--fixed-fps`, `--import` and `--quit-after`, two maintained test frameworks, frontier models at 15/15 on a Godot 4 benchmark, and reports of whole UIs built without opening the editor. — [Godot docs, command line](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html); [dev.to, Flockbay (vendor)](https://dev.to/orellanaed/the-best-llm-for-godot-37fo); [vivecuervo7 dev blog](https://vivecuervo7.github.io/dev-blog/p/claude-code-godot)
- Route 3 evidence: a first-party CLI with test, build, `command`, `eval`, MCP mode and skills; a 42,628-line game built with zero editor clicks; but scene and prefab edits must go through the editor, one process per project, and a licence on every machine. — [Unity CLI docs](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli); [Project Aegis devlog](https://cxyda.github.io/ProjectAegisDevLog); [GameCI activation](https://game.ci/docs/github/activation)
- Route 4 evidence: an official MCP server of about 130 tools, bound to one open browser Editor; the engine-only mode is route 1 by another name. — [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server); [PlayCanvas engine manual](https://developer.playcanvas.com/user-manual/engine/)
- Route 5 evidence: first-party MCP is labelled Experimental, calls are serial on the game thread, an independent test found 5 to 15 minute turns and failed core tasks, and Epic plans to replace C++ and Blueprints with Verse in UE6. — [Epic docs, Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor); [Puget Systems](https://www.pugetsystems.com/?p=48127); [Edge](https://knowledge.edge-online.com/p/ai-goes-native-in-unreal-engine-the-five-main-takeaways-from-state-of-unreal-2026)

### Inferences
Recommended setup per route, so the present method carries over:

1. **Web engine as a library (Three.js, Babylon.js or PlayCanvas engine-only), TypeScript.**
   - Tools: Vite and `tsc` for a one-command build; Playwright in place of the raw Chromium script; a Node WebSocket server in the same repo for co-op.
   - Harness: keep `window.DF`, `DF.sim(seconds, eachStep)` and screenshot review. Add a co-op test mode that starts the server, opens four or five pages in one test, steps each and asserts they agree. Keep the simulation deterministic and free of renderer calls so the server can run it in Node.
   - Conventions: ES modules replace the single concatenated scope; one directory per agent lane; keep CLAUDE.md as the contract; generate content in code as now.
2. **Godot 4.7, GDScript.**
   - Tools: `godot --headless --import` after file changes, GUT or gdUnit4 from the CLI with JUnit output, optional godot-ai for editor-only operations. No MCP is required.
   - Harness: a `DF`-style autoload exposing state; tests run with `--fixed-fps 60 --quit-after N`; logic and network tests headless with several processes; one windowed run for screenshots saved as PNG and read by the agent; a debug-draw flag for collision shapes.
   - Conventions: pin "Godot 4.7, typed GDScript, no Godot 3 APIs" in CLAUDE.md; commit `.uid` files and move them with scripts; small composed scenes; redirect user-data directories into the project for sandboxed agents.
3. **Unity 6.3 LTS or later, C#.**
   - Tools: the Unity CLI (`unity test`, `unity build`, `unity command`, `unity eval`) with Unity's skills; CoplayDev or IvanMurzak MCP only if a needed editor operation is missing; UnityYAMLMerge as the git merge driver; Force Text serialization.
   - Harness: game rules in plain C# assemblies with Edit Mode tests; Play Mode tests that step a fixed dt and capture screenshots (not under `-nographics`); Multiplayer Play Mode for up to four players by hand and built players launched by script for five.
   - Conventions: the agent never hand-edits `.unity`, `.prefab` or `.meta`; scenes and prefabs are built by editor scripts kept in git; UI Toolkit, not uGUI; one worktree and editor per agent; a licence plan for every machine that runs tests.
4. **PlayCanvas, editor-centric.**
   - Tools: the official editor MCP server with tool search on, a browser tab kept open per agent, Playwright against the launched build.
   - Harness: the present one, since the runtime is JavaScript in a browser.
   - Conventions: treat the cloud project as the source of truth and export builds to git for review; expect one agent at a time per project. If parallel agents and git matter, use the engine-only mode (route 1) and watch Director.
5. **Unreal Engine 5.8 or 5.9, C++.**
   - Tools: Epic's Unreal MCP plugin (or EngineWire) for assets, the Automation framework from the command line with `-ReportExportPath`, Gauntlet for multi-client runs, Git LFS or Perforce.
   - Harness: functional tests in C++ that spawn the level in code, screenshots through the MCP screenshot tools.
   - Conventions: gameplay in C++ with assets created only through scripted tools, disjoint asset ownership per agent, and a budget for long builds and for the UE6 Verse transition.

### Gaps
- The ranking weighs agent workflow only. Rendering quality, netcode libraries, asset stores and cost are other researchers' topics and could reorder the final choice.
- No route has a documented, agent-built, automatically tested 4 to 5 player co-op action game; the co-op test harness is new work in all five.
- Real edit-to-result timings on the owner's Mac for Unity and Unreal were not measured and should be before committing to either.
