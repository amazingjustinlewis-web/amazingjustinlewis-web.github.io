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

## Lost Sock (Oct 13, 2026) - v0.1 on the dev page
- [ ] Laundry arsenal, next (dryer bomb is in v0.1 as a proxy): bleach bomb (fades the team colour), clothespin sniper, static cling grenade (sticks socks together), lint roller steamroller. (Mortar, airstrike and hamper mine shipped in v0.2.)
- [ ] Mismatched Pair polish (in v0.1 as a basic version): fabric + paint build animation, smarter pathing toward the enemy.
- [ ] Private table mode, sock customisation, camera zoom/follow on bigger maps, sound.

## Demolition Derby (Oct 14, 2026)
- [ ] Car picker: several models (sedan v02 is the first), with paint / texture / look options. Every model fully bustable (separate hood, doors, trunk, glass, wheels with pivots, same as sedan_v02).

## Controls plan (long-term, Oct 15, 2026)
- [ ] Layer 1, good defaults: every game just works with phone, controller, keyboard or mouse, with no setup.
- [ ] Layer 2, quick presets behind the small gear (shared ztp-pad-settings.js): Standard, Southpaw, Inverted (plus the swap and invert checkboxes that exist today).
- [ ] Layer 3, full "map anything to anything" remapping for deep players and adaptive / accessibility controllers (e.g. one-handed designs), saved per player and per game.
- [ ] Someday: custom 0-Phi controllers.

## Demolition Derby, future (Oct 15, 2026)
- [ ] More modes on the same bustable car physics: full-contact racing, and a stunt / trick scoring mode.
- [ ] Hand-modelled "hero wreck" variants for each car (wrapped around a pole, nose-planted, folded in half), swapped in for big slow-motion crash moments.
- [ ] Roof crush: cars that land or slide on their roof get the roof/pillars crushed (v0.4 has flips + roof slides, no crush yet).
- [ ] Phone controller (controller.html): same touch-anywhere floating joystick + green throttle bars + swipe boost as phone-screen play.

## Coffee-shop mini games (Oct 15, 2026) - v0.1s on the dev page
Hop Top (peg triangle), Dangerous Waters (classic battleships, folder broadside/), Swish Flick, Splash Clown, Glide Puck, Stack Attack, Balloon Buddy. Shared kit: dev-7q3x/minikit/.
- [ ] Dangerous Space Waters: bigger board on opposite sides of a nebula; pick spaceships with different abilities; ships can move a little each turn; collect resources from asteroids; send probes and get reports; weapons with different shockwave radii. (Slot already in the mode picker as "Dangerous Space Waters (coming)".)
- [ ] Plinko.
- [ ] Price is Right-style show, after optional sign-in and simple characters (Justin can animate simple CG guys; slide them around as a first pass).
- [ ] Penny / coin arcade game: coin goes up a ramp and flips at the top (maybe a Penny Falls-style pusher). Confirm the details with Justin first.
- [ ] Real-phone pass on all seven: flick power tuning (Swish Flick, Splash Clown), Glide Puck camera feel, Stack Attack drag over the network, sound.
- [ ] Once Dangerous Waters is approved, fold its TV board + 10x10 Classic into the café Battleship.
- [ ] Café shared screen: multiple groups on one café screen playing different phone-native games; when none needs the full screen, the screen shows split views, highlights and scoreboards from active games.
  - Phone-native games (e.g. Hop Top peg game) stay entirely on the phone. The big screen only joins in when ~3+ people are playing one game; otherwise it just shows subtle ghosted names, small scores and achievements floating up the side of whatever's on screen (even over the logo or shop page). No 'N people playing' counter for now.
- [ ] Stack Attack: real 3D physics (blocks with depth that can sit in front of / behind each other). v0.2 is a 2D physics slab drawn in 3D.

## Iron Stride split (Oct 15, 2026)
- [ ] Two games now: Iron Stride Squad (3/4 top-down arcade brawler, all inputs) and Iron Stride: Cockpit (first-person open world). "Cockpit" is a placeholder; the name is Justin's call.
- [ ] Missions and RKD-style versions of both, later.

## Red Deer Rescue, future (Oct 15, 2026)
- [ ] Picking powers and stacking them, with layered strategies.
- [ ] Throwing cars; light building damage.
- [ ] Cats stuck up trees to rescue.
- [ ] A long list of arcade-style bits to add over time (collect ideas here). For now the proxies sliding around is fine.

- Bubble Hockey: animate players stickhandling and shooting (currently static figures that slide along their slots).

## Orbit Brawl: HUD placement (from v0.3)
- v0.3 hides the top HUD (timer, kills, rank, kill feed) so the cockpit stays clean; only a tiny timer + kills readout sits in a corner. Rethink where these live: end screen, a small corner, the radar rim, or a pull-down. Decide after more playtests.
- Radar has no pickups yet (none exist); add pickups and show them on the radar.
- Bubble Hockey: tune track positions/lengths and stick lengths after playtests (bubble/tracks.js).
- Bubble Hockey: real player models (currently cylinders + box sticks).
- Bubble Hockey: crossbar/post physics (puck is flat 2D; posts are simple circles).
- Bubble Hockey: Justin will model a proper dome-hockey table in Blender. Hooks: swap the Bubble3D.build() scene for the GLB; add faded background crowd (cheering / freaking out) shown during replays; multiple broadcast-style cinematic cameras (extend Bubble3D.shot() kinds and the replay segment list in Bubble3D.goal()).
- Bubble Hockey next iteration (v0.6+), in this order:
  1. Opponent players drawn 60% transparent on your phone so it's clear you can't control them.
  2. Body checks: holding your guy and making a quick move without lifting checks opponents. Square hard check can send them over the glass (respawn a few seconds later); hard checks knock them down sliding, then they get up and skate back. Each player has a blended weight toward their path (keep the springiness).
  3. Hard pushes visually strain/bend the track a couple of pixels.
  4. Hard shots in slow-mo tear/shatter the net or knock it off its posts so it bounces around.
  5. Later: Justin's own simple 3D hockey guys (poses, skating, skating hard, body checks from 8 angles).
  6. Fights.
  7. Stamina/health ring around each player (green/yellow/red) from hits, with recovery and injuries.
  8. Helmets that get knocked off (flying stick: maybe, much later).
  9. Line-change buttons, penalties, reformed lines when short-handed.
  10. Penalty shot mode: 10-20% speed, zoomed red-line-to-net view, goalie vs one freer-moving skater; gentle flicks deke, forward flick shoots relative to the stick (may become the general subtle stick-control system).
  11. Keep the current fast speed; optional speed settings at join are fine.
