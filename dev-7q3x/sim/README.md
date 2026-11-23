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
