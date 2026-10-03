# Zombie Tiles (working title) - prototype v0.4

A zombie tile-laying board game for a TV or big screen. Up to 4 players use their
phones as controllers (Jackbox-style), or play hot-seat on one screen.
Plain HTML5 + JavaScript (canvas). No build step, no server of our own.

## Play
1. On the TV / PC browser open `index.html` (live: https://amazingjustinlewis-web.github.io/games/zombie-tiles/).
2. Phones scan the QR code (or open `controller.html` and type the 4-letter room code), enter a name, pick dice, JOIN.
3. The first player to join presses START GAME on their phone (or press Start / Enter on the TV).
4. No phones? Add hot-seat players in the lobby and play with the keyboard or the on-screen pad.

TV keys: arrows plan a path, Enter = roll / execute / place, Backspace = undo,
Esc = reset moves, N = end turn, T = drop a trap box, B = drop dynamite, X = detonate your dynamite,
Q/E = rotate a tile, M = mute, L = Hue lights off/on.

## Traps, dynamite and sprites (new in v0.4)
- **Trap boxes** and **dynamite** are new pickups (max 2 of each). On your turn (before rolling or while planning) press
  DROP TRAP / DROP TNT on your phone (T / B in hot-seat) to leave one on your square.
- A zombie that steps on a trap is caught in a rope snare and yanked away (player-zombies just dangle for 2 turns).
- Lit dynamite goes off at the end of the round, or right away with DETONATE (X). It clears zombies in the 3x3 area
  around it and takes 1 heart from any player standing there (you included). Big boom, screen shake, orange Hue flash.
- Phone buttons: RESET MOVES clears your planned path; END TURN (tap twice) stops where you are and gives up the rest of your moves.
- AI players drop traps when zombies come close and light dynamite when zombies bunch up, then walk out of the blast.
- Tokens are now little animated characters that walk square to square. Draw your own: see `assets/sprites/README.md`.
- All numbers are in `js/config.js` (`items`, `sprites`).
- **Placing a tile ends your turn** (since v0.3.1).

## Computer players (new in v0.3)
Add AI players in the TV lobby (click the personality and difficulty buttons, then + ADD AI) or from the host
phone ("Add AI player"). Personalities: reckless fighter, cautious looter, helipad sprinter, sneaky backstabber,
loyal buddy; difficulty Easy / Normal / Ruthless. They work alongside phones and hot-seat players. AIs show their planned
path before moving, react in speech bubbles with sound, may share ammo with their teammate (or leave them at the
helipad) and rise as zombies with their own hunting style. If a phone drops mid-game, an AI covers the seat after
10 s and hands it back when the phone rejoins. Each phone can switch on "Coach hints" (a suggested move; the player still chooses).
AI tuning (personalities, difficulty, timings) is in the `ai` block of `js/config.js`; the brain is `js/ai.js`, sounds are `js/sfx.js` (WebAudio, generated in code).

## Philips Hue lights (optional, new in v0.2)
Run the Lights Helper on a PC on the same network (`lights-helper/`, see its README). It joins the
room as a non-player, and the host phone / TV lobby then asks "Use your lights in this game?" with a
checklist of the bridge's rooms and zones. Without the helper the game is exactly the same as v0.1.
Effect colours, brightness, lengths and Hue rate limits are in the `hue` block of `js/config.js`.

## Tuning
Every rule number is in `js/config.js` (hearts, weapon bonuses, ammo, fight margins, zombie
behaviour, deck size, helipad position, timings, dice styles, ICE/TURN servers).
Tiles are in `js/tiles.js` (8x8 text grids, legend at the top) with how many of each go in the deck.

## Files
| File | What it does |
|---|---|
| `index.html`, `css/tv.css`, `js/host.js` | TV / host page: lobby, QR, overlays, hot-seat input, phone networking |
| `controller.html`, `css/phone.css`, `js/controller.js` | Phone controller |
| `js/game.js` | Rules engine (the TV is the authority; phones only send intents) |
| `js/render.js` | Board renderer (pixel-art tiles, tokens, path preview, tile ghost) |
| `js/dice.js` | The six dice styles, drawn in code |
| `js/ai.js` | AI players: path planning, personalities, difficulty, coach hints, reactions |
| `js/sfx.js` | Procedural sound effects (WebAudio): crunch, victory, charge, scream, rotor, fireworks, fuse, snare, boom |
| `js/sprites.js`, `assets/sprites/` | Character sprite sheets (walk cycles); placeholders drawn in code, your own PNGs optional |
| `js/net.js` | WebRTC via PeerJS and its free cloud broker; reconnect handling |
| `js/vendor/` | PeerJS 1.5.4 (MIT) and qrcode-generator 1.4.4 (MIT) |
| `assets/` | Zero to Phi logo, fonts (OFL) |
| `lights-helper/` | Optional Philips Hue helper for a PC (Python, standard library): pairing, effects, mock bridge |

## URL options (TV page)
`?hotseat=3` adds 3 hot-seat players, `&autostart` starts at once, `&seed=42` fixes the shuffle,
`&fast` speeds up animations, `&nonet` skips the phone room, `&mute` starts muted,
`&room=ABCD` asks for a specific room code, `&ai=3` adds 3 AI players (or `&ai=fighter:ruthless,looter:easy`), `&hotseat=all` lets the keyboard play for phone players too.

## Networking notes
The TV registers a room on the free PeerJS cloud broker; phones connect to it with WebRTC.
TV and phones on the same Wi-Fi is the normal case and needs only STUN. Phones on mobile data
or very strict networks may need a TURN server: add one to `iceServers` in `js/config.js`.
If the TV page is opened from a local file, the QR code points phones at the live controller.
