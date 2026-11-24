# The co-op relay

A small Cloudflare Worker with one Durable Object class. It lets the host's
page and one friend's page swap frames over WebSockets, because two browsers
cannot reach each other directly. It is not part of the page build.

- `POST /new` returns `{ "code": "XXXXXX" }`, a room nobody is using. The code
  is good for a first socket for 10 minutes.
- `GET /room/CODE` with `Upgrade: websocket`. The first socket in is the host
  (pid 1), the second is the friend (pid 2). A bad or expired code, or a full
  room, accepts the socket and closes it with `4004` or `4001`.
- Frames are binary. Friend to host: the relay prepends the friend's pid byte.
  Host to friend: the host's first byte is the addressee, and the relay strips
  it. The relay's own frames start with 0: the host hears `[0, 1, 2]` when the
  friend joins and `[0, 2, 2]` when the friend leaves, and the friend hears
  `[0, 2]` when the host leaves. Two rules for the game's client: it must
  close its own socket when it receives `[0, 2]` (a close the relay starts from
  that side did not finish promptly under `wrangler dev`), and it must not send
  a backlog in one burst after a stall, since more than 120 frames in a second
  closes it with `4008`.
- The host's page is the game's server, so when the host leaves the room ends
  and its code stops working. When the friend leaves, another can take the seat.
- A frame over 16,384 bytes closes the sender with `4009`, more than 120
  frames in a second closes it with `4008`, a text frame closes it with `1003`.
- Only the origins in `ALLOWED_ORIGINS` (comma separated, set in
  `wrangler.toml`), `http://localhost:*` and `http://127.0.0.1:*` may call it,
  and a request with no `Origin` header is let through. Any other origin gets
  HTTP 403, so a browser sees a failed socket.
- Each address (`CF-Connecting-IP`) may call `POST /new` 10 times and open 30
  rooms (upgrades) in a minute; past that it gets HTTP 429 with `Retry-After`.
  This limit is kept in the Worker's own memory, so it is per isolate and best
  effort, not exact. Cloudflare's Rate Limiting binding was not used: its page
  does not say it is available on the free plan, and its counts are per
  location and eventually consistent.

It uses the Durable Objects WebSocket Hibernation API (`acceptWebSocket`), on
a SQLite-backed class, which is the only kind the free plan offers.

## Run it locally

No Cloudflare account is needed. From the repository root:

    npm install
    cd relay
    WRANGLER_SEND_METRICS=false npx wrangler dev --port 8787

Then `curl -X POST http://127.0.0.1:8787/new`. The test starts and stops its
own copy, with a clean state directory:

    node tests/coop-relay.mjs

## Deploy (the owner does this, once)

1. `cd relay`
2. `npx wrangler login` (opens a browser; sign in to your Cloudflare account)
3. `npx wrangler deploy`
4. `ALLOWED_ORIGINS` is already `https://maxjlerman.github.io` in
   `wrangler.toml`, so the deploy sets it. To use another page address, edit
   that line and deploy again, or change it under the Worker's Settings, then
   Variables, in the Cloudflare dashboard.
5. Wrangler prints the Worker's address, like
   `https://dungeon-raze-relay.<your-subdomain>.workers.dev`. Put it in the
   `COOP_RELAY` constant in the game's source (Task 11 adds it), as a `wss://`
   address for sockets and the `https://` one for `POST /new`.

To take it down: `npx wrangler delete`, or delete the Worker in the dashboard.

## What it costs

Read on 2026-11-24 from Cloudflare's own pages:

- Durable Objects pricing, https://developers.cloudflare.com/durable-objects/platform/pricing/
- Workers pricing, https://developers.cloudflare.com/workers/platform/pricing/

Limits quoted from them:

| | Free plan | Paid plan ($5 a month minimum) | Page |
|---|---|---|---|
| Worker requests | 100,000 a day | 10 million a month, then $0.30 per million | Workers pricing |
| Durable Object requests | 100,000 a day | 1 million a month, then $0.15 per million | Durable Objects pricing |
| Durable Object duration | 13,000 GB-s a day | 400,000 GB-s a month, then $12.50 per million GB-s | Durable Objects pricing |
| SQLite rows written | 100,000 a day | 50 million a month, then $1.00 per million | Durable Objects pricing |

