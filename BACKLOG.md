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
- [x] Bubble Hockey v0.9.4: phone orientation fixed (screen.orientation.lock + CSS counter-rotate wrapper, V.unrot touch mapping); netcode (minikit opt-in fast channel: Kit.pad({fast}) / c.sendFast / h.allFast, PeerJS reliable:false = unordered; drag coalescing DRAG_MS 33; TV deltas NET {hz 30, slowHz 6, attractHz 3, key 1 s}); attract scoreboard names.
- [ ] Netcode: real café test with 15-20 phones; per-field quantisation / binary packing if still heavy; phone-side snapshot interpolation for the puck.
- [ ] Bubble Hockey reel: more angles per goal clip, player-name captions, one-timer/near-miss detection tuning.
- [ ] Bubble Hockey: tune goalie depth vs scoring rate with real players; human goalie lunge/check animation polish; wild-puck bounce feel review.
- [ ] Bubble Hockey: zone faceoffs - players line up around the zone dot (they currently coast to their usual slot spots); serve-slot pop visual at the zone dots.
- [ ] Bubble Hockey: real glove-hand side per goalie model (current glove save is a proxy: hard shot to one side, ~30% chance).

## Walker v0.4.1 (Oct 16, 2026)
- [x] Phone keeps awake during play: Screen Wake Lock requested on taps until held, re-acquired on visibilitychange; tiny silent looping video fallback (assets/wake.mp4) when the API is missing/refused.
- [x] Instant tap feedback: squish + glow + 15 ms buzz on pointerdown (tabs too); repeat taps of the same choice within ~0.8 s get a soft nudge (6 ms); TV ignores a repeat while that trip/ride is still starting (still counts toward running faster).
- [ ] Verify on Walker's actual phone/iPad (iOS wake lock in home-screen mode, vibrate is Android-only).

## Walker v0.4.2 (Oct 16, 2026)
- [x] Playground slide: walk to a new ladder at the back of the tower, climb rung by rung (lift + settle bob + clank per rung), climb over onto the deck, plop down to sit for a beat, slide with an accelerating ease, hop off and land. Tower roof raised so the sitting view fits under it.
- [x] Same floating fix for swings, merry-go-round and seesaw: walk over on the ground first, then a softened step on. Climbing dome already walked + climbed (unchanged). Bouncy-castle slide (b_slide) still uses the old glide; water slide not checked.
- [ ] Bouncy-castle and water slides: same walk/climb treatment.

### Walker design notes (no build yet)
- Optional follower friend: a heart with a happy face, little arms and legs. Jumps around excitedly, points things out, and lights up extra bright at happy moments (laughter, fun animals, the end of a ride).
- NPC kids invite the player: "Come play with us?" with a big green Yes and a soft red Maybe next time. Yes leads to tag, a slide chain where everyone goes down together, and later sing-along songs.

## Orbit Brawl design note (Oct 16, 2026, no build)
- A spectator loved watching the big screen while someone played on a phone: consider a spectator-friendly TV camera (wider, smoother framing of the action for people watching rather than playing).

## Marble Rush v0.1 (Oct 16, 2026, dev only: /dev-7q3x/marble/)
- [x] TV-authoritative sphere-on-track sim (sim.js, own physics, node-testable), turtle-built track: start gate + countdown, big drop, boosts, 2 jumps, banked curves with glass rails, over-drops, loop (offset corkscrew), rollers, finish + runout. Marble bumps, fall -> respawn at last checkpoint (1.4 s). Pack-follow camera. Phone: tilt (deadzone/curve/smoothing/sensitivity in TILT), iOS permission button, recalibrate, drag fallback, START.
- [ ] Next: play-test tilt feel on real phones; track variety / random tracks; marble skins; sounds; a spectator camera cut for the loop and jumps; lap mode.
- [x] v0.1.1: Portrait/Landscape toggle (localStorage marble-orient; landscape direction latched pre-race from the OS angle, marble-ldir), page locked via screen.orientation.lock or a counter-rotated wrapper with remapped drag; tilt from device-frame beta/gamma for the chosen mode only (landscape 90: lr=beta, fb=-gamma; 270: lr=-beta, fb=gamma); Recalibrate re-zeroes in that mode.
- [ ] Verify on iPhone + Android in both landscape directions; consider auto-detect of landscape direction mid-lobby with a visible indicator.

