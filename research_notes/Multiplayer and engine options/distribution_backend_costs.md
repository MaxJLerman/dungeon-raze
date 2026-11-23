# Distribution platforms, online platform services and running costs for a 4 to 5 player co-op action game (late 2026)

All pages were read on 20 November 2026 unless a different date is given. Prices are in the currency the vendor lists. Nothing here is legal advice. Where a fact could not be confirmed from a page read in this session it is in a Gaps list, even when it is widely believed.

Refused or unreadable sources in this session (not retried, no workarounds used): `onlineservices.epicgames.com` pricing, FAQ and news pages (redirect to an Epic login), `dev.epicgames.com/docs` pages (returned empty content or 404), `store.epicgames.com/en-US/distribution` (403), `www.epicgames.com/site/news/...` (403), `playfab.com/pricing` (403), `globalratings.com` developer page (404), one Photon blog URL (404), one ICO fee sub-page (404), one Godot docs URL (404). Reddit was not attempted.

## 1. Steam: fee, revenue share, Steamworks co-op features, cost of "player-hosted with Steam relay", web-technology wrappers

### Takeaway
Steam costs a one-off $100 per app plus a 30% revenue share, and its lobbies, invites, relay network, cloud saves and playtests carry no listed per-use or per-CCU fee, so a player-hosted co-op game has no recurring online bill. Node bindings (steamworks.js, Greenworks) exist for Electron and NW.js, but no shipped Electron game using Steam networking was found in this session.

