# Zombie Tiles (working title) - prototype v0.2

A zombie tile-laying board game for a TV or big screen. Up to 4 players use their
phones as controllers (Jackbox-style), or play hot-seat on one screen.
Plain HTML5 + JavaScript (canvas). No build step, no server of our own.

## Play
1. On the TV / PC browser open `index.html` (live: https://amazingjustinlewis-web.github.io/games/zombie-tiles/).
2. Phones scan the QR code (or open `controller.html` and type the 4-letter room code), enter a name, pick dice, JOIN.
3. The first player to join presses START GAME on their phone (or press Start / Enter on the TV).
4. No phones? Add hot-seat players in the lobby and play with the keyboard or the on-screen pad.

TV keys: arrows plan a path, Enter = roll / execute / place, Backspace = undo,
Esc = clear the path, Q/E = rotate a tile, M = mute, L = Hue lights off/on.

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
| `js/net.js` | WebRTC via PeerJS and its free cloud broker; reconnect handling |
| `js/vendor/` | PeerJS 1.5.4 (MIT) and qrcode-generator 1.4.4 (MIT) |
| `assets/` | Zero to Phi logo, fonts (OFL) |
| `lights-helper/` | Optional Philips Hue helper for a PC (Python, standard library): pairing, effects, mock bridge |

## URL options (TV page)
`?hotseat=3` adds 3 hot-seat players, `&autostart` starts at once, `&seed=42` fixes the shuffle,
`&fast` speeds up animations, `&nonet` skips the phone room, `&mute` starts muted,
`&room=ABCD` asks for a specific room code, `&hotseat=all` lets the keyboard play for phone players too.

## Networking notes
The TV registers a room on the free PeerJS cloud broker; phones connect to it with WebRTC.
TV and phones on the same Wi-Fi is the normal case and needs only STUN. Phones on mobile data
or very strict networks may need a TURN server: add one to `iceServers` in `js/config.js`.
If the TV page is opened from a local file, the QR code points phones at the live controller.
