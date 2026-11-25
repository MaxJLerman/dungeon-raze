# Co-op: your first real session

This is the list to follow the first time you and a friend play DungeonRaze
together. Everything is built and has been checked by automated tests. Nobody
has played it by hand or over a real network yet. The point of the first
session is to find out what the tests could not.

Read it top to bottom once, then follow the numbered steps.

## 1. What this is, and what it is not yet

What you get:

- Two players go through grade E's cave together over the internet.
- Each of you picks one of the five base classes (Assassin, Fighter, Tanker,
  Mage, Ranger) on the title screen.
- The host's computer runs the dungeon (the enemies, the boss). The friend's
  computer shows it and sends back what the friend does. A small relay on the
  internet passes messages between you. You cannot connect directly, because
  browsers cannot do that without help.
- It is meant for a desktop browser, Chrome or Safari, on both sides.

What is not there yet:

- The hall (the base) is not part of co-op. You start together in the cave.
- Grade D and every other grade. Only E.
- The hidden classes. If you have one chosen, you play as the Assassin for the
  run, and your saved choice is not changed.
- More than two players.
- A phone as one of the players. It may work. Question 4 below is how to find
  out.

The page only shows the co-op button when the address ends with `?coop=1`.
Nobody stumbles into it by accident.

## 2. Try it alone first

You do not need the internet for this. The dev menu has a button that runs a
co-op game by yourself, with a pretend friend and a pretend slow connection,
so you can see how it plays before involving anyone.

1. In a terminal, in the project folder:

   ```
   node build.mjs
   npm run dev
   ```

   The second command starts a small web server and prints the address. It
   needs Python 3 on your computer (`python3 --version` shows whether you have
   it). Leave it running.
2. Open http://localhost:8000/ in Chrome.
3. On the title screen press the **Dev** button, then **Co-op alone, with
   lag**. You are in the cave with a second player (the pretend friend).
4. A small panel appears at the bottom left, titled **LAG DIAL**. It has
   sliders for **Ping (round trip)**, **Jitter** and **Packet loss**, a menu
   called **Second player** (none, idle, follows, fights; it starts on fights) and a line showing
   how much data is moving. While you play, `[` makes the ping 25 ms lower and
   `]` makes it 25 ms higher.
5. Fight a few enemies with the ping at 50, then 100, then 200. Notice when
   hits start to feel late. That is your yardstick for question 1 below.

The dev button and this panel exist only in a build made with `node
build.mjs`. The published page never has them.

To stop the server, press Ctrl+C in the terminal.

## 3. Put the relay on the internet

The relay is a small program on Cloudflare's servers. You do this once. The
details and the reasoning are in `relay/README.md`.

You need a free Cloudflare account (https://dash.cloudflare.com/sign-up). Do
not add a payment card. Stay on the free plan.

1. In a terminal, in the project folder, install the tools once:

   ```
   npm install
   ```

2. Go into the relay folder and sign in. This opens your browser and asks you
   to allow the login:

   ```
   cd relay
   npx wrangler login
   ```

3. Put it online:

   ```
   npx wrangler deploy
   ```

4. When it finishes it prints the relay's address, like
   `https://dungeon-raze-relay.<your-name>.workers.dev`. Copy it. If you lose
   it, the Cloudflare dashboard also lists the Worker, named `dungeon-raze-relay`.

`relay/wrangler.toml` already says that the Pages site
(`https://maxjlerman.github.io`) may use it, so there is nothing to set. If
you ever move the game to another web address, change the `ALLOWED_ORIGINS`
line there and run `npx wrangler deploy` again.

What it costs:

- On the free plan, two people playing use up the free allowance in about 9
  hours of play a day. Cloudflare resets the allowance at 00:00 UTC.
- The worst case on the free plan is that someone floods the relay with
  requests and co-op stops working until 00:00 UTC. You are not billed,
  because the free plan has no bill.
- The paid plan has no spending cap, so a flood there would cost money. Do
  not move to the paid plan without first adding a rate-limiting rule in the
  Cloudflare dashboard (`relay/README.md`, "Abuse", says where).
- The prices and limits in `relay/README.md` were read once, on 2026-11-24, by
  a tool from Cloudflare's own pages. Look at them yourself once before you
  rely on them:
  - https://developers.cloudflare.com/durable-objects/platform/pricing/
  - https://developers.cloudflare.com/workers/platform/pricing/

To take the relay down later: `npx wrangler delete` in the `relay` folder.

## 4. Tell the game where the relay is, and publish

1. Open `src/08e_coopui.js`. Near the top is this line:

   ```js
   let COOP_RELAY = "";
   ```

   Put the relay's address between the quotes, with `wss://` at the start in
   place of `https://`, and nothing after `workers.dev`:

   ```js
   let COOP_RELAY = "wss://dungeon-raze-relay.<your-name>.workers.dev";
   ```

   The game uses the same address with `https://` when it asks for a room, so
   you only write it once.
2. Build and look at it locally:

   ```
   node build.mjs
   npm run dev
   ```

   Open http://localhost:8000/?coop=1. A **Play with a friend** button should
   be on the title screen. Press it, then **Host a room**. After a moment a
   six-character code appears. If instead you read "Cannot reach the co-op
   relay.", the address is wrong or the relay is not deployed.
3. Publish. The co-op work is on the branch `feat/coop-cave`, and the site is
   published from `main`. Merge the branch into `main` on GitHub the way you
   do any other, with the line from step 1 in it, and push. A push to `main`
   builds the page and publishes it to GitHub Pages
   (`.github/workflows/pages.yml`). Give it a couple of minutes. Check the
   Actions tab on GitHub to see it finish.

Two things to know:

- The relay only lets in the Pages site and your own computer (`localhost` or
  `127.0.0.1`). A page opened straight from a file (`file:` in the address
  bar) cannot play co-op. It says "Co-op does not run from a file. Run npm run
  dev and open http://localhost:8000/?coop=1". The single-file hosted copy of
  the game cannot either. It says to play on the Pages site.
- You and your friend must both be on the same version of the game. If you
  are not, the friend sees "You and the host are on different versions of the
  game. Both reload the page." Both of you play on the Pages site and both
  reload before starting, and this does not come up.

## 5. The link, and who clicks what

Send your friend this link:

```
https://maxjlerman.github.io/dungeon-raze/?coop=1
```

Do not use your localhost address for a real session. Your friend cannot reach
it, and it may be on a different version.

You (the host):

1. Open the link. Pick your class on the title screen.
2. Press **Play with a friend**, then **Host a room**.
3. Read out or send the six-character code. **Copy** puts it on your
   clipboard. The code works for the first connection for 10 minutes.
4. When your friend's class shows in the second slot (it reads "Not here yet"
   until they join), press **Start**. You can press Start before they arrive and be joined later.

