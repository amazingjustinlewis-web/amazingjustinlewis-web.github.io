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
