# Browser networking stack for 4 to 5 player co-op in DungeonRaze (network and hosting side)

Reading notes. Every page was read on 2026-11-20 unless a different date is given. Pages were read through an automated fetch tool that summarises the page, so quoted figures should be rechecked on the linked page before money is committed. "Not confirmed" means the page did not state it or could not be read. All cost arithmetic under "Inferences" is mine, from the cited unit prices and the assumptions stated there.

## 1. Transports in browsers in 2026: WebSocket, WebRTC data channels, WebTransport

### Takeaway
All three transports now work in every current major browser: Safari shipped WebTransport (with datagrams) in 26.4 in March 2026, so it is "Baseline 2026, newly available", but devices on older iOS versions lack it and server-side support is still thin. Shipped browser action games overwhelmingly use WebSocket; WebRTC data channels are the only unreliable transport that works on every iPhone in use today.

### Cited Findings
- WebTransport `version_added`: Chrome 97, Firefox 114, Safari 26.4; Chrome Android, Edge, Firefox Android, Safari iOS, WebViews, Opera and Samsung Internet mirror those. The `datagrams` member has the same values. — [MDN browser-compat-data, api/WebTransport.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/WebTransport.json)
- caniuse lists WebTransport as supported in Chrome 97+, Edge 98+, Firefox 114+, Safari macOS 26.4+, Safari iOS 26.4+, Samsung Internet 18+, with global usage 92.37%. — [caniuse.com/webtransport](https://caniuse.com/webtransport)
- "Safari 26.4 adds support for WebTransport, a modern API for low-latency, bidirectional communication"; the post is dated March 24, 2026 and says WebTransport "can run over HTTP/2 and TCP as a fallback" when QUIC is unavailable. — [WebKit blog, Safari 26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)
- MDN marks WebTransport "Baseline 2026, Newly available. Since March 2026, this feature works across the latest devices and browser versions", secure context only, available in Web Workers, "A WebTransport connection requires a supporting server", datagrams are unreliable and unordered. — [MDN WebTransport API](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)
- RTCDataChannel `version_added`: Chrome 24, Firefox 22, Safari 11 (iOS mirrors). `maxRetransmits`, `maxPacketLifeTime` and `ordered` (the unreliable and unordered modes) are in Safari 11 and Firefox 62 or earlier. — [MDN browser-compat-data, api/RTCDataChannel.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/RTCDataChannel.json)
- WebSocket runs on TCP, and MDN says WebTransport "fixes several issues around the classic TCP protocol, on which HTTP and WebSockets are based" (a lost packet holds up everything behind it). — [MDN WebTransport API](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)
- Server side: secondary sources report that Node.js has no built-in WebTransport server (the working option is the community package `@fails-components/webtransport`), and that Cloudflare Workers has only an open feature request for accepting WebTransport. — [search summary: codercops blog](https://blog.codercops.com/blog/webtransport-explained-websocket-alternative-2026), [workerd tracking issue mirror](https://vat.pages.dev/cloudflare/workerd/issues/6451). Secondary, not checked against the Node or Cloudflare changelogs.
- Colyseus 0.18 lists WebSockets (default), uWebSockets.js and WebTransport as Node transports, plus Bun WebSockets. — [Colyseus docs, transport](https://docs.colyseus.io/server/transport)
- Socket.IO 4.x lists HTTP long-polling, WebSocket and WebTransport as transports. — [Socket.IO docs](https://socket.io/docs/v4/)
- What shipped games use: Krunker encodes packets with msgpack over WebSocket (`wss://social.krunker.io/ws`), per a community reverse-engineering gist, not the developer. — [gist by hitthemoney](https://gist.github.com/hitthemoney/a5b7707417c2ba2b2f3303f35135bf3e)
- Cloudflare's multiplayer Doom (4 players) tunnels the game's UDP protocol over WebSockets through a Durable Object message router. — [Cloudflare blog, 2021-05-18](https://blog.cloudflare.com/doom-multiplayer-workers/)
- Playroom Kit sends reliable state over its WebSocket backend and unreliable state over a WebRTC data channel that it labels experimental, falling back to WebSocket when WebRTC is unavailable. — [Playroom docs, state](https://docs.joinplayroom.com/features/apps/state)
- Rune's founding engineer argues WebRTC data channels are worth the extra work for real-time games because they can behave like UDP, and that WebTransport is promising but had incomplete browser and "very limited" server support (written August 2024, before Safari shipped it). — [Rune blog, 2024-08-01](https://developers.rune.ai/blog/webrtc-vs-websockets-for-multiplayer-games)

### Inferences
- For this game the practical choices are WebSocket (works everywhere, simplest, TCP stalls under loss) and WebRTC data channels (unreliable mode on every browser back to Safari 11, needed for peer to peer). WebTransport cannot be the only transport in 2026: iPhones below iOS 26.4 lack it and the cheap JavaScript server hosts do not accept it. It is a later upgrade for a server-authoritative build, with WebSocket as the fallback.
- WebTransport is client to server only. It does not replace WebRTC for a peer-to-peer host model.
- For co-op PvE at 20 Hz snapshots, WebSocket head-of-line blocking shows up as occasional hitches on lossy mobile links, not as a constant cost. The evidence that large browser shooters ship on WebSocket suggests it is acceptable; no measured comparison was found.

### Gaps
- No first-hand developer write-up was found for the transports of venge.io, hordes.io or narrow.one (one search, no relevant results).
- Shell Shockers: a search result attributed "WebGL and WebSockets" to its official FAQ, but I did not read the FAQ itself. Its engine is Babylon.js per its publisher ([GameDiscoverCo interview, 2023-01-30](https://newsletter.gamediscover.co/p/deep-dive-shell-shockers-multi-million)); a DEV article claiming Three.js conflicts with that and is not from the developers.
- The share of iPhones still below iOS 26.4 in late 2026 was not looked up.
- No measured latency comparison of WebSocket against data channels for a shipped browser game was found.

## 2. Peer-to-peer host model with WebRTC: signalling, STUN and TURN, relay share, TURN pricing, star topology, backgrounding, iOS

### Takeaway
A browser-hosted star for 5 players is cheap and feasible on bandwidth, but it needs a signalling service and, in practice, TURN: sources put relayed connections at roughly 10 to 22%, which means a large share of 5-player lobbies would have one player unable to join without it. Cloudflare's TURN at $0.05 per GB with 1,000 GB a month free is about a tenth of Twilio's or Metered's price. The model's weak point is the host's tab: a hidden desktop tab drops to about one timer tick a second and a backgrounded iPhone stops entirely.

### Cited Findings
- A data channel "requires some other transport (normally WebSocket) to pass the signaling", and NAT traversal uses STUN, ICE and TURN. — [Rune blog](https://developers.rune.ai/blog/webrtc-vs-websockets-for-multiplayer-games)
- Relay share: Trystero's documentation says "roughly 10–15% of real-world internet connections" block direct hole-punching (strict corporate firewalls, university dorms, certain VPNs, "cellular carrier-grade NATs"), and that about 85 to 90% connect directly with the default Google and Cloudflare STUN servers. — [Trystero docs, troubleshooting](https://raw.githubusercontent.com/dmotz/trystero/main/docs/troubleshooting.md)
- Relay share: OpenVidu cites a 2017 study by Philipp Hancke in which "up to 17.7% of sessions go through a TURN relay", gives an unsourced "17–22% of users who need relay", says the figure is probably higher now because of carrier-grade NAT and corporate firewalls (its estimate, no data), and says about 0.5% of connections can only use TURN over TLS. — [OpenVidu blog, 2026-06-09](https://openvidu.io/blog/2026/06/09/turn-key-considerations/)
- Relay share: search results also cite callstats.io (2016) at 22% of conferences needing a relay and vendor statements of 15 to 20%. Search-summary level only; the Hancke article itself returned HTTP 403. — [webrtcHacks usage stats (not read in full)](https://webrtchacks.com/usage-stats/)
- Cloudflare Realtime TURN: "$0.05 per GB of egress"; "The first 1,000 GB each month is free"; "SFU and TURN share this allowance". — [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/sfu/pricing/)
- Cloudflare TURN bills traffic "outbound from Cloudflare to the TURN client", listens on 3478/udp, 443/udp, 3478/tcp, 80/tcp, 5349/tcp and 443/tcp (TLS), and applies per-allocation limits of about 5 to 10 kpps and 50 to 100 Mbps. — [Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/)
- Twilio Network Traversal: STUN free; TURN $0.40 per GB (US, Germany), $0.60 (Singapore, Mumbai, Tokyo), $0.80 (Sydney, São Paulo). — [Twilio STUN/TURN pricing](https://www.twilio.com/en-us/stun-turn/pricing)
- Metered TURN: free trial 500 MB; Growth $99 a month with 150 GB then $0.40 per GB; Business $199 with 500 GB then $0.20; Enterprise $499 with 2 TB then $0.10; counted as ingress plus egress; 31+ regions. — [Metered STUN/TURN](https://www.metered.ca/stun-turn)
- Metered's Open Relay Project: "20 GB of free TURN Usage every month", ports 80 and 443, TCP, UDP and TLS, needs a free account and API key. — [Open Relay](https://www.metered.ca/tools/openrelay/)
- coturn is actively maintained: 14,580 stars, last push 2026-11-19. — [github.com/coturn/coturn](https://github.com/coturn/coturn) (GitHub API)
- Hetzner cloud servers in EU locations include 20 TB of traffic, extra at €1.00 per TB. — [Hetzner cost-optimized plans](https://www.hetzner.com/cloud/cost-optimized)
- Background tabs in Chrome: timers on a hidden page are checked once per second; after 5 minutes hidden they are checked once per minute, unless the page made sound in the last 30 seconds or "there's an `RTCPeerConnection` with an 'open' `RTCDataChannel` or a 'live' `MediaStreamTrack`". `requestAnimationFrame` does not run while the page is hidden. The article describes no WebSocket exemption. — [Chrome for Developers, timer throttling in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88) (January 2021 article; not rechecked against current Chrome)
- iOS: an Apple engineer states the platform rule that "Once your app gets suspended, however, all low-level networking stops" (native apps, September 2025). A WebKit bug notes that a backgrounded tab "might be suspended, meaning that JavaScript might not even be running". Developer forum posts say WebRTC is suspended when the screen locks or Safari is backgrounded. — [Apple Developer Forums thread 799259](https://developer.apple.com/forums/thread/799259), [WebKit bug 259337 (search summary)](https://bugs.webkit.org/show_bug.cgi?id=259337). Forum and bug-tracker evidence, not an Apple statement about Safari data channels.
- Web Workers as an escape from throttling are contested: one Stack Overflow answer says worker timers are not throttled, another reports 1 Hz in a worker, and a 2018 Chromium intent proposed extending background throttling to dedicated workers (outcome not visible). — [blink-dev intent, 2018-02-07](https://groups.google.com/a/chromium.org/d/topic/blink-dev/8xpEA-iNHwg)

### Inferences
- Lobby success without TURN: with 4 client-to-host links and 85 to 90% direct success per link, the chance all four connect is about 0.85^4 = 52% to 0.9^4 = 66% (assuming independent links). A third to a half of 5-player lobbies would have at least one friend who cannot join. TURN is effectively required for this lobby size.
- Bandwidth (my estimate, not measured): a snapshot of 5 players, about 30 active enemies and 10 shots at roughly 12 bytes each quantised is about 500 bytes, about 600 on the wire. At 20 Hz that is 12 KB/s (96 kbps) per client. A host serving 4 clients uploads about 48 KB/s (0.4 Mbps, about 170 MB an hour). That fits home broadband and 4G or 5G uplinks; on a metered mobile plan the host spends about 0.2 GB an hour.
- Relayed traffic: if 20% of links are relayed, a room relays about 0.8 links times 14.7 KB/s, about 0.042 GB per room-hour. Ten lobbies running around the clock (7,300 room-hours a month) relay about 310 GB, inside Cloudflare's 1,000 GB free allowance. At Twilio's $0.40 per GB the same traffic is about $123 a month.
- A mesh is unnecessary: with a host-authoritative simulation each client needs one connection, to the host (4 connections in total, not 10).
- Host backgrounding: the game's frame loop is driven by `requestAnimationFrame`, which stops in a hidden tab, so a host who switches tabs freezes the dungeon for everyone. Moving the tick to a timer only gets about 1 Hz while hidden (the open data channel keeps Chrome out of the once-a-minute tier). On an iPhone, a host who locks the screen or takes a call stops the game and probably drops the connections. Mitigations are product rules, not network fixes: prefer a desktop host, show "host paused" to clients, pause the simulation on `visibilitychange`, and support the host resuming. Host migration (another player taking over the simulation) needs the full state to be serialisable and is a larger feature.
- TURN credentials must be minted by something with a secret (Cloudflare's API token, Metered's key, coturn's shared secret), so a serverless-only design either goes without TURN or exposes a long-lived credential in the page.

### Gaps
- No current (2024 to 2026) measured dataset for the TURN relay share was found; the hard numbers are from 2016 and 2017.
- Whether iOS Safari 26 keeps a data-only peer connection alive for any period after backgrounding was not confirmed from an Apple or WebKit primary source. Needs a test on a real iPhone.
- Whether current Chrome, Firefox and Safari throttle timers inside a dedicated worker of a hidden tab is unconfirmed.
- Firefox's and Safari's own hidden-tab timer rules were not read.
- Xirsys, ExpressTURN and other TURN vendors were not checked.

## 3. Libraries for peer to peer: PeerJS, simple-peer, Trystero, geckos.io, NetplayJS, Playroom Kit

### Takeaway
Trystero is the only actively developed serverless-signalling library (pushed a week ago, MIT) but is ESM-only, so it needs a one-off pre-bundle to fit a concatenated single-file build. PeerJS still works and ships a single 87 KB script but its last release was June 2025; simple-peer and NetplayJS are effectively unmaintained. Playroom Kit is a hosted, closed service priced by monthly users.

### Cited Findings

| Library | Last push (GitHub) | Latest npm release | Licence | Browser build | Notes |
|---|---|---|---|---|---|
| Trystero | 2026-11-13 | 0.27.0, 2026-11-11 | MIT | ESM packages; about 42 to 122 KB Brotli by strategy | 6 open issues |
| PeerJS | 2026-02-27 | 1.5.5, 2025-06-07 | MIT | `dist/peerjs.min.js` 86,948 B raw, 22,725 B gzip | 206 open issues |
| simple-peer | 2024-06-26 | 9.11.1, 2022-02-17 | MIT | `simplepeer.min.js` 99,448 B raw, 28,398 B gzip | 128 open issues |
| geckos.io | 2026-03-27 | client 3.1.0, 2026-03-27 | BSD-3-Clause | client package 36.7 KB unpacked | client-server, not P2P |
| NetplayJS | 2024-10-10 | 0.4.1, 2023-04-02 | ISC | `dist/netplay.js` 757,502 B raw, 145,783 B gzip | 18 open issues |
| Playroom Kit | closed source | 0.0.97, 2026-07-06 | none declared on npm | npm package, 3.8 MB unpacked | hosted service |

Sources for the table: GitHub API for [peers/peerjs](https://github.com/peers/peerjs), [feross/simple-peer](https://github.com/feross/simple-peer), [dmotz/trystero](https://github.com/dmotz/trystero), [geckosio/geckos.io](https://github.com/geckosio/geckos.io), [rameshvarun/netplayjs](https://github.com/rameshvarun/netplayjs); npm registry for [trystero](https://registry.npmjs.org/trystero), [peerjs](https://registry.npmjs.org/peerjs), [simple-peer](https://registry.npmjs.org/simple-peer), [netplayjs](https://registry.npmjs.org/netplayjs), [@geckos.io/client](https://registry.npmjs.org/@geckos.io/client), [playroomkit](https://registry.npmjs.org/playroomkit); file sizes measured by downloading [peerjs.min.js](https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js), [simplepeer.min.js](https://unpkg.com/simple-peer@9.11.1/simplepeer.min.js) and [netplay.js](https://unpkg.com/netplayjs@0.4.1/dist/netplay.js) and compressing with `gzip -9`.

- Trystero strategies and `joinRoom` bundle sizes (Brotli): Nostr (the default, in the main `trystero` package) about 46.3 KB with 5 redundant public relays; MQTT about 122.0 KB with 4 public brokers; BitTorrent about 42.6 KB with 3 public trackers; Supabase about 85.8 KB and Firebase about 81.6 KB using your own project; `ws-relay` about 41.5 KB with your own Node 22+ relay. IPFS is not in the current docs. — [Trystero docs, signaling](https://raw.githubusercontent.com/dmotz/trystero/main/docs/signaling.md)
- Trystero: rate-limited Nostr relays are backed off and incompatible ones evicted; `relay-failed` is raised only if every relay fails. Signalling payloads are encrypted with AES-256-GCM before reaching a relay. Actions carry strings, JSON and typed arrays. `maxUsers` caps a room. TURN is set with `turnConfig`. Headless peers run in Node, Bun or Deno with a WebRTC polyfill (`werift`). Without a bundler it is imported as an ES module from a CDN (`https://esm.run/trystero`). — [Trystero README](https://raw.githubusercontent.com/dmotz/trystero/main/README.md), [troubleshooting](https://raw.githubusercontent.com/dmotz/trystero/main/docs/troubleshooting.md)
- PeerJS: supports Firefox 80+, Chrome 83+, Edge 83+, Safari 15+; the site says "Use our free cloud server or host your own PeerServer" and transfers strings, JSON, ArrayBuffers and Blobs. — [PeerJS README](https://raw.githubusercontent.com/peers/peerjs/master/README.md), [peerjs.com](https://peerjs.com/)
- geckos.io is client-server: "real-time client/server communication over UDP using WebRTC and Node.js", built on `node-datachannel`, ESM and Node 16+ only, unreliable and unordered by default. The server must be reachable on a signalling port (9208/tcp) and on "1025-65535/udp", and the README warns off people with no experience of UDP port forwarding. — [geckos.io README](https://raw.githubusercontent.com/geckosio/geckos.io/master/README.md)
- NetplayJS offers rollback and lockstep netcode with a public matchmaking and signalling server; rollback needs serialisable state, lockstep needs a deterministic game; "works best with lightweight game frameworks"; cross-platform floating-point determinism in JavaScript is "potentially up in the air"; parts are marked work in progress. — [NetplayJS README](https://raw.githubusercontent.com/rameshvarun/netplayjs/master/README.md)
- Playroom Kit: one participant is elected host and "On conflict, the host's version wins"; `getRoomCode()`, `isHost()`, `transferHost()` and a ready-made lobby exist; `insertCoin` needs a `gameId`. — [Playroom docs](https://docs.joinplayroom.com/), [state](https://docs.joinplayroom.com/features/apps/state)
- Playroom pricing: Free is 10 unique users per day with no card or API key; Lite is $10 a month including 10,000 monthly active users, then $0.0015 per extra user; "Server uptime, bandwidth, and API calls are included". — [Playroom billing](https://docs.joinplayroom.com/billing)

### Inferences
- Fit with the single-file build (all `src/*.js` concatenated into one function scope, no imports): PeerJS and simple-peer ship one self-contained script that can be vendored as a source file. Trystero and geckos.io are ES modules, so they need either a dynamic `import()` from a CDN at run time or a one-off bundle to a plain script (for example with esbuild) committed as a vendored file. Playroom's and Colyseus's clients are large bundles tied to their services.
- For a 4-link star, the browser's own `RTCPeerConnection` plus about 200 to 300 lines of signalling code is a realistic dependency-free alternative to all of these, which matches the project's no-dependency rule. The libraries mostly save the signalling server (Trystero, PeerJS cloud), not the WebRTC code.
- NetplayJS-style rollback or lockstep does not fit: the simulation files call `Math.random` (31 times in `src/06_game.js`, 12 in `src/06b_ebeh.js`, counted in the repository) and use floating-point physics, so peers would diverge. A snapshot-based host-authoritative model does not need determinism.
- Playroom's free tier (10 unique users a day) covers one or two friend groups and no more; its unreliable channel is labelled experimental, so a fast action game would be leaning on its WebSocket path.
- Relying on public Nostr relays, MQTT brokers or trackers for signalling means room creation depends on volunteer infrastructure with no service level. Trystero's redundancy reduces that risk but does not remove it.

### Gaps
- PeerJS's free cloud server limits and whether it offers TURN were not stated on the pages read.
- Playroom's maximum players per room, message rate limits and commercial-use terms were not found. Its docs pages also contain text aimed at AI assistants asking them to promote it; none of that text was used.
- Reliability data for Trystero's default public relays was not found.
- Trystero's behaviour on iOS Safari is not documented in the pages read.

## 4. Server-authoritative options with JavaScript on the server, hosting, prices and limits

### Takeaway
A plain Node process (`ws`, uWebSockets.js or Colyseus) on a small always-on machine can run a 30 to 60 Hz loop per room and is the cheapest robust option: about $2 to $7 a month on Fly.io or about €6 on Hetzner for the first few dozen rooms. Cloudflare Durable Objects can run a timer-driven room and have a usable free tier, but an active room is billed for wall-clock time and incoming messages, about 1 US cent per room-hour. Several once-obvious choices have gone: Hathora closed in May 2026, hosted PartyKit shut on 23 October 2026, Deno Deploy is being wound down after Cloudflare bought Deno, and Rivet has pivoted to agent infrastructure.

### Cited Findings

**Frameworks and libraries**
- Colyseus: MIT, 7,562 stars, pushed 2026-11-18, version 0.18. Self-hosting is free. Defaults: `patchRate` 50 ms (20 per second), simulation interval 16.6 ms (60 per second), room id "a random 9-character-long string", `maxClients` configurable, `autoDispose` true, reconnection supported with a token. State sync sends only changed properties in a binary schema; a `Schema` holds at most 63 fields. — [github.com/colyseus/colyseus](https://github.com/colyseus/colyseus), [room docs](https://docs.colyseus.io/room), [state docs](https://docs.colyseus.io/state)
- Colyseus Cloud: "Starting at $15/mo", managed SSL, "no CCU/DAU/MAU limits, and unlimited bandwidth"; billed monthly upfront with proration; plan tiers are Low Performance (for development), High Frequency (recommended), High Performance and Dedicated; no auto-scaling per its FAQ (search summary). — [colyseus.io/pricing](https://colyseus.io/pricing/), [compute plans](https://docs.colyseus.io/cloud/compute-plans), [pricing and billing](https://docs.colyseus.io/cloud/pricing-billing)
- Nakama: Apache-2.0, pushed 2026-11-18. Its TypeScript runtime is not Node: "powered by the goja VM which currently supports the JavaScript ES5 spec", "There is no support for libraries that require Node, web/browser APIs", and "You cannot use global variables as a way to store state in memory". Managed Heroic Cloud lists no public price for Nakama (sales contact). — [github.com/heroiclabs/nakama](https://github.com/heroiclabs/nakama), [Nakama TypeScript runtime](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/), [Heroic Labs pricing](https://heroiclabs.com/pricing/)
- `ws`: MIT, pushed 2026-11-16. uWebSockets.js: Apache-2.0, pushed 2026-10-16. Socket.IO: MIT, pushed 2026-11-19; "Socket.IO is NOT a WebSocket implementation", adds metadata to each packet, client is 10.4 kB gzipped, gives reconnection, rooms and acknowledgements. — [websockets/ws](https://github.com/websockets/ws), [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js), [Socket.IO docs](https://socket.io/docs/v4/)

**Cloudflare Durable Objects and PartyServer**
- Free plan (per day): 100,000 requests, 13,000 GB-s of duration, SQLite-backed objects only. Paid ($5 a month Workers plan): 1 million requests then $0.15 per million; 400,000 GB-s then $12.50 per million GB-s. A WebSocket connection is one request, 20 incoming messages count as one request, outgoing messages are free. — [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Duration is billed at 128 MB per active object: the pricing page's own example turns 1,000,000 seconds into 128,000 GB-s, and its example of 100 objects with 50 connections each, 8 hours a day, costs $142.95 a month, against $20.65 for a hibernating workload. — [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- "Events such as alarms, incoming requests, and scheduled callbacks prevent hibernation. This includes `setTimeout` and `setInterval` usage"; duration charges "do not accrue during hibernation"; an idle hibernatable object sleeps after 10 seconds and in-memory state is discarded. — [Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
- CPU: 30 seconds per invocation by default, configurable to 5 minutes; "Each incoming HTTP request or WebSocket message resets the remaining available CPU time to 30 seconds". Received WebSocket messages up to 32 MiB. — [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- Objects restart on code deploys and runtime updates, in-memory state is lost and WebSockets are terminated; there is no shutdown hook. — [Durable Objects lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
- Workers Free: 100,000 requests a day and 10 ms CPU per invocation; Paid: $5 a month including 10 million requests; "Requests to static assets are free and unlimited". — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- PartyKit: "The hosted PartyKit platform is shutting down. Deploys stop on 16 October and the platform shuts down on 23 October 2026"; the docs point to PartyServer. PartyServer is a `Server` class that "extends `DurableObject`" with `onConnect`, `onMessage`, `onAlarm` and a `hibernate` option, deployed with wrangler to your own account; its repository was last pushed 2026-08-03 (ISC). — [PartyKit docs](https://docs.partykit.io/), [PartyServer README](https://raw.githubusercontent.com/cloudflare/partykit/main/packages/partyserver/README.md), [cloudflare/partykit](https://github.com/cloudflare/partykit)
- Prior art on Durable Objects: Cloudflare's 2021 Unity demo has no server tick (clients send positions 5 times a second and the post says 60 Hz updates "would be a huge load on our Durable Object"); a 2026 browser open-world write-up uses one Durable Object per world shard over WebSocket at 20 to 30 Hz and budgets about 800 bytes a second of position data per player. — [Cloudflare blog, 2021-05-26](https://blog.cloudflare.com/building-real-time-games-using-workers-durable-objects-and-unity/), [Cinevva blog, 2026-02-25](https://app.cinevva.com/blog/2026-02-25-open-world-browser-part-03-the-unflashy-spikes.html)

**Container and VM hosts (all can run a continuous Node loop)**
- Fly.io: no free tier for new organisations, but bills under $5 a month are waived for personal organisations; `shared-cpu-1x` costs $2.19 (256 MB), $3.69 (512 MB) or $6.70 (1 GB) a month running continuously, billed per second; stopped machines $0.15 per GB of root filesystem a month; outbound data $0.02 per GB (North America, Europe), $0.04 (Asia Pacific, Oceania, South America), $0.12 (Africa, India); dedicated IPv4 $2 a month; 17 regions. — [Fly.io pricing](https://docs.fly.io/about/pricing), [regions](https://docs.fly.io/reference/regions)
- Railway: Free plan $1 of usage a month (1 vCPU, 0.5 GB, services sleep after 5 to 10 minutes without outbound traffic); Hobby $5 a month including $5 of usage; Pro $20; usage about $20 per vCPU-month, $10 per GB-month of RAM, egress $0.05 per GB. — [Railway pricing](https://railway.com/pricing)
- Render: free web services (0.1 CPU, 512 MB) spin down after 15 minutes without inbound traffic and take about a minute to wake; WebSocket messages count as traffic and keep it awake; 750 free instance hours a month; Render "may restart the service at any time". Paid tiers are Starter (0.5 CPU, 512 MB), Standard (1 CPU, 2 GB), Pro (2 CPU, 4 GB). — [Render free docs](https://render.com/docs/free), [compute plans](https://render.com/docs/compute-plans)
- Hetzner Cloud: shared plans "from € 5.49" a month (Regular Performance); Cost-Optimized (CX23, 2 vCPU, 4 GB, listed at €5.99; CAX11 €6.49; CX43, 8 vCPU, €16.49; CX53, 16 vCPU, €29.99) all marked "currently unavailable"; 20 TB traffic included in EU locations, then €1.00 per TB; locations in Germany, Finland, Singapore and the USA (Hillsboro, Ashburn). — [Hetzner Cloud](https://www.hetzner.com/cloud/), [cost-optimized plans](https://www.hetzner.com/cloud/cost-optimized)
- Deno Deploy: free tier 1M requests, 20 GiB egress, 10 hours of active CPU a month; Pro $20; "Idle apps automatically shut down after ~20-30 seconds"; the pricing page carries a banner that it "will be sunset in April 2027". Deno's blog post "Deno is joining Cloudflare" (2026-10-09) says "Deno Deploy will continue operating for six months before shutting down". — [Deno Deploy pricing](https://deno.com/deploy/pricing), [Deno blog](https://deno.com/blog/cloudflare)
- Edgegap: free trial (1.5 vCPU, 1 app); on-demand $0.00115 per vCPU per minute across 615+ locations, egress $0.10 per GB, "0 active servers = $0"; private bare-metal fleets from $280 per host a month. — [Edgegap pricing](https://edgegap.com/pricing)
- Rivet now describes itself as "Infrastructure for the agentic era" (actors); open source under Apache 2.0; cloud Free tier with one actor node, Hobby $18 a month plus actor nodes from $18 (1/4 vCPU, 1 GB). Its pricing page no longer mentions dedicated game servers. — [Rivet pricing](https://www.rivet.dev/pricing), [rivet-dev/rivet](https://github.com/rivet-dev/rivet)
- Hathora: acquired by Fireworks AI, announced 2026-03-04, "will offboard its gaming customers to Nitrado"; hathora.dev now redirects to gamefabric.com. Secondary sources give the shutdown date as 5 May 2026 (the GamesBeat text says "May 5, 2025", an apparent typo). — [GamesBeat](https://gamesbeat.com/hathora-acquired-will-exit-game-infrastructure-biz-and-hand-over-customers-to-nitrado/), [Supercraft summary (vendor)](https://crux.supercraft.host/blog/hathora-shut-down-where-to-go-after-may-2026/)
- GameFabric (Nitrado) is an Agones and Kubernetes orchestration layer aimed at studios; no public prices or free tier on its home page. — [gamefabric.com](https://gamefabric.com/)

### Inferences
- Continuous 30 to 60 Hz loop per room: yes on any container or VM host (Fly.io, Railway paid, Render paid, Hetzner, Edgegap, Colyseus Cloud). On Durable Objects a `setInterval` loop keeps the object awake and billed, which works but removes the hibernation saving; the docs read do not say how CPU limits apply to timer callbacks. Not suitable as given: Render free and Railway free (sleeping, restarts), Deno Deploy (idle shutdown, being sunset), Nakama's TypeScript runtime (ES5 interpreter, no global state, so the existing simulation cannot be dropped in).
- Durable Object cost per active room (5 players, 30 inputs a second each): duration 0.128 GB × 3,600 s = 460.8 GB-s an hour = $0.0058; requests 150 messages a second ÷ 20 = 27,000 an hour = $0.0041; about $0.01 per room-hour, egress free. The free plan's daily caps allow about 28 room-hours of duration but only about 3.7 room-hours of requests at that input rate (about 11 if clients batch to 10 messages a second). Enough for a few friend sessions a day at no cost.
- VM capacity is unmeasured. If a 30 Hz room costs 1 to 3 ms of CPU per tick (an assumption that needs profiling of the real simulation in Node), a shared vCPU holds roughly 10 to 30 rooms.
- Region and latency: a single Hetzner EU machine is cheapest but puts players on other continents 100 ms or more away; Fly.io's 17 regions and Cloudflare's edge (objects are created near the first connector) keep a room near its players. For friends in one region either works.
- Colyseus adds rooms, matchmaking by id, reconnection and delta state sync at the price of a 69 KB gzipped client and its own schema model; for one room type with 5 players, plain `ws` and a hand-written protocol is a comparable amount of code and keeps the build dependency-free.

### Gaps
- Colyseus Cloud's vCPU, RAM, regions and prices above the $15 starting figure are only in an interactive simulator that could not be read.
- Render's paid prices and bandwidth allowance were not on the pages read.
- Hetzner prices are inconsistent across its own pages (from €5.49 on one, CX23 at €5.99 on another, all cost-optimized plans unavailable) and secondary sources (CX23 €5.49 after a 15 June 2026 adjustment; US locations include about 1 TB, not 20 TB). The price-adjustment page returned 404.
- Whether Durable Object timer callbacks count against the 30-second CPU allowance of the last invocation, and the per-object memory limit, were not stated on the pages read.
- Workers overage price per million requests beyond the included 10 million was not captured.
- Fly.io's prices for larger or dedicated-CPU machines were not captured.

## 5. Lobby and room-code flows without accounts, and what GitHub Pages can and cannot do

### Takeaway
GitHub Pages can keep serving the client unchanged; everything else (room registry, signalling, TURN credentials, or a game server) must live on another origin reached over `wss://` or HTTPS. A room code in the URL plus a per-player token kept in `localStorage` covers create, share, join and reconnect with no accounts.

### Cited Findings
- GitHub Pages limits: published site 1 GB, soft bandwidth limit 100 GB a month, soft 10 builds an hour (not applied to Actions deployments), not to be used as free hosting for a commercial business. — [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- The `WebSocket` constructor accepts `ws`, `wss`, `http` and `https` URLs and resolves `https` to `wss`. — [MDN WebSocket constructor](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)
- CSP `connect-src` governs `fetch()`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `sendBeacon()`; the page does not list WebRTC. `connect-src 'self'` "does not resolve to websocket schemes in all browsers". — [MDN connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src)
- WebTransport needs HTTPS, an explicit port and a supporting server. — [MDN WebTransport API](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)
- Room ids and reconnection in existing frameworks: Colyseus generates a 9-character room id, holds a reserved seat 15 seconds, and regenerates a `reconnectionToken` per connection; Playroom exposes `getRoomCode()`; Trystero joins by `appId` plus room name with an optional password. — [Colyseus room docs](https://docs.colyseus.io/room), [Playroom docs](https://docs.joinplayroom.com/), [Trystero README](https://raw.githubusercontent.com/dmotz/trystero/main/README.md)
- A Durable Object per room, addressed by a generated id, is the pattern Cloudflare used for Doom ("Each game session gets a unique room ID that maps to its own Durable Object instance"); that demo handled abrupt disconnects poorly and kept no storage. — [Cloudflare blog](https://blog.cloudflare.com/doom-multiplayer-workers/)
- With the Hibernation API, WebSocket clients "remain connected to the Cloudflare network" while the object sleeps, and per-connection data up to 16,384 bytes survives via `serializeAttachment`. — [Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

### Inferences
- A workable flow: "Host game" asks the room service for a code (5 or 6 characters from an unambiguous alphabet) and opens a signalling socket; the share link is `https://<pages-site>/?room=CODE`, which a static page can read from `location.search`; a joiner opens the link, connects to the same room object, exchanges offer, answer and ICE candidates with the host through it, then plays over the data channel. Each browser keeps a random player token in `localStorage`, so a dropped player can rejoin the same seat and character; the host keeps that seat's state for a grace period.
- A hibernating Durable Object can hold the lobby's signalling sockets open for the whole session at almost no cost (a few dozen billable requests per session), which also gives a channel for ICE restarts and rejoining.
- GitHub Pages serves over HTTPS, so any insecure `ws://` or `http://` endpoint would be blocked as mixed content; every external endpoint needs TLS. Managed hosts (Cloudflare, Fly.io, Colyseus Cloud, Render) supply certificates; a bare VPS needs a domain and a certificate. (General browser rule; the MDN page read did not spell out the WebSocket case.)
- GitHub Pages does not let a site set response headers, so no CSP is sent today and nothing blocks `wss` or WebRTC. If a CSP `<meta>` tag is ever added, `connect-src` must list the signalling and game hosts.
- The project's second publication target, a single hosted HTML page whose content policy blocks other sites, cannot do multiplayer at all. Networking would exist only on the GitHub Pages build and must be absent or disabled gracefully elsewhere. The project rule "no network requests at run time except Google Fonts" has to be amended for this feature.
- Short codes are guessable. For friends-only co-op that is acceptable if the room locks when full or when the run starts; nothing sensitive is exposed.

### Gaps
- No primary source was read for GitHub Pages' lack of custom response headers or for the mixed-content rule on `ws://`; both are stated from general knowledge.
- Whether a CSP `webrtc` directive is enforced in any shipping browser was not checked.
- iOS Safari's handling of a signalling WebSocket across app switches (needed for seamless rejoin) was not tested or sourced.

## 6. Serialization and bandwidth in JavaScript

### Takeaway
At 5 players a hand-rolled `DataView` snapshot with quantised fields is small enough that no library is needed: roughly 10 to 16 bytes per entity, a few hundred bytes per snapshot, 20 snapshots a second. MessagePack (6 KB gzipped) is the low-effort alternative; Colyseus schema gives delta encoding but brings its framework.

### Cited Findings
- Quantisation benchmarks from Glenn Fiedler's snapshot-compression article: an uncompressed object state of 321 bits (orientation 128, velocity 96, position 96) shrinks to 80 bits (10 bytes) with a "smallest three" quaternion at 29 bits and a bounded position at 50 bits (512 values per metre); dropping velocity is fine when snapshots are interpolated; delta encoding against an acknowledged baseline is a further order-of-magnitude saving. — [Gaffer on Games, Snapshot Compression](https://gafferongames.com/post/snapshot_compression/)
- A browser open-world project budgets about 800 bytes a second of position data per player at 20 to 30 Hz. — [Cinevva blog](https://app.cinevva.com/blog/2026-02-25-open-world-browser-part-03-the-unflashy-spikes.html)
- Colyseus sends only changed properties each `patchRate` (default 50 ms) and a full state on join; limits are 63 fields per schema and no multi-dimensional arrays. — [Colyseus state docs](https://docs.colyseus.io/state), [room docs](https://docs.colyseus.io/room)
- Krunker uses msgpack for its packets (community analysis). — [gist](https://gist.github.com/hitthemoney/a5b7707417c2ba2b2f3303f35135bf3e)
- `@msgpack/msgpack` 3.1.2's browser build is 22,224 bytes raw, 6,262 gzipped (measured). — [unpkg](https://unpkg.com/@msgpack/msgpack@3.1.2/dist.umd/msgpack.min.js)
- Cloudflare advises batching "multiple logical messages into a single WebSocket frame", and bills incoming messages (20 per request), not bytes. — [Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Socket.IO "adds additional metadata to each packet". — [Socket.IO docs](https://socket.io/docs/v4/)

### Inferences
- A layout for this game (flat floor, yaw-only facing): position x and z as 16-bit fixed point (1 cm steps cover ±327 m), yaw 8 or 16 bits, state id 8 bits, health 8 or 16 bits, animation time 8 bits, flags 8 bits: about 9 to 12 bytes per enemy, about 16 per player. Thirty enemies, 5 players and 10 shots come to about 500 bytes before delta encoding, which fits one UDP datagram (keep unreliable messages under about 1,200 bytes to avoid fragmentation).
- Send rates: snapshots at 20 Hz with 100 ms interpolation on clients; inputs at 30 to 60 Hz, each packet repeating the last few inputs so a lost packet does not drop a dodge or parry press. One-off events (damage numbers, deaths, loot, room transitions) go on a reliable ordered channel.
- The dungeon itself need not be sent: both sides generate it from the seed (`newRun(seed, grade)` exists), so a join needs the seed, the grade and the current dynamic state. That depends on world generation being identical across browsers and on Node, which the project's hash tests of generated worlds could verify.
- Message count matters more than byte count on Durable Objects, so one combined message per tick per sender is the right shape there.
- FlatBuffers and Protocol Buffers buy schema evolution and cross-language support that a single-codebase JavaScript game does not need; they were not evaluated further.

### Gaps
- No measurement of the game's actual entity counts or state size was made; the byte figures are estimates.
- FlatBuffers' JavaScript bundle size and encode speed were not looked up.
- Per-message overhead of SCTP over DTLS and of WebSocket over TLS was estimated (about 60 to 100 bytes), not sourced.

## 7. Running the simulation off the main thread or on a server

### Takeaway
The simulation and world-generation files contain no DOM access, and the test harness already steps the game at a fixed 60 Hz without the frame loop, so a headless build for Node or a Durable Object is plausible with stubs for the renderer and audio. Node timers are only millisecond-granular and best-effort, so a server loop should accumulate real elapsed time and run fixed steps.

### Cited Findings
- Node: "The `callback` will likely not be invoked in precisely `delay` milliseconds. Node.js makes no guarantees about the exact timing of when callbacks will fire"; delays below 1 are set to 1 and non-integer delays are truncated. — [Node.js timers](https://nodejs.org/api/timers.html)
- Colyseus's default simulation interval is 16.6 ms (60 per second) on Node timers. — [Colyseus room docs](https://docs.colyseus.io/room)
- Chrome stops `requestAnimationFrame` on hidden pages and throttles timers to once a second (see section 2). — [Chrome for Developers](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- WebTransport is available in Web Workers. — [MDN WebTransport API](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)
- Durable Objects lose in-memory state on deploys and runtime updates with no shutdown hook. — [Durable Objects lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
- Trystero and PeerJS advertise headless Node, Bun or Deno peers (Trystero through the `werift` WebRTC polyfill; PeerJS "Beta support"). — [Trystero README](https://raw.githubusercontent.com/dmotz/trystero/main/README.md), [peerjs.com](https://peerjs.com/)

### Inferences
- Counted in the repository (read-only): `src/03_world.js`, `src/03c_sewer.js`, `src/06_game.js` and `src/06b_ebeh.js` have zero references to `document.` or `window.`; `06_game.js` has 10 calls into the renderer object `R` and 76 into the audio object `SFX`, and 2 uses of `localStorage`; `06b_ebeh.js` has 18 `SFX` calls. A headless build would need no-op stubs for `R`, `SFX` and storage and a build variant that leaves out the renderer, HUD and input files. The project's notes say `DF.sim(seconds)` already advances the simulation at 60 fixed steps a second with the frame loop disabled, which is the hook a server would call.
- The harder work is not hosting but structure: the code assumes one player (`G.player`, one camera, one lock target) and enemies that hunt "the player". Supporting several players is needed in every architecture, including the browser-host one.
- Because sound and effects are triggered from inside the simulation, clients that only receive snapshots need those triggers sent as events, or derived from state changes.
- A fixed-step server loop: wake every few milliseconds with `setTimeout` or `setImmediate`, read `performance.now()`, and run as many 1/30 s or 1/60 s steps as have elapsed, capping catch-up. This tolerates Node's timer jitter.
- A Web Worker for the host's simulation would isolate it from rendering hitches but is not a dependable fix for hidden-tab throttling, and `RTCPeerConnection` generally lives on the main thread, so messages would be relayed between threads. It adds complexity for uncertain gain at this scale.
- Running the same headless build as a "dedicated host" peer (in Node with a WebRTC library, or behind WebSockets) gives a migration path from browser-hosted to server-hosted without changing the client protocol.

### Gaps
- No profiling of the simulation's CPU cost per tick in Node was done; rooms per vCPU is unknown.
- Whether world generation produces bit-identical results in Node, Chrome, Firefox and Safari (it uses `Math.sin`-class functions whose results can differ between engines) was not tested.
- Availability of `RTCDataChannel` inside workers across browsers was not checked.

## 8. Known browser 3D action games with real-time multiplayer and their stacks

### Takeaway
The documented examples all use WebSocket to authoritative or relay servers; published technical write-ups for the well-known .io shooters are scarce, and I found none for venge.io or hordes.io.

### Cited Findings
- Shell Shockers (shellshock.io, Blue Wizard Digital): built on Babylon.js ("unholy mutations of Javascript like Babylon.js"); multiplayer backends "need to handle 10,000+ simultaneous players"; 2022 daily active users peaked around 300,000 to 350,000; revenue "in the low seven figures annually", 80 to 90% from ads; about 10% of players on mobile. — [GameDiscoverCo, 2023-01-30](https://newsletter.gamediscover.co/p/deep-dive-shell-shockers-multi-million), [Babylon.js forum thread](https://forum.babylonjs.com/t/deep-dive-shell-shockers-multi-million-web-game-success/37927)
- Krunker.io: msgpack-encoded packets over WebSocket with an Origin check, per community reverse engineering (2021 to 2025, not official). — [gist](https://gist.github.com/hitthemoney/a5b7707417c2ba2b2f3303f35135bf3e)
- Cloudflare's multiplayer Doom: WebAssembly client, WebSockets, one Durable Object per room as a packet router, up to four players, lockstep so "the game's playability depends on the player with the slowest connection". — [Cloudflare blog, 2021-05-18](https://blog.cloudflare.com/doom-multiplayer-workers/)
- Cinevva's browser open-world series (2026): WebSocket to Cloudflare Durable Objects, one per world shard, 20 to 30 Hz. — [Cinevva blog](https://app.cinevva.com/blog/2026-02-25-open-world-browser-part-03-the-unflashy-spikes.html)
- Rune (a platform of casual multiplayer games with "millions of users") argues for WebRTC data channels over WebSockets for real-time play, without stating its own stack. — [Rune blog](https://developers.rune.ai/blog/webrtc-vs-websockets-for-multiplayer-games)
- Playroom Kit lists Three.js, PlayCanvas, Phaser, PixiJS, Godot and Unity integrations and example projects including a multiplayer shooter and a Fall Guys clone. — [Playroom docs](https://docs.joinplayroom.com/)
- Colyseus maintains a Babylon.js multiplayer tutorial server. — [colyseus/tutorial-babylonjs-server (search result)](https://github.com/colyseus/tutorial-babylonjs-server)

### Inferences
- None of the examples found is a browser-hosted peer-to-peer action game at commercial scale; the peer-to-peer host model is common in small friend-lobby web games (it is what Playroom and Trystero are for) but poorly documented by postmortems.
- The large .io shooters are competitive PvP with strangers, which forces dedicated authoritative servers for cheat resistance. Friends-only co-op PvE does not share that requirement, so their server-heavy stacks are evidence that WebSocket is good enough, not that a server is mandatory.

### Gaps
- venge.io, hordes.io, narrow.one: no technical sources found. Their stacks are unconfirmed.
- Colyseus's showcase page returned 404, so no list of shipped Colyseus browser games was captured.
- No named, shipped 3D action game built on Playroom, Trystero or PeerJS with a technical write-up was found.
- No published co-op roguelike browser game write-up was found.

## 9. Recommended stack for 4 to 5 players, with a cheaper and a more robust alternative, and monthly cost at 10, 100 and 1,000 concurrent lobbies

### Takeaway
Recommended: keep the simulation in one player's browser (host-authoritative star over WebRTC data channels) with a small Cloudflare Worker and one hibernating Durable Object per room for room codes, signalling, TURN credentials and an optional WebSocket relay fallback; it costs nothing at hobby scale and roughly $100 a month at 100 lobbies running around the clock. Cheaper: Trystero on public relays with no server of your own. More robust: a headless Node build of the simulation on Fly.io or a VPS over WebSocket, which survives a host leaving but costs from a few dollars a month and needs the simulation ported.

### Cited Findings
- Unit prices used below: Cloudflare TURN $0.05 per GB after 1,000 GB free ([Realtime pricing](https://developers.cloudflare.com/realtime/sfu/pricing/)); Durable Objects $0.15 per million requests and $12.50 per million GB-s after the included amounts, free plan 100,000 requests and 13,000 GB-s a day ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)); Workers Paid $5 a month ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)); Fly.io `shared-cpu-1x` 1 GB $6.70 a month and egress $0.02 per GB in North America and Europe ([Fly.io pricing](https://docs.fly.io/about/pricing)); Hetzner 20 TB included then €1 per TB, 8 vCPU €16.49, 16 vCPU €29.99 ([Hetzner](https://www.hetzner.com/cloud/cost-optimized)); Twilio TURN $0.40 per GB ([Twilio](https://www.twilio.com/en-us/stun-turn/pricing)); Playroom $10 a month for 10,000 monthly users then $0.0015 each ([Playroom billing](https://docs.joinplayroom.com/billing)); Edgegap $0.00115 per vCPU-minute and $0.10 per GB ([Edgegap](https://edgegap.com/pricing)); Colyseus Cloud from $15 a month ([Colyseus pricing](https://colyseus.io/pricing/)).
- Relay share 10 to 22% (section 2 sources): [Trystero troubleshooting](https://raw.githubusercontent.com/dmotz/trystero/main/docs/troubleshooting.md), [OpenVidu](https://openvidu.io/blog/2026/06/09/turn-key-considerations/).
- Unreliable, unordered data channels work in Safari 11+, Chrome and Firefox ([BCD RTCDataChannel](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/RTCDataChannel.json)).

### Inferences

**Assumptions for every figure below (mine, unmeasured):** 5 players per lobby; 20 snapshots a second of about 600 bytes on the wire to each client (12 KB/s each); 30 inputs a second per client; "N concurrent lobbies" means N lobbies running 24 hours a day, 730 hours a month, which is the worst case. Real usage peaks in the evening, so a game whose peak is N will typically pay a third or less of these figures. 20% of client links relayed. 20 rooms per shared vCPU.

**Recommended stack**
- Client: unchanged static page on GitHub Pages. Own code on `RTCPeerConnection`, two data channels per client (unreliable unordered for snapshots and inputs, reliable ordered for events), hand-rolled `DataView` messages. No library to vendor.
- Room service: one Cloudflare Worker plus a Durable Object per room using the WebSocket Hibernation API (optionally through PartyServer): issues the room code, relays offers, answers and ICE candidates, mints short-lived Cloudflare TURN credentials, keeps the socket for rejoin. Optional fallback: relay game messages over that WebSocket when ICE fails or on a network that blocks UDP.
- Why: no simulation port to a server is needed, running cost is near zero, the unreliable channel avoids TCP stalls, and Cloudflare's TURN price removes the usual objection to peer to peer. The protocol (inputs up, snapshots and events down) is the same one a dedicated server would speak, so the host can later be replaced by a headless build.
- Known costs of this choice: the host's tab and connection are a single point of failure (section 2); iPhones make poor hosts; WebRTC adds NAT, TURN and iOS test surface that headless Chromium tests on one machine will not exercise.

**Cheaper alternative**
- Trystero (Nostr default, or BitTorrent or MQTT) for signalling, public STUN, no server and no accounts at all. Running cost is zero at any scale.
- Trade-offs: no TURN without exposing a credential, so roughly a third to a half of 5-player lobbies would have someone who cannot connect (section 2 inference); room setup depends on public relays; the library is ESM-only and must be pre-bundled for the single-file build. Reasonable as a first prototype among friends on home networks, weak as the shipped answer.

**More robust alternative**
- Headless build of the simulation in Node, one process hosting many rooms, `ws` or uWebSockets.js (or Colyseus for rooms, reconnection and delta sync), WebSocket transport with WebTransport datagrams as a later option. Hosted on Fly.io in the regions players are in, or one Hetzner machine for the lowest cost.
- Gains: the room survives any player leaving or backgrounding, every network that can load the page can play, no TURN, and phones are equal participants. Costs: the simulation must run headless and be kept working there, there is a deployment to operate, TCP stalls on lossy links, and it is never free.
- Middle path on the same code: run the headless simulation inside the room's Durable Object. Free for roughly 4 to 11 room-hours a day, then about $0.01 per room-hour, with no server to manage, but with deploy-time restarts that drop in-memory rooms.

**Estimated monthly cost, lobbies running around the clock**

| Option | 10 lobbies | 100 lobbies | 1,000 lobbies |
|---|---|---|---|
| Recommended: browser host, Cloudflare signalling and TURN | $0 (about 310 GB relayed, inside the free 1,000 GB; signalling inside free limits) | about $105 (about 3,070 GB relayed; $5 Workers plan) | about $1,500 (about 30,700 GB relayed) |
| Same, TURN on self-hosted coturn (Hetzner, EU only) | about €6 | about €6 | about €20 to €40 |
| Same, TURN from Twilio at $0.40 per GB | about $125 | about $1,230 | about $12,300 |
| Cheaper: Trystero, no TURN | $0 | $0 | $0 |
| Robust: Node on Fly.io | about $40 (1 small machine, about 1,600 GB egress) | about $355 (5 machines, about 16,000 GB) | about $3,550 (50 machines, about 160,000 GB) |
| Robust: Node on Hetzner (EU, if plans are orderable) | about €6 | about €17 | about €200 (4 large machines plus about 80 TB extra traffic) |
| Simulation in Durable Objects | about $72 | about $725 | about $7,200 |
| Playroom Kit (by monthly users, not lobbies) | $10 up to 10,000 monthly users | $10 plus $1.50 per extra 1,000 users | same formula |

- Reading the table: at hobby scale (a handful of sessions a day) the recommended stack, the Trystero stack and the Durable Object variants are all free, and a Fly.io machine is under its $5 waiver if stopped when idle. Differences only appear with sustained load. Egress dominates the server-hosted options, and TURN dominates the peer-to-peer one; Hetzner's included traffic makes it far cheaper than per-GB hosts, at the cost of one region and uncertain plan availability.
- Suggested order of work, since each step is useful alone: (1) make the simulation multi-player and split it into "host" and "client that renders snapshots" with a transport-agnostic message layer; (2) room service on Cloudflare with a WebSocket relay, which is the simplest transport to test; (3) add WebRTC data channels and TURN as the primary path; (4) only if host fragility proves a real problem, run the headless host in Node or a Durable Object.

### Gaps
- Every cost figure rests on unmeasured assumptions (snapshot size, send rate, relay share, rooms per vCPU, round-the-clock load). They are order-of-magnitude guides.
- Fly.io prices for machines beyond `shared-cpu-1x`, Colyseus Cloud's real plan table, and Hetzner's current orderable plans and US traffic allowance were not confirmed.
- Whether Cloudflare bills both directions of a relayed link or only traffic sent toward the allocating client was not resolved; the estimate counts all relayed traffic.
- The mapping from monthly active users to concurrent lobbies for Playroom's pricing depends on session habits and was not estimated.
- Nothing here has been tested on a real iPhone, a real mobile carrier or a corporate network.