Your friend:

1. Open the link. Pick a class.
2. Press **Play with a friend**. Type the code into the box (capitals or
   small, spaces and dashes are ignored) and press **Join with a code**.
3. The button at the bottom reads "Waiting for the host to start" and is
   greyed out. When it reads **Enter the cave**, press it.

Once in: you start together at the cave's start. Pause does not stop the
dungeon in co-op, and the pause screen says so. Each of you has your own
health, flasks and rest points. Dying sends you back to your own last lit
rest point and brings no enemies back, unless you are both dead at once, in
which case they all come back. When either of you steps into the exit gate
after the boss, the run ends for both and the room closes. For another run,
host a new room.

## 6. The five questions

These are what the first sessions are for. For each, do the thing, watch for
the signs, and write down what you saw. A few lines is plenty, and it is worth
doing it while you play, not afterwards.

### Question 1. Does combat still feel right at the relay's real lag, and what is that lag?

What to do:

- Play together for at least ten minutes in the cave: fight a pack each, fight
  one pack together, and try to parry and dodge enemy attacks.
- Measure the lag. Each of you, with the game page open at the Pages address,
  press F12 (on Safari, first turn on the web developer features in Settings,
  Advanced, then press Option+Command+C), open the Console, and paste the line below. It asks
  the relay for a room code three times and prints how long each took, in
  milliseconds. The first is slow because it opens the connection. Read the
  second and third. Replace the address with the relay's `https://` address.
  This measures your page's trip to the relay only. Your friend's trip is the
  other half, and the game's lag is roughly the sum of the two.

  ```js
  (async () => { for (let i = 0; i < 3; i++) { const t = performance.now(); await fetch("https://dungeon-raze-relay.<your-name>.workers.dev/new", { method: "POST" }); console.log(Math.round(performance.now() - t) + " ms"); } })()
  ```

  (This line was not run against the deployed relay, because it did not exist
  when this was written. If it prints an error, skip it and use the lag dial
  comparison below.)

What to watch for:

- A hit you make that shows, then is taken back (an enemy flinches, then
  seems not to have been hit).
- Parries and perfect dodges that feel late, or enemy swings that hit you when
  you were sure you had dodged.
- Enemies that jump or slide instead of walking.
- How it compares with the lag dial from section 2. At what ping there did it
  feel like this?

What to write down: each of your two measured times, whether combat felt right
(yes, mostly, no), and the worst moment you can describe.

### Question 2. Does the dungeon keep running when the host's tab is in the background?

The host's page runs the whole dungeon. Browsers slow down or freeze pages you
are not looking at, so this might stop the game for your friend. Nobody knows
yet, and it may differ by browser. If it does fail, the friend sees "Waiting
for the host", and the fix is a server that runs the dungeon, which is a bigger
project.

What to do, once for each browser you can use as the host (Chrome, Safari and
Firefox; co-op is aimed at Chrome and Safari, but the Firefox answer is
useful too), with the friend on whichever browser they have:

1. Host and friend are both in the cave with enemies near the friend, ideally
   awake and chasing.
