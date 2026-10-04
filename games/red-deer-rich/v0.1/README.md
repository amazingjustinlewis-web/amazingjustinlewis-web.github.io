> Archived copy of v0.1 (kept so the old version stays playable). The current build is one folder up.

# Red Deer Rich - v0.1 first playable (placeholder art)

A Red Deer-themed property trading board game by Zero to Phi. The spec is the design doc
(`red-deer-rich/design-doc.md`, outside this repo). Same architecture as Zombie Tiles: plain
HTML/JS with no build step. The TV page holds the whole game state, phones are controllers
over PeerJS (QR code or 4-letter room code), and every number lives in `js/config.js`.

Live: https://amazingjustinlewis-web.github.io/games/red-deer-rich/

## How to play
1. Open `index.html` on the TV: a Chromecast TV browser, DashCast, a Samsung TV browser or a PC on the TV.
2. Phones scan the QR code (or open `controller.html` and type the code), enter a name and swipe to pick a character.
3. The first phone is the host. It can add AI players, switch house rules and pick Full or Quick mode, then taps START GAME.
   On the TV you can also press Enter.
4. On your turn, swipe up on the dice (or tap ROLL), then BUY or PASS, then PASS DICE.
   When someone lands on your deed, a giant **PAY UP** button takes over your phone. Rent is only paid if you hit it
   before they pass the dice. Their PASS DICE button stays locked for a 1.5 s grace period.

## Files
| file | what |
|---|---|
| `index.html`, `css/tv.css`, `js/host.js` | TV page: lobby, QR code, board, overlays, Auto-Crush, PeerJS host, Hue bridge |
| `controller.html`, `css/phone.css`, `js/controller.js` | phone: join, character carousel, host settings, four tabs, PAY UP and BOOM takeovers |
| `js/config.js` | all numbers: money, PAY UP timing, characters, AI levels, living board, Youth Centre, Hue |
| `js/board.js` | the 40 Present Day spaces, groups, rents, Hailstone and Potluck cards (each with a Red Deer fact) |
| `js/game.js` | rules engine (pure, time-driven `tick(now)`; also runs in node for the simulations) |
| `js/ai.js` | AI players: buying, building, unhocking, set-completing trades, PAY UP reflexes, chat lines |
| `js/render.js` | canvas board: tiles, Youth Centre vignette, walkers and cars, day/night, tokens |
| `js/sfx.js` | WebAudio sound effects plus the procedural punk band loop (no audio files) |
| `js/net.js` | PeerJS host and client (copied from Zombie Tiles) plus a BroadcastChannel transport for `?local` tests |

## URL options (TV page)
- `?ai=3` adds 3 AI players; `?ai=mike:ruthless,grace:easy` picks characters and levels.
- `&autostart` starts as soon as there are 2+ players (useful with `ai=`).
- `&mode=quick` gives Quick mode (pre-dealt deeds, 45-minute timer, richest wins).
- `&rules=jackpot,fees,bullseye,classic,kid,noperks` sets house rules (`classic` = automatic rent, no PAY UP race).
- `&lowfx` starts on the lowest graphics rung; `&fx=N` sets rung 0-6; `&nocrush` turns off Auto-Crush.
- `&mute`, `&room=ABCD` (fixed room code), `&seed=N`, `&fast` / `&speed=N` (time multiplier), `&nonet` (no PeerJS).
- `&local` uses the BroadcastChannel transport: phones in tabs of the same browser, for tests only.

TV keys: Enter starts or replays, M mutes, L turns the lights on or off, V cycles the graphics rung (manual),
A turns Auto-Crush back on, and N skips the day/night clock forward 2 minutes.

## Auto-Crush
If the TV renders under 24 fps for 5 s, it steps down one rung, and steps back up after 30 s above 28 fps.
The rungs:
1. half the walkers
2. no cars
3. static Youth Centre
4. quantized day/night and 1x pixel ratio
5. no walkers
6. flat tiles

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
| build or GOLD | helipad |
| whiteout | boom |
| jackpot or game over | escape |
| bankrupt | crunch |

## Placeholder or not done yet (v0.1)
- Art is all placeholder: coloured tokens with initials and shapes, flat tiles, simple silhouettes.
- Perks still coming: Justin's Count-In, Drew's High Kick and Walt's Shortcut.
- No auctions (buy or pass only), and no drag-and-drop in the trade builder (tap to toggle instead).
- Present Day era only: no era skins, and vignettes are icons rather than full stages.
- Hue: no day/night base cycle and no new effect names (existing helper effects are reused).
- Optional rules not built yet: Deal Ticker and the turn timer. No character voice stings.

## Tests (kept outside the repo in `/workspace/red-deer-rich/tests` on the build box)
- `sim.js` runs headless node AI games with invariant checks.
- `e2e.py` drives the TV plus two phones: join, carousel, host, PAY UP caught, slipped and grace lock, trade, counter, hold-accept, stale, decline, chat and lock.
- `tv_full.py` checks Auto-Crush, Youth Centre proximity volume, `lowfx`, and full AI games in the browser.
