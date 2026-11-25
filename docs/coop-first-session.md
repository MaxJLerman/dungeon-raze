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

**Done on 2026-11-25.** The relay is at
`https://dungeon-raze-relay.dungeon-raze.workers.dev` and `COOP_RELAY` in
`src/08e_coopui.js` holds it, so sections 3 and 4 are kept only for doing it
again (after a change to `relay/`, steps 2 to 5 here are all it takes).

The relay is a small program on Cloudflare's servers. Cloudflare calls a
program like this a "Worker" (it has nothing to do with the Worker the game
runs in your browser). You do this once. The details and the reasoning are in
`relay/README.md`.

The Cloudflare dashboard is the website where you manage your account:
https://dash.cloudflare.com. Once the relay is deployed it is listed there
under **Workers & Pages**, named `dungeon-raze-relay`.

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

   On a new account it may first ask you to choose a name for your
   `workers.dev` subdomain (this was not checked, because nobody had deployed
   it when this was written). If it asks, pick any name you like: it becomes
   part of the relay's address.

4. When it finishes it prints the relay's address, like
   `https://dungeon-raze-relay.<your-name>.workers.dev`. Copy it. If you lose
   it, open the Cloudflare dashboard, then **Workers & Pages**, then
   `dungeon-raze-relay`: the address is shown there.
5. Go back to the project folder, because everything in section 4 runs from
   there:

   ```
   cd ..
   ```

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

Everything here runs in the project folder (the one with `build.mjs` in it),
not in `relay`. If you are still in `relay`, run `cd ..` first.

The simplest way through this section is to ask Claude Code, in this project,
to do it: "set COOP_RELAY to wss://dungeon-raze-relay.<your-name>.workers.dev,
commit it and get the branch onto main". Then do step 2 below to check it. If
you would rather do it by hand, follow all three steps.

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
   relay.", the address is wrong or the relay is not deployed. When you have
   seen it work, press Ctrl+C in the terminal to stop the local server, so
   the terminal is free for the next step.
3. Publish. The co-op work is on the branch `feat/coop-cave`, and the site is
   published from `main`. The line from step 1 is only on your computer until
   it is committed and pushed, and a merge on GitHub takes the branch as
   GitHub has it, so commit and push it first. In the project folder:

   ```
   git add src/08e_coopui.js
   git commit -m "feat: point co-op at the deployed relay"
   git push
   ```

   Then get the branch onto `main`, one of two ways:

   - On GitHub: open
     https://github.com/MaxJLerman/dungeon-raze/compare/main...feat/coop-cave,
     press **Create pull request**, then **Merge pull request**. (The `gh`
     command on this computer cannot open pull requests, so use the page.)
   - Or on your computer:

     ```
     git switch main
     git pull
     git merge feat/coop-cave
     git push
     ```

   A push to `main` builds the page and publishes it to GitHub Pages
   (`.github/workflows/pages.yml`). Give it a couple of minutes. Check the
   Actions tab on GitHub to see it finish.

   Afterwards, https://maxjlerman.github.io/dungeon-raze/?coop=1 shows **Play
   with a friend** on the title screen, and **Host a room** there shows a
   six-character code after a moment. If it says "Cannot reach the co-op
   relay." instead, the published page does not have the line from step 1:
   check that the commit reached `main`.

Two things to know:

- The relay only lets in the Pages site and your own computer (`localhost` or
  `127.0.0.1`). A page opened straight from a file (`file:` in the address
  bar) cannot play co-op. It says "Co-op does not run from a file. Run npm run
  dev and open http://localhost:8000/?coop=1". The single-file hosted copy of
  the game cannot either. It says to play on the Pages site.
- You and your friend must both be on the same version of the game. Every
  build of the game carries a stamp made from its code, and the host's page
  refuses a friend whose page has a different stamp (an old copy a browser
  kept, say). The friend then sees "You and the host are on different versions
  of the game. Both reload the page." Both of you play on the Pages site and
  both reload before starting, and this does not come up.

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
   clipboard. A code nobody has used expires after 10 minutes. Once you are
   in, it stays good while you are there.
4. When your friend's class shows in the second slot (it reads "Not here yet"
   until they join), press **Start**. You can press Start before they arrive
   and be joined later. Once you have started, the code is also on your pause
   screen ("Room code" and the code), so you can read it out again.

Your friend:

1. Open the link. Pick a class.
2. Press **Play with a friend**. Type the code into the box (capitals or
   small, spaces and dashes are ignored) and press **Join with a code**.
