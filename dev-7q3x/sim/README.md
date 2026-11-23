# AI playtest panel (dev kit) v0.1

`panel_v01.html` opens the real game TV page and 1-8 real phone pages in iframes and drives each phone with a
simulated person, so you can watch every phone screen side by side and study how people play.

- **Shared room.** The panel opens `../rdr-phone/index.html` (Red Deer Rich TV board, dev v0.7.1) with a room code and
  points every AI phone at `../rdr-phone/controller.html?room=CODE`. The QR in the panel joins the same room from a
  real phone. "Wait for me" holds the lobby until you press START GAME NOW.
- **Room: Online** uses the PeerJS broker (same as the TV game). **Offline** uses the same-browser BroadcastChannel
  transport (`&local=1`): no network needed, but no real phones.
- **Autopilot.** `js/games/rdr_v01.js` reads only what that phone can see (`RDRC.state()`) and taps the real buttons
  (pointerdown / pointerup / click at a spot inside the button, with a visible ripple). Missed taps land just off the
  button and do nothing. No game code is changed.
- **People.** `js/personas_v01.js`: name, gender, look, skill, smarts, reaction, calm-to-intense temperament, phone
  orientation (portrait / landscape / switches), a quirk and a motive. The Human model turns those into reaction
  delays with a long tail, hesitation, misreads, missed taps and short "looked away" lapses.
- **Controls.** Pause / resume (TV and every phone), speed 1x / 2x / 4x (game timers and human delays), Restart
  (fresh room, same people), event log (AI actions + TV game log, filterable).
- **URL.** `?n=4&auto=1&speed=2&len=quick&net=local&hold=1&seed=7`. Test hook: `ZTPSim.state()`, `ZTPSim.events()`.
- **Adding a game.** Add `js/games/<id>_v01.js` registering `ZTPSimGames.<id>` (contract at the top of
  `rdr_v01.js`) and a script tag in the panel.
- **Later.** `js/hooks_v01.js` holds the venue hook (cafe / pub / stage) and the group menu vote hook.

## v0.2 (`panel_v02.html`, v0.1 untouched)
- Phone layout (logical width < 820 px): settings in a gear drawer, TV full width on top, phones in a scrolling
  2-column grid (landscape phones span both), event log collapsed. Android "desktop site" mode (layout ~980 px on a
  ~400 px screen) is zoomed back up by `screen.width` (`?zoom=x` overrides).
- No text selection, long-press callout or Touch to Search anywhere; the TV hint has a real START button.
- Seats: every phone caption has an **AI / Me** switch (also in Edit players, or `?me=2`). Me = autopilot off, the
  controller is yours. A Me seat set before Start joins with "Your name".
- Double-tap any phone or the TV to zoom it to full screen (phone: the controller at the real screen size; desktop:
  as big as fits). Your seat is playable while zoomed; AI phones and the TV are watch-only. The gold tab at the top
  right (or Esc) zooms back out. Nothing is moved or paused: every iframe keeps running underneath.

## v0.3 (panel_v03.html)
New files only; v0.1 / v0.2 untouched. Uses `personas_v02.js` (curiosity stat), `games/rdr_v02.js` (adapter), and the TV board
`rdr-phone/index_v074.html` (= v0.7.3 + `host_v074.js`, whose QR points at `controller_v074.html`).
- **Phone sound:** header "All phone SFX" (default off; `&sfx=1`) plus a speaker per phone caption that overrides it. Only effects;
  the band music plays once, from the TV. The speaker jumps in gold #E2B84A whenever that phone fires an effect (faint when muted).
  Every panel tap or key re-unlocks the audio.
- **Curious AIs:** after locking a pick they peek at the host options, swipe other characters, or turn the phone, weighted by
  `curiosity` (editable in the people cards). They never press CHANGE PICK.
- **Explore after pick (controller_v074):** after a pick the menu fades but stays swipeable ("✔ You picked X · just browsing").
  CHANGE PICK snaps back to your pick; PICK or KEEP returns you to where you were browsing. `RDRC.lobby()` is the test hook.
- **TV breakout:** ⛶ = full screen (Fullscreen API + zoom; the gold tab exits). ⧉ = its own window, using the TV viewer mode
  (`index_v074.html?viewer=CODE`), synced to the same room.
- **Host:** Auto (first in, handed on when they leave; the game drops a silent phone after about 15 s), Me (your seats join first,
  the AIs never press START, use START GAME NOW or your phone), or First AI. `&host=auto|me|ai`.
- **Leave / rejoin / late join:** ⏏ on a caption closes that phone; tap it again to walk back in with the same id, which restores the seat.
  "Late join" adds a new AI; mid-game it takes a free seat or watches.
- **Pace:** Relaxed (AI think ×1.8, TV timing ×1/0.72, catch window 8 s), Normal (×1.35, ×1/0.85, 5 s), Snappy (v0.2 pace). `&pace=`.
- Unticking "Wait for me" starts the AIs right away.