- Bubble Hockey later: two proxy bar guys standing at the table who yank, shove, pull and twist the rods (softly simulated from which players are active); super slow-mo replays fly in over their shoulders into the bubble.
- Bubble Hockey later: separate hockey-player, goalie and ref proxies; penalties, injuries, line changes.
- Bubble Hockey track redraw (Justin): move the D bow-in slightly inside the blue line.
- Bubble Hockey short-handed (4 on ice): reconfigure the available paths to maximize ice use.
- Bubble Hockey glass dome: checks can punch through it (persistent cracks/holes); enough damage shatters it and it falls, the arcade guys toss it aside and play continues; checked players can fly over the edge onto the arcade floor.
- Bubble Hockey animations from Justin: skating slow/fast, drifting, crouched, stick handling, wrist shots, passes, slapshots; checks and impacts from 8 directions at light/medium/hard.
- Bubble Hockey health ring at the feet: blends green/yellow/red, recovers with stamina, players slow when red; ring breathes with stamina (gentle thickening, faster when panting); rattled and black when knocked out.
- Bubble Hockey: helmets knocked off; sticks fly, slide toward their player and stay on the ice as physics objects until reset at the whistle.
- Bubble Hockey: periods, arcade-length line changes, cinematic angles.
- Bubble Hockey rules: no offsides, only goals stop play. Refs point and freak out at offsides and checks, but no penalties except after a fight (sometimes both players, sometimes the more aggressive one). Track aggression per player and per team to trigger fights; a constant aggressor must win convincingly or he alone goes to the box.
- Bubble Hockey fighting system once models exist.
- Bubble Hockey: real glove-grab-down animation for the faceoff puck once the player models exist (v0.8.1 is a proxy lean + raised arm).
- Bubble Hockey: varied movement animations per player (so the 12 guys don't all move identically).
- Bubble Hockey performance plan: phones can drop the extras (bar guys, ref, crowd, particles) if it chugs.
- [ ] Bubble Hockey (after v0.8.6): end-of-game highlight reel — keep each goal's replay buffer; after the final, play one replay per goal with a varied angle (slow following or static), scorer caption, skippable.
- [ ] Bubble Hockey (next): jerseys show the user's profile name or arcade 3-letter initials; names on the scoreboard.
- [ ] Bubble Hockey (next): clean stat overlays between plays on the TV with the cinematic view (shots, saves, hits, possession).
- [ ] Bubble Hockey (next): post-game breakdown alongside the highlight reel.
- [ ] Bubble Hockey: goalie reach/lunge animation from Justin's models (replaces the proxy lean + 'reachPad' box).
- [ ] Bubble Hockey: tilt-shift / miniature depth-of-field on select cinematic and replay angles (TV), toggleable.
- [x] Bubble Hockey v0.9: soft movement spring for thumb-held players (MOVE_SPRING) + flick keeps some carry whip (WHIP); goalie freeze (cover ~5 s or glove save -> whistle, coast, faceoff at the zone dot).
- [x] Bubble Hockey v0.9.1: goalie depth (GD: out 1.5x / back 0.25x, AI cuts angles, settles on quiet play, further on breakaways, tight when wide/behind); goalie <-> skater body shoves (gBody); human strip forward/back sets depth (arrows); AI forwards mostly shoot, sometimes drive (AIF); Wild puck toggle (WILD, ⚙, default on).
- [x] Bubble Hockey v0.9.2: phone held-player cue: thick feathered personal ring + soft glow under the thumb with a feathered tether to the player (view3d CUE constants: ringIn/ringOut/solid/feather/ringA/glowR/glowA/tetherW/tetherA); sparkles removed. TV rings unchanged.
- [x] Bubble Hockey v0.9.3: highlight buffer (view3d HL/HLK: cap 14 clips, 30 fps, scored by kind) -> post-game reel (REEL.dur 180 s, chronological ending on the best, angle-1 top cam, soft title cards, any tap skips) -> attract mode (muted AI-vs-AI, normal goal replays, ORB dome orbits 20-40 s alternating) until a phone input/join starts a game.
- [ ] Bubble Hockey reel: more angles per goal clip, player-name captions, one-timer/near-miss detection tuning.
- [ ] Bubble Hockey: tune goalie depth vs scoring rate with real players; human goalie lunge/check animation polish; wild-puck bounce feel review.
- [ ] Bubble Hockey: zone faceoffs - players line up around the zone dot (they currently coast to their usual slot spots); serve-slot pop visual at the zone dots.
- [ ] Bubble Hockey: real glove-hand side per goalie model (current glove save is a proxy: hard shot to one side, ~30% chance).