### Cited Findings
- Steam Direct fee is "$100 USD (or equivalent) fee for each new app", not refundable, recoupable "in the payment made after your product has at least $1,000.00 Adjusted Gross Revenue" — [Steamworks: Steam Direct fee](https://partner.steamgames.com/doc/gettingstarted/appfee)
- Valve's cut is 30% up to $10 million of a title's revenue, 25% from $10 million to $50 million, 20% above $50 million (tiers introduced for revenue from 1 October 2018; counts packages, DLC, in-game sales and Market fees) — [Neowin](https://www.neowin.net/news/valve-introduces-new-revenue-share-tiers-for-steam-promising-bigger-cuts-for-studios/); [PC Gamer](https://www.pcgamer.com/uk/valves-new-revenue-sharing-favours-big-budget-games-and-indie-devs-arent-happy)
- Steam's multiplayer overview offers three parts: Matchmaking and Lobbies, "peer-to-peer networking for small groups of players", and Game Servers for dedicated hosting (recommended for competitive or persistent games). "Matchmaking and lobbies do not provide networking features", so a networking layer is needed beside them. The page states no price for any of them — [Steamworks: Multiplayer](https://partner.steamgames.com/doc/features/multiplayer)
- Lobbies live on Steam's back end: "A single lobby can have up to 250 users in it"; searches return up to 50 lobbies; a lobby is destroyed when everyone leaves; only the owner sets lobby data; members can set per-member data and send lobby chat messages. `InviteUserToLobby` sends a friend an invite; if the game is not running it launches with `+connect_lobby`, and if it is running a `GameLobbyJoinRequested_t` callback fires. `ActivateGameOverlayInviteDialog` opens the overlay friend picker. The page lists no cost — [Steamworks: Matchmaking and Lobbies](https://partner.steamgames.com/doc/features/multiplayer/matchmaking)
- Networking APIs: `ISteamNetworkingSockets` (connection-oriented) and `ISteamNetworkingMessages` (UDP-like, with reliable and large messages). "All P2P connections are automatically relayed over the Valve backbone when appropriate"; "Traffic is relayed through the Valve backbone, or a direct connection may be established when appropriate"; relaying "prevents IP addresses from being revealed and in many cases improves ping times and connection quality". The old `ISteamNetworking` API is deprecated and "we may remove this API from the SDK in a future release" — [Steamworks: Steam Networking](https://partner.steamgames.com/doc/features/multiplayer/networking)
- Steam Datagram Relay is "Valve's virtual private gaming network". For Steam P2P a game uses the standard P2P APIs and "Steam will take care of everything else"; Steam verifies the player is signed in and owns the game. Traffic is "authenticated, encrypted, and rate-limited" with no figures given. The page states no price. For players on other stores, a version of the game must ship on Steam and Valve "cannot promise that this service will always be available to non-Steam players" — [Steamworks: Steam Datagram Relay](https://partner.steamgames.com/doc/features/multiplayer/steamdatagramrelay)
- The open-source GameNetworkingSockets library is "a subset of the functionality" of the Steamworks API and "Steam is not needed", but "some features are only available on Steam, such as Steam's authentication service, signaling service, and the SDR relay service", and Valve is "not able to offer access to SDR on other platforms to all partners". The open version does P2P NAT traversal through WebRTC's ICE with "Plug in your own signaling service" — [ValveSoftware/GameNetworkingSockets README](https://github.com/ValveSoftware/GameNetworkingSockets)
- A Unity forum reply on Lethal Company-style games says client-hosted sessions over Steam's transport represent "no cost or maintenance for the developer"; another reply notes Steam's relay still routes through a server and may add latency (forum users, not Valve) — [Unity Discussions thread](https://discussions.unity.com/t/how-do-solo-small-indies-handle-multiplayer-costs-and-support-for-steam-games-e-g-lethal-company/947238)
- Remote Play Together: friends join "as if they were sitting at the same computer" through Steam's streaming; "Only the host needs to own and install the game"; it is switched on in the store page admin and is on automatically for games marked Local Multiplayer, Local Co-op or Shared/Split Screen. No price is stated — [Steamworks: Remote Play](https://partner.steamgames.com/doc/features/remoteplay)
- Steam Cloud: Auto-Cloud needs no code (file paths configured on the partner site, synced at launch and exit); the `ISteamRemoteStorage` API gives finer control. Byte and file-count quotas are set per user per game by the developer; a single write call is capped at 100 MB. No fee is stated — [Steamworks: Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- Steam Playtest "is a completely free feature for both customers and Steam developers", runs on a child app id without touching the main game's reviews or wishlists, with limited or open sign-up, keys, and an experimental friend-invite option; charging for access is not allowed — [Steamworks: Steam Playtest](https://partner.steamgames.com/doc/features/playtest)
- Steam Deck compatibility has four ratings (Verified, Playable, Unsupported, Unknown). Verified needs a default controller setup that reaches all content with no settings changes, glyphs matching the input, smallest text at least 9 px tall at 1280x800, 30 fps at 800p by default, and no unsupported-device warnings. "Some anti-cheat providers are currently unsupported" under Proton. The review is separate from release review and no fee is mentioned — [Steamworks: Steam Deck compatibility](https://partner.steamgames.com/doc/steamdeck/compat)
- Anti-cheat on Steam: Game Bans let a developer use "Valve's banning infrastructure rather than implement your own ban tracking system" through a Web API. Valve's guidance for peer-to-peer games is that each user should validate the others so the host does not control the game state, and servers are recommended where cheating matters — [Steamworks: Anti-cheat](https://partner.steamgames.com/doc/features/anticheat)
- Steam Voice records and encodes audio but "does not network the recorded audio by itself"; the game sends it over P2P or game servers — [Steamworks: Multiplayer](https://partner.steamgames.com/doc/features/multiplayer)
- steamworks.js describes itself as "A steamworks implementation for nw.js/electron games"; in Electron it needs `contextIsolation: false` and `nodeIntegration: true`, and the overlay needs `electronEnableSteamOverlay`. Its README lists no games using it and refers to `client.d.ts` for API coverage — [ceifa/steamworks.js](https://github.com/ceifa/steamworks.js)
- Greenworks, an older binding, exposes Steamworks to NW.js and Electron and includes a P2P networking interface; GDevelop's JavaScript runtime ships a Steamworks module — [Greenworks listing](https://docsearch.algolia.com/mcp/docs/repo/greenheartgames/greenworks); [GDevelop runtime docs](https://docs.gdevelop.io/GDJS%20Runtime%20Documentation/modules/gdjs.steamworks.html)

### Inferences
- "Player-hosted with Steam relay" has no per-CCU or per-GB charge that any Steamworks page read here lists; the cost is the $100 fee and the revenue share. Valve never uses the word "free" for SDR on the pages read, so "free" rests on the absence of any listed fee plus developer reports.
- SDR is tied to Steam: a browser build, an itch.io build or a mobile build of the same game cannot count on it, so a game that also ships outside Steam needs a second transport (EOS, WebRTC, or its own relay).
- A web-technology game can reach Steam lobbies and networking through a native Node addon in Electron or NW.js. Tauri would need a Rust-side Steamworks binding with messages passed to the web view; no source read here covers that.
- Remote Play Together is a zero-netcode way to offer "online" co-op only if the game has local co-op on one screen, which a third-person camera game does not naturally have.

### Gaps
- No Valve page read states that SDR or lobbies are free in so many words. The 2019 Steamworks announcement of the networking APIs was fetched but its body did not load.
- Not confirmed here: the 30-day wait after paying the fee and the two-week "coming soon" page requirement, the Remote Play Together player limit, whether Valve Anti-Cheat requires dedicated servers, Easy Anti-Cheat or BattlEye terms, and Steam demo rules.
- No shipped Electron, Tauri or NW.js game using Steam networking was found. The search returned only tooling.
- Which steamworks.js version covers `ISteamNetworkingSockets` and lobbies was not confirmed from the README (it points to the type definitions).

## 2. Epic Online Services (EOS)

### Takeaway
Epic's own site says EOS has no royalty or hosting fees and no cap on titles or player accounts, covers lobbies, sessions, P2P, voice and player data storage, and works on any store; lobbies, P2P and storage do not need Epic accounts. No browser or JavaScript SDK was found, and the official limits and platform pages could not be read.

### Cited Findings
- Epic's machine-readable site summary states EOS is free, with no royalty or hosting fees, no cap on titles and no limit on player accounts; services can be adopted one at a time; it lists crossplay, matchmaking, lobbies, sessions, peer-to-peer networking, Epic Account Services, friends, presence, cloud saves and player data storage, achievements, stats, leaderboards, voice chat and Easy Anti-Cheat (deeper anti-cheat tiers need a paid agreement); it is "engine-agnostic and store-agnostic" and shipping on the Epic Games Store is not required — [onlineservices.epicgames.com/llms.txt](https://onlineservices.epicgames.com/llms.txt)
- The EOS plugin for Unity (PlayEveryWare) lists supported platforms as Windows, Linux, macOS, Android, iOS, Nintendo Switch, Nintendo Switch 2, Xbox One, Xbox Series X|S, PlayStation 4 and PlayStation 5, and marks Lobbies, "NAT P2P", "Voice with Lobbies" and Player Data Storage as supported, with lobbies, P2P and storage not requiring an Epic Games account. WebGL is not listed — [PlayEveryWare/eos_plugin_for_unity](https://github.com/PlayEveryWare/eos_plugin_for_unity)
- Epic's Connect interface article says Game Services and product user ids do not depend on Epic Account Services or Epic accounts; a Device ID login creates a persistent pseudo-account so a player can start at once, but it is not tied to an identity, so the game should prompt the player to link an identity provider, and Device ID is not supported on consoles (as summarised by search; the page itself needs a login) — [Epic: Accessing EOS Game Services with the Connect Interface](https://onlineservices.epicgames.com/news/accessing-eos-game-services-with-the-connect-interface)
- Voice was launched as a free service for one-to-one or group chat in matches or lobbies, with connections between authenticated users relayed through EOS back-end servers (as summarised by search; the page returned 403 to a direct read) — [Epic news: free voice and Easy Anti-Cheat](https://www.epicgames.com/site/news/epic-online-services-launches-free-in-game-voice-and-easy-anti-cheat?lang=de)
- A forum thread refers to an EOS lobby limit of 64 members (a user's mention, not Epic documentation) — [Unreal Engine forums](https://forums.unrealengine.com/t/understanding-epic-online-services-limitations/495026)
- Developers have asked on Epic's forums whether a JavaScript SDK exists for browser games; the results found hold questions with no confirming answer — [forum: JavaScript SDK for EOS?](https://forums.unrealengine.com/t/is-there-a-javascript-sdk-for-the-epic-online-services/145478); [forum: EOS for a browser-based game?](https://forums.unrealengine.com/t/can-we-use-the-epic-online-services-for-a-browser-based-game/142020)
- SDK 1.18 (September 2025) added Epic Account Services Friends Web APIs for reading friends and block lists — [Epic: EOS SDK 1.18](https://onlineservices.epicgames.com/news/epic-online-services-sdk-1-18-is-live-here-s-what-you-need-to-know)
- A community Godot binding for EOS exists — [3ddelano/epic-online-services-godot listing](https://awesome.ecosyste.ms/projects/github.com%2F3ddelano%2Fepic-online-services-godot)

### Inferences
- EOS is the closest free equivalent to Steam's lobbies and relay that also works off Steam and on mobile and consoles, so it suits a game that wants crossplay between a Steam build and other native builds.
- It does not look usable from a browser build: every listed SDK target is native, and the P2P transport is a native library. A web build would need WebRTC or WebSockets instead.
- A Steam player can be signed in through the Connect interface with their Steam identity, so no Epic account prompt is needed for lobbies and P2P (supported by the plugin's "no Epic account" marks; the official identity-provider list was not read).

### Gaps
- Epic's pricing, FAQ, licensing, service-usage-limits and platform pages could not be read (login redirect, 404 or empty). Unconfirmed: the lobby member cap (64 is a forum mention), voice room limits, player data storage quotas, rate limits, relay bandwidth limits, the P2P relay control options, and the C and C# SDK language list.
- Whether the EOS Web API covers lobbies or sessions for a browser client is unresolved.
- Epic Games Store terms (the 88/12 split, any first-$1M waiver, crossplay requirements for multiplayer games) could not be read (403).

## 3. Web release: itch.io, portals, self-hosting, Discord Activities

### Takeaway
A browser build can go on itch.io with modest file limits, on portals that give invite links and (on Poki) a networking library in return for ad revenue share and, on Poki, web exclusivity, or inside Discord as an Activity, where all traffic passes through Discord's proxy, only WebSockets work and WebRTC is not supported.

### Cited Findings
- itch.io HTML5 zip limits: no more than 1,000 files after extraction, 500 MB total extracted, 200 MB per file, 240 characters of path. A "Mobile Friendly" option and a fullscreen button exist — [itch.io: HTML5 games](https://itch.io/docs/creators/html5)
- itch.io SharedArrayBuffer support is an opt-in checkbox under Embed Options, Frame Options, still titled "Experimental" (announced 2 April 2022). It sets COOP and COEP headers, so requests to other domains fail by default and other iframes on the page do not work; Chrome works in page, Firefox later stopped needing a separate window, Safari still does — [itch.io: Experimental SharedArrayBuffer support](https://itch.io/t/2025776/experimental-sharedarraybuffer-support)
- CrazyGames technical limits: total file size 250 MB, 1,500 files, initial download at most 50 MB (at most 20 MB for the mobile homepage), relative paths only, about 20 seconds to gameplay for externally loaded files, must work on Chrome and Edge, Unity games disabled on iOS by default — [CrazyGames: technical requirements](https://docs.crazygames.com/requirements/technical/)
- CrazyGames SDK supports HTML5, Unity, GameMaker, Construct 3, Godot, Cocos, GDevelop, Defold and Wonderland, and games built with Phaser, PlayCanvas, Pixi.js and BabylonJS are live. Revenue comes from ads and, for selected games, in-game purchases; a "Basic Launch" has monetization disabled and a "Full Launch" enables revenue share. No percentage is given — [CrazyGames docs](https://docs.crazygames.com/)
- CrazyGames multiplayer SDK: `inviteLink(params)` returns a shareable URL, `getInviteParam` and `inviteParams` read it on arrival, `isInstantMultiplayer` tells the game to drop the player straight into a joinable room, `updateRoom` reports `roomId`, `isJoinable` and invite parameters, and a join listener fires for a player already in the game — [CrazyGames SDK: game module](https://docs.crazygames.com/sdk/game/)
- CrazyGames multiplayer rules: room status must be shared through the SDK, the player must be joinable right after launch in instant multiplayer, CrazyGames usernames must be shown in game, lobby sizes are declared at upload, chat must be switchable off by the SDK setting and moderated (a profanity filter at the least), and "In case of complaints, we will require you to disable chat alltogether". The page says nothing about servers, P2P or WebRTC — [CrazyGames: multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/)
- Poki asks for web exclusivity: "you can't publish the same game on other web portals or aggregators", which "applies to the open web only" (Steam, app stores and consoles are unaffected). Revenue: 100% for users who arrive directly, and "Poki splits the revenue 50/50 with you" for users Poki brings. SDKs exist for HTML5, Unity, Defold, GameMaker, Phaser 3, Godot, Cocos, Construct 3 and GDevelop. Poki offers a "Poki Networking Library (Netlib)" "to power online multiplayer games" and an "Arbitrary User Data Store" for backend data — [Poki for Developers: guide](https://developers.poki.com/guide)
- Discord Activities "are web apps hosted in an iframe" in Discord on desktop, mobile and web, talking to Discord through the Embedded App SDK — [Discord: Activities overview](https://docs.discord.com/developers/activities/overview)
- All Activity traffic goes through Discord's proxy at `{clientId}.discordsays.com`; external hosts must be declared as URL mappings or requests fail with `blocked:csp`. "While we currently only support websockets"; WebTransport is not yet supported; "WebRTC is not supported" — [Discord: Activities networking](https://docs.discord.com/developers/activities/development-guides/networking)
- Discord monetization covers one-time purchases (durable and consumable) and subscriptions, and "App Monetization applies to Bots and Activities" — [Discord: monetization overview](https://docs.discord.com/developers/monetization/overview)
- Discord monetization eligibility: a verified app owned by a developer team, team owner at least 18, verified emails and 2FA, Terms of Service and Privacy Policy links, a payout method, and $100 earned before the first payout. Payouts run through Stripe for teams in the United States, the European Union or the United Kingdom — [Discord: enabling monetization](https://docs.discord.com/developers/monetization/enabling-monetization)
- Discord's platform fee was cut from 30% to 15% until an app has made $1 million, from 6 June 2024 (secondary report) — [Gigazine](https://gigazine.net/gsc_news/en/20240607-discord-monetization-terms)
- Self-hosted signalling on Cloudflare: Workers Free allows 100,000 requests a day at 10 ms CPU each; Workers Paid is a $5 monthly minimum with 10 million requests included; Durable Objects (SQLite-backed) are on the free plan, a WebSocket connection is billed as one request, and hibernating idle sockets are not billed for duration — [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### Inferences
- A Discord Activity cannot be player-hosted over WebRTC: every lobby needs a WebSocket server (or a relay such as a Durable Object) that the developer pays for, although at 5 players a room the traffic is small.
- Portals fit the current free browser game well (invite links are exactly "friends gather and run a dungeon") but they are ad-funded, CrazyGames can force chat off, and Poki's exclusivity would remove the GitHub Pages and itch.io copies of the same game.
- itch.io's SharedArrayBuffer mode blocks cross-origin requests by default, which matters for an engine export that needs threads (Godot 4 web with threads, Unity with threads) and also calls an external signalling or relay host.

### Gaps
- Newgrounds and Y8 were not researched. itch.io's revenue share terms were not read.
- Poki's file size and technical requirements, how Netlib transports data (it is believed to be WebRTC with Poki-run signalling and relays), and its limits were not read.
- CrazyGames' revenue percentage is not published on the pages read.
- Discord's launch requirements for Activities (verification for discovery, age gates) and its current fee schedule were not confirmed from a primary page.
- GitHub Pages and Cloudflare Pages limits were not read. GitHub Pages cannot set COOP and COEP headers itself, which is believed but unverified here.

## 4. Mobile: App Store, Google Play, Game Center, Play Games Services, wrapped web games

### Takeaway
Apple charges $99 a year and 15% under its small business programme; Google charges $25 once and moved the UK, US and EEA to a new fee structure on 30 June 2026. Game Center still offers real-time and turn-based multiplayer and matchmaking; Google's Play Games Services now presents itself as identity, achievements and social features only. A thin web wrapper risks Apple's guideline 4.2.

### Cited Findings
- Apple Developer Program: "$99 annual membership" — [Apple Developer Program](https://developer.apple.com/programs/)
- App Store Small Business Program: "a reduced commission rate of 15% on paid apps and Apple In-App Purchases" for developers who made up to 1 million USD in proceeds in the prior calendar year and for developers new to the store; above the threshold the standard rate applies — [Apple: Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- Apple guideline 4.2: "Your app should include features, content, and UI that elevate it beyond a repackaged website." Guideline 4.7 allows "HTML5 and JavaScript mini apps and mini games" not embedded in the binary, under conditions. Guideline 1.2 requires apps with user-generated content to include filtering, a report mechanism with timely responses, the ability to block abusive users, and published contact information. Guideline 5.1.1(v): "If your app supports account creation, you must also offer account deletion within the app." Guideline 4.8 requires an equivalent privacy-preserving login option when a third-party or social login is used for the primary account — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Game Center "supports real-time and turn-based multiplayer functionality, so players can invite Game Center friends, contacts, iMessage groups, and nearby players, or automatch"; it "provides infrastructure to match players", with matchmaking rules that can use "party codes"; it can also save game state across a player's Apple devices — [Apple: Game Center](https://developer.apple.com/game-center/)
- Google Play registration is a one-time US$25 fee; personal accounts "must complete specific app testing requirements before making their app available" and verify an Android device — [Google Play Console Help: registration](https://support.google.com/googleplay/android-developer/answer/6112435)
- Google Play service fees: "There isn't a single service fee." In Australia, the EEA, Japan, the UK and the US a new structure applies from "June 30, 2026 for the EEA, UK, and US; September 30, 2026 for Australia and Japan": for non-subscription transactions 20% for new installs and 25% for existing installs, each plus a 5% billing fee when Google Play Billing is used (15% and 20% under the Play Games Level Up programme); subscriptions 10% plus the 5% billing fee on the first $1M of annual earnings. Elsewhere the older 15% on the first $1M and 30% above still applies — [Google Play Console Help: service fees](https://support.google.com/googleplay/android-developer/answer/112622)
- Play Games Services v2 is described as identity, achievements, leaderboards, a social graph, stats and programme features; it "does not serve as a primary system for inventory management or game-state preservation", and developers are expected to run their own in-game account for progress. The overview lists no multiplayer API — [Android Developers: Play Games Services overview](https://developer.android.com/games/pgs/overview)
- EOS supports Android and iOS for lobbies and P2P according to the Unity plugin's platform list — [PlayEveryWare/eos_plugin_for_unity](https://github.com/PlayEveryWare/eos_plugin_for_unity)

### Inferences
- On mobile there is no free cross-platform relay from the platform holders: Game Center is Apple-only and Google offers none, so a mobile co-op build would use EOS, WebRTC with a TURN fallback, or the developer's own relay.
- The existing browser game wrapped in a web view would need native-feeling features to pass guideline 4.2, plus report and block tools if it has any chat, and account deletion if it has accounts.
- For a UK developer, a Google Play purchase from a newly installed game costs 25% in total with Play Billing (20% plus 5%), or 20% in the Level Up programme, as the fee page reads.

### Gaps
- Apple's standard commission (believed 30%) and any 2025-2026 changes for the UK or EU were not confirmed on the page read.
- Whether GameKit's real-time matches are relayed by Apple and at what limits was not read.
- The removal date of Google's real-time and turn-based multiplayer APIs was not confirmed (believed to have ended around 2020).
- The details of Google's closed-testing requirement for new personal accounts (believed to be 12 testers for 14 days) were not on the page read.

## 5. Consoles in brief

### Takeaway
Console access is by application to each platform holder, needs a devkit and certification, and in practice needs an engine with console export: Unity or Unreal, or Godot through a paid third-party port. Nintendo's portal is free and open to individuals.

### Cited Findings
- Nintendo Developer Portal: individuals can register (not minors), no company or prior experience is needed, home offices are accepted, and "Registering for the portal and downloading the tools is completely free"; the remaining cost is development hardware, with details inside the portal. Developers set price, release date and content, and can use IARC for an age rating at no fee — [Nintendo Developer Portal FAQ](https://developer.nintendo.com/faq)
- Godot's documentation says the only console it officially supports is Steam Deck and points to third-party middleware, W4 Games among them, for Switch, Xbox Series and PS5 — [Godot docs 4.5: Console support](https://docs.godotengine.org/en/4.5/tutorials/platform/consoles.html)
- W4 Consoles pricing (annual, no refunds): Starter (revenue under $300,000) $800 a year per platform or $2,000 for all platforms; Pro $4,000 per platform or $10,000 for all. Supported: Switch, Switch 2 (beta, a separate platform licence), PS5, Xbox Series X|S; Godot 4.4 to 4.6 on all four, 4.3 on Switch and Xbox; C# in beta on Switch and Xbox — [W4 Games: W4 Consoles](https://w4games.com/w4consoles)
- A general 2026 guide says Switch 2 devkit access was still limited in early 2026, Nintendo's certification is strict, and ID@Xbox is the most accessible of the three programmes (secondary source) — [gamedo: porting to consoles 2026](https://gamedo-live.pages.dev/news/how-to-port-indie-game-consoles-2026)
- PEAK, a small-team co-op game, is on Steam, Xbox Series X|S, Switch 2 and PS5 with crossplay; "Online play on Xbox, Switch, and PlayStation requires a subscription" — [Landfall: PEAK FAQ](https://landfall.se/peak-faq)
- EOS and its Device ID login: Device ID is not supported on console platforms, while the EOS Unity plugin lists Switch, Switch 2, Xbox and PlayStation as supported platforms — [Epic: Connect interface article](https://onlineservices.epicgames.com/news/accessing-eos-game-services-with-the-connect-interface); [PlayEveryWare/eos_plugin_for_unity](https://github.com/PlayEveryWare/eos_plugin_for_unity)

### Inferences
- A custom JavaScript engine or a web engine has no route to consoles short of a full port. If consoles are a real aim, the engine choice narrows to Unity, Unreal or Godot with W4.
- Steam networking does not exist on consoles, so a console version needs a cross-platform service (EOS or Photon, as PEAK uses) or each platform's own online service.

### Gaps
- The ID@Xbox page read had no programme details. PlayStation Partners was not read. Devkit prices, certification requirements and each platform's rules for online play were not confirmed.
- Unity's and Unreal's console export terms were not read.

## 6. Dedicated server hosting: orchestrators' 2026 status and prices, versus a small VPS

### Takeaway
Two well-known hosts left the market in 2026 (Hathora shut its game hosting on 5 May after an acquisition; Unity deprecated Multiplay on 1 April), and Rivet no longer sells game hosting. Edgegap and GameLift publish prices that put a light 5-player room at roughly $0.003 to $0.02 an hour; a small VPS is cheaper per room but brings the operations work.

### Cited Findings
- Hathora: acquired by Fireworks AI, announced 4 March 2026; it is ending its game business and handing customers to Nitrado's GameFabric (the article's "May 5, 2025" end date looks like a typo for 2026) — [GamesBeat](https://gamesbeat.com/hathora-acquired-will-exit-game-infrastructure-biz-and-hand-over-customers-to-nitrado/); shutdown on 5 May 2026 per vendor write-ups — [Supercraft blog](https://crux.supercraft.host/blog/hathora-shut-down-where-to-go-after-may-2026/). `hathora.dev/pricing` now redirects to `gamefabric.com`.
- GameFabric (Nitrado; footer "© 2026 marbis GmbH") is an orchestration platform on bare metal, cloud or both. Its pricing page is "Individual Pricing - Tailored to Your Unique Needs" with no figures — [GameFabric](https://gamefabric.com/); [GameFabric pricing](https://gamefabric.com/pricing)
- Unity: "As of April 1st 2026 Multiplay Game Server Hosting by Unity has been deprecated"; "Customers can no longer scale new game servers or make new allocations", except those migrating to "Multiplay by Rocket Science" — [Unity status notice](https://status.unity.com/info_notices/362941). Unity Matchmaker, Relay, Lobby and Distributed Authority are reported unaffected (vendor blog) — [AccelByte blog](https://accelbyte.io/blog/unity-multiplay-is-transitioning-practical-paths-forward-for-multiplayer-studios-using-or-evaluating-multiplay)
- Rivet now presents itself as "Infrastructure for the agentic era" selling Actors; the pricing page does not mention game servers. Cloud plans: Free $0, Hobby $18, Team $156, Enterprise $740 a month, with actor nodes from $18 a month. It is open source (Apache 2.0) and free to self-host — [Rivet pricing](https://rivet.dev/pricing)
- Edgegap: on-demand compute "$0.00115 per vCPU per minute", "Pay only when players play. 0 active servers = $0", deployments of 0.25 to 4 vCPU, egress $0.10 per GB, containers run 24 hours at most. Free trial with 1.5 vCPU and no card. Private fleet: $280 a month per 16 vCPU host on a 12-month term or $350 without, 14.7 vCPU usable, egress included to 6 TB per host. Matchmaker: $0.146 an hour (about $105 a month). Relay: $0.14 per additional peak CCU and $0.10 per additional GB, with a trial up to 50 CCU and 160 GB — [Edgegap pricing](https://edgegap.com/pricing)
- Amazon GameLift Servers (US East, Ohio): c6a.large (2 vCPU, 4 GB) $0.099 an hour on demand and $0.03 an hour spot; "Network bandwidth is free for all instance types generation 6 and later" — [GameLift Servers pricing](https://aws.amazon.com/gamelift/servers/pricing/)
- Hetzner Cloud "Regular Performance" shared plans (excl. VAT): CPX02, 1 vCPU and 1 GB, €5.49 (Helsinki) to €6.49 a month; CPX12, 1 vCPU and 2 GB, €9.99 to €11.99; CPX22, 2 vCPU and 4 GB, €16.99 to €19.99; 20 TB of traffic included in EU locations (0.5 to 1 TB in Singapore), with extra traffic listed at €1.00 per TB in the EU — [Hetzner Cloud: Regular Performance](https://www.hetzner.com/cloud/regular-performance/). Hetzner's cloud landing page lists shared plans "from € 5.49/month" and "from € 5.99/month" — [Hetzner Cloud](https://www.hetzner.com/cloud)
- Fly.io: `shared-cpu-1x` with 256 MB is $2.19 a month and with 1 GB $6.70 a month; outbound data $0.02 per GB in North America and Europe, $0.04 in Asia Pacific, Oceania and South America, $0.12 in Africa and India; a dedicated IPv4 is $2 a month — [Fly.io pricing](https://docs.fly.io/about/pricing)
- Valve steers "highly competitive games" to dedicated servers and "smaller-party games" to lobbies plus P2P — [Steamworks: Multiplayer](https://partner.steamgames.com/doc/features/multiplayer)

### Inferences
- Cost per room-hour for a light simulation, assuming 0.25 vCPU per 5-player room: Edgegap on demand about $0.017 compute plus about $0.009 egress (at 90 MB an hour), so about $0.005 per player-hour; GameLift c6a.large at 8 rooms an instance about $0.012 per room-hour on demand ($0.0025 per player-hour) and $0.004 on spot; a Hetzner CPX22 at 8 rooms about €0.003 per room-hour.
- The per-session orchestrator market is unstable (three exits or pivots in one year), which is itself a reason for a solo developer to avoid depending on one. A plain container that also runs on any VPS keeps the game portable.
- A single small VPS running many rooms in one process is the cheapest dedicated option at hobby scale but serves one region, so players far from it get worse latency than with a host among them.

### Gaps
- PlayFab Multiplayer Servers pricing could not be read (403). Nitrado, i3D.net, Gameye and Rocket Science prices were not found; GameFabric's are quote-only.
- The Hetzner page rendered traffic overage as "€1.00 per hour" per additional TB; the unit is taken to be per TB and should be checked.
- The 0.25 vCPU per room figure is an assumption; the real figure depends on the engine and the enemy counts and has not been measured.
- GameLift's free tier, FlexMatch and Anywhere fees were not on the page read.

## 7. Relay and NAT traversal outside Steam and Epic

### Takeaway
A browser or cross-store game pays for relayed traffic only on the minority of links that cannot connect directly, commonly put at 10 to 25%. Cloudflare's TURN at $0.05 per GB is far cheaper than Twilio ($0.40) or Metered's small plans; Unity Relay and Photon charge by CCU plus traffic and relay everything.

### Cited Findings
- Cloudflare Realtime TURN: "$0.05 per real-time GB" of outbound traffic from Cloudflare to the TURN client, free when used with the Realtime SFU; per-allocation limits of 5 new IPs a second, 5 to 10 kpps and 50 to 100 Mbps — [Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/)
- Twilio Network Traversal Service: STUN free; TURN $0.40 per GB in the US and Germany, $0.60 in Singapore, India and Japan, $0.80 in Australia and Brazil — [Twilio STUN/TURN pricing](https://www.twilio.com/en-us/stun-turn/pricing)
- Metered TURN: free trial 500 MB; Growth $99 a month with 150 GB then $0.40 per GB; Business $199 with 500 GB then $0.20 per GB; Enterprise $499 with 2 TB then $0.10 per GB — [Metered STUN/TURN](https://www.metered.ca/stun-turn)
- Unity Relay: first 50 average monthly CCU free, then $0.16 per average CCU; 3 GiB per CCU free up to 150 GiB a month, then $0.09 per GiB (US and EU) or $0.16 (Asia and Australia). Unity Lobby: 10 GiB a month free per regional group, then the same per-GiB rates — [Unity Gaming Services pricing](https://unity.com/products/gaming-services/pricing)
- Photon Fusion public cloud: 20 CCU free for development; a free 100 CCU launch plan for one app; 100 CCU for $95 once (12 months); 500 CCU $125 a month; 1,000 CCU $250; 2,000 CCU $500; 3 GB of traffic included per CCU; overage $0.05 per GB in Europe and North America and $0.10 in Asia, Australia, South America and other regions — [Photon Fusion pricing](https://www.photonengine.com/fusion/pricing)
- Edgegap relay: $0.14 per additional peak monthly CCU and $0.10 per additional GB — [Edgegap pricing](https://edgegap.com/pricing)
- Share of sessions needing a relay: estimates of "10–20%" and "roughly 10–25%" of WebRTC connections; a 100ms blog says "almost 20%"; Callstats data cited by webrtchacks gives 22% for conferences. Carrier-grade NAT on mobile networks behaves like symmetric NAT and pushes the share up. Most figures trace to vendor blogs or 2016-era data — [Metered blog](https://www.metered.ca/blog/what-is-a-turn-server/); [100ms blog](https://www.100ms.live/blog/webrtc-turn-server); [webrtchacks usage stats](https://webrtchacks.com/usage-stats/); [OpenVidu blog, June 2026](https://openvidu.io/blog/2026/06/09/turn-key-considerations/)
- A WebRTC engineer disputes the widely quoted "20% of calls fail" figure and reports a failure rate near 0.5% on one platform — [Philipp Hancke on Medium](https://medium.com/@fippo/67b185e49765)

### Inferences
- In a star topology the host's NAT decides: a host behind a symmetric or carrier-grade NAT relays all four of its links, so the relayed share per lobby is lumpy and a mobile host is the worst case.
- A self-run coturn on a €5 to €7 Hetzner box with 20 TB included would carry the relayed traffic of all three scales in section 12 on traffic alone, at the price of running and securing it.
- Unity Relay and Photon carry every packet, so their traffic charges exceed their CCU charges for an action game once play time is high.

### Gaps
- No recent, large, independent measurement of the relayed share for games (as opposed to calls) was found.
- Cloudflare's free monthly allowance for TURN (believed to be 1,000 GB shared with the SFU) was not on the page read.
- Whether Photon's free 100 CCU plan allows traffic overage was not stated.

## 8. Identity, saves and progression; cheating in progression when a player hosts

### Takeaway
The range runs from local saves (free, no identity) through platform cloud saves (Steam Cloud, EOS Player Data Storage, both without a listed fee) to a small backend whose free tier covers hobby scale. With a player as host, Valve's own guidance is that peers should validate each other, and progression that must be trusted needs a server.

### Cited Findings
- Steam Cloud syncs save files per user with developer-set quotas and no listed fee — [Steamworks: Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- EOS lists cloud saves and player data storage among its free services, usable without an Epic account per the Unity plugin — [onlineservices.epicgames.com/llms.txt](https://onlineservices.epicgames.com/llms.txt); [PlayEveryWare/eos_plugin_for_unity](https://github.com/PlayEveryWare/eos_plugin_for_unity)
- Game Center "can save a player's game state" across Apple devices; Google says Play Games Services is not the system for game-state preservation and expects the developer's own in-game identity — [Apple: Game Center](https://developer.apple.com/game-center/); [Android Developers: PGS overview](https://developer.android.com/games/pgs/overview)
- Cloudflare D1 on the Workers Free plan: 5 million rows read a day, 100,000 rows written a day, 5 GB storage, 10 databases; on Workers Paid the first 25 billion rows read and 50 million written a month are included — [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- Supabase Free: $0, 50,000 monthly active users, 500 MB database, 5 GB egress, 200 concurrent realtime connections, and "Free projects are paused after 1 week of inactivity". Pro: from $25 a month, 100,000 MAU, 8 GB disk, 250 GB egress — [Supabase pricing](https://supabase.com/pricing)
- Firebase Spark (free): Authentication 50,000 MAU; Firestore 1 GiB stored, 50,000 reads and 20,000 writes a day; Realtime Database 100 simultaneous connections, 1 GB stored, 10 GB downloaded a month — [Firebase pricing](https://firebase.google.com/pricing)
- Unity Gaming Services: Authentication free; Cloud Save 5 GiB and 1,000,000 reads and writes a month free — [Unity Gaming Services pricing](https://unity.com/products/gaming-services/pricing)
- Heroic Cloud (managed Nakama) shows no starting price for Nakama on the page read (a placeholder appears); Satori "Starts from $600/month"; the page links to "Download and Install Nakama OSS" — [Heroic Labs pricing](https://heroiclabs.com/pricing/)
- Poki offers an "Arbitrary User Data Store" for backend data, and CrazyGames a `Data` module for cloud progress — [Poki guide](https://developers.poki.com/guide); [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/)
- Valve on cheating: with peer-to-peer, each user should validate the others so the host does not control the game state; servers are recommended so clients receive only what they need; Game Bans are for players who gained an unfair competitive advantage in multiplayer — [Steamworks: Anti-cheat](https://partner.steamgames.com/doc/features/anticheat)
- A developer notes that client-hosted sessions rule out competitive play — [Unity Discussions thread](https://discussions.unity.com/t/how-do-solo-small-indies-handle-multiplayer-costs-and-support-for-steam-games-e-g-lethal-company/947238)
- PEAK's developers know players use mods to exceed the 4-player limit and fix mod-specific bugs — [PC Gamer](https://www.pcgamer.com/games/adventure/hi-modders-peak-devs-know-were-using-mods-to-break-past-the-4-player-limit-and-theyre-so-cool-with-it-theyre-even-fixing-mod-specific-bugs)
- PEAK's save progress cannot be transferred between platforms — [Landfall: PEAK FAQ](https://landfall.se/peak-faq)

### Inferences
- For PvE co-op among friends, the common position is to accept that a host or a save file can be edited, since it harms nobody outside the lobby. This is an inference from the games in section 11 shipping with player hosting and no dedicated servers; no developer statement on progression cheating was found.
- Trust matters once loot has value outside one lobby (trading, leaderboards, an extraction economy with strangers). Then drops and inventory need to be decided or at least validated by a server the developer runs, which is where a small backend or dedicated servers come in.
- A cheap middle step: saves stay local or in platform cloud, and only identity plus a signed summary go to a free-tier backend (Workers with D1, Supabase or Firebase), whose free limits exceed hobby scale by a wide margin.

### Gaps
- PlayFab's free tier and prices could not be read (403).
- Nakama's licence and Heroic Cloud's starting price were not confirmed on the page read.
- EOS Player Data Storage quotas were not confirmed.
- No sourced account of how a specific small co-op game handles progression cheating was found.

## 9. Voice and text chat

### Takeaway
Free voice exists (EOS voice relayed by Epic, Vivox free to 5,000 peak concurrent users, Steam's codec with the game carrying the audio), and players can always use Discord. In-game chat is the feature that triggers platform moderation rules and UK online safety duties.

### Cited Findings
- Steam Voice provides capture and encoding only: "It does not network the recorded audio by itself" — [Steamworks: Multiplayer](https://partner.steamgames.com/doc/features/multiplayer)
- Steam lobbies carry text messages through `SendLobbyChatMsg` — [Steamworks: Matchmaking and Lobbies](https://partner.steamgames.com/doc/features/multiplayer/matchmaking)
- EOS voice is free, for one-to-one or group chat in matches or lobbies, relayed through EOS servers; the Unity plugin marks "Voice with Lobbies" supported and "Voice Trusted Server" not — [Epic news (via search)](https://www.epicgames.com/site/news/epic-online-services-launches-free-in-game-voice-and-easy-anti-cheat?lang=de); [PlayEveryWare/eos_plugin_for_unity](https://github.com/PlayEveryWare/eos_plugin_for_unity)
- Vivox Voice and Text: free up to 5,000 peak concurrent users, then $2,000 per 5,000 PCU from 5,001 to 50,000 — [Unity Gaming Services pricing](https://unity.com/products/gaming-services/pricing)
- CrazyGames requires chat to be moderated and switchable off, and may require it removed after complaints — [CrazyGames: multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/)
- Apple requires filtering, reporting, blocking and published contact details for apps with user-generated content — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Ofcom names text and voice chat among the features that bring a game under the Online Safety Act — [Ofcom: the Online Safety Act and gaming](https://www.ofcom.org.uk/online-safety/the-online-safety-act-and-gaming-know-the-risks-know-the-rules-know-how-to-comply)
- A community mod for R.E.P.O. advertises "native proximity voice", and PEAK supports crossplay lobbies, indicating voice is a feature in that genre (weak evidence) — [Thunderstore: REPO Steam P2P](https://thunderstore.io/c/repo/p/Makfly/REPO_Steam_P2P/)

### Inferences
- For friends-only lobbies the cheapest and lowest-risk choice is no in-game chat at all, leaving voice to Discord or the platform's own party chat, which keeps moderation with the platform that runs it.
- Proximity voice is a selling point of the "friendslop" hits, but DungeonRaze is a combat game where it is not central, so it can be left out at first.

### Gaps
- Whether small co-op games generally ship their own voice was not established from sources; the listed hits are believed to have proximity voice but this was not confirmed.
- Discord's Social SDK (voice and invites inside a game) was not researched.

## 10. Legal and compliance basics for a UK solo developer

### Takeaway
Ofcom's October 2025 guidance says games with player-generated content, text or voice chat, or matchmaking that connects users (strangers included) are user-to-user services under the Online Safety Act, with risk assessment duties and no size exemption according to law firms. A sole trader using personal information must normally pay the ICO's data protection fee. A solicitor should confirm how these apply before any release with accounts, chat or matchmaking.

### Cited Findings
- The Act applies to services with links to the UK that are "user-to-user", defined as "an internet service that enables users to generate, share or upload content". In games that covers "creating or manipulating player profiles, avatars, objects, and the environments themselves", text and voice chat "including, for example, team-based channels or open-world chats", matchmaking that connects users "including strangers" through lobbies or team assignment, and livestreaming — [Ofcom: the Online Safety Act and gaming (published 14 October 2025)](https://www.ofcom.org.uk/online-safety/the-online-safety-act-and-gaming-know-the-risks-know-the-rules-know-how-to-comply)
- Not covered: content published by the provider itself, such as offline gameplay and "original or additional game content developed and published by a studio" — [Ofcom](https://www.ofcom.org.uk/online-safety/the-online-safety-act-and-gaming-know-the-risks-know-the-rules-know-how-to-comply)
- Duties: "Providers need to assess the risk of 17 kinds of illegal content", complete a children's access assessment and, where it applies, a children's risk assessment covering 12 kinds of harmful content, put protections in place, and keep and review records — [Ofcom](https://www.ofcom.org.uk/online-safety/the-online-safety-act-and-gaming-know-the-risks-know-the-rules-know-how-to-comply)
- A law firm summary: "single player, offline games are not caught by the OSA"; in-scope services must moderate and remove illegal content, give players easy in-game reporting and a complaints procedure, and explain protections in their terms; Ofcom can fine up to "£18m or 10% of annual global revenue"; the article mentions no small-studio exemption — [Lewis Silkin, 13 March 2026](https://www.lewissilkin.com/insights/2026/03/13/digital-commerce-creative-101-online-safety-act-navigation-for-the-video-games-industry)
- Another law firm note says there are no exceptions for small or micro businesses, and that for small services without boards, reporting to a senior manager can be enough for oversight (as summarised by search) — [Lewis Silkin, 24 October 2025](https://www.lewissilkin.com/insights/2025/10/24/ofcom-issues-guidance-about-online-safety-act-in-video-gaming-context-102lr5v)
- Without strong age assurance, Ofcom expects a conservative approach to assessing children's exposure across voice chat, user content and recommendation features (as summarised by search) — [Cooley, 9 April 2025](https://www.cooley.com/news/insight/2025/2025-04-09-the-online-safety-act-child-access-duties-for-the-gaming-industry)
- One industry commentator argues smaller developers cannot realistically take on the risk of online or user-content features for UK audiences (opinion) — [PocketGamer.biz](https://www.pocketgamer.biz/like-airport-security-for-ugc-the-mobile-mavens-react-to-the-uks-online-safety-act)
- ICO: organisations, sole traders included, that use personal information "need to pay a data protection fee, unless they are exempt" — [ICO: data protection fee](https://ico.org.uk/for-organisations/data-protection-fee/)
- Age ratings: Nintendo says a developer can use the IARC system to get an age rating at no fee, valid in participating countries — [Nintendo Developer Portal FAQ](https://developer.nintendo.com/faq)
- Platform rules that overlap: Apple's guideline 1.2 (filter, report, block, contact details) and 5.1.1(v) (account deletion); Discord monetization needs Terms of Service and Privacy Policy links; CrazyGames requires chat moderation — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/); [Discord: enabling monetization](https://docs.discord.com/developers/monetization/enabling-monetization); [CrazyGames: multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/)
- Steam relay and Discord's proxy both hide players' IP addresses from each other — [Steamworks: Steam Networking](https://partner.steamgames.com/doc/features/multiplayer/networking); [Discord: Activities networking](https://docs.discord.com/developers/activities/development-guides/networking)

### Inferences
- A design with invite-only lobbies, no in-game text or voice chat, no player-made content, and names and avatars supplied by the platform has the smallest online-safety surface. Whether such a game is still a "user-to-user service" (through lobbies, names, or emotes) is a question for a solicitor; Ofcom's page lists matchmaking with strangers as in scope and does not address friends-only invites.
- Public matchmaking and in-game chat are the two features that most clearly add duties (risk assessments, reporting tools, possibly age assurance), so they carry a compliance cost beyond their engineering cost.
- In a direct peer-to-peer connection each player's IP address (personal data under UK GDPR, on the usual reading) is exposed to the others; a relay avoids that. A privacy notice should say which it is and name the relay operator. This reading should be checked with a professional.
- Any account system or backend makes the developer a data controller for that data, which is when the ICO fee, a privacy notice and deletion requests apply; local saves with platform identity keep most of that with the platform.

### Gaps
- ICO fee amounts and exemptions were not on the page read (the tier-1 fee is believed to be about £52 a year since 2025; unverified).
- The ICO's Age Appropriate Design Code (Children's Code), which applies to online services likely to be accessed by children, was not read.
- Ofcom's deadlines, fee thresholds for regulated services, and any statement on who is the provider when chat is run by Steam or Discord were not found on the pages read.
- IARC's own page could not be read (404); which stores issue IARC ratings and whether Steam uses its own questionnaire were not confirmed.
- EU rules (GDPR, Digital Services Act) for EU players were not researched.

## 11. What comparable small co-op hits did

### Takeaway
"Player-hosted, no dedicated servers" is confirmed as the norm; "Steam relay only" is not. Lethal Company and Deep Rock Galactic fit the Steam player-hosted pattern, but R.E.P.O., PEAK and Content Warning are player-hosted over Photon's paid cloud relay, which is what let PEAK ship crossplay on three consoles.

### Cited Findings
- Lethal Company: no official dedicated server was ever shipped; players join friends' lobbies through Steam and there is no matchmaking; forum developers say it "likely used the Facepunch transport" with Steam covering connection costs, "client hosted and not dedicated" (community sources, not the developer) — [Thunderstore: UEXP Dedicated Client](https://thunderstore.io/c/lethal-company/p/UEXP/UEXP_Dedicated_Client/); [The Nerd Stash](https://thenerdstash.com/does-lethal-company-have-matchmaking-multiplayer-explained/); [Unity Discussions thread](https://discussions.unity.com/t/how-do-solo-small-indies-handle-multiplayer-costs-and-support-for-steam-games-e-g-lethal-company/947238)
- R.E.P.O.: built in Unity with Photon networking; a player notes it "does not use p2p technology but uses server provider called 'photon'"; a community mod "replaces R.E.P.O.'s Photon cloud networking with direct peer-to-peer over Steam" — [Wikipedia mirror citing Photon's blog](https://wiki.krisyotam.com/content/wikipedia_en_all_nopic_2026-03/R.E.P.O); [Steam discussion](https://steamcommunity.com/app/3241660/discussions/0/597394034880739995); [Thunderstore: REPO Steam P2P](https://thunderstore.io/c/repo/p/Makfly/REPO_Steam_P2P/)
- PEAK: "We use Photon for server relays, meaning your IP address should not be visible to invaders"; "there is no online matchmaking in PEAK"; a player hosts; it is on Steam, Xbox Series X|S, Switch 2 and PS5 with crossplay; saves do not transfer between platforms — [Landfall: PEAK FAQ](https://landfall.se/peak-faq)
- PEAK launched on Steam in June 2025 at $7.99 and sold 2 million copies in nine days — [Inverse](https://www.inverse.com/gaming/peak-steam-landcrab-friendslop-update-interview-nick-kaman-pc)
- Content Warning: a Steam discussion says Landfall has used Photon PUN for years (user comment) — [Steam discussion](https://steamcommunity.com/app/2881650/discussions/0/4361247820935439912)
- Deep Rock Galactic: "There are no dedicated servers hosting the multiplayer functionality"; connections are peer-to-peer with the host's computer as the server; 4 players; a server browser lists public lobbies; Xbox and Windows 10 versions crossplay with each other and not with Steam — [Deep Rock Galactic wiki: Multiplayer](https://deeprockgalactic.wiki.gg/wiki/Multiplayer)
- Valheim: a player hosts a peer-to-peer session, or anyone runs the dedicated server that "comes free with the game when purchased on Steam" as a Steam tool — [Game8](https://game8.co/games/Valheim/archives/321145)
- Risk of Rain 2: a dedicated server application exists with a default of 4 players; one November 2026 hosting article says the SteamCMD server app now provides only a placeholder, so its status is unverified — [Yekbot guide](https://www.yekbot.com/risk-of-rain-2-dedicated-server-for-windows/); [ZAP-Hosting](https://zap-hosting.com/en/help/articles/riskofrain2-vps-installation)
- GodotSteam publishes a tutorial for lobbies plus Steam P2P, the pattern Godot co-op games on Steam use — [GodotSteam: P2P tutorial](https://godotsteam.com/tutorials/p2p)
- A forum developer found Photon, as used by R.E.P.O., laggy compared with alternatives (one user's view) — [Unity Discussions thread](https://discussions.unity.com/t/how-do-solo-small-indies-handle-multiplayer-costs-and-support-for-steam-games-e-g-lethal-company/947238)

### Inferences
- Every game checked launched on Steam first and let a player host. None ran dedicated servers at launch. That part of the suspected norm holds.
- The split is in the relay: Steam's own (no listed fee, Steam only) or Photon's (paid by CCU, works everywhere). Photon's cost is the price of console crossplay and of not being tied to Steam, and at section 7's prices it is small against the revenue of a game that needs it.
- None of these hits has a browser or mobile version. DungeonRaze starting in the browser is unusual among them, and no comparable browser-first co-op hit was found in this session.

### Gaps
- Webfishing: nothing reliable was found on its networking (itch.io comments mention an "official dedicated server", unverified). It is believed to use Steam lobbies and P2P through GodotSteam.
- Lethal Company's exact stack (believed to be Unity Netcode for GameObjects with a Facepunch Steam transport) is not confirmed by a developer source.
- No developer postmortem with online running costs was found for any of the games. Photon's own R.E.P.O. article could not be read (404).
- Risk of Rain 2's and Valheim's relay details (Valheim is believed to use PlayFab for crossplay) were not confirmed.

## 12. Cost tables: monthly running cost at 10, 100 and 1,000 concurrent lobbies

### Takeaway
Player-hosted with Steam or EOS costs nothing a month at any scale; browsers with WebRTC and Cloudflare TURN cost about $5, $55 and $530 a month at 10, 100 and 1,000 always-full lobbies; dedicated servers cost from tens of dollars to about $19,000 a month depending on the host. All figures below are estimates built on the listed prices and the stated assumptions.

### Cited Findings
- Steam: one-off $100 per app; no fee listed for lobbies, P2P or SDR — [Steam Direct fee](https://partner.steamgames.com/doc/gettingstarted/appfee); [Steam Networking](https://partner.steamgames.com/doc/features/multiplayer/networking)
- EOS: no royalty or hosting fees — [onlineservices.epicgames.com/llms.txt](https://onlineservices.epicgames.com/llms.txt)
- Unity Relay: 50 average CCU free then $0.16 per CCU; 150 GiB free then $0.09 per GiB (US and EU) — [Unity Gaming Services pricing](https://unity.com/products/gaming-services/pricing)
- Photon: 500 CCU $125 a month, 2,000 CCU $500 a month, 3 GB per CCU included, $0.05 per extra GB (Europe and North America) — [Photon Fusion pricing](https://www.photonengine.com/fusion/pricing)
- TURN per GB: Cloudflare $0.05, Twilio $0.40 (US and EU), Metered plans $99 for 150 GB, $199 for 500 GB, $499 for 2 TB — [Cloudflare](https://developers.cloudflare.com/realtime/turn/); [Twilio](https://www.twilio.com/en-us/stun-turn/pricing); [Metered](https://www.metered.ca/stun-turn)
- Relayed share of WebRTC links: about 10 to 25% — [Metered blog](https://www.metered.ca/blog/what-is-a-turn-server/); [webrtchacks](https://webrtchacks.com/usage-stats/)
- Signalling: Cloudflare Workers Free 100,000 requests a day; Paid from $5 a month — [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- Dedicated: Edgegap $0.00115 per vCPU-minute, $0.10 per GB, private host $280 to $350 a month for 14.7 usable vCPU with 6 TB; GameLift c6a.large $0.099 an hour on demand, $0.03 spot, bandwidth free; Hetzner CPX22 €16.99 to €19.99 a month with 20 TB; Fly.io `shared-cpu-1x` 1 GB $6.70 a month and $0.02 per GB — [Edgegap](https://edgegap.com/pricing); [GameLift](https://aws.amazon.com/gamelift/servers/pricing/); [Hetzner](https://www.hetzner.com/cloud/regular-performance/); [Fly.io](https://docs.fly.io/about/pricing)

### Inferences

Assumptions behind every figure (all are assumptions, none measured):
- 5 players a lobby. "Concurrent lobbies" is treated as a sustained average, 24 hours a day for a 730-hour month, which is an upper bound. If the figure is a daily peak, real cost is perhaps a third to a half of what is shown.
- Traffic of 5 kB/s (40 kbit/s) per client link, both directions together. Player-hosted: 4 links, 72 MB an hour, 52.6 GB per lobby-month. Dedicated: 5 links, 90 MB an hour, 65.7 GB per lobby-month. A heavier state sync could be three to five times this, and every traffic line scales with it.
- 20% of links need a relay in the WebRTC case. At 10% halve the TURN line, at 25% add a quarter.
- A dedicated room uses 0.25 vCPU, so 8 rooms on a 2 vCPU machine and 58 on an Edgegap private host.

Scale in players: 10 lobbies is 50 CCU, 100 is 500 CCU, 1,000 is 5,000 CCU. Player-hosted traffic a month: 526 GB, 5,256 GB, 52,560 GB.

(a) Player-hosted with a platform relay, per month:

| Service | 10 lobbies | 100 lobbies | 1,000 lobbies | Notes |
|---|---|---|---|---|
| Steam lobbies and SDR | $0 | $0 | $0 | $100 once per app; Steam builds only |
| EOS lobbies and P2P | $0 | $0 | $0 | Native builds only; limits unconfirmed |
| Unity Relay | about $31 | about $500 | about $5,200 | $72 and $792 of CCU fees at the two larger scales; the rest is traffic over the 150 GiB allowance |
| Photon public cloud | $0 to $125 | about $313 | about $3,100 (extrapolated) | Free 100 CCU plan may not cover 526 GB; no listed tier above 2,000 CCU, so the last column scales the 2,000 CCU plan by 2.5 and adds $0.05 per GB over the allowance |

(b) Player-hosted in browsers, WebRTC with a paid TURN fallback, per month. Relayed traffic at 20%: 105 GB, 1,051 GB, 10,512 GB.

| TURN provider | 10 lobbies | 100 lobbies | 1,000 lobbies | Notes |
|---|---|---|---|---|
| Cloudflare Realtime TURN ($0.05/GB) | about $5 | about $53 | about $526 | Any free allowance would lower this |
| Metered | $99 (Growth) | about $309 (Business plus overage) | about $1,350 (2 TB plan plus overage) | |
| Twilio ($0.40/GB) | about $42 | about $420 | about $4,200 | US and EU rate |
| Self-run coturn on one Hetzner CPX02 | about €6 | about €6 | about €6, more with a spare | 10.5 TB fits in 20 TB included; one region, own upkeep |
| Signalling (Cloudflare Workers) | $0 | $0 to $5 | $5 or a little more | Added to any row above |

(c) Dedicated servers, per month:

| Host | 10 lobbies | 100 lobbies | 1,000 lobbies | Notes |
|---|---|---|---|---|
| Edgegap on demand | about $190 | about $1,900 | about $19,200 | $12.59 compute plus $6.57 egress per always-on room; pays nothing when no rooms run |
| Edgegap private fleet | $280 to $350 (1 host) | $560 to $700 (2 hosts) | $5,040 to $6,300 (18 hosts) | Egress included |
| GameLift c6a.large on demand | about $145 (2) | about $940 (13) | about $9,030 (125) | Bandwidth free on this generation |
| GameLift c6a.large spot | about $44 | about $285 | about $2,740 | Spot instances can be reclaimed mid-session |
| Hetzner CPX22, self-run | €34 to €40 (2) | €221 to €260 (13) | €2,124 to €2,499 (125) | No orchestration, EU only at this price, shared vCPU |
| Fly.io `shared-cpu-1x` 1 GB, 4 rooms each | about $33 | about $300 | about $2,990 | Includes $0.02 per GB egress |

Reading across the three models:
- The gap is two to four orders of magnitude at every scale: $0 against tens, hundreds or thousands of dollars a month. Dedicated servers only pay for themselves if the design needs them (strangers matched together, trusted loot, sessions that outlive the host).
- Hobby scale (10 lobbies as a peak, so 3 to 5 on average) costs nothing on Steam or EOS, a few dollars in the browser, and €6 to €40 on a VPS.
- At modest commercial scale (1,000 lobbies), the browser route's relay bill is in the low hundreds a month with Cloudflare, about a tenth of Twilio's, so the choice of TURN provider matters more than the choice between browser and native.
- The 30% store cut dwarfs all of these for a paid game: at 1,000 concurrent lobbies a game has sold enough copies that even the dedicated-server lines are a small share of revenue. The running-cost question mostly matters for a free game.

### Gaps
- Bandwidth per link and CPU per room are assumed, not measured; a prototype should measure both before any of these lines is relied on.
- PlayFab, GameFabric, Nitrado and i3D are missing from table (c) for want of readable prices.
- Photon above 2,000 CCU and Edgegap's relay base tiers have no listed price.
- No published per-CCU cost figure from a shipped small co-op game was found to check the estimates against.