## Stunt Smash v0.1 (Oct 16, 2026, dev only: /dev-7q3x/stunt/)
- [x] Random level per round (1-2 kicker ramps, crate tower/wall/pile), phone top-down map: draw a line (direction from start, clamped +-26 deg), vehicle pick (bike 250 kg flips / car 1300 kg / bus 7000 kg smash), speed slider, GO. cannon.js 0.6.2 box physics on the TV; score = 100/crate + 400 total wreck + 60/s air + 500/flip. Turn rotation, chase cam, slow-mo (0.3x) orbit replay of the round's best crash, tap to skip.
- [x] v0.2: aim drag reach -> launch strength (DRAGSPD 30..125 m -> 18..44, slider live); dirt off-road (ROAD/DIRT: drag 7 m/s2, sideways grip, slip -> roll torque scaled by speed and mass, 0.12 m visual sink, Points dirt spray); queue next shot during other runs/replays (auto-launch 1.4 s into your turn); GO launch FX (glow, full-screen flash, fade to 'Observe display screen', returns after a beat or when you're next).
- [ ] Tune dirt roll odds on real play; tapping the near-black screen during the replay skips it (maybe make that clearer).
- [ ] Next: curved drawn paths (steer along the line), real wheels/suspension, more obstacle kinds (loops, gaps, explosive barrels), sounds, per-round leaderboard card.

## Mini golf idea (note only, Oct 16, 2026)
- Phone putter (flick or pull-back for power, aim on the phone), shared 3D course on the TV, turns or simultaneous ghost balls; windmills, ramps, loops, moving obstacles; par per hole, scorecard on the TV.

## Foosball v0.2 (done)
- Forward/back thumb rotates the rod instead of translating it: angle proportional to thumb travel (THUMB.full = 90 deg), swing rate follows thumb speed (capped THUMB.maxW), critically-damped spring back to upright on release.
- Ball vs man is a sphere vs rotating box (rod height ROD.h, man length ROD.len): contact point sets the normal, so centre face = straight and edges/corners angle it; man velocity at the contact point (swing x lever + rod slide) adds impulse (HIT.swingBoost). Restitution/tangential keep blend from blanket (HIT.eStill/keepStill) to drill (eFast/keepFast) by man speed. Lifted men (toe above the ball) let it pass under.
- Dropped: old possession/stick-to-man, tap-to-shoot and flick pass/shot gestures (they fought the new spin). Sideways flick-pass dropped too: with real contact a sideways rod slide + touch does the same job; revisit if players miss it.
- AI: wind back then strike, picks a contact offset that threads the next opposing rod; reaction delay on tracking; idle rods (AI and human-assisted) lift when their own team shoots from behind.
- Dead zones between rods get a gentle roll toward the nearest rod (like a dished table).
- Next: tune on real phones (THUMB.full, blanket strength), maybe pin/snake-shot trick (hold ball under a tilted man), 3D TV view, sound per contact strength.

## Shared phone How to play (done: minikit/howto.js; Bubble Hockey v0.9.5, Marble Rush v0.1.2)
- HowTo.setup({game, root, ready, steps}) - each step: caption, finger start (selector / selector@fx,fy / fraction / fn), optional swipe target, act tap|drag|flick, optional wiggle, ghost sprite that follows the finger, fly-off result (pass/shot), onMove/onEnd hooks to drive the real view locally.
- Auto-plays once per game (localStorage ht-seen-<game>) after the join card is gone; ? button top-right replays; Skip button or tap anywhere skips.
- Bubble: drag a player, stick aim, flick pass, tap shot, goalie strip. Marble: steer (moves the real tilt dot, not during a race), forward/back, Calibrate, Portrait/Landscape, drag fallback.
- Next: wire into Foosball, Stunt Smash, Walker; per-game caption position (Marble's caption overlaps the 'Ready' title a little); a real local mini-sim result for Bubble instead of sprites.

## Marble Rush v0.2 (done)
- Wake lock on pad.html (Walker v0.4.1 approach: request on every tap until held, re-request on visibilitychange, muted looping wake.mp4 fallback). MRP.wake() reports state.
- Jump: tap anywhere outside buttons = hop; press-and-hold charges (ring fills green->gold->orange), launches on lift. Phone sends {t:'jc',c} while charging (12 Hz) and {t:'jump',p}. Sim: JUMP {small, big, coyote, cool, gate} - grounded (+coyote) only, cooldown, not during countdown. Pad JPAD {tapMs, fullMs, moveCancel, sendHz}. Without a tilt sensor the pad circle stays drag-to-steer (jump elsewhere); with a sensor the whole screen can jump.
- TV: half-transparent tilt-force arrow per marble along the track's steer/push axes (B*x + T*y), length ~ tilt (ARROW constants), green -> gold -> fiery orange, pulses near max; additive charge glow halo + emissive tint (GLOW). Phone: mini arrow from the tilt dot centre.
- How to play: added 'Tap anywhere for a little hop' and 'Press and hold to charge a big jump'.
- Next: jump-over shortcuts/gaps designed for jumping, landing squash, arrow only for local view option, sound.

## Dev metrics (done: minikit/perf.js, dev pages only)
- Loaded on dev-7q3x Bubble Hockey, Marble Rush, Foosball, Stunt Smash, Orbit Brawl (TV + pad). No public page loads minikit.
- Open: add ?perf=1 to the TV or pad URL, or triple-tap the top-left corner (70 px) within 0.7 s. Overlay: live 5 s bucket readout, Download log (JSON), Clear, close.
- TV: fps, frame-time p50/p95/p99 (fixed 0.25 ms histogram), max, frames > 50 ms, sim step vs render CPU time (ms/call and per frame), JS heap (Chrome), device (UA, screen, window, dpr, cores, memory, GPU via WEBGL_debug_renderer_info), phone count, per phone: RTT and jitter (TV pings every 2 s, the phone echoes), msg in/out rate, bytes/s (sampled 1 in 8 via JSON length), late (>150 ms) / out-of-order / dropped pings, % of inbound on the unordered fast channel, phone fps.
- Phone: fps and frame percentiles, RTT/jitter (reported by the TV in each ping), fps sent back in the echo.
- Log: localStorage 'mk-perf-log', rolling (~720 buckets total across sessions).
- Next: wire into other minis, GPU timer query (EXT_disjoint_timer_query) for true render cost, optional upload endpoint.

## RTS Flight Test v0.1 (done, /dev-7q3x/rts/)
- Shared deterministic terrain.js (value-noise heightmap, raised rim, height tint, prop scatter) used by TV mesh and phone minimap.
- TV: vertex-coloured terrain, transparent water, instanced low-poly trees/rocks, PCF soft shadows following the camera. Fliers = BloatFlier_polish_v02b.glb (copied as rts/flier.glb), tinted 45% toward player colour, wings flapped procedurally on wing_upper/fore/hand bones + tail sway; proxy if load fails.
- Flight (FLY constants): arrival-limited speed, accel/brake limits, heading follows velocity, bank from turn rate, flap Hz from speed + acceleration, altitude follows terrain ahead, hover bob. Camera (CAM): frames all fliers, extra zoom-out while anyone flies.
- Phone: height-tinted minimap with hill shading, your dot (pulsing) + others in colour, tap ripple + dashed course line; How to play (3 steps); perf.js on both.
- Next: unit selection/groups, obstacles/no-fly, fog of war, flier collision, pinch-zoom minimap.

## Mocap Studio v0.1 (tool, /dev-7q3x/mocap/)
- Single page: MediaPipe Tasks vision 0.10.14 from jsDelivr (Pose Landmarker full/heavy + world landmarks, Face Landmarker with blendshapes + facial matrix), GPU delegate with CPU fallback. Stations BODY / FACE+VOICE / BOTH; spoken or beep countdown, pre-roll capture, Space start/stop, Esc cancel, auto-stop; optional one-euro smoothing; take list with rename + JSON/WAV/WebM download. Audio: AudioWorklet PCM -> WAV + MediaRecorder WebM, offset measured on the take clock (seconds from ACTION).
- Format 'ztp-mocap' v1 (see README in D:\AI\Mocap). Blender importer + synthetic test live in /workspace/mocap/pkg (not in this repo).
- Todo: hands/fingers (Hand Landmarker), multi-camera fusion, in-page playback of a take, foot-contact flags.

## RTS v0.5 (done)
- Taps: tapMode default 'move' (one-shot amove from wheel Attack-move); double-tap empty = 'sweep' attack-move; double-tap selected unit = openOpt + combine tree.
- Orbs: pointerdown on orb -> G.m 'orb'; hold CFG.hold -> reopen that orb (moved to newest); move >12 px -> 'orbdrag' (o.drag drawn under finger); up = fire. orbDrop(): over .gb bubble -> g.queue (own groups only); in the orb row -> nothing; else fire with wp = drop point, ids = sel or orb's sel.
- Order-of-drop rule: GROUP->ORB = ASSIGN now (replaces orders); ORB->GROUP = QUEUE (800 ms poll, fires when >=70% of alive group units are idle; snapshot unit q[8] = idle). Gatherers count as busy.
- Lasso: closed if end-start < max(36 px, 22% of bbox diagonal). Open -> ADDM (first open replaces, then adds); closed or blank tap ends (blank tap still moves); an empty closed loop in ADDM just ends it. Group auto-save when not adding / on end.
- Style: phone rts5-style {bias, ag, rt, work, scout} -> act 'style'; TV STYLE: default bias for new + still-default units, ag scales aggro range, rt = retreat hp. work/scout stubbed.
- Todo: orbs still block map lasso/taps while pending (touch reopens newest); queue on enemy groups unsupported.

## RTS v0.4.1 (done)
- Pixel 'no markers' bug: NOT reproduced (headless Pixel 7 emulation over real PeerJS from a laptop-style host shows markers, ~1 KB snaps at ~5 Hz). Hardened likely causes: size() from visualViewport fallback + min 1px + DPR re-read on resize/orientation; V.s guard; NaN position guard; try/catch around snapshot + entity draw (error kept in DIAG.err); onMsg accepts JSON strings; pad sends {t:'need'} when no snap for 2.5 s -> TV snap(p) to that phone; TV sets p.on=true on any message (stale onClose used to stop snapshots silently); auto findMine() once if none of ours on screen. DIAG overlay: snaps/Hz/age/KB, ent counts, on-screen count, view, css/dpr/canvas, msg types, last error, FIND MY SHAPES. Ask Justin for a DIAG screenshot from the Pixel.
- Rolodex stack: ROLOS[], RO_OPEN 60 ms linear vertical open, RO_PER 70 ms, RO_HOLD 380; slots stack upward from bottom-right, y eases to slot (drop together).
- Taps: single tap deferred CFG.tap2 (280 ms, panel 220/280/360) with a faint instant ring; double-tap table in pad.html dtap(). TV: go mode 'sweep' (fan ring, sweepT 20 s aggro>=18), act 'focus' (attackset of target's team within 9 m, target first).
- Placement ghost: PLACE {kind,x,z,ra}; ra = screen angle (0 = faces down the map = TV camera); 4 big + 4 half dots on a ring rotate freely; tap dot / down-arrow button = face camera; confirm = tap ghost body or check button (both, by design); cross = cancel; several builds in a chain queue (PQ). TV: mesh rotation.y = atan2(-sin ra, -cos ra), ra sent in snapshots (q[8]) so the phone draws it rotated.

## RTS v0.4 wheel + controls (done)
- Reopen: CFG.reopenAt 'prev' (default, wheel returns at its old ox/oy; thumb becomes the pick anchor) | 'thumb'. Drop 'zip' (default, 650 ms): straight up to slot+60 px, then quadratic arc/zip into the slot, wheel body fades out over first 60% while the orb fades in; 180 ms landing bounce. RECATCH_MS 330, CFG.dbl 420, orbR 16-28 px, spacing 70 px. localStorage key now rts4-cfg.
- QCOL per top quadrant (orange/gold/cyan/violet). layers() = one per loaded leaf (its quadrant) then one per menu layer -> concentric rings around wheel, concentric fill in orbs (inner = first).
- Tree is generic (branches nest any depth). Move/Attack > Move only > Resource/Scout/Aggression > bias pairs (mv:* sets bias + next tap = move); Targets > Attack/Defend T1/T2 (TV orders attackset / guard); Build > Worker priority > Rush (TV b.rush 25 s, non-strict idle team units within 30 m drift over, heal + speed the queue) / Normal / Strict. Bias > Economy (greedy/protective) / Risk (bold/careful: retreat at 60% hp) / Posture / Upgrade.
- Nodes A/B/C bottom centre: ordered combo (15 + none), comboLayer(): first node decides (A top, B layer 2, C layer 3) -- 2/3-node combos are logged + stubbed. Layer path = last branch path used, else AI guess, padded with first branch child.
- Groups: own lasso -> G bubble (max 6, dedup); enemy-only lasso -> red E bubble; drag bubble onto TARGET box -> T1/T2 (max 2, tap chip to remove).
- Disconnect: phone heartbeat {t:'hb'} every 3 s; TV treats >7 s silence (or Kit close) as gone. dcPause -> 10 s countdown then sim paused; else AI (aiTick every 4 s: gather, train, attack-move at 8+ fighters) after dcAI s. Rejoin = control back.
- Todo: real 2/3-node combo meanings; multiple orbs only via re-catch (re-touch always reopens newest); AI is very basic.

## RTS v0.3 phone wheel (done)
- Lift without GO: orb only if something is loaded or you are inside a sub-menu (top level + empty = plain close). Snap to green circle, drop DROP_MS 500 along dropAt(): soft (ease-out cubic + arc), sharp (12% ease-in then quartic snap), plinko (straight accelerating rise to just under the slot, then curved ramp in).
- Pending orb: pointerdown anywhere (not on an orb / UI) reopens the NEWEST orb exactly centred on the thumb (no clamp, edges can go off-screen), state per CFG.reopen; stack always kept. Quick release (<220 ms, <12 px) puts the orb back untouched and arms double-tap; 2nd tap within 250 ms = actuate newest orb. Lasso / single map taps are unavailable while an orb is pending (clear by GO, or BOTTOM reset at top level then lift). Pinch still works (orb restored).
- Bottom-left round button cycles reopen mode (localStorage rts3-cfg). Left tab = test panel (wraps to 2 columns in landscape); unit speed + waves are sent to the TV ({t:'cfg'}).
- Todo: real-phone feel test of drop variants; maybe allow lasso while orb pending via 2-finger or edge-start.

## RTS v0.2 'Shapes' (done)
- index.html/pad.html = Shapes; v0.1 kept as flight.html/flightpad.html (?mode=flight redirects; flight TV QR passes mode=flight). shapes.js = shared tables (U 12 shapes, B buildings, FAC, BIAS, COST, WHEEL, SHARE rules).
- TV sim: host-authoritative, substeps of 50 ms (keeps pace on slow frames), snapshot 6-7 Hz (~3-5 KB/s per phone). Monster waves every 40 s (first at 60 s). Neutrals turn hostile when hit.
- Phone: lasso (drag), tap (smart action), double-tap options, pinch/wheel zoom, 2-finger/right-drag pan; mouse supported.
- Wheel (Justin refinements): thumb-down only; picks inside 78% radius, outer band = travel to edge dots; TOP go, BOTTOM reset (option toggles return-to-top), LEFT back (keeps stack), RIGHT AI guess (frequency + recency, localStorage rts2-pred). Lift = orb at top (glow ~ stack size), tap orb = actuate. Burst 0.33 s + top shake + rolodex bottom-right.
- Wired: bias (4), build (barracks/tower/workshop at the wheel point), train (Brick/Orb/Ring), select army, attack-move/move mode, hold/stop, upgrade, share, auto stack, order cycle. Stubs: wall, combine tree.
- Todo: real combine/evolve, better battle readability on TV (bigger beams/impact puffs), fog of war, phone faction choice, sound, multiple phones splitting the army.

## Bubble Hockey v0.9.13 (done): puck-carrier ring
- 8 inward arrows around the carrier / loose puck (RING in bubble/pad.html: longL/longW/shortL/shortW/gap/minR/k); ?edge=1 = old edge arrows.

## Bubble Hockey v0.9.12 (done): brighter blue puck arrows
- Blue team arrows #3aa8ff -> #5fd6ff, opacity x1.4 (PARR.col / PARR.opK in bubble/pad.html); red unchanged.

## Playtest invitational page v0.1 (done): /playtest-fe6ad60e/
- Edit playtest-fe6ad60e/playtest.json only: add/remove an entry in games[] (name, build_source, tv, phone, players, new[]). Build number comes from each game's build.json (bubble/build.json also feeds the in-game Feedback popup) - bump it there per release.
- RTS v0.5 left out (gesture prototype with DIAG overlay, not ready for outside testers).
- [ ] SMS feedback (config slot sms_number, empty: no number yet); what's-new diff could be auto-built from status.json notes.

## Future: playtest invitational page (original note)
- [x] Playtest invitational page: games open for playtest group, always current build, what's-new notes vs last build, one-tap feedback (mailto with build number to an inbox HotRod watches; SMS alternative).

## Bubble Hockey v0.9.11 (done): how-to panel
- Phone How to play panel (bubble/howtopanel.js): ? button + join-screen link, auto-scroll ~18 px/s (pauses 4 s on hand scroll), controls worded as coded (flick = pass, tap = shoot), Watch demo -> minikit HowTo. Feedback build bumped to v0.9.11.

## Bubble Hockey v0.9.10 (done): feedback button
- Small "Feedback" pill on TV (top-left) and phone (top-right under ?), panel shows "Bubble Hockey build v0.9.10 (2026-10-17) - please include this build number in your feedback" + COPY/Close (bubble/feedback.js; bump BUILD/DATE there each release). Phone controls hint (#tip) made brighter.
- [ ] Swipeable how-to pages (separate pending task); Mike needed pass/shoot explained.

## Bubble Hockey v0.9.9 (done): triangle puck pointers
- pad.html PARR: 8 narrow SVG triangles (2 per edge incl. bottom), tip at the anchor point, rotate to the puck centre; length * (1 + .5 * nearness), brightness 0.8-1.2 by nearness (nearness = 1 - dist / rink diagonal).
- Colour: BubbleCOL[team] of the carrier; loose keeps lastTeam at opacity * PARR.loose (.7, instant snap); '#e8e8e8' before first possession. Player ring/token colours untouched.

## Bubble Hockey v0.9.8 (done): phone puck-pointer arrows
- pad.html puckArrows(): 6 SVG chevrons inside #rot (follows the v0.9.4 orientation lock), placed PARR.gap px outside the rink bounds from V.w2s, sine drift PARR.drift px, rotate to the puck's screen point, colour BubbleCOL[carrier team] or #f2f2f2 loose, opacity PARR.op, pointer-events none.
- No netcode change: st.p and st.c were already in the updates (team = c < 6 ? 0 : 1).
- Hidden during phone zoom-ins/replays and while the faceoff puck is hidden in the slot.
- Todo: real-phone check that the side arrows don't distract; maybe fade them when the puck is near an arrow.

## Bubble Hockey v0.9.7 (done): broadcast cam, bar room, depth of field
- TV gameplay default = gentle 3/4 broadcast camera from the near side (BCAST in view3d.js: side/h/fov/follow/k). ⚙ view: broadcast / top-down (bh-view, ?view=top). Attract orbit now eases out of whichever view is on.
- Bar room proxy (TV only, buildRoom/ROOM): bar counter + shelf + bottles, 4 tables with seated patrons, standing patrons, crates past both table ends, pendant shades with glow sprites and floor pools. Room is unlit MeshBasic (cheap); the only added real light is a spot over the rink. Clear colour warm dark.
- Depth of field (DOF/DOFK): scene -> render target with depth -> 16-tap CoC disk blur. Full on replays + reel, 0.7 on slow-mo moments, off live (DOFK.live). ⚙ depth of field (bh-dof, ?dof=0). Auto-off for the session if frames stay >45 ms for 4 s. Phones never build it.
- Fixed: particle size used the ortho pixel size whenever the 3D cam was swapped in after the size update (giant pink fireworks blob in orbit/wide views).
- Todo: let Justin tune BCAST height/follow on the real TV; real bar model later; DOF focus on replay 'top' angle is mostly in-focus (by design); consider half-res DOF target if TV GPU struggles.

## Bubble Hockey v0.9.6 (done) + skater poses
- /workspace/hockey/player_skater_poses.glb: from Justin's Faceoff.blend / glide.blend, evaluated deform-bone poses (IK/constraints baked) as single-frame actions 'faceoff' and 'glide' on the v03 armature; 23 deform joints, same meshes. Working file player_skater_v03_poses.blend (deform constraints removed, actions as NLA tracks). Previews pose_faceoff.png / pose_glide.png.
- Game: bubble/player_skater.glb loaded on the TV for the 10 skaters (goalies keep the padded proxy); AnimationMixer per skater, glide weight 1 in play, blends to faceoff while st.pz > 0 (SKATER.blendIn / blendOut), back on the drop. Jersey material tinted to team colour; model stick turns white on a swing; proxy stick only appears during lunges. ?noskaters = proxy; phones keep the proxy unless ?skaters=1.
- Next: stride/skate cycle, shoot/check poses, goalie model, instancing or merged meshes if many draw calls hurt on weak TVs.

## RTS v0.5.1 (done): dragon + wading
- Dragon unit (Shapes.U[12], fly: 7) from rts/flier.glb, per-instance parse + mixer (Fly_Flap_Loop); 1 Humans + 1 Monsters dragon per match. Ground units sink in water (sinkOf in rts/index.html: .2H shallow -> .5H cap) + ripple ring.
- [ ] Dragon: trainable from a building, attack anim (Test_JawOpen), air-vs-ground rules, phone icon.