How Cloudflare counts a WebSocket (Durable Objects pricing page): opening one
is one request; messages the relay sends are not charged; incoming messages
count at 20 to 1 ("100 incoming messages count as 5 requests"). A hibernatable
object that is idle is not billed for duration. Free plan limits reset at
00:00 UTC, and past one the operation fails until then.

The arithmetic, for one room of two players:

- Incoming messages to the relay: the host sends 20 frames a second to the
  friend, the friend sends 30 a second to the host, so 50 a second. Allow 10 a
  second more for events (an estimate): 60 a second, 216,000 an hour.
- Billed at 20 to 1 that is 10,800 Durable Object requests an hour (9,000 an
  hour with no events at all).
- A session also costs 3 Worker requests (`/new` and two upgrades) and 3
  Durable Object requests, which does not move the figure.
- Free plan, requests: 100,000 / 10,800 = 9.2 hours a day (11.1 with no
  events). This is the limit that binds.
- Free plan, duration: assume the worst, that the object is billed for every
  second of play at its 128 MB (0.125 GB): 0.125 x 3,600 = 450 GB-s an hour,
  so 13,000 / 450 = 28.9 hours a day. With hibernation it is less, because
  gaps between messages are not billed. Not binding.
- Free plan, SQLite rows written: about 5 a session (an estimate) against 100,000. Not
  binding.
- The Worker's 100,000 requests a day are used at 3 a session. Not binding.

**Free plan: about 9 hours of two-player play a day.** The limits are per
account, so rooms running at once share them.

On the paid plan, 3 hours a day for 30 days is 90 hours: 90 x 10,800 = 972,000
Durable Object requests (972,000 of the 1,000,000 included), 90 x 450 = 40,500
GB-s (of 400,000) and a few hundred Worker requests. **That costs the $5 a
month minimum, with about 3% of the included requests to spare.** A 31-day
month at 3 hours a day is 1,004,400 requests, 4,400 over, which is less than a
cent at $0.15 per million. Play beyond 3 hours a day costs $0.15 per million
requests, so each extra hour is about $0.002.

### Abuse

The cost above is for play. Someone who finds the address can call
`POST /new` from a script, and a browser's `Origin` check does not stop a
script. The per-address limit above slows one machine but is per isolate and
best effort, and a flood from many addresses passes it.

- On the free plan the worst case is a denial of service: about 50,000 `/new`
  calls (each costs a Worker request, a Durable Object request for the room
  and an alarm) use up the day's 100,000 requests, and co-op stops until
  00:00 UTC. Nothing is billed.
- The paid plan has no spending cap, so the same flood becomes a bill. A
  million `/new` calls cost a few dollars; a sustained flood of tens of
  millions a day would cost hundreds of dollars a day.
- Guessing a code into a live room is not a practical risk: there are
  31^6 = 887,503,681 codes and each guess costs the guesser a request.

Advice: stay on the free plan for now. Before moving to the paid plan, add a
Cloudflare rate-limiting rule on `POST /new` (Security, then WAF, then Rate
limiting rules, in the dashboard), which counts across all of Cloudflare's
locations and stops the request before the Worker runs.

## Test knobs

The test sets these with `wrangler dev --var`; leave them alone when deploying.
`ROOM_WAIT_MS` is how long a new code waits for its host (default 600000).
`RATE_NEW` and `RATE_ROOM` are the per-address counts (10 and 30) and
`RATE_WINDOW_MS` is the window (60000).

## What it stores and logs

It stores whether a room exists and when its code was issued, in the room's own
storage, and deletes that when the host leaves or the code goes unused for 10
minutes. The rate limit remembers each caller's address and recent request
times in the Worker's memory only, for at most the window, and never writes
them to storage or a log. It never reads a frame beyond the first byte of a
host frame (the addressee). The code does not log anything, request logs and
traces are turned off in `wrangler.toml` (`[observability]`), and nothing else
about a player (name, class, what they did) is kept by the relay. Cloudflare itself, as the
host of any site, still counts requests for billing.
