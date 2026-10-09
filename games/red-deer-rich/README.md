# Red Deer Rich - v0.5 (placeholder art)

A Red Deer-themed property trading board game by Zero to Phi. The spec is the design doc
(`red-deer-rich/design-doc.md`, outside this repo). Same architecture as Zombie Tiles: plain
HTML/JS with no build step. The TV page holds the whole game state, phones are controllers
over PeerJS (QR code or 4-letter room code), and every number lives in `js/config.js`.

Live: https://amazingjustinlewis-web.github.io/games/red-deer-rich/

## How to play
1. Open `index.html` on the TV: a Chromecast TV browser, DashCast, a Samsung TV browser or a PC on the TV.
2. Phones scan the QR code (or open `controller.html` and type the code), enter a name and swipe to pick a character.
3. The first phone is the host. It picks a preset (Classic, Chaos or Chill) or opens the one-line **Game options**
   list, sets the game length (Regular, Medium or Quick) and the number of AI players beside the big START GAME
   button, then taps START GAME. The setup from last time comes back on its own. On the TV you can also press Enter. Mid-game, the host can fill an empty seat with an AI from
   the phone's Board tab (or press I on the TV).
4. On your turn, swipe up on the dice (or tap ROLL), then BUY or PASS, then PASS DICE.
   When someone lands on your deed, a giant **PAY UP** button takes over your phone. Rent is only paid if you hit it
   before they pass the dice. When you land on someone else's deed (with PAY UP on), PASS DICE (and ROLL AGAIN)
   stays locked for 3 s (+1 s with Mike's Loud Amp). On your own deed, an unowned one or any other space there is no wait.
5. Pass on a deed (for any reason) and it goes to **auction** from $10: every phone gets +$20 / +$50 / +$100 buttons,
   and each bid resets an 8 s countdown. The top bidder pays when it runs out; with no bids the bank keeps it.
   You can never bid more than your cash.

### Game lengths
| mode | start | timer |
|---|---|---|
| Regular | nothing pre-dealt, $1,800 each | none (last one standing) |
| Medium | 3 deeds each (2 each for 4+ players), $1,500 each | 45 min, then the richest wins |
| Quick | ALL ownable spaces dealt out round-robin, $1,500 each | 30 min, then the richest wins |

v0.5: the timer is its own setting. The ⏱ button beside the length picker (phone) or the Timer button in the TV lobby
cycles Off / 20 / 30 / 45 / 60 / 90 min and works with any length. Until you touch it, each length keeps the default above.

### What's new in v0.5 (Weather and wear)
Everything from v0.4 is unchanged. The core stays small: the new house rule hides in Game options, and the rest is feel and polish.
- **Disasters (Game options; Chaos on, Classic and Chill off).** Now and then a mild local event hits an owned business:
  it is **closed** (no rent) or earns **half rent** for 1, 2 or 3 of the owner's turns, by severity. The 20 events
  follow the TV's day/night clock: day brings hail, a car through the window, a water main break, road cones, a power
  outage, an angry goose, September snow, a sewer backup, a fussy inspector and wildfire smoke; night brings a break-in,
  graffiti, a stolen catalytic converter, a burst pipe, raccoons, a kitchen fire, a plow ridge, an ice dam, copper
  thieves and a wrecked patio. No tornadoes. Hidden limits keep it gentle: nothing before round 2, at most 2 a round
  and 3 at once, never two on one deed, never a mortgaged deed, and it spreads around rather than hitting the same
  player twice in a row (`C.disasters`). On the TV, the event's icon flies in from the edge and lands with an impact
  sized to its severity, and a big note names the place, the owner and the effect. The tile then wears a repair pill
  with the turns left (closed tiles also get a red wash and a hazard border). The owner's phone gets an alert card with
  **RUSH REPAIR** (about 10% of the price per turn skipped) or WAIT IT OUT. The repair badge and RUSH button also
  show in My Stuff (list and cards) and on the phone's board map. Rent and PAY UP amounts are halved or zeroed
  automatically. Every event line in the history is tappable. The AI rushes when the rent it would lose is worth more than the cost,
  and the headless sim checks the limits every game.
- **Smarter AUTO-RAISE.** The phone shows the plan before anything happens, for example *"Mortgage Three Mile Bend,
  sell 2 Shops on Gasoline Alley West and 2 on Gasoline Alley East = $180"*. **OK, DO IT** runs it, and **ADJUST BY
  HAND** opens My Stuff. The order: mortgage deeds outside full sets (cheapest first), then full sets that have no Shops
  yet, then sell Shops evenly from the weakest set (and mortgage that set once it's empty) before touching a stronger
  set. It stops the moment the debt is covered. The same planner (`planRaise`) drives the phone text and the real moves.
- **Mega-Plex construction.** Building a Mega-Plex plays a few seconds of saw and hammer sounds, with a saw, a hammer and
  sawdust on the tile.
- **Bold amounts.** Dollar amounts are bold in the TV's payment popups and play-by-play, and in the phone history.
- **Deed cards from the map.** Tap any deed on the phone's board map, on the trade map (it still lights up too), or in
  a history line that names it, and its deed card opens, whoever owns it. Tap to flip it: the front has owner, price,
  mortgage, rent now and the full rent ladder; the back has every Shop and Mega-Plex step with its cost, running
  total and the rent it brings.
- **Card hold.** A drawn card stays on the TV for 12 s unless another card replaces it. Other notes wait their turn.
- **Shop outlines.** Shops and Mega-Plexes have a slightly thicker, consistent dark outline.
- **Token transparency.** Resting tokens are drawn at 70% opacity; the active player and any moving token stay solid.
- **Shake to roll.** When you can roll, a firm shake rolls (debounced). On iPhone, the first ROLL tap asks once for
  motion access; on Android it just works.
- **Keep screen awake.** A 🔆 / 🌙 toggle beside the dice uses the Wake Lock API. It is remembered per phone
  (`rdr_wake`), re-acquired when you come back to the page, and hidden where the browser can't do it.
- **Timer toggle,** separate from game length (see the table above).
- **Cash animation on the phone.** Money in pops green dollar signs with a cha-ching; money out crunches the number with a
  crunch sound.
- **Polish.** Bigger cards in the portrait cards view (up to 300 px wide, sized to the screen height), a tidier turn
  screen, a time-left pill, and calmer spacing.

### What's new in v0.4 (Cards in hand)
Everything from v0.3 is unchanged: presets and remembered setup, PAY UP and its sounds, the decks with era tags, money
flows, AI takeover, hops, the podium and the QR codes. Clean screens, and the new rules hide behind the options list.
- **Hawk is now Mortgage** everywhere (phone, TV log, help). Code names (`hock`, `unhock`, `hocked`) are unchanged.
- **My Stuff as cards.** The switch at the top left flips between a **cards** wheel and the plain **list** (the phone
  remembers, `localStorage rdr_stuffView`). The wheel is an iPod-style cover flow on a slight arc: swipe with momentum,
  tap a side card to bring it forward. The front card has the full rent ladder, the next Shop and its price, and
  **BUY (−$60)** / **SELL (+$30)** on top with no confirmation. Tap the front card (or pinch open) to unfold its whole
  colour set (2×2 portrait, one row landscape; deeds you don't own show as faint ghosts with their owner), each with
  its own buttons; tap outside or pinch closed to go back. **MORTGAGE** flips the card: the back shows the cash with
  a clear CONFIRM. A mortgaged card stays flipped and shows **UNMORTGAGE (−$)**. Tapping still bounces the tile on the TV.
  The list view also shows prices on every button.
- **PAID IN FULL.** Owe money and sell or mortgage by hand: the debt pays itself the moment you have enough. The phone
  shows a big PAID IN FULL stamp with a cha-ching and a buzz; the TV shows a small stamp by the name. AUTO-RAISE stays.
- **Heckle (new option; on in Classic and Chaos, off in Chill).** When the player whose turn it is stalls, the others
  get a tiny 😂 button beside their name: after 15 s of nothing on the first stall of the turn, 5 s on the second, 3 s on
  the third, then it stays unlocked until the turn ends. Any action locks it again. Each press floats laughing faces up
  the staller's phone with a buzz, and a little face pops by their name on the TV. Light rate limit
  (`C.heckle`: 450 ms per heckler, 120 ms per target). Computer players and auctions are never heckled.
- **Card history.** Every card drawn (both decks, anyone) is in the phone History; tap it to read the card again, or
  open "Cards drawn (N)" for the whole list.
- **Owned tiles** get a solid outline in the owner's colour that feathers inward (`C.ownerLine`); the tile and its
  colour band stay untinted. The 10 s trade colour crossfade still works.
- **Matching pieces.** Board tokens wear the same crowns and accessories as the pieces in the side panel, the phone
  header, whose-turn line and trade map (one shared `RDRRender.drawPiece`).
- **Trade map.** The deal screen stays; a 🗺️ Map switch (remembered) opens a drag-and-drop board with only the two
  traders' deeds. Drag their deed onto your piece or yours onto theirs (wrong-way drags do nothing); added deeds go
  half dark and appear as coloured bars beside the receiving piece. Each side has its bank balance and a cash slider
  with money pouring across and a cash stack. RESET and SUBMIT use the same trade / counter flow. Tapping deeds (in
  either view) lights them up on a small board on your phone only, never the TV.
- **Calmer phone.** Leave / New game are folded behind "⋯", PAY UP tips only in round 1, shorter hints.
- **Graphics pick themselves.** The TV starts from a hint (CPU cores, memory, device) and runs a short frame-time probe
  at boot and at game start, stepping the Auto-Crush rung down or up. Pin a rung with `localStorage rdr_fx = '0'..'6'`
  (remove it to go back to auto). `&nocrush` and `&fx=N` still work.
- **Podium on 4:3** with 6 to 8 players is centred.

### What's new in v0.3 (Red Deer stories)
Everything Justin loves is unchanged: sticky hops, token hops, money flows, dice from the token, podium awards, fast
turns, QR rejoin, presets and the options drop-down, the phone-to-TV property display and the 10 s trade colour crossfade.
- **New decks.** HAILSTONE is now **Red Deer Randomness** (a playful confetti card: quirky, kid-friendly local
  happenings, 20 cards) and POTLUCK is now **Secret Finds** (an old-paper card: a short true Red Deer history story,
  1 to 3 sentences, with an effect tied to the story, 20 cards). On the phone, Secret Finds cards have **READ MORE**
  (a longer note plus the source sites), and the latest Secret Find stays one tap away. Every story is sourced in
  `data/secret-finds-sources.md` (anything we couldn't confirm was left out or phrased loosely). Every card carries an
  era tag (`pioneer`, `punk2000`, `present`, `future` or `any`) for the design-doc era skins:
  `RDR_BOARD.deckCards(deck, era)` filters a deck, and `C.eraFilter` (default `null`, all cards) picks it for a game.
  Story cards stay on the TV for 9 s (`C.storyHoldMs`).
- **No pointless wait.** The 3 s PASS DICE lockout only happens where PAY UP can (someone else's deed, PAY UP on).
- **Show off a deed.** Tap one of your deeds in My Stuff: that tile does a little bounce on the TV with a flash of your
  colour. It changes nothing in the game (a few taps a second at most; only your own deeds).
- **PAY UP boom at half strength:** half the volume, half the shake, half the red flash.
- **PAY UP catch feedback.** The catcher's phone plays a cha-ching with a light buzz; the caught phone plays the boom
  plus a "funds removed" coin drain with a light buzz. On the TV the money explodes out of the caught player's token,
  then streams to the catcher. Normal rent (PAY UP off, or automatic) keeps the usual token-to-token flow.
- **Podium fits.** The results screen scales itself to fit 2 to 8 players at 16:9 and 4:3, and the bottom row steps
  aside for the join QR.
- **Rejoining keeps the room's setup.** If the host phone reloads or rejoins a room whose setup was already changed
  (TV or phone, or a game was played), the live room settings win over the phone's remembered setup.
- **Tile names** are one weight lighter (600) with a soft light halo, drawn once into the cached board layer.

### What's new in v0.2.1 (simple setup)
Everything from v0.2 is unchanged: sticky hops, money flows, the podium awards and the fast pace.
- **One line for all the options.** The host phone (and the TV lobby) shows a single "Game options (3 on) ▾" line.
  Tap it to open a checklist; each option has a one-line description. Tap a row to switch it on or off. **Press and
  hold** a row (about half a second) for a longer explanation. Holding never toggles it.
- **Presets.** Classic (PAY UP race, auctions, perks), Chaos (everything on except Kid Mode) and Chill (automatic rent,
  no auctions, perks, jackpot and bullseye bonus cash). One tap sets them all; change anything afterwards and the
  preset shows "Custom". Presets leave the TV camera setting alone. The list lives in `C.options` / `C.presets` in
  `js/config.js`, and the shared helpers are in `js/options.js`.
- **Remembers the last game.** The host phone saves its setup (options, length, number of AIs and their difficulty) in
  localStorage when you change it or press START, and puts it back the next time it hosts. The TV saves its options and
  game length too, and reloads them when it opens (test URLs with `local`, `nonet`, `ai`, `rules`, `mode` or `fresh`
  skip this).
- **One big START button**, with the game length (Regular / Medium / Quick) and the AI count (− AI n +) as small pickers
  beside it. Everything else (option rows, which character the next AI is, its difficulty, Hue) sits inside Game options.
- **The TV lobby shows the rules.** The preset name (or Custom) and an icon and label for each active option are always
  visible, so everyone sees the rules before the first roll. Waiting phones show the same chips.
- **Owner-colour tiles are 20% lighter** (every wash alpha × 0.8, on the TV and the phone board) so the street colours
  show through. The solid owner strip is unchanged.
- **Bigger podium QR.** "Scan to join the next game" is 20vh (was 13vh), with the same white border and low-density
  (level L, 4-module quiet zone) code, and it stays clear of the podium and awards.

### What's new in v0.2 (game feel)
Kept exactly as they were: the dice spitting out of the token with each player's own dice on the board, the play-by-play
log, QR rejoin to your original seat, and the fast turn pace (the game never waits on any of the new effects).
- **Tokens hop tile by tile and stay on the landing tile.** The bug: once the hops finished, the token aimed back at its
  old tile for a moment and slid. On landing there's a small firework in your colour, mixed with the owner's colour on
  someone else's property.
- **Board announcements** (the big banner, card and deed pop-ups, same spots as before) stay up for 6 seconds, then fade
  slowly. A new one shatters the old one and punches in: one at a time, never stacked.
- **Money you can feel.** A "+$200" in your colour floats up out of your total on the TV and the total counts up; losses
  float a red "−$50". On the board, $ signs pop from your token when you gain and bills flutter away when you pay;
  more money, more particles. Rent and other player-to-player payments fly from the payer's token to the receiver's.
  Trades stay private: no floats or particles for trade cash.
- **Dropped phones:** a 10-second countdown shows on the player's name on the TV, then an AI covers the seat until they
  rejoin (scan the QR again: same seat, control comes back straight away).
- **TV log** text is 50% bigger. With lots of players it shows fewer lines rather than shrinking.
- **Day/night lighting** stays on the big centre square and feathers about 20% onto the tiles, so the tiles stay crisp.
  Two small cached layers (quarter size), rebuilt only when the light changes: light work for a Chromecast.
- **My Stuff** on the phone lists your deeds in the order you see them on the board (top row, left side, right side,
  bottom row).
- **"Go bust, pay what I can"**: when even selling everything can't cover a debt, the phone shows one big button. The
  bank buys your Shops back, then each deed goes whichever way is worth more to the creditor: deeds go to a player as
  they are (mortgaged ones stay mortgaged); for the bank, deeds are mortgaged for cash and then go back up for auction straight
  after. Whatever is still unpaid follows you: "Skipped Town Owing $840" on the podium. AI and off-turn bankruptcies use
  the same rules.
- **Plaques** beside out-of-game names on the TV: "Busted, owed $840", "Busted", "Left town, the AI took over",
  "Left town, split their stuff", "Left town, gave it all to X", "Left town, threw it in the pot".
- **Camera moments:** a quick zoom-in on purchases, auction wins, big rent ($150+) and bankruptcies, then back to the
  soft follow.
- **Placeholder building art** (`js/art.js`): line-art Shops, Mega-Plexes and mini-city blocks with a gentle overhead 3D
  look, as if the camera hangs over the middle of the board with a slight fisheye. Roofs lean OUTWARD from the centre,
  more toward the edges and almost none in the middle; nothing ever leans into the board. One knob:
  `C.art.lean` (0 = flat, 0.12 default, about 9 degrees at the edge) plus `C.art.fisheye`.
- **Swappable effects for real sprites:** `RDRFx.useSprite('spark' | 'dollar' | 'bill' | 'flybill', [frame urls], {fps})`
  for the particles and `RDRArt.useSprite('shop' | 'mega' | 'city', url)` for the buildings. A 3 to 8 frame top-down
  sprite sheet drops straight in; the cached board redraws itself once the image loads.
- v0.1.2 is archived at `v0.1.2/`.

### What's new in v0.1.2 (fixes from the first Chromecast + projector night)
- **Bigger watch QR** in the TV's bottom-right corner: 26vh (about 2.9x the old one; 21vh with 7+ players), pure
  black on white with a full 4-module quiet zone and low error correction (fewer, bigger squares), so it scans off a
  slightly blurry wall projector. The podium gets a smaller "Scan to join the next game" QR in its corner.
- **Sound fix ("chunky blips" after a while on the Chromecast).** Cause: the Youth Centre punk loop never really
  stopped (far away it idled at 3% volume) and built about 7 fresh oscillator / noise voices every 8th note, and the
  proximity volume rewrote two audio parameters every animation frame. On a slow device that piles up until the audio
  thread underruns. Now the band is one fixed set of nodes driven by automation from a 0.5 s lookahead timer
  (it resyncs instead of bursting if the device stalls), proximity writes are throttled, one-shot sounds have a voice
  cap and per-sound rate limits and are disconnected as soon as they end, there's a brick-wall limiter, a larger
  'playback' audio buffer, 24 kHz audio on TV sticks (Chromecast / Tizen / webOS / Fire TV), no faint far-away loop on
  slow devices, and the audio device sleeps after 30 s of silence. In a test game, WebAudio nodes created per minute
  dropped from about 5,000 to about 360. Laser Range and Zombie Tiles got the same treatment for their one-shot sounds.
- **New game** button for the host phone (My Stuff, and the host panel on the Board tab): "Are you sure?", then
  the game ends with no winner and everyone goes back to setup in the same room. No re-scanning, no recasting.
- The host phone now stays with whoever joined first. Before, starting a game shuffled the seats and the host
  controls could silently move to another phone.

### What's new in v0.1.1
- Owned tiles are washed and outlined in the owner's colour (TV and phone Board tab). After a private deal the tiles
  drift to the new owner's colour over about 10 s, with only a generic "A deal went down." log line.
- A dropped phone gets an AI stand-in after about 15 s. Rejoin from the same phone, or from a new phone using the
  seat's name, to take the seat back.
- PASS DICE locked for 3 s after each landing; auctions; three game lengths; AI seats mid-game.
- TV: a gentle follow camera (lobby setting or the C key; off at the lowest Auto-Crush rung), dice that tumble across
  the board, tile names at least 50% bigger, a soft sun and moon arc tied to the day/night clock (about 80% transparent),
  and a first-pass mini city in the centre (dense buildings against the property ring, roads and sidewalks, peg-people
  and little cars, the river and the Upper Level).
- Phone Board tab: names only, pinch / drag / + - zoom, a dot per player (the active one pulses and steps along its path).
- **Leave game** (My Stuff, bottom): a strong "Are you sure?", then pick (a) hand my character to an AI, (b) split my cash
  and deeds evenly, (c) give everything to one player, or (d) throw it all into the Dirt Lot pot (deeds back to the bank;
  Shops are sold back to the bank for b and d). Not allowed during a PAY UP window, while your deeds are locked, while
  you lead an auction, or with an unpaid debt. The TV announces it, and the phone switches to Observer mode.
- **Observer mode**: a small QR in the TV's side panel during play. Scanning it opens a watch-only phone view (zoomable
  board, standings, game history). An observer can ask to take over an AI seat: every human player gets a 5-second
  YES / NO prompt, and majority yes (or no objections) hands the seat over. Observers join the next game automatically.
  A phone that joins mid-game with no seat to claim also lands in Observer mode.
- **Results podium** on the TV at the end: 1st on top, 2nd and 3rd beside it, everyone else on the ground in front.
  Each player shows net worth (cash + property + shops) and five small stat tiles (biggest rent collected, best deal,
  PAY UP catches / misses, auctions won, times in the Snowbank), plus one fun title such as "Landlord of Gaetz",
  "Snowbank Regular", "Quickest Draw in Red Deer", "Auction Hawk", "Deal Maker" or "Asleep at the Till". Each title goes
  to the player with the strongest claim, and nobody gets two. Fireworks and a Hue celebration (rainbow wave, flashes
  in the winner's colour, then the lights are handed back). Phones show each player's title on their results list.
- Old TV browsers (Samsung Tizen, Chromium < 80) load a transpiled PeerJS build automatically, so phone play works there.
  Full-screen panels (lobby, results) no longer rely on CSS `inset`, which those browsers ignore.

## Files
| file | what |
|---|---|
| `index.html`, `css/tv.css`, `js/host.js` | TV page: lobby, QR code, board, overlays, Auto-Crush, PeerJS host, Hue bridge |
| `controller.html`, `css/phone.css`, `js/controller.js` | phone: join, character carousel, host settings, four tabs, PAY UP and BOOM takeovers |
| `js/config.js` | all numbers: money, PAY UP timing, characters, AI levels, living board, Youth Centre, Hue |
| `js/board.js` | the 40 Present Day spaces, groups, rents, the Red Deer Randomness and Secret Finds decks (era tags, sources, `deckCards` filter) |
| `data/secret-finds-sources.md` | v0.3: the source for every Secret Finds story, plus the facts we checked and left out |
| `js/game.js` | rules engine (pure, time-driven `tick(now)`; also runs in node for the simulations) |
| `js/ai.js` | AI players: buying, building, unmortgaging, set-completing trades, PAY UP reflexes, chat lines |
| `js/render.js` | canvas board: tiles, Youth Centre vignette, walkers and cars, day/night, tokens, camera |
| `js/fx.js` | v0.2 board particles (landing fireworks, $ pops, bills, token-to-token money): pre-rendered sprites, capped, swappable |
| `js/options.js` | v0.2.1 game-options helpers: presets, counts, active chips, and the press-and-hold row handler (tap toggles, hold explains) |
| `js/art.js` | v0.2 building line art with the outward overhead lean (`C.art.lean`), swappable for rendered sprites |
| `js/sfx.js` | WebAudio sound effects plus the procedural punk band loop (no audio files) |
| `js/net.js` | PeerJS host and client (copied from Zombie Tiles) plus a BroadcastChannel transport for `?local` tests |

## URL options (TV page)
- `?ai=3` adds 3 AI players; `?ai=mike:ruthless,grace:easy` picks characters and levels.
- `&autostart` starts as soon as there are 2+ players (useful with `ai=`).
- `&mode=regular|medium|quick` picks the game length (see above). The old `&mode=full` still means Regular.
- `&rules=jackpot,fees,bullseye,classic,kid,noperks` sets house rules (`classic` = automatic rent, no PAY UP race).
- `&lowfx` starts on the lowest graphics rung; `&fx=N` sets rung 0-6; `&nocrush` turns off Auto-Crush.
- `&mute`, `&room=ABCD` (fixed room code), `&seed=N`, `&fast` / `&speed=N` (time multiplier), `&nonet` (no PeerJS).
- `&local` uses the BroadcastChannel transport: phones in tabs of the same browser, for tests only.

TV keys: Enter starts or replays, M mutes, L turns the lights on or off, V cycles the graphics rung (manual),
A turns Auto-Crush back on, C toggles the follow camera, I adds an AI to an empty seat mid-game,
and N skips the day/night clock forward 2 minutes.

## Auto-Crush
If the TV renders under 24 fps for 5 s, it steps down one rung, and steps back up after 30 s above 28 fps.
The rungs:
1. half the walkers and peg-people
2. no cars
3. static Youth Centre
4. quantized day/night, 1x pixel ratio, no lit city windows or sun/moon glow
5. no walkers
6. flat tiles (no mini city) and no follow camera

Tokens and the UI are never crushed.

## Philips Hue
This reuses the Zombie Tiles Lights Helper unchanged. The TV opens a second PeerJS "lights door" on the Zombie Tiles
prefix with the same room code, so in the helper you just type the Red Deer Rich room code. Game events map onto the
helper's existing effects:

| Red Deer Rich event | helper effect |
|---|---|
| turn colour | turn |
| dice | roll |
| PAY UP window | fight |
| caught | fight lost |
| buy | pickup |
| auction won | pickup (winner's colour) |
| build or GOLD | helipad |
| whiteout | boom |
| jackpot or game over | escape |
| results podium | pickup / kill flashes in the winner's colour, a second escape wave, then over |
| bankrupt | crunch |

## Placeholder or not done yet (v0.5)
- Art is all placeholder: coloured tokens with initials and shapes, line-art buildings, simple particles, simple silhouettes.
- Perks still coming: Justin's Count-In, Drew's High Kick and Walt's Shortcut.
- The mini city is a first pass: generic blocks, not real Red Deer landmarks yet.
- Present Day era only: no era skins yet (cards are era-tagged and filterable, ready for them), and vignettes are icons rather than full stages.
- No Future Red Deer history cards (a Future skin falls back to the whole deck).
- Hue: no day/night base cycle and no new effect names (existing helper effects are reused).
- Optional rules not built yet: Deal Ticker and a per-turn timer (the v0.5 timer is the game clock). No character voice stings.
- Disasters use emoji icons for the fly-in graphic (placeholder art), and the saw animation is simple line art.
- Shake to roll was tested with synthetic motion events only; the threshold (`C.shake.jerk`) may want tuning on real phones.

## Backlog (not built yet)
- **Night Crime (lobby toggle).** At night, players can Lock Up their businesses from My Stuff (maybe a small cost,
  or a one-tap Lock All). Unlocked businesses risk random, generic crime events (vandalism, a break-in, a smashed
  window) that cost repair money. Crime must never be tied to, or shown as, the unhoused townsfolk.
- **Unhoused townsfolk (separate lobby toggle).** Whether unhoused townsfolk appear in the ambient population at all.
  This is independent of Night Crime and has no gameplay link to it.
- **Natural Disasters & Mishaps.** Built in v0.5 as the Disasters option, using closures and half rent instead of repair bills.
  Possible later: Lock Up at night to dodge the night events.
- **Remote TV screen.** A second household opens the game page on their own TV, types the room code, and gets a live,
  mirrored, view-only TV board (same animations and sounds, no host controls), so two living rooms across town can
  play one game, each on its own TV. Their phones join with the same room code. Needs: a "Watch on another TV" entry on
  the TV start screen, a mirror role in the TV's PeerJS room that receives the full game state plus events, and a
  check on TURN servers for cross-network WebRTC.
- **Needs a real test: remote phones.** Phones joining by room code from a different network (not on the TV's Wi-Fi)
  should already work through PeerJS, since the connection is peer-to-peer over the internet with STUN. It has not
  been tested across two real households. Some strict mobile carrier or router NATs may need a TURN relay.

## Tests (kept outside the repo in `/workspace/red-deer-rich/tests` on the build box)
- `sim.js` runs headless node AI games with invariant checks.
- `e2e.py` drives the TV plus two phones: join, carousel, host, PAY UP caught, slipped and grace lock, trade, counter, hold-accept, stale, decline, chat and lock.
- `e2e3.py` covers v0.1.1: modes, auctions, mid-game AI, the phone board, leave game, observer + vote, and the sky arc.
- `e2e4.py` covers v0.1.2: watch QR size and corner, quiet zone, decoding from blurred 1080p / 720p screenshots, New Game (confirm, cancel, back to setup, restart), podium join QR.
- `e2e5.py` covers v0.2: tokens stay on the landing tile, landing bursts, money floats / count-up / particles / token-to-token flights, private trades, notification shatter + 6 s hold + fade, log size and trimming, centre-only night lighting, building lean always outward + sprite swap, My Stuff board order, Go bust + plaques + owed title, the disconnect countdown and AI hand-back, camera moments, and turn pace against v0.1.2.
- `e2e6.py` covers v0.2.1: owner-tint alpha × 0.8 (config and pixels), podium QR size, overlap and blurred decode, the collapsed options line, presets + Custom, press-and-hold details without toggling, remember-last-game (phone and TV), the START pickers, TV lobby chips, and no page errors.
- `v03unit.js` (node) covers v0.3 decks (sizes, eras, effects, sources file, filter + fallback), the PASS DICE lockout only where PAY UP can happen, and the halved boom.
- `e2e7.py` covers v0.3 in the browser: every card fits the TV at 16:9 / 720p / 4:3, the phone card + READ MORE sheet, the My Stuff tile bounce (colour, no game change, rate limit, own deeds only), the PAY UP explosion vs the normal rent flow, phone sounds and vibration, and rejoin keeping the live settings.
- `v04.py` is the v0.4 multi-phone playthrough: Heckle unlock times / faces / buzz / TV pop / rate limit, PAID IN FULL by a manual sell and by a mortgage flip, card history + card list, the cards view in portrait and landscape (unfold, ghosts, flip, unmortgage, list switch), and the drag-map trade with slider, private highlights and SUBMIT.
- `v05unit.js` (node) covers v0.5: the 20 disaster events and presets, rent with damage, the repair countdown, rush cost, caps (per round, at once, never stacked, never mortgaged, day/night pools), the auto-raise planner order and text, and the timer defaults and choices.
- `v05.py` is the v0.5 browser run: the Disasters option, presets and hold details, timer picker and end time, bold amounts, the TV fly-in and note, the phone alert, RUSH REPAIR, history taps, the My Stuff badge, the board-map marker, deed flip cards (board map, trade map, history), shake to roll, the wake lock, the raise plan with OK, the Mega-Plex saw, the 12 s card hold and queue, cash pop and crunch, and bigger portrait cards.
- `autoq.py` checks v0.4 auto graphics: the boot probe steps a slow TV down, the FX line says auto, and `rdr_fx` pins a rung.
- `podfit.py` checks the results screen for 2 to 8 players at 1920×1080 and 1024×768 (inside the screen, no overlaps, clear of the QR).
- `tiletext.py` makes the tile-name before/after closeup and checks the lighter weight.
- `oldsetup.py` checks the new setup screens and TV lobby on Chromium 62 / 74.
- `bust.js` unit-tests "Go bust, pay what I can" in node (player and bank creditors, auction queue, owed, plaques data).
- `audio.py` counts WebAudio nodes per minute in a live AI game, old engine vs new.
- `podium.py` plays quick games to the end and checks the results podium (titles, stats, net worth, fireworks).
- `tv_full.py` checks Auto-Crush, Youth Centre proximity volume, `lowfx`, and full AI games in the browser.