3. The button at the bottom reads "Waiting for the host to start" and is
   greyed out until the host presses Start. When it reads **Enter the cave**,
   press it. If the host has already started, it reads that at once.

Once in: you start together at the cave's start. Pause does not stop the
dungeon in co-op, and the pause screen says so. Each of you has your own
health, flasks and rest points. Dying sends you back to your own last lit
rest point and brings no enemies back, unless you are both dead at once, in
which case they all come back. When either of you steps into the exit gate
after the boss, the run ends for both and the room closes. For another run,
both of you reload the page, and the host makes a new room. If the run ends
while the friend is still on the room screen, the friend reads "That run has
ended. Ask the host for a new room."

If the friend's own connection drops, or the friend hears nothing from the
host for 10 seconds, the friend goes back to the title screen with "The
connection to the room was lost. You can join again with the same code." The
room is still there while the host is: the friend joins again with the same
code. "The host has left." means the host's page closed or lost its own
connection, and the room is gone.

If the host's page ever sends something the friend's page cannot read, the
friend sees "The host sent something this page could not read. Both reload
the page."

## 6. The five questions

These are what the first sessions are for. For each, do the thing, watch for
the signs, and write down what you saw. A few lines is plenty, and it is worth
doing it while you play, not afterwards.

### Question 1. Does combat still feel right at the relay's real lag, and what is that lag?

What to do:

- Play together for at least ten minutes in the cave: fight a pack each, fight
  one pack together, and try to parry and dodge enemy attacks.
- Measure the lag, in Chrome or Safari (Firefox refuses a pasted line until
  you type `allow pasting` into its console, so leave it out). Each of you,
  with the game page open at the Pages address, press F12 (on Safari, first
  tick "Show features for web developers" in Settings, Advanced, then press
  Option+Command+C), open the Console, and paste the line below. It asks
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
  at the title screen with "The connection to the room was lost. You can join
  again with the same code."? (That happens if nothing arrives from the host
  for 10 seconds. "The host has left." appears only when the host's page
  really closed or lost its own connection.)

What to write down, for each host browser: did the enemies keep moving (yes,
no, partly), did "Waiting for the host" appear and when, did the host show as
away, and what happened when the host came back.

Two more things to note while trying other browsers, because only Chrome was
tested: whether a Safari or Firefox host can make a room at all (if the
friend cannot join a Safari or Firefox host's room, the relay may be refusing
that browser's host connection, which was not tested), and, if the friend's
connection drops hard (Wi-Fi off), whether joining again at once says "That
room is full." for a while before it works.

### Question 3. Does the connection stall show as hitching?

The game talks to the relay over a WebSocket, which waits for lost data to be
sent again. That could show up as moments where everything stops, then jumps.

What to do: play a long, busy fight. If you can, make one of you use a worse
connection (phone hotspot, Wi-Fi from another room) for a few minutes.

What to watch for: a stop of a fraction of a second to a second where enemies
and your friend freeze, and then everything catches up in a rush. Also "Waiting
for the host" flashing up briefly.

What to write down: how often it happened, how long each was, and what the
connections were (home Wi-Fi, hotspot, wired). If it does show, a direct
connection between the two browsers (which skips the relay's way of resending
lost data) moves up the list of next projects.

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
- **A host who leaves** ends the room for the friend. So does a drop of the
  host's own connection, even a short one: the relay closes the room the
  moment the host's connection goes, and the host's page does not reconnect.
  A friend who leaves does not stop the host, and someone else can take the
  seat with the same code while the host is there.
- **Cheating** is not guarded against: anyone with the code could, with a
  little scripting, kill everything or end the run once the boss is dead.
- If the relay closes during a game, the host plays on alone and a line says no
  friend can join.
- The relay is set up so that, on the free plan, a stray flood of requests
  costs nothing, but stops co-op for the rest of the day (section 3).

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
the co-op relay.", look at the Cloudflare dashboard (https://dash.cloudflare.com,
then **Workers & Pages**, then `dungeon-raze-relay`). If it is the free plan's
daily limit, co-op returns at 00:00 UTC.

## For the record: the page's size

The published page (built with `node build.mjs --release`, one HTML file) before
and after the co-op work. Before is `main` where the branch left it
(`cec89fa`):

| | Before | After | Change |
|---|---|---|---|
| Raw | 649,034 bytes | 1,268,909 bytes | +619,875 (+96%) |
| Gzipped (`gzip -9`) | 190,142 bytes | 372,741 bytes | +182,599 (+96%) |

The page roughly doubled. The reason is that the co-op host's code is carried
inside the page as text, so that the host's Worker can be made from it without
a second file. The page you play is still one file.