2. The host switches to another tab (or another window that covers the game)
   and stays there for 30 seconds. Count it.
3. The friend watches the whole time and says out loud what they see.
4. The host comes back.

What to watch for, on the friend's screen:

- Do the enemies keep moving and fighting, or freeze?
- Does "Waiting for the host" appear in the middle of the screen? Note how
  many seconds in.
- After 2 seconds, the host should show as away: the marker over their
  character turns grey, the character loses its coloured rim light, and their
  small health bar under the friend's own bars dims. Does it?
- When the host comes back, does everything carry on, or does the friend end up
  at the title screen with "The host has left."? (That happens if the host is
  gone for 10 seconds with no update.)

What to write down, for each host browser: did the enemies keep moving (yes,
no, partly), did "Waiting for the host" appear and when, did the host show as
away, and what happened when the host came back.

### Question 3. Does the connection stall show as hitching?

The game talks to the relay over a WebSocket, which waits for lost data to be
sent again. That could show up as moments where everything stops, then jumps.

What to do: play a long, busy fight. If you can, make one of you use a worse
connection (phone hotspot, Wi-Fi from another room) for a few minutes.

What to watch for: a stop of a fraction of a second to a second where enemies
and your friend freeze, and then everything catches up in a rush. Also "Waiting
for the host" flashing up briefly.

What to write down: how often it happened, how long each was, and what the
connections were (home Wi-Fi, hotspot, wired).

### Question 4. Does a phone work as the friend's device?

This is not expected to be polished: the room screen has been tested on a
phone layout only in a computer's imitation of a phone.

What to do: the friend joins from a phone (on a phone the friend turns it
sideways to play) while the host is on a desktop. The phone opens the same
link. Fight together for five minutes.

What to watch for: whether the room screen is readable and the buttons can be
pressed, whether the controls work with the other player visible, whether the
game stays smooth on the phone, and whether the phone gets hot or the battery
drops fast.

What to write down: the phone model, its browser, anything that was
unreadable, unpressable or slow.

### Question 5. Is two attackers at once across two players too easy?

In one-player games, at most two enemies attack at the same time. With two
players the enemies may spread their attacks across both of you, which could
make the dungeon feel too easy.

What to do: play through the whole cave to the boss and kill it together.

What to watch for: how often anyone was in real danger. Whether packs were
dangerous, and whether the Warden (the boss) was too easy with two.

What to write down: whether you died and where, which fights felt easy and
which hard, and one sentence on whether it felt too easy, about right, or too
hard with two.

## 7. Known rough edges

None of these is a surprise. Do not count them as findings unless they are
worse than described.

- **Executions.** If you both start executing the same stunned enemy at
  almost the same moment, the first one whose message reaches the host gets
  the kill and its rewards. The other's animation plays but gives nothing.
- **The dead screen.** It says "Everything you killed is back on its feet."
  That is not true in co-op, where one death brings nobody back.
- **Class changes.** If you change class in the pause menu in the middle of a
  run, your friend does not see the change.
- **Hidden classes.** In co-op they play as the Assassin (the first base
  class), for both host and friend.
- **Parried shots.** When you reflect an enemy's shot, your friend does not see
  the reflected shot.
- **The other player's shots** appear slightly before their body does.
- **A host who leaves** ends the room for the friend. A friend who leaves does
  not stop the host, and someone else can take the seat with the same code
  while the host is there.
- If the relay closes during a game, the host plays on alone and a line says no
  friend can join.
- The relay is set up so a stray flood of requests costs nothing, but stops
  co-op for the rest of the day (section 3).

## 8. What to send back afterwards

Send me, in whatever form is quickest (a message, a note, voice dictation):

1. The date, who hosted, and each of your browsers and devices.
2. For each of the five questions, the thing to write down listed under it.
3. The lag numbers from question 1 for both of you.
4. Anything that broke: the exact words on screen if there were any, what you
   had just done, and whether it happened again.
5. A screenshot or phone photo of anything that looked wrong.
6. Anything that felt bad that is not on this list, even if you cannot say why.
7. Whether you want to keep going: more players, the hall as a place to meet,
   grade D, or a server that runs the dungeon so the host's tab stops mattering.

If the relay stops working part way through and everything says "Cannot reach
the co-op relay.", look at the Cloudflare dashboard for the Worker. If it is
the free plan's daily limit, co-op returns at 00:00 UTC.

## For the record: the page's size

The published page (built with `node build.mjs --release`, one HTML file) before
and after the co-op work. Before is `main` where the branch left it
(`cec89fa`):

| | Before | After | Change |
|---|---|---|---|
| Raw | 649,034 bytes | 1,261,833 bytes | +612,799 (+94%) |
| Gzipped (`gzip -9`) | 190,142 bytes | 370,307 bytes | +180,165 (+95%) |

The page roughly doubled. The reason is that the co-op host's code is carried
inside the page as text, so that the host's Worker can be made from it without
a second file. The page you play is still one file.
