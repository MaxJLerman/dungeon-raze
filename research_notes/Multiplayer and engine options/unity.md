# Unity as the platform for rebuilding DungeonRaze as a 4 to 5 player co-op action game (state as of 20 November 2026)

Notes on method. All pages were read on 2026-11-20. Where a finding comes only from a search-result summary and the article itself was not opened, it is marked "(search summary only)". Third-party blogs are marked as such. 17 of the 18 permitted web searches were used. Reddit and Fandom were not attempted. One third-party page (strayspark.studio) carried embedded text addressed to AI readers; it was ignored and the page is treated as low authority.

## 1. State of Unity in late 2026: versions, licensing and pricing, company direction

### Takeaway
Unity is on a steady footing compared with 2023 to 2024: the Runtime Fee is gone, Personal is free up to $200K with no forced splash screen, Pro is $2,310 per seat per year after a 5% rise in January 2026, and the company posted its first GAAP profit in Q3 2026. The engine is mid-transition: Unity 6.3 is the current LTS, 6.6 is the current Update release, 6.7 (next LTS) is in beta and Unity 7 (CoreCLR, .NET 10) is due as a preview in December 2026 and a full release in Q1 2027.

### Cited Findings
- Unity's release policy: one LTS release a year supported for two years (one more year for Enterprise and Industry); several "Update" releases a year, each supported only until the next one ships. Unity recommends Update releases for new and mid-cycle productions and LTS for projects about to lock a version — [Unity releases](https://www.unity.com/releases)
- Unity 6.0 LTS was supported through October 2026; Unity 6.3 LTS is the "Latest LTS release" and is supported until December 2027 — [Unity 6 support page](https://unity.com/releases/unity-6/support)
- Unity 6.3 LTS was released in early December 2025 (article dated 5 December 2025) — [CG Channel](https://www.cgchannel.com/2025/12/unity-6-3-lts-is-out-see-5-key-features-for-cg-artists/) (search summary only)
- Unity's documentation version selector, read 2026-11-20, labels 6000.3 "LTS", 6000.6 "Current", 6000.7 "Beta" and 7000.0 "Alpha". Editor versions are numbered 6000.x for Unity 6.x — [Unity docs, Burst float determinism page (6000.7)](https://docs.unity.com/en-us/engine/6000.7/manual/programming-environment/script-compilation/burst/compilation/float-precision-determinism)
- Unity 6.4 shipped on 19 March 2026 according to a third-party blog summarising Unity's roadmap; the same blog lists 6.5 (CoreCLR lifecycle API), 6.6 (fast enter-play-mode default, 64-bit WASM), 6.7 (Surface Cache GI, experimental CoreCLR desktop player) and 6.8 — [StraySpark blog, 16 Aug 2026](https://www.strayspark.studio/blog/unity-6-4-to-6-8-roadmap-indie-developers-2026) (third party, low authority)
- Unity 7 was announced at Unite Seoul. Unity's recap (21 July 2026) says the Preview launches in December with full release targeted for Q1 of the following year, with "no breaking changes"; it ships CoreCLR with .NET 10 and C# 14, official .NET debuggers, MSBuild support and a code reload model that reloads only what changed. Unity 6.7 is named as an LTS — [Unity blog, Unite Seoul 2026 keynote recap](https://unity.com/blog/unite-seoul-keynote-2026-recap)
- Game Developer reports the same timing (early beta December 2026, final early 2027), quotes Unity calling Unity 7 a "direct continuation" of Unity 6 with "zero rebuilding", and notes this is a company promise — [Game Developer, 21 July 2026](https://www.gamedeveloper.com/programming/unity-unveils-unity-7-roadmap-with-update-path-that-won-t-break-your-build)
- The Runtime Fee was cancelled on 12 September 2024 and never applied to any game — [Unity pricing updates](https://unity.com/products/pricing-updates)
- Unity Personal is free for revenue and funding up to $200,000 in the prior 12 months (the threshold was raised to $200,000 when Unity 6 launched on 17 October 2024; the earlier cap, $100K from memory, was not legible on the page as fetched). The "Made with Unity" splash screen is optional with Unity 6 on Personal — [Unity pricing updates](https://unity.com/products/pricing-updates)
- Unity Pro, read 2026-11-20: $2,310 per seat per year prepaid, or $210 per seat per month. It is required above $200K revenue or funding. Enterprise (custom price) is required above $25M. A 5% increase applied from 12 January 2026 at purchase or renewal — [Unity pricing updates](https://unity.com/products/pricing-updates); [Unity compare plans](https://unity.com/products/compare-plans)
- The 2025 change was an 8% rise to $2,200 per seat per year — [Unity pricing updates, via search summary](https://unity.com/products/pricing-updates) (search summary only for the 2025 figure)
- Unity describes its policy as "predictable, annual price adjustments"; no figures beyond 2026 are given — [Unity pricing updates](https://unity.com/products/pricing-updates)
- From Unity 6.3, Havok Physics is no longer included with Pro, Enterprise or Industry — [Unity pricing updates](https://unity.com/products/pricing-updates)
- From 1 March 2026 Unity DevOps has unlimited seats, 25 GB free storage, and free monthly build minutes (200 Windows, 100 Mac, 100 Linux); free users can build for iOS and macOS in the cloud — [Unity pricing updates](https://unity.com/products/pricing-updates)
- Q3 2026: revenue $622M (up 32% year on year), GAAP net income $122M (first GAAP profit since the IPO), driven by the Vector ad platform (up 126%). The ironSource Ads Network was sunset in Q2 2026 and Supersonic publishing was sold on 4 August 2026 — [Inven Global](https://invenglobal.com/articles/28232/unity-posts-first-gaap-profit-since-ipo-as-q3-revenue-hits-622m); [mobilegamer.biz](https://mobilegamer.biz/unity-posts-first-profit-since-its-ipo-as-vector-grows-126/) (search summaries only)
- Unity shut down its own Multiplay Game Server Hosting on 31 March / 1 April 2026 (see section 3) — [Unity status notice](https://status.unity.com/info_notices/362941)
- A GDC 2026 survey, cited second-hand, puts engine use at Unreal 42%, Unity 30%, Godot 11% — [ziva.sh](https://ziva.sh/blogs/godot-multiplayer) (search summary only, second-hand)

### Inferences
- A project started now would sensibly begin on 6.3 LTS (supported to December 2027) or on the 6.6 Update release, and expect to move to 6.7 LTS and then Unity 7 during development. Unity's "no breaking changes" claim for Unity 7 is unproven until the December 2026 preview is in developers' hands; the CoreCLR switch is the largest runtime change in the engine's history and third-party packages are the likely weak point.
- For a solo developer under $200K, the engine costs nothing and carries no royalty. The financial risk is not today's price but repeated annual rises and a company whose profit comes from advertising, not the engine.
- The company's finances are no longer a near-term risk. Its record of withdrawing services (Multiplay hosting, ironSource Ads, Supersonic) is the pattern to plan around: avoid building on Unity-run back-end services that have no drop-in replacement.

### Gaps
- Exact release dates of 6.1, 6.2, 6.5 and 6.6 were not confirmed from Unity's own pages (from memory 6.1 was April 2025 and 6.2 August 2025; not re-verified). The release archive page did not render through the fetch tool.
- The StraySpark roadmap details (6.5 to 6.8 contents) were not checked against Unity's own roadmap page.
- No layoffs in 2026 were found; earlier rounds (2024 to 2025) were not re-researched.

## 2. Networking options in 2026 and their fit for 4 to 5 player co-op PvE

### Takeaway
There is no single default, but four realistic choices: Netcode for GameObjects (first-party, free, now at 3.x with the "unified netcode" merge with Netcode for Entities), Photon Fusion 2 (most complete prediction and relay, paid above 100 CCU), FishNet and Mirror (free, open, community-run). For 4 to 5 friends with a few dozen server-run enemies, a player-hosted (listen server) model over a free relay is what shipped indie co-op hits use, and every listed library handles that scale.

### Cited Findings
**Netcode for GameObjects (NGO)**
- Latest version 3.2.1, dated 5 November 2026. 3.0.0 (14 September 2026) made Netcode for Entities a hard dependency and renamed editor assemblies and timing types; 3.2.1 "removed the note that the unified netcode is experimental". The 2.x line ran from 2.0.0 (12 September 2024) to 2.13.3 (14 September 2026) — [NGO changelog](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/changelog/CHANGELOG.html)
- Distributed authority first appeared in 2.0.0-exp.2 (April 2024) and client anticipation (`AnticipatedNetworkVariable<T>`, `AnticipatedNetworkTransform`) in 2.0.0-pre.2 (June 2024) — [NGO changelog](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/changelog/CHANGELOG.html)
- NGO 3.2 requires Unity 6.0 or later, supports Mono and IL2CPP, and lists Windows, macOS, Linux, iOS, Android, XR, consoles (by arrangement) and WebGL (NGO 1.2.0+ with Unity Transport 2.0.0+) — [NGO 3.2 manual](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/manual/index.html)
- Topologies: client-server (dedicated server, or a listen server where one player hosts) and distributed authority (clients share ownership; a light central service routes traffic and no server simulates the game). Unity's guidance: client-server "suits projects that need a trusted server or client-side prediction with rollback"; distributed authority suits simple spawning of visually synchronized objects and is more open to cheating. A listen server adds no hosting cost but is a single point of failure — [NGO network topologies](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/manual/terms-concepts/network-topologies.html)
- A shipped co-op example on distributed authority: Dagger Directive (2 or 4 player co-op) uses Unity 6, NGO, Relay and distributed authority; the developer calls host migration "nearly seamless" and says cheating matters less in co-op with friends — [Unity blog, 29 Sep 2025](https://unity.com/blog/how-to-leverage-distributed-authority-for-multiplayer-co-op-games)
- Distributed authority pricing, read 2026-11-20: free up to 6,000 connectivity hours and 100 GiB egress a month, then $0.001 per connectivity hour and $0.09 to $0.16 per GiB — [Unity Gaming Services pricing](https://unity.com/products/gaming-services/pricing)

**Netcode for Entities**
- A server-authoritative framework with client prediction built on ECS; as of Unity 6.5 it is a core package included in the editor by default. NGO 3.1.0 depends on Netcode for Entities 7.1.0 — [Netcode for Entities docs](https://docs.unity3d.com/Packages/com.unity.netcode@6.6/manual/index.html) (search summary only); [NGO changelog](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/changelog/CHANGELOG.html)

**Photon Fusion 2**
- Modes: Dedicated Server, Client Host, and Shared Authority, plus single-player. "Client-side prediction and lag compensation out of the box", area of interest, a host migration sample, and WebGL samples. Free for development — [Photon Fusion intro](https://doc.photonengine.com/fusion/current/fusion-intro)
- Pricing, read 2026-11-20: 20 CCU free (development only); 100 CCU free for one game app; 100 CCU for $95 one-time for 12 months; 500 CCU $125 a month; 1,000 CCU $250 a month; 2,000 CCU $500 a month. Traffic is included at about 3 GB per CCU; overage $0.05 to $0.10 per GB. Premium is $0.50 per CCU with a $1,000 a month minimum — [Photon Fusion pricing](https://www.photonengine.com/fusion/pricing)
- Photon's older PUN SDK has been in long-term-support mode since July 2021, and Photon recommends Fusion for all new projects — [Photon PUN page](https://www.photonengine.com/PUN) (search summary only)

**Photon Quantum 3**
- Deterministic predict and rollback: clients exchange only inputs and run the same simulation. Gameplay is a pure C# simulation on Quantum's own ECS, decoupled from Unity, with Quantum's own deterministic physics, navigation and animation libraries. Up to 128 players. Aimed at latency-sensitive sports, fighting and FPS games. Free for development — [Photon Quantum intro](https://doc.photonengine.com/quantum/current/quantum-intro)

**FishNet**
- Free, "no CCU caps or CCU paywalls", server-authoritative by design with host mode, a transport system, and a "no-break promise" (no breaking API changes between major versions; major releases at most every six months) — [FishNet docs](https://fish-networking.gitbook.io/docs)
- Asset Store: free version listed at 4.7.3R; FishNet Pro listed at $50 per seat; supports Unity 2021, 2022, 2023 and Unity 6 LTS — [FishNet Pro on Asset Store](https://assetstore.unity.com/packages/tools/network/fishnet-pro-networking-evolved-287711) (search summary only)
- GitHub: 2.1k stars; developed by one professional developer with community support — [FishNet GitHub](https://github.com/FirstGearGames/FishNet)

**Mirror**
- MIT, free. Supports Unity 2019 to 2022 LTS and 6000.1. Stable: transform and physics sync, SyncVars, RPCs, interest management, snapshot interpolation. Lag compensation is "Beta"; client-side prediction is listed as "Researching", not shipped. Transports: KCP (default UDP), Telepathy (TCP), SimpleWebTransport (WebSockets, WebGL), community Steam (FizzySteamworks, FizzyFacepunch) and Epic transports. Games listed include Dinkum, Sun Haven, SCP: Secret Laboratory, Liar's Bar, Nuclear Option, Population: ONE — [Mirror GitHub](https://github.com/MirrorNetworking/Mirror)

**PurrNet**
- MIT, free, "no seat licenses, no CCU tax and no revenue share". Client-side prediction through PurrDiction (rollback, optional determinism), per-object authority rules, awaitable RPCs with return values. Transports: UDP, WebSockets, Steam, Unity Transport, optional WebRTC, and PurrTransport relay (free for development, self-hostable). Unity 2022+. 711 GitHub stars; no shipped titles named — [PurrNet GitHub](https://github.com/PurrNet/PurrNet)

**What shipped indie co-op games use** (detail in section 8)
- R.E.P.O. uses Photon PUN plus Photon Voice; the team had "no prior experience with multiplayer" — [Photon blog](https://blog.photonengine.com/r-e-p-o-multiplayer-success-powered-by-photon/)
- Lethal Company uses Netcode for GameObjects — [Lethal Company modding wiki](https://lethal.wiki/dev/advanced/networking)

### Inferences
- Scale is not the constraint. Five players and a few dozen enemies is far inside what every listed library handles. The hard part for this game is feel under latency: dodge invulnerability windows, parry timing, lock-on and hit reactions with 50 to 150 ms between players. The usual answer in co-op PvE is that each client owns and simulates its own character (no perceived input lag, the client judges its own dodge and parry against what it sees), while the host owns enemies and resolves damage. That is achievable in NGO (owner-authoritative NetworkTransform or client anticipation), Fusion (Host Mode with prediction, or Shared Mode), FishNet and PurrNet.
- Fusion 2 is the most turnkey for prediction, lag compensation, relay and host migration, at a cost: the free 100 CCU tier covers about 20 simultaneous lobbies of five, and a modest success needs $125 a month or more. NGO or FishNet over Steam relay costs nothing at any scale on Steam.
- NGO is in flux. The move to 3.0 in September 2026 pulled in Netcode for Entities and renamed assemblies; a project started on 3.x gets Unity's long-term direction (unified netcode with prediction) but will be an early adopter of it. A cautious project could use 2.13.x on 6.3 LTS.
- Quantum is a poor fit: it would force the whole simulation into Quantum's own ECS and fixed-point world, which fits the existing deterministic, table-driven JavaScript simulation in spirit but gives up Unity's physics, NavMesh and Animator for gameplay and is paid above the free tier.
- Mirror's lack of shipped client prediction matters little for a client-owned-movement co-op design; its shipped-games list is the longest of the free options.

### Gaps
- Coherence and Mirage were not researched in this session (search budget). No current facts are offered for either.
- FishNet's "prediction v2" status and Pro feature differences were not confirmed from the docs (the pages fetched did not cover them).
- Photon Fusion's own guidance on which mode suits co-op was not retrieved (the topology page returned 404).
- Photon Quantum pricing was not retrieved separately.
- Whether NGO 3.x offers full client-side prediction with rollback for GameObjects (via the unified netcode "hybrid mode" and GhostObject prefabs) in a production-ready way was not confirmed beyond the changelog line.

## 3. Unity Gaming Services and alternatives (Relay, Lobby, hosting, Steam, Epic, Edgegap)

### Takeaway
Unity's Relay, Lobby and distributed authority services remain and have free tiers that cover a small co-op game, but Unity closed its own dedicated server hosting (Multiplay) on 31 March 2026. For a Steam co-op game the usual zero-cost path is Steam lobbies plus Steam Datagram Relay; dedicated servers are not needed for player-hosted co-op.

### Cited Findings
- "As of April 1st 2026 Multiplay Game Server Hosting by Unity has been deprecated"; customers can no longer scale new servers or make new allocations, except those who had committed by 31 March to migrate to "Multiplay by Rocket Science" — [Unity status notice 362941](https://status.unity.com/info_notices/362941)
- Unity licensed the Multiplay software to Rocket Science Group; Matchmaker, Relay, Lobby and Distributed Authority are reported as unaffected — [Gameye blog](https://gameye.com/blog/unity-multiplay-shutdown-migration-options/) (search summary only; vendor blog promoting a competitor)
- Relay, read 2026-11-20: first 50 average monthly CCU free with 3 GiB per CCU (up to 150 GiB a month); then $0.16 per additional average CCU and $0.09 per GiB (US and EU) or $0.16 per GiB (Asia and Australia) — [UGS pricing](https://unity.com/products/gaming-services/pricing)
- Lobby: 10 GiB a month free per regional group, then $0.09 to $0.16 per GiB. Authentication: free. Vivox voice: free up to 5,000 peak concurrent users. Cloud Save: 5 GiB and 1M reads and writes free. Cloud Code: 1M invocations free — [UGS pricing](https://unity.com/products/gaming-services/pricing)
- Matchmaker and Multiplay Hosting do not appear on the UGS pricing page read on 2026-11-20 — [UGS pricing](https://unity.com/products/gaming-services/pricing)
- Multiplayer Play Mode 1.6.3: tests up to four players inside the editor (the main editor plus three lightweight editor instances), plus up to four locally built instances. Requires Unity 6000.0.50f1 or later on Windows or macOS. Virtual players cannot edit GameObjects — [Multiplayer Play Mode docs](https://docs.unity3d.com/Packages/com.unity.multiplayer.playmode@1.6/manual/index.html)
- Unity's Claude Code plugin includes a `/setup-multiplayer-services` skill and a `/setup-vivox-voice-chat` skill — [Unity blog, 9 Sep 2026](https://unity.com/blog/unity-plugin-for-claude-code)
- Steam: `ISteamNetworkingSockets` and `ISteamNetworkingMessages` relay packets through Valve's network by default (Steam Datagram Relay), hide player IP addresses, and fall back between direct and relayed connections; designed to work with Steam Matchmaking and Lobbies with traffic through one host (typically the lobby owner). The old `ISteamNetworking` is deprecated — [Steamworks networking docs](https://partner.steamgames.com/doc/features/multiplayer/networking)
- Mirror has community Steam transports (FizzySteamworks, FizzyFacepunch) and an Epic Online Services relay transport; PurrNet lists a Steam transport — [Mirror GitHub](https://github.com/MirrorNetworking/Mirror); [PurrNet GitHub](https://github.com/PurrNet/PurrNet)
- Edgegap, read 2026-11-20: relay free trial up to 50 CCU and 160 GB egress, then $0.14 per additional peak monthly CCU and $0.10 per GB; on-demand dedicated servers $0.00115 per vCPU per minute with no minimum; managed matchmaker from about $22 a month — [Edgegap pricing](https://edgegap.com/pricing)

### Inferences
- A lobby of five through Unity Relay uses five CCU while playing; 50 average monthly CCU free is roughly ten lobbies running around the clock, so a friends-and-testers phase costs nothing and a commercial release would cost on the order of $0.16 per average concurrent player per month plus bandwidth.
- Multiplayer Play Mode tops out at four editor players, so a five-player lobby cannot be tested wholly inside the editor; the fifth has to be a local build (it supports up to four of those as well).
- Steam relay ties online play to Steam accounts and Steam clients. If browser or mobile play is kept, Steam relay cannot be the only path, and Unity Relay (which has WebSocket support) or Photon would be needed instead or as well.
- The Multiplay closure does not affect a player-hosted co-op design, but it is direct evidence that a Unity-run service can be withdrawn with months of notice.

### Gaps
- The cost of Steam networking is not stated on the Steamworks page read (it is widely understood to be free to Steam partners, with the $100 Steam Direct fee per app; not confirmed in this session).
- Epic Online Services (free P2P relay, lobbies, cross-platform) was not researched in this session.
- Steamworks.NET versus Facepunch.Steamworks (maintenance state in 2026) was not researched.
- The Multiplayer Services SDK and Sessions API (current version, how it wraps Relay, Lobby and distributed authority) was not read directly.
- Unity Matchmaker's current pricing and whether it still makes sense without Unity-run hosting was not confirmed.

## 4. Web builds, browsers on phones, and iOS and Android

### Takeaway
Unity can keep a browser version alive, including on phone browsers (listed as supported in the 6.3 manual), and a browser client can use Unity's netcode. But a Unity Web build is single-threaded for C#, cannot open raw sockets, and is far heavier than the current hand-written page; the browser would become a secondary target, not the lead one. Native iOS and Android builds are first-class.

### Cited Findings
- Unity 6.3 Web supports desktop Chrome, Firefox, Safari and Edge (WebGL 2, 64-bit, WebAssembly), and lists mobile support for iOS Safari 15 and newer and Chrome 58 and newer on Android, runnable in the browser, in a WebView or as a PWA — [Unity 6.3 manual, Web browser compatibility](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro/browsercompatibility)
- WebGPU in Unity 6.3 "is experimental and not supported by all browsers and devices"; WebGL 2 is the default — [Unity 6.3 manual, WebGPU](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/develop/graphics/web-gpu)
- Unity states WebGPU is "production-ready" in Unity 6.6 with URP compatibility — [Unity blog, Unite Seoul 2026 recap](https://unity.com/blog/unite-seoul-keynote-2026-recap)
- C# threads are not supported on Web: everything in `System.Threading` is unsupported and the platform runs on one C# thread. Native C/C++ multithreading is partial and experimental and needs cross-origin isolation headers (COOP, COEP). Garbage collection runs once at the end of each frame — [Unity 6.3 manual, Web technical limitations](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro/technical-overview)
- Physics on Web "may differ from the Editor or other platforms" because WebAssembly does not expose the FTZ/DAZ floating-point flags, so small deviations can change outcomes such as collisions — [Unity 6.3 manual, Web technical limitations](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro/technical-overview)
- Browsers block direct TCP and UDP sockets; `System.Net.Sockets`, `System.Net.Http` and `System.Net.WebSockets` are unsupported; Unity says Web builds use the Netcode package for multiplayer, which "supports the Web platform" — [Unity 6.3 manual, Web networking](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/develop/networking)
- NGO lists WebGL as a supported platform (NGO 1.2.0+ and Unity Transport 2.0.0+) — [NGO 3.2 manual](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/manual/index.html)
- Third-party transports for browsers: Mirror's SimpleWebTransport (WebSockets); PurrNet WebSockets and optional WebRTC; Photon Fusion ships WebGL samples — [Mirror GitHub](https://github.com/MirrorNetworking/Mirror); [PurrNet GitHub](https://github.com/PurrNet/PurrNet); [Photon Fusion intro](https://doc.photonengine.com/fusion/current/fusion-intro)
- A third-party roadmap summary says 6.4 adds Burst job support on Web and 6.6 adds 64-bit WASM, raising the Web memory ceiling from 4 GB to 16 GB — [StraySpark blog](https://www.strayspark.studio/blog/unity-6-4-to-6-8-roadmap-indie-developers-2026) (third party, low authority)
- Unity's Claude Code plugin includes an `/optimize-web` skill; the Unity CLI installs platform modules with `unity install <version> -m android ios webgl` — [Unity blog, plugin](https://unity.com/blog/unity-plugin-for-claude-code); [Unity blog, CLI](https://unity.com/blog/meet-the-unity-cli)
- NGO lists iOS and Android as supported platforms — [NGO 3.2 manual](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/manual/index.html)

### Inferences
- A browser client cannot listen for connections, so it cannot be a directly reachable host; it can only connect out over WebSocket (or WebRTC with a third-party transport). Cross-play between a browser client and native clients therefore needs either a relay that speaks both (Unity Relay supports secure WebSocket connections; Photon does too) or a host that listens on both UDP and WebSocket. Steam relay alone will not carry browser players.
- The current game is one dependency-free HTML page under a hosting policy that blocks loading from other sites. A Unity Web build is a loader plus a multi-megabyte WebAssembly and data payload (commonly tens of megabytes even when stripped; no official figure found), will not fit that single-page hosting model, and starts slower on phones. GitHub Pages can host it, but multithreading headers (COOP, COEP) cannot be set there.
- The Web physics caveat and the single C# thread mean a design that needs identical simulation on every client (deterministic lockstep) is unsafe across browser and native; a host-authoritative design avoids the problem.
- For phones, native iOS and Android builds will run and feel better than the Unity Web player; on a Mac the owner can build both (iOS needs Xcode and an Apple developer account, a general fact not re-sourced here).

### Gaps
- No official figure for minimum Unity 6 Web build size or load time on phones was found.
- The Unity Transport cross-play page (WebSocket plus UDP in one server, `MultiNetworkDriver`) returned 404, so whether a native host can accept browser clients directly without Relay in Unity Transport 2.6 is not confirmed here.
- Whether a browser client can act as the session host through Unity Relay or under distributed authority was not confirmed.
- Real-world reports of Unity 6 Web performance on iOS Safari in 2026 were not gathered.

## 5. 3D and animation capability for a third-person melee action game, and Asset Store value

### Takeaway
Unity's character animation, camera, navigation and effects stack covers everything this genre needs and is the area where the port gains most over a hand-written renderer, though few of these long-standing features were re-verified from documentation in this session. Asset Store combat kits are cheap but, on the evidence found, are single-player; none found advertised networking, so a co-op Soulslike combat core has to be written, not bought.

### Cited Findings
- Run-time navigation: `NavMeshSurface.BuildNavMesh()` builds a NavMesh at run time; `UpdateNavMesh(NavMeshData)` rebuilds only changed parts asynchronously and returns an `AsyncOperation` — [AI Navigation API, NavMeshSurface](https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/api/Unity.AI.Navigation.NavMeshSurface.html)
- NavMeshSurface can collect geometry from render meshes or from physics colliders, limited to a volume or a hierarchy; "If you plan to bake the NavMesh at runtime, use a smaller tile size to keep the maximum memory use low" — [AI Navigation manual, NavMesh Surface](https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/manual/NavMeshSurface.html)
- Unity's Claude Code plugin ships skills for `/initialize-ai-navigation`, `/physics-3d-collision`, `/urp-postprocessing`, `/shader-graph-create-custom-node` and UI Toolkit — [Unity blog, plugin](https://unity.com/blog/unity-plugin-for-claude-code)
- Rendering direction: a third-party roadmap summary says "URP becomes the single unified render pipeline", ending the separate HDRP track; Unity says Surface Cache GI (real-time global illumination) arrives for URP in 6.7 — [StraySpark blog](https://www.strayspark.studio/blog/unity-6-4-to-6-8-roadmap-indie-developers-2026) (third party); [Unity blog, Unite Seoul recap](https://unity.com/blog/unite-seoul-keynote-2026-recap)
- Asset Store: "SoulsLike Combat Core – Modular Combat Framework (6+)" by MaxShDev, €22.99 ($24.99), version 1.0.0 released 4 February 2026, for Unity 6000.3, Built-in, URP and HDRP; tagged lock-on, FSM, action RPG; no mention of networking — [Asset Store listing](https://assetstore.unity.com/packages/tools/game-toolkits/soulslike-combat-core-modular-combat-framework-6-351742)
- Other combat toolkits found: Ability & Combat Toolkit $78.25 (integrations for Game Creator 2 and Emerald AI), Combat Framework $60, Combat Combo System $75; none of the listings seen mention multiplayer — [Ability & Combat Toolkit](https://assetstore.unity.com/packages/tools/game-toolkits/ability-combat-toolkit-155168); [Combat Framework](https://assetstore.unity.com/packages/tools/game-toolkits/combat-framework-66826); [Combat Combo System](https://assetstore.unity.com/packages/tools/visual-scripting/combat-combo-system-384290) (search summaries only)
- A networking add-on for a character controller exists as a separate paid product: "Multiplayer for Malbers Character Controller", $25, requires FishNet v4+ — [Asset Store listing](https://assetstore-fallback.unity.com/packages/tools/integration/multiplayer-for-malbers-character-controller-300747) (search summary only)
- Environment art exists in the genre: "Fantasy Soulslike Bundle Vol 2" and a Soulslike GUI pack are on the store — [Asset Store listing](https://assetstore.unity.com/packages/3d/environments/fantasy/fantasy-soulslike-bundle-vol-2-283320) (search summary only; price not read)

### Inferences
- The following are long-standing Unity features known from background knowledge and not re-verified against 2026 documentation in this session: the Animator (Mecanim) state machines and blend trees, root motion, animation events for opening and closing hit windows, humanoid avatar retargeting (which is what makes Mixamo and store animation packs usable across characters), the Animation Rigging package for IK and aim, Timeline for cinematics such as executions, Cinemachine 3 for third-person and target-group lock-on cameras, the CharacterController component, Shader Graph and VFX Graph. All were present in Unity 6.0.
- URP is the right pipeline: it is the one that runs on Web and mobile, and Unity's roadmap is converging on it. HDRP rules out Web and phones.
- The existing characters are built from primitives in code. Moving to rigged humanoid models with retargeted animation is the largest art-direction decision in a Unity port: it is where "building it properly" would show, and it is work an AI coding agent cannot do from text alone (rig import settings, avatar masks, animator graphs and clip trimming are editor-centred assets). The alternative of keeping primitive-built figures and procedural poses would port as code, but wastes much of what Unity offers.
- NavMesh would replace the hand-written grid router (`world.route`), but the current AI also relies on the scalar field for sight and footing; both can coexist, since the field is plain data.
- Combat kits from the store assume a single local player and state held in MonoBehaviours without network authority. Retrofitting networking onto them is usually harder than writing combat against the netcode from the start; the existing JavaScript tables and state machines are a better starting point than a bought kit.

### Gaps
- Prices and networking support of the best-known controller kits (Invector Third Person Controller Melee, Opsive Ultimate Character Controller, Game Creator 2, Malbers) were not confirmed in this session.
- Animation pack and dungeon kit prices (Synty, KayKit, Mixamo terms) were not researched.
- Status of Unity's announced new animation system in 6.x or 7 was not found in the sources read.
- No documentation pages for Animator, Cinemachine, Animation Rigging or Timeline were opened in this session; version numbers for those packages are not given.

## 6. Procedural generation at run time and determinism across clients

### Takeaway
Unity can build the dungeon mesh, its collider and its NavMesh at run time from a seed, with the collider bake movable off the main thread. Floating-point results are not guaranteed identical across architectures under IL2CPP, so "every client generates the same world from the seed" is only safe if generation uses integer or fixed-point maths, or if the host's result is treated as the truth.

### Cited Findings
- `Physics.BakeMesh` builds the acceleration structures a MeshCollider needs; Unity calls it "a resource-intensive operation", says it is thread-safe and usable from the C# Job System (`IJobParallelFor`), and suggests spreading several meshes across cores. In a built player the mesh must have Read/Write enabled. The MeshCollider reuses the bake only when its cooking options match — [Unity 6.3 scripting reference, Physics.BakeMesh](https://docs.unity.com/en-us/engine/6000.3/script-reference/unityengine/physics/bakemesh)
- Run-time NavMesh build and asynchronous partial update are supported (see section 5) — [AI Navigation API](https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/api/Unity.AI.Navigation.NavMeshSurface.html)
- `Unity.Mathematics.Random` is "based on xorshift", has 32-bit state seeded with a non-zero `uint`, and offers `CreateFromIndex(uint)` — [Unity.Mathematics API](https://docs.unity3d.com/Packages/com.unity.mathematics@1.3/api/Unity.Mathematics.Random.html)
- IL2CPP: "No, for IL2CPP we don't have deterministic floating point calculations between architectures." On the same architecture: "We don't make any guarantees about this, but so long as you are using the same C++ compiler... I think that there should be no differences." (JoshPeterson, 26 August 2022; Unity IL2CPP developer, role not shown on the page) — [Unity Discussions](https://discussions.unity.com/t/are-floating-point-numbers-deterministic-on-the-same-architecture-il2cpp/892251)
- Burst's `FloatMode.Deterministic` makes Burst-compiled floating-point results "consistent across all supported platforms", is supported only on 64-bit architectures, applies only to Burst-compiled code, and can still be broken by hardware intrinsics or non-deterministic inputs — [Unity 6.7 manual, Burst float precision and determinism](https://docs.unity.com/en-us/engine/6000.7/manual/programming-environment/script-compilation/burst/compilation/float-precision-determinism)
- Unity's issue tracker records floating-point inconsistencies between Mono and IL2CPP on Apple Silicon — [Unity Issue Tracker](https://issuetracker.unity3d.com/issues/apple-silicon-floating-point-inconsistencies-between-mono-and-il2cpp) (search summary only)
- Web builds have their own floating-point behaviour (no FTZ/DAZ) — [Unity 6.3 manual, Web technical limitations](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro/technical-overview)
- Photon Quantum achieves cross-platform determinism with its own deterministic libraries and a Fixed Point section in its manual — [Photon Quantum intro](https://doc.photonengine.com/quantum/current/quantum-intro)

### Inferences
- The existing generator already draws all randomness from one seeded stream (`Rn`) in a fixed order and has tests that hash generated worlds (t22). Port the PRNG as explicit 32-bit integer arithmetic in C# (do not use `System.Random`, whose algorithm is an implementation detail of the .NET runtime and Unity is changing runtimes with CoreCLR in Unity 7; this last point is background knowledge, not sourced here). Integer PRNG output will match on every platform.
- The risk is the floating-point field itself: values near a threshold (marching squares at 0, the shore at 0.5) could fall on different sides on an ARM phone, an x64 PC and a browser, giving walls or water that differ by one cell edge. Three workable defences: (a) compute the field in fixed-point or integers; (b) put field generation in a Burst job with `FloatMode.Deterministic` (64-bit only, which excludes nothing the game would target except possibly 32-bit WASM); (c) have the host generate and send a compact result (the field grid is small: one value per metre) or a hash that clients verify, falling back to downloading the host's field on mismatch. Option (c) is the most robust and is cheap at this world size.
- The ported world hashes make a ready-made cross-platform test: run the generator in an IL2CPP build on each target and compare against the JavaScript hashes. Exact agreement with the JavaScript output is unlikely for floating-point parts (JavaScript uses doubles; C# code would normally use floats), so hashes would be re-baselined in C#.
- The cave draws about 82,000 triangles whole; baking a MeshCollider of that size at load is a one-off cost of the kind `Physics.BakeMesh` is meant for. The current design collides against the field, not the mesh, and that can be kept: character movement can stay field-based (cheap, deterministic, identical on all clients) with the MeshCollider used only for cameras, ragdolls and effects.

### Gaps
- No measured figures for run-time MeshCollider bake time or NavMesh build time at this mesh size were found.
- No official statement on `System.Random` stability across Unity's Mono, IL2CPP and CoreCLR runtimes was read.
- Whether Burst deterministic mode covers WebAssembly builds was not confirmed.

## 7. Fit for AI coding agents and a code-first, test-driven workflow

### Takeaway
This changed sharply in 2026 in Unity's favour: Unity now ships a free CLI built for agents (1.0 reported on 17 November 2026), a free MCP server, and an official Claude Code plugin with 29 first-party skills, on top of long-standing batch mode and a headless test runner. The remaining friction is that scenes, prefabs, animator graphs and import settings are editor-owned assets that agents should change through the editor's API, not by editing YAML, and iteration is slower than a `node build.mjs` loop.

### Cited Findings
- Unity CLI: announced 15 July 2026 as "a new terminal-native path for connecting agents, CI pipelines, and custom tooling to Unity". Features: `eval` runs C# through Roslyn in a running editor without a domain reload; custom project commands; driving development builds for automated playtesting; an MCP mode. Unity recommends it over the older Unity MCP for new users. Unity staff say both CLI and MCP are free with no concurrency limits, and describe a single command that installs the right editor, runs headless Editor and Player tests and reports results — [Unity Discussions announcement](https://discussions.unity.com/t/announcing-the-unity-cli-a-new-way-to-connect-your-tools-and-agents/1731104)
- The CLI is one self-contained `unity` binary for macOS, Linux and Windows: installs editors and modules, `unity auth login` or service-account environment variables on headless agents, `--format json`, exit codes 0, 1 and 130, `unity doctor`. With the `com.unity.pipeline` package (Unity 6.0 LTS or newer) it sends commands to a running editor or a development player; projects add commands with a `[CliCommand]` attribute — [Unity blog, 20 July 2026](https://unity.com/blog/meet-the-unity-cli)
- Unity confirmed at Unite Seoul that the Unity CLI and Unity MCP server "will be broadly available to everyone, free and without subscription" — [Unity blog, Unite Seoul recap](https://unity.com/blog/unite-seoul-keynote-2026-recap)
- CLI 1.0 and the Pipeline package left beta, announced at Unite Tokyo on 17 November 2026: an agent can open a project, run commands, enter Play mode and read results; `unity setup` installs an official plugin for Claude Code, Codex, Grok Build or Google Antigravity; the CLI finds and answers blocking dialogs; `unity open --until-ready`; `unity build --target`. "Build Server licenses now cover agents and automation, with one license per instance, including agents running in headless editors or containers." A supported headless editor in Linux containers is "coming soon" — [gaming.net](https://www.gaming.net/ko/unity-cli-1-0-exits-beta-for-agent-driven-game-development/) (single third-party report; the article is dated 16 November but describes a 17 November announcement)
- Official Unity Plugin for Claude Code (9 September 2026): first-party, Claude Code is the first supported agent; installs 29 skills written by the Unity teams that own each feature, including `/unity-cli` ("create and modify GameObjects, edit scenes and assets, inspect the hierarchy, and run C# in a live Editor"; also installs, licences, builds and logs), `/new-unity-project`, `/ui-uitk`, `/initialize-ai-navigation`, `/physics-3d-collision`, `/setup-multiplayer-services`, `/optimize-web`. Listed at claude.com/plugins/unity — [Unity blog](https://unity.com/blog/unity-plugin-for-claude-code); [PocketGamer.biz, 10 Sep 2026](https://www.pocketgamer.biz/unity-launches-official-claude-code-plugin-with-29-built-in-engine-skills/)
- The earlier Unity MCP server (May 2026) shipped in the AI Assistant package (`com.unity.ai.assistant`), needed Unity 6, a Unity Cloud project and an AI tools beta trial or subscription; tools covered scene hierarchy, GameObject and component edits, script edits, console logs and build settings, plus custom C# tools — [Unity blog, 11 May 2026](https://unity.com/blog/unity-ai-mcp-how-to-get-started)
- Batch mode: `-batchmode -nographics -quit -projectPath -executeMethod -logFile`, `-build` with `-activeBuildProfile`, `-buildTarget` (including `webgl`, `ios`, `android`, `osxuniversal`). Exit code 1 on script exception. "Only one Unity instance can run at a time" on a project, so batch mode cannot open a project the editor has open. `-nographics` runs without a GPU — [Unity 6.3 manual, editor command-line arguments](https://docs.unity.com/en-us/engine/6000.3/manual/unity-editor/command-line-arguments/editor)
- Licence activation from the command line: `-serial` activates a paid licence; `-username` and `-password`; manual activation files (`-createManualActivationFile`, `-manualLicenseFile`) — [Unity 6.3 manual, editor command-line arguments](https://docs.unity.com/en-us/engine/6000.3/manual/unity-editor/command-line-arguments/editor)
- Unity Test Framework from the command line: `-runTests -testPlatform EditMode|PlayMode|<BuildTarget>` (a build target builds and runs tests in a player, including WebGL in a named browser), `-testResults` (NUnit XML), `-testFilter`, `-testCategory`, `-repeat`, `-retry`. `-quit` is not supported during test runs, and there is "no common definition for exit codes" so results are read from the XML — [Unity 6.3 manual, Test Framework command line](https://docs.unity.com/en-us/engine/6000.3/manual/programming-environment/test-framework-introduction/reference-command-line)
- Fast Enter Play Mode becomes the default for new projects in 6.6 (Unity cites 2.7x to 4.7x faster play-mode entry in samples); Unity 7's CoreCLR reloads only changed code — [Unity blog, Unite Seoul recap](https://unity.com/blog/unite-seoul-keynote-2026-recap)
- Practitioner guidance (anecdotal): agents cannot reliably hand-edit `.unity`, `.prefab`, `.asset` and `.meta` files because they depend on GUIDs and fileIDs; one 2026 guide says such edits should be blocked outright and wiring done through the editor — [The Prompt Shelf guide](https://thepromptshelf.dev/blog/claude-code-unity-guide-2026) (search summary only)
- Unity 6.2 added logging for some malformed YAML asset files, described as non-exhaustive — [Unity Discussions](https://discussions.unity.com/t/unity-6-2-catching-and-fixing-malformed-asset-prefab-or-unity-files-before-they-break-your-project/1684262/1) (search summary only)
- Unity's merge tool has open reports of missing conflicts in prefab instances and variants — [Unity Issue Tracker](https://issuetracker.unity3d.com/issues/unityyamlmerge-tool-is-not-detecting-conflicts-in-prefab-instances) (search summary only)

### Inferences
- The owner's present method (agents write code, a headless harness steps the simulation at a fixed 60 Hz and asserts, screenshots are checked by eye) maps onto Unity as: gameplay rules in plain C# classes with no MonoBehaviour dependence, tested by Edit Mode tests that run in seconds; Play Mode tests for anything needing physics, animation or netcode; `unity command eval` or the Pipeline package to enter Play mode and capture screenshots. The discipline that makes this work is the one the project already has: keep the simulation steppable by a function call and independent of the frame loop.
- The more of the game that is built by code at start-up (as now: world mesh, figures, HUD), the less an agent touches editor assets and the better the fit. A fully code-constructed Unity game is possible but gives up much of the editor's value; the realistic split is code for rules, generation and wiring, with editor-authored prefabs for characters, animator controllers, VFX and UI, created through the CLI and MCP rather than YAML.
- Work that still needs a human at the GUI: judging animation blends and timing, importing and configuring rigged models, tuning cameras, effects and lighting by eye, device builds and signing, and store submission. That is exactly the "feel" work this project has not yet had from a human.
- Iteration cost is higher than today: an editor that must import assets and recompile, licence activation on each machine, one editor instance per project (parallel agents need separate checkouts or worktrees, each with its own multi-gigabyte Library folder), and binary or semi-opaque assets in git (LFS advisable).
- The "one Build Server licence per headless agent instance" statement, if accurate, means parallel headless agents may not be free even though the CLI is. Driving a single signed-in editor on the owner's Mac through the CLI avoids the question.
- Training-data coverage for Unity C# is very large and model output quality is generally high (general knowledge, not sourced); the specific hazard is API churn: Unity 6 renames (for example the `EntityId` overloads replacing instance IDs seen in the BakeMesh page), NGO 3.x assembly renames from September 2026, and the Input System and UI Toolkit versus legacy APIs. The first-party skills exist to counter this.

### Gaps
- Whether a Unity Personal licence can be activated on a headless machine (CI or container) and whether Build Server licences are needed for local agent-driven headless editors was not confirmed from Unity's own pages.
- The gaming.net report of CLI 1.0 on 17 November 2026 was not corroborated with a Unity page.
- No systematic evidence on agent success rates with Unity projects exists in the sources found; guidance is anecdotal. One practitioner blog (quiccsite.pages.dev) could not be reached.
- Whether Play Mode tests run reliably with `-batchmode -nographics` on macOS in 6.3 was not confirmed (the test page does not document it).

## 8. Shipped Unity co-op action games and their netcode

### Takeaway
The recent run of Unity co-op hits used ordinary, even dated, networking: Photon PUN (R.E.P.O., PEAK, reportedly Content Warning) or Netcode for GameObjects (Lethal Company), all player-hosted through a relay. None of the confirmed examples used client-side prediction with rollback. Evidence for several older titles on the list could not be found in this session.

### Cited Findings
- R.E.P.O. (Semiwork) uses Photon PUN, the classic SDK, with Photon Voice; chosen on Landfall's recommendation as a "fun and sturdy way to do multiplayer"; "As a team with no prior experience with multiplayer, this was a breeze to get set up"; Photon scaled "from 0 to hundreds of thousands of concurrent users". Photon says Fusion or Quantum would suit physics sync better, but switching weeks before launch was not feasible — [Photon blog](https://blog.photonengine.com/r-e-p-o-multiplayer-success-powered-by-photon/) (vendor case study)
- Content Warning (Landfall): Landfall recommended Photon to Semiwork — [Photon blog](https://blog.photonengine.com/r-e-p-o-multiplayer-success-powered-by-photon/). Steam community posts state it uses Photon PUN and that "Landfall has been using pun for 9 years" — [Steam community discussion](https://steamcommunity.com/app/2881650/discussions/0/4361247820935439912) (search summary only; user claims, unverified). The game was made by five developers between February and April 2024 — [Landfall press kit](https://landfall.se/content-warning-press-kit) (search summary only)
- PEAK: a mod page describes Photon as "the backend used for the game's networking" — [Thunderstore, PEAKER mod](https://thunderstore.io/c/peak/p/lammas123/PEAKER/v/0.4.6) (search summary only; community source)
- Lethal Company uses Unity's Netcode for GameObjects; the modding wiki links the NGO 1.5.2 documentation, and a patcher exists that "replicates the IL Post Processing that unity does with its Netcode For GameObjects package" for mods — [Lethal Company modding wiki](https://lethal.wiki/dev/advanced/networking); [UnityNetcodeWeaver](https://github.com/EvaisaDev/UnityNetcodeWeaver)
- Valheim: client-server with one player or a dedicated server as host; a developer is quoted: "A common misconception is that the game uses some kind of P2P network. It does not, all data is sent between client<->server and never between clients." Two backends: Steam networking, and Azure PlayFab Party relay for crossplay — [XGamingServer Valheim network guide](https://xgamingserver.com/docs/valheim/troubleshooting-network); [Edgegap deep dive](https://edgegap.com/blog/valheim-multiplayer-game-backend-deep-dive) (search summaries only; third-party)
- Risk of Rain 2: the community networking API for mods is "built around the Unity UNet Low Level API" — [Thunderstore, R2API_Networking](https://thunderstore.io/c/riskofrain2/p/RiskofThunder/R2API_Networking/required) (search summary only). SteamDB lists Risk of Rain 2 and Core Keeper among games using the Azure PlayFab Party SDK — [SteamDB](https://steamdb.info/tech/SDK/Azure_Playfab_Party) (search summary only)
- V Rising (Stunlock) is built on Unity DOTS with about 1,600 ECS systems and uses Vivox for voice — [Unity case study](https://unity.com/kr/case-study/v-rising) (search summary only; vendor case study)
- Dagger Directive (2 or 4 player co-op): Unity 6, NGO, Relay and distributed authority — [Unity blog](https://unity.com/blog/how-to-leverage-distributed-authority-for-multiplayer-co-op-games)
- Mirror's shipped list includes co-op and survival titles Dinkum, Sun Haven and Super Raft Boat Together — [Mirror GitHub](https://github.com/MirrorNetworking/Mirror)

### Inferences
- For friends-only co-op PvE, commercial success has not depended on sophisticated netcode. The common recipe is: player hosts, relay for connectivity, each client moves its own character, host runs the monsters, voice chat included. That recipe is available free (NGO with Steam or Unity Relay; FishNet or Mirror with Steam) or paid (Photon).
- This game is more timing-sensitive than those examples: none of them has parry windows or invulnerability frames judged against enemy attack animations. Client-judged defence (the defending client decides whether its dodge or parry succeeded and tells the host) is the standard co-op answer and is what action co-op games outside Unity generally do; it trades cheat resistance, which matters little among friends, for feel.
- Team sizes of the confirmed examples were tiny (one developer for Lethal Company by reputation, five for Content Warning), which supports the view that a solo developer can ship Unity co-op with off-the-shelf netcode.

### Gaps
- Not confirmed in this session: Sons of the Forest (believed Photon Bolt, as The Forest was), Gunfire Reborn, Core Keeper's core netcode (believed Unity DOTS with Netcode for Entities), V Rising's netcode layer (believed custom on DOTS), and Risk of Rain 2's base stack beyond the mod API reference to UNet. Treat the "believed" items as unverified background knowledge.
- Lethal Company's transport (believed Facepunch Steamworks transport for NGO) was not confirmed.
- No developer postmortem with engineering detail was read for any of these; sources are vendor case studies and modding communities.

## 9. Port effort: what carries over from the JavaScript and what is redone

### Takeaway
No sourced data on comparable JavaScript-to-Unity ports was found, so this section is reasoned from the project's own structure. The rules, tables and generation algorithms (perhaps half the code) translate to C# nearly line for line; rendering, figures and poses, input, touch layout, HUD, audio and the test harness are replaced; and the biggest job is not the language change but turning a simulation written around one player and one global state into a host-authoritative one for five.

### Cited Findings
- Unity supplies run-time NavMesh building, MeshCollider baking in jobs, a headless test runner for Edit Mode and Play Mode, and command-line builds for macOS, Windows, iOS, Android and Web, which are the engine-side pieces a port relies on — [AI Navigation API](https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/api/Unity.AI.Navigation.NavMeshSurface.html); [Physics.BakeMesh](https://docs.unity.com/en-us/engine/6000.3/script-reference/unityengine/physics/bakemesh); [Test Framework command line](https://docs.unity.com/en-us/engine/6000.3/manual/programming-environment/test-framework-introduction/reference-command-line); [Editor command line](https://docs.unity.com/en-us/engine/6000.3/manual/unity-editor/command-line-arguments/editor)
- Unity's plugin has a `/new-unity-project` skill for guided project setup that explicitly does not scaffold gameplay code — [Unity blog, plugin](https://unity.com/blog/unity-plugin-for-claude-code)
- Teams with no multiplayer experience have added Photon PUN to a Unity game quickly (R.E.P.O.), and a finished single-player-style game was moved onto distributed authority because "the whole game was done" and the developer did not want to rework ownership (Dagger Directive) — [Photon blog](https://blog.photonengine.com/r-e-p-o-multiplayer-success-powered-by-photon/); [Unity blog](https://unity.com/blog/how-to-leverage-distributed-authority-for-multiplayer-co-op-games)

### Inferences
**Translates nearly line for line (data and pure logic)**
- Data tables: `MOVES`, `CLASSES`, `EDEF`, `PURSUIT`, `PACKS`, `SEWER`, `CROC`, `HOLD`, `RIFT`, `MINE`, `CAVEIN` and the like become C# static data or ScriptableObjects. Timings are already in seconds.
- World generation: `planGraph`, `linkGraph`, the scalar field, `marchWalls`, `fieldFns` (`fieldAt`, `resolve`, `los`, `route`, rock capsules, water layer), `genWorld`, `genSewer`, `sewerPieces`. These are array and arithmetic code with a seeded stream. Output goes to Unity's `Mesh` API in place of `meshSink`. The axis conventions (XZ ground, Y up, metres) already match Unity's; Unity is left-handed, so facing and "right" conventions need one careful pass.
- State machines: the player and enemy state machines, `hitEnemy`, `hurtPlayer`, posture, tokens, sight and search, the `EBEH` hook tables, boss modes. Structurally portable as plain C# classes.
- Test intent: the assertions in t5 to t25 (what must hold) carry over as Edit Mode tests against the plain C# simulation; the harness (`DF`, Chromium, device emulation) does not.

**Must be redone**
- Renderer (`02_gl.js`, `07_render.js`, effects): replaced by URP, Shader Graph or hand-written shaders for brick and water, particle systems or VFX Graph. Visibility culling (`visiblePieces`) is replaced by Unity's own culling or kept as chunked meshes.
- Characters: primitive-built figures and code poses (`05_figures.js`, `05b_dbodies.js`, `posePlayer`, `poseEnemy`) either port as procedural meshes and transforms (faithful, quick, keeps the look) or are replaced with rigged models and Animator graphs (the "proper" route; new art pipeline, hit windows move to animation events, largest single cost).
- Input: keyboard, mouse, pad and touch code is replaced by Unity's Input System (rebinding, pad families and rumble come with it); the honeycomb touch layout would be rebuilt in Unity UI.
- HUD and menus: DOM and CSS replaced by UI Toolkit or uGUI.
- Audio: synthesised WebAudio tones replaced by clips and mixers, or a small synth port.
- Saves: `localStorage` to `PlayerPrefs` or files; cloud saves optional.

**New work that no port gives for free (the co-op redesign)**
- Authority: decide what the host owns (enemies, boss modes, world events such as rubble, mines, rifts, falling ceiling) and what each client owns (its character's movement, attacks, dodge and parry outcome).
- Every "the player" in the AI becomes "a player": target choice, `canSee`, last-seen memory, attack tokens (two attackers at once per target or per lobby?), `G.inBoss`, grabs and holds, the crocodile's surfacing and plate aiming, leash and give-up rules, hit-stop and slow motion (cannot be global in co-op), executions (who is locked out, can others hit the target), revive and death rules, difficulty scaling with player count.
- The mutable walkable field (rock) must be replicated as events so every client's field matches the host's.
- Hub, lobby, invites, joining in progress, host loss, and five-player balance.

**A rough staged plan** (an estimate from the above, not from reported cases)
1. Two to four weeks: Unity project on 6.3 LTS or 6.6, CLI and Claude Code plugin working, plain C# port of the field, cave generator and seeded stream with hashes under Edit Mode tests; world mesh on screen in URP.
2. Four to eight weeks: single-player vertical slice in Unity with one class, three enemy types and the Warden, using ported state machines; decide primitive figures versus rigged models here.
3. Four to eight weeks: networking spike on the slice with the chosen library (two candidates at most), five players through a relay, client-owned movement, host-owned enemies, dodge and parry under 100 to 150 ms simulated latency. This is the go or no-go point.
4. Three to six months: port remaining classes, D-grade enemies and the crocodile into the networked design; hub and lobby flow; UI; audio.
5. Ongoing: art pass, platform builds (Steam first; Web and phones only if kept), playtests.
A solo developer with agents should expect of the order of six to twelve months to reach parity with the current prototype in co-op form; the spread depends mostly on the art route and how much boss behaviour is redesigned for several players.

### Gaps
- No published accounts of porting a comparable custom-engine JavaScript game to Unity, or timelines for them, were found in this session; the staged plan is an estimate and should be presented as one.
- No data was found on how well AI coding agents translate large JavaScript codebases to Unity C# specifically.
- The share of the 19,000 lines that is rules versus presentation was not measured from the repository.

## 10. Main risks, and the case for and against Unity for this game in 2026

### Takeaway
For: the deepest pool of co-op precedent, netcode choices and assets, native builds for every target including a workable Web build, free at this scale, and from mid-2026 first-party tooling for AI agents. Against: an engine and its netcode both in the middle of major transitions, a vendor with a record of changing terms and closing services, editor-owned assets that fit a text-only workflow less well than the current codebase, and the loss of the lightweight single-page browser game.

### Cited Findings
**For**
- Free under $200K revenue with no royalty and no forced splash screen — [Unity pricing updates](https://unity.com/products/pricing-updates)
- First-party multiplayer stack with free tiers (NGO, Relay 50 CCU, distributed authority 6,000 hours, Lobby, Vivox 5,000 PCU) and in-editor multi-player testing — [UGS pricing](https://unity.com/products/gaming-services/pricing); [Multiplayer Play Mode](https://docs.unity3d.com/Packages/com.unity.multiplayer.playmode@1.6/manual/index.html)
- Several mature third-party netcode libraries, free and paid — [Mirror](https://github.com/MirrorNetworking/Mirror); [FishNet](https://fish-networking.gitbook.io/docs); [Photon Fusion](https://doc.photonengine.com/fusion/current/fusion-intro); [PurrNet](https://github.com/PurrNet/PurrNet)
- Proven for small-team co-op hits (Lethal Company, R.E.P.O., PEAK, Content Warning) — [Lethal wiki](https://lethal.wiki/dev/advanced/networking); [Photon blog](https://blog.photonengine.com/r-e-p-o-multiplayer-success-powered-by-photon/)
- Official agent tooling: free CLI and MCP, Claude Code plugin with 29 skills — [Unity Discussions](https://discussions.unity.com/t/announcing-the-unity-cli-a-new-way-to-connect-your-tools-and-agents/1731104); [Unity blog](https://unity.com/blog/unity-plugin-for-claude-code)
- Web (desktop and listed mobile browsers), iOS, Android and desktop from one project — [Web browser compatibility](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro/browsercompatibility); [NGO manual](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/manual/index.html)
- Comparison articles describe Unity as having "mature multiplayer options" from co-op to real-time PvP, and note hiring is easier for Unity than Godot — [Ocean View Games](https://oceanviewgames.co.uk/blog/posts/unity-vs-godot-vs-unreal-2026) (search summary only; a Unity studio's blog, opinion)

**Against**
- Pricing rises yearly by policy (8% in 2025, 5% in 2026) — [Unity pricing updates](https://unity.com/products/pricing-updates)
- Trust: Game Developer still frames Unity news against "recent turmoil and controversies, such as its runtime fee" — [Game Developer](https://www.gamedeveloper.com/programming/unity-unveils-unity-7-roadmap-with-update-path-that-won-t-break-your-build)
- Service withdrawal: Multiplay hosting deprecated 1 April 2026 — [Unity status notice](https://status.unity.com/info_notices/362941)
- Platform churn: NGO 3.0 (September 2026) changed dependencies and names; Unity 7 with a new .NET runtime is due Q1 2027; Havok removed from Pro in 6.3 — [NGO changelog](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@3.2/changelog/CHANGELOG.html); [Unity blog](https://unity.com/blog/unite-seoul-keynote-2026-recap); [Unity pricing updates](https://unity.com/products/pricing-updates)
- Comparison articles say real-time multiplayer "requires more setup in Unity than in Unreal, which ships with a more complete framework", and that Unity is closed source — [Ocean View Games](https://oceanviewgames.co.uk/blog/posts/unity-vs-godot-vs-unreal-2026) (search summary only; opinion)
- Web limits: one C# thread, no sockets, physics that can differ from native — [Web technical limitations](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro/technical-overview)
- No cross-architecture float determinism under IL2CPP — [Unity Discussions](https://discussions.unity.com/t/are-floating-point-numbers-deterministic-on-the-same-architecture-il2cpp/892251)
- Agents and editor assets: hand-editing scenes and prefabs is unreliable — [The Prompt Shelf](https://thepromptshelf.dev/blog/claude-code-unity-guide-2026) (search summary only; anecdotal)
- Unity's AI tools were described in May 2026 as open beta whose "features and availability may change or be discontinued without notice" — [Unity blog](https://unity.com/blog/unity-ai-mcp-how-to-get-started)

### Inferences
- Ranked risks for this project: (1) combat feel under latency, which is a design risk in any engine and should be tested in a spike before the port is committed; (2) the animation and art pipeline, which is new to the owner and resistant to agent-only work; (3) choosing a netcode layer during NGO's 3.x transition, mitigated by picking a library with a stable API (Fusion 2, FishNet, or NGO 2.13 on 6.3 LTS) and isolating it behind the game's own interfaces; (4) Unity 7 migration in early 2027, mitigated by staying on LTS until it settles; (5) vendor risk, mitigated by using Steam for lobbies and relay and keeping game rules in engine-independent C#; (6) slower agent iteration and heavier repository than today.
- If the browser stays a hard requirement as the lead platform (instant load, single page, phones), Unity is a weak choice and a web engine is the natural comparison. If the lead platform becomes Steam on desktop with phones as a later native port, Unity is a strong, conventional choice.
- Keeping rules in plain C# with no engine types (the pattern the tests already force) is also the hedge: such code would move to Godot's C# or a custom host with modest effort if Unity's terms changed again.
- The owner's interest in a commercial release favours Unity's console and store reach and its asset market, but the first $200K is free either way, so licence cost should not drive the choice.

### Gaps
- No first-hand 2026 developer postmortems weighing Unity against Unreal or Godot for a co-op melee action game were read; the opinion sources are comparison blogs of limited authority, and Reddit was out of bounds.
- Console requirements (Unity Pro is needed for console builds by long-standing policy; not re-verified) were not researched.
- Community reaction to the Unity 7 preview could not exist yet at the time of reading (preview due December 2026).
