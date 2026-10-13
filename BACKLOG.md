# 0-Phi front door – backlog

Ideas queued after menu2 (Oct 2026). Not built yet.

- **Screen queue with estimated wait**: phones can join a queue for a busy screen and see an estimated wait, worked out from the current game's length and the queue ahead.
- **In-game QR**: while a game runs, a small QR on the TV lets newcomers choose between join this game, explore 0-Phi, or queue their own game.
- **Request-to-change vote**: current players vote on their phones to switch games, with a cooldown so it can't be spammed.
- **End-of-game stat breakdown screens**: per-player/team stats on the TV, with a summary on each phone.
- **"Next team stepping in" announcement**: an animation that hands the screen over and lands the next queued game (fly through the 0).

Done in menu2 for reference: the launching phone is the game's host (it can end the game or go back to the menu). If the host leaves, hosting passes to the next connected player. When a game ends (the game posts `{ztp:'end'}` to its parent), the screen frees, the logo flies back and the QR breathes.

## Transition language (Oct 12, 2026)
- Darker/intense games enter via the Phi corkscrew; lighter games via the 0.
- Return reflects outcome: big win bursts out through the 0; rough loss spirals slowly back out of the Phi. Needs end-of-game results hooked up first.

## Home edition (Oct 12, 2026)
- Private house version of the front door: pairing also shows house controls (lights, movies from hard drive via Chromecast). Coordinate with Grok's home hub.

## Game-to-queue handoff (Oct 12, 2026)
- After the end-of-game breakdown (fireworks, stats), show "Next up: <game>" with a loading bar near the bottom for about a minute.
- Near the end, fade out through one part of the logo (e.g. the 0) and straight back in through the other (the Phi), landing in the queued game.

## Phone wrap-up screen (Oct 12, 2026)
- When the TV moves on, phones keep: stats/scores, share buttons, arcade initials on generic ladders, make/add-to account, explore studio/other games, jump to phone-only games, rejoin TV queue.

## Iron Stride asymmetric direction (Oct 12, 2026)
- Controller players pilot small agile mechs (twitch aim); phone players command huge slow monolithic mechs (tactical: mountain cover, target locks, planned shots). Both clash in the same world, PC and phone. First step: one phone-controlled heavy mech joining a local controller game.

- End-of-game fireworks, podium and breakdown stay on screen at least a full minute before any handoff.
- [ ] Phone wrap-up screen: small 'Made by Zero to Phi' credit that opens the company page. This is the only place the company link appears for café players.
- [ ] Custom café skins: favourite shops get their own Red Deer Rich board (their street, logo, a signature item as a property), tied to their shop account.
- [ ] Shop feedback button in the café setup / shop account.
- [ ] Phone solo mode for Red Deer Rich (and others) so it's playable on a phone alone; replaces the "needs a big screen" note.
- [ ] Firebase setup (tonight): Google Analytics with quiet usage counts (visits, one-sheet scans via business.html, games played, active cafés; no personal info), arcade-initials leaderboards without an account, optional Google sign-in profiles with a Founder #, and the character builder.
- [ ] Café-account version choice: each café picks which frozen version (games/<game>/vX.Y/) its screen runs, default latest stable; reads games/<game>/versions.json.
- [ ] Screen-type dropdown (Phone / Tablet / Big screen): auto-detects, remembers the choice, tight layouts for each.
