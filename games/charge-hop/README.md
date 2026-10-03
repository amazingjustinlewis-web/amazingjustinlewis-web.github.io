# Charge Hop — prototype v0.3

A one-button, Frogger-style race for 1–2 players on one keyboard.
Plain HTML5 Canvas + vanilla JavaScript. No install, no build: **double-click `index.html`** (Chrome, Edge or Firefox).
Also plays on **iPad / phones with touch** (see "Touch controls" below).

---

## Controls

| Key | Action |
|---|---|
| **Space** | Player 1 (orange) — the only button P1 has |
| **Enter** / **Numpad Enter** | Player 2 (cyan) |
| **M** | mute / unmute |
| **P** | pause |
| **R** | restart the round |
| **Esc** | back to the title screen |
| **`** (backquote, left of 1) | tuning panel (live sliders) |
| **← / →** or **1 / 2 / 3** (title screen) | choose the level |
| **C** (title screen) | characters: robots ↔ stickmen |

**Title screen:** press your button to join. When both have joined, the 3-2-1 starts on its own. To play alone, press your button a second time.

**Characters (title screen, C):** switch between **ROBOTS** (the default) and **STICKMEN**. The choice is remembered in this browser.
- **P1** is a chunky yellow toy robot.
- **P2** is a small bronze robot dog.
- Each has a small light in its player colour (orange / cyan).

These are procedural placeholders inspired by *Benevolence*. Any art you put in `assets/` still replaces them state by state (see "Dropping in real art").

**Sitting out / joining:** in a 2-player round, if one player never presses their button in the first **10 s** after GO, they fade out with a "P2 sat out" note. The camera then follows only the active player, so an accidental join can't keep it zoomed out. A player who isn't in the round can press their button at any time to **join the next round**; the HUD corner shows this.

**Winning:** the **first player to land on the GOAL** wins, and the round ends right away. Then comes a ~5 s **fireworks show**: rockets whistle up and burst across the screen, mostly in the winner's colour. After that, the **same level restarts automatically with the same players** ("next round in 3…"). **R** skips the wait; **Esc** goes back to the title.

**Level select (title screen):** **← / →** or the number keys **1** / **2** / **3** choose the level card before you start.
- **1 · Rush Hour Creek**: the original v1 level, 13 rows, unchanged.
- **2 · The Long Way**: the v2 long level, 91 rows, with the **v2 domino rules** (standing dominoes block). Unchanged.
- **3 · The Lava Run**: the v3 long level, 131 rows, with lava chutes, fast open straights and the **v3 domino rules**. This is the **default** now.

Esc during a round returns to the title, where you can switch.

### Touch controls (iPad / phone, v3.1)
Touch drives the **same input path as the keys**: every finger is tracked on its own (by pointer id) and counts as one more "key" held on that player's button. Tap, hold, charge, overload and streak timing are therefore identical to Space / Enter.
- **One player:** tap or hold **anywhere** on the screen. It works exactly like Space.
- **Two players:** the **LEFT half is P1** (Space) and the **RIGHT half is P2** (Enter).
  - Both kids can press at once (true multi-touch).
  - A faint dashed split line and "◀ P1 / P2 ▶" labels appear while 2 players are in the round.
- **Title screen:**
  - Tap your side to join. Tap again to start solo; when both have joined it starts by itself.
  - Tap **◀ / ▶** next to the level name to change level.
  - Tap the "characters" line to switch robots / stickmen.
- **⏸ button** (top centre, during a round): pause menu with **Resume**, **Restart round** (= R), **Title / level select** (= Esc) and **Sound on/off** (= M). Rounds still auto-restart after a win.
- **⛶ button:** fullscreen, shown only where the browser supports it. iPhone Safari doesn't, so it's hidden there. On iPhone, "Add to Home Screen" gives a full-screen icon.
- **What's blocked on the game:** scrolling, pinch / double-tap zoom, text selection, the long-press callout and the context menu.
- **Sound:** it unlocks on the first touch. If an iPhone/iPad has its **silent switch** on, Web Audio stays quiet.
- **Screen fit:** the game fills the screen in landscape and portrait. In portrait the whole track width stays visible and you just see more rows. On small phone screens the HUD shrinks.
- **Desktop is unchanged:** the mouse does nothing, the keyboard works as before, and the touch hints only show on touch devices.

### The one button
- **Tap** (let go in under 0.15 s): hop forward 1 row.
- **Hold**: crouch, shake, glow and throw off fire while the meter fills.
  - After **0.35 s** you get charge level 1, a **2-row jump**.
  - **Level 2, a 3-row jump** (after 0.75 s), only works while you have the **glowing orb** power-up: 10 s or 3 triple jumps, whichever runs out first. The orb is on the middle grass strip and comes back 8 s after someone takes it.
  - The chevrons above the meter show how many rows you'd jump if you let go right now.
- **Overload:** keep holding for 0.6 s past full charge and the shaking gets violent, then it bursts. You get flung exactly 1 row (with a little random sideways kick), land wherever that is, and see stars for 0.5 s, during which input is ignored.
- **Tap rhythm streak:** tap again within 0.3 s of landing and the streak grows. Each step makes hops quicker and flatter (down to 55 % of normal air time). You'll see afterimages, the character bouncing on its toes, and "x3"-style pop-ups. Charging, overloading, dying, or standing still breaks the streak.
- You're safe from traffic while airborne. What happens is decided when you land.
- Sideways momentum: on a log you move at the log's speed. When you jump off, you keep that sideways speed in the air and carry it into the landing, where it fades out at the speed set by that surface's **friction** (see below).

### Hazards
- **Roads:** a vehicle touching a grounded player means SPLAT.
- **River:** water drowns you unless you land on a log. Logs in the same lane drift at *different* speeds and **bump each other** (1D collisions, mass = length, with bounce), so landing spots move around. If your centre gets too close to a log edge (on landing, or because a bump slid you there), you **teeter** for 0.45 s and then fall in, unless you jump away first. Getting carried off the side of the screen also kills you.
- When you die: a death animation, a short pause, then you respawn on the last grass row you stood on. Deaths are counted on the HUD.
- **Water is a funny moment, not a failure** (v2). A big cartoon **SPLASH!**, then the character sinks below the surface, **rusting** as it goes (colour shifts to rusty brown with patches, plus bubbles). It flails back up, pops out, shakes off the water and hops back to its last safe spot. The whole dunk takes about 1.5 s, has no slow-mo, and the rust wears off over about a second.
- **Hit by a vehicle (robot style):** KA-CLANK! The robot comes apart into head, limbs, gears and bolts that clatter across the road, then snaps back together when it respawns. In stickman style it's the original splat.
- First player to land on the **GOAL** row wins. R gives a rematch.

### Lava chutes & open straights (v3, level 3)
**Lava chutes** are the transitions between sections. Each is a lava flow several rows long (6–9 rows in level 3); one sits between every Frogger-style section and the open straight after it, and another between each straight and the next Frogger section.
- **Rock chunks** float on the lava in rows. Each row sways side to side as a unit, alternating direction like the logs, while the whole flow carries everything **forward** (up the screen).
- **The flow speeds up along the chute** and the chunks **spread apart**: rows drift further apart, each row gets wider, and the chunks melt a little smaller. Near the entrance you can hop from chunk to chunk; by the end the gaps are too wide.
- **Riding a chunk carries you forward.** You can stand still and ride it all the way.
- **Falling in = the lava gag:** **SIZZLE!** The robot sinks a little, heats up **red-hot** (glowing orange, smoke and embers), then hops out smoking and lands back at the last checkpoint. It takes about 1.1 s and has no slow-mo; the glow cools off over about a second.
- **The end of the chute (the lip)** is marked by a dashed yellow line and chevrons, and "TAP TO LAUNCH!" pops up as you reach it. You have two options:
  - **Tap in the lip:** a **BIG LAUNCH**. You jump off when you choose (the chunks are still drifting, so the timing sets where you line up), land one row further, and start the straight faster.
  - **Do nothing:** that's fine. At the very end the chute **launches you on its own** onto the ledge, or straight into the open straight at high speed.

**Open straights** are long open plains (16–18 rows) with dominoes and boulders.
- **You run on your own.** Land in a straight and you're already moving forward fast; from a chute launch, you're moving very fast. You keep running, stride by stride, until the checkpoint at the end, where you stop.
- **Speed** settles toward a cruising speed: it drops quickly from a launch and creeps back up if you were slowed. A small speed bar sits under your feet.
- **TAP = long jump:** 3 rows, fast and high, and every tap **adds speed**. Use it to clear fallen dominoes and boulders, or just to go faster.
- **Nothing stops you or kills you in a straight:**
  - **Standing dominoes never block or bounce you.** Running past, through or over one makes it fall (away from you) and sets off its chain. The chain-reaction visuals, clicks and **CHAIN!** slow-mo are the same as in v2.
  - **Fallen dominoes and boulders** only **slow you down** ("slow!") when you land on them. Tap to build your speed back up.
- **Steering is the same as before:** forward only. You're lined up by where you came in, plus whatever sideways momentum you carried (it fades while you run).
- A straight is 13 columns wide like every row (the world width is fixed). v3 made the open areas **longer**, not wider.

### Open plains & dominoes (v2 rules, level 2)
These rules apply to plains **without** `run: true`, which means level 2. Level 3's straights use the v3 rules above. Plains are big open sand-coloured areas, several rows tall, with patterns of standing dominoes (lines, S-curves, waves, spirals, zigzags, grids with gaps).
- **Standing dominoes block you.** If you land on one or slide into it, it tips over (away from you) and you bounce back a row or get pushed back sideways, with a short gentle stun. You can go through the **gaps** between standing dominoes.
- **Chain reactions:** a falling domino knocks over the next one in front of it, so whole patterns topple in a timed wave. Each tile visibly falls flat and gets longer in the direction it falls, with a click and a puff of dust. A big chain (8+) going off near a player triggers a **CHAIN!** slow-mo, using the normal slow-mo cooldown. Getting caught under a falling tile stuns you briefly.
- **Fallen dominoes are low walls.** A *running* streak hop into a fallen row bonks: you stop and glance sideways, so you can't get stuck. To get over, break the rhythm:
  - a **deliberate tap** (not mid-streak) vaults one fallen row and lands just beyond it;
  - a **charged jump** clears 2–3 rows as usual, and if it would come down on fallen dominoes it carries on up to 2 more rows to the first clear spot.
  - a bonk glances you sideways toward the nearest open column. You can slide past fallen tiles in your own row while it does, so a pocket of fallen dominoes can never trap you.

  Chains you set off can close paths for the player behind you.
- **Running on the land:** tap-streaking on open ground shows a pitter-patter run, with alternating legs, pumping arms, afterimages, speed lines from x3, and footfall dust. Steering is still only through sideways momentum and how you line up.

### Checkpoints & the long level
- **Checkpoint rows** are grass rows with flags. Reaching one announces "CHECKPOINT", and from then on you respawn there. Ordinary grass rows also still count as respawn points. Plains are not respawn rows.
- **Players far apart (2P):** the camera zooms out to frame both. If even the 2-player zoom-out cap (0.75) can't fit both, it frames the **leader**, and the trailing player gets an **arrow** at the bottom edge showing how many rows behind they are. After **3 s** off-screen (while not mid-jump), they're **pulled up** to the leader's last safe row (checkpoint or grass) with a whoosh. That's the rubber band. Any lead the leader has beyond that row is still theirs.

### Camera & drama
- The camera frames everyone who has joined. It zooms out as players spread apart and in as they come together, between min/max zoom limits, and never zooms in so far that the road gets cut off at the sides.
- **Slow motion** fires on close calls: taking off with a car almost touching you, landing just next to one, landing right on a log edge, an overload, a death (not water dunks, which stay quick and silly), or a win. Time drops to 0.3×, the camera pushes in on that player for about 0.8 s with letterbox bars, then eases back. It's rate-limited to once every 2.5 s, or 0.9 s for deaths, overloads and wins. Deaths and overloads also shake the screen.

---

## File structure

```
index.html            loads everything (classic <script> tags, in order; works from file://)
js/config.js          ALL tuning numbers, commented  <- start here to change feel
assets/art.js         list of art files present (auto-generated by update-art-list.bat)
js/input.js           one button per player + hotkeys (key mapping at the top) + touch/pointer layer (Input.attachTouch)
js/touch.js           v3.1 touch: routes fingers to P1/P2 (via Game.touchRoute), pause menu + fullscreen buttons
js/sprites.js         ART-SWAP manifest + loader + Sprites.draw (falls back to placeholders)
js/audio.js           WebAudio-synthesised sound effects (Sfx.play('hop') ...)
js/effects.js         particles (fire, splash, splat, confetti...), floating text
js/camera.js          Camera (framing / zoom / shake) + Drama (slow-motion moments)
js/entities.js        entity types (car, truck, log, powerup) + their placeholder drawings
js/lanes.js           lane types (start, grass, checkpoint, road, river, goal) + level builder (rows: N expansion)
js/dominoes.js        OPEN PLAINS: 'plain' lane type, domino patterns, toppling/chain physics, boulders, domino placeholder art
js/chutes.js          v3 LAVA CHUTES: 'chute' lane type (flow, rock chunks, lip & launch), chunk/boulder placeholder art
levels/level1.js      Level 1 "Rush Hour Creek" (v1, 13 rows)
levels/level2.js      Level 2 "The Long Way" (v2, 91 rows) - includes the domino pattern definitions
levels/level3.js      Level 3 "The Lava Run" (v3, 131 rows, default) - chutes + open straights
js/player.js          the character: charge / jump / land / die logic (water dunk, lava gag, splat), v3 auto-run + chute launch, stickman placeholder
js/characters.js      v2 robot proxies (P1 toy robot, P2 robot dog), splat debris, rust tint, battery power-up, C toggle
js/fireworks.js       v2 win celebration (screen-space rockets/bursts + WebAudio whistles & pops)
js/debug.js           the ` tuning panel
js/main.js            game states, fixed-timestep loop, rendering, HUD, title/win screens
assets/               drop art here
assets/examples/      two example sprite strips (copy them into assets/ to try the art swap)
```

Load order matters (it's in `index.html`): config → art list → input → sprites → audio → effects → fireworks → camera → entities → lanes → dominoes → chutes → levels → player → characters → debug → main → touch.

---

## Dropping in real art

1. Save a PNG into `assets/` using one of the filenames below.
2. Double-click **`assets/update-art-list.bat`**. It rewrites `assets/art.js` to list every PNG in the folder. You can also edit `art.js` by hand.
3. Refresh the browser. Anything that's missing keeps its placeholder, so you can bring art in one file at a time.

*(If you'd rather not run the .bat, set `ART_PROBE_ALL = true` in `assets/art.js`. The game will then try every filename in the manifest. The only downside is a list of harmless "file not found" lines in the browser's dev console.)*

**Sprite strip format:** one PNG per animation, frames laid out left to right in a **single horizontal row**, every frame the same width (`image width = frame width × frames`), transparent background. Any pixel size works; the drawn size is set in world pixels (1 row = 48 px).

| Sprite key | State | Filename | Default frames / fps | Notes |
|---|---|---|---|---|
| player | idle | `player_idle.png` | 4 / 6 | loops |
| player | charge | `player_charge.png` | 4 / 14 | loops while holding |
| player | jump | `player_jump.png` | 4 / 10 | plays once per jump |
| player | fling | `player_fling.png` | 4 / 12 | overload tumble (falls back to jump art); the code also spins it |
| player | land | `player_land.png` | 3 / 20 | once (~0.14 s squash) |
| player | dizzy | `player_dizzy.png` | 6 / 10 | after an overload |
| player | teeter | `player_teeter.png` | 4 / 14 | wobbling on a log edge |
| player | fall | `player_fall.png` | 6 / 10 | once; falling/sinking into water |
| player | splat | `player_splat.png` | 4 / 16 | once; hit by a vehicle |
| player | win | `player_win.png` | 4 / 8 | celebrating |
| car | drive | `car.png` | 2 / 10 | drawn **facing right**, auto-mirrored when driving left |
| truck | drive | `truck.png` | 2 / 10 | facing right |
| log | float | `log.png` | 1 | stretched to each log's length (2–4 tiles); consider 9-slice later |
| powerup | idle | `powerup.png` | 6 / 10 | drawn 30×30 world px |
| tile_grass / tile_road / tile_water / tile_goal | idle | `tile_grass.png` … | 1 (water 4 / 4) | repeated once per 48×48 tile across the row |
| player | run | `player_run.png` | 4 / 16 | **v2** tap-streak pitter-patter run (falls back to jump art) |
| player | swim | `player_swim.png` | 4 / 12 | **v2** flailing back up after falling in the water (falls back to fall art). The sinking part uses `fall`, popping out uses `jump`. Under water the game tints your art blue; when rusty it adds a sepia/brown filter |
| domino | standing | `domino_standing.png` | 1 | **v2** top-down view of the standing tile (its footprint, drawn 22×11 world px) |
| domino | falling | `domino_falling.png` | 6 | **v2** frames are chosen by **fall progress**, not fps: frame 1 upright, last frame flat. Drawn 22 px wide, and the height grows from 11 to 45 px as it falls |
| domino | fallen | `domino_fallen.png` | 1 | **v2** lying flat, drawn 22×45 world px |
| flag | idle | `flag.png` | 4 / 8 | **v2** checkpoint flags (anchor at the pole's foot, 40 px tall) |
| tile_plain | idle | `tile_plain.png` | 1 | **v2** ground tile for open plains (also the v3 straights) |
| player | burn | `player_burn.png` | 4 / 12 | **v3** fell in lava (falls back to fall art). The hop out uses `jump`. The game also tints your art red-hot (sepia/saturate filter) and adds an orange glow |
| tile_lava | idle | `tile_lava.png` | 4 / 6 | **v3** lava surface, repeated once per 48×48 tile across each chute row. Without it you get the procedural lava with flow streaks |
| chunk | idle | `chunk.png` | 1 | **v3** floating rock chunk, top-down. Stretched to each chunk's size: about 62–86 × 30 world px at the entrance, shrinking toward the lip. Centre anchor |
| boulder | idle | `boulder.png` | 1 | **v3** boulder on the open straights (it slows you). Drawn about 33–40 × 27–32 px, anchored near its base |

**Domino art orientation:** draw every domino state **falling toward the TOP of the image**. The bottom of the image is the hinge, the edge it tips over. The anchor is bottom-centre, which is where the domino stands. The game rotates the art to each domino's real fall direction. Pips and bevel are up to you; the placeholder is a dark tile with white pips. Placeholder code: `Sprites.registerPlaceholder('domino', ...)` in `js/dominoes.js`.

**Where to set frame counts, fps and anchors:** `SPRITE_MANIFEST` near the top of `js/sprites.js`. Each entry looks like this:

```js
idle: { file: 'player_idle.png', frames: 4, fps: 6, loop: true, anchorX: 0.5, anchorY: 1.0, h: 56 }
```
- `frames`: how many frames are in the strip. `fps`: playback speed. `loop: false` holds on the last frame.
- `anchorX` / `anchorY`: the pivot inside the frame, as 0–1. For players this is **the feet** (0.5, 1.0). For vehicles, logs and pickups it's the **centre** (0.5, 0.5). The `defaults` block on each key fills in anything you leave out.
- `w` / `h`: drawn size in world px. Give only `h` and the width follows the frame's aspect ratio (players default to `h: 56`, a little more than one row). Give neither and the art stretches to the object's own size (vehicles and logs do this).
- `fallback: 'jump'` means "use the jump art if this file is missing".
- **Separate art per player:** add `idle: { file: 'p1_idle.png', frames: 4, fps: 6 }` (and so on) under the `p1` or `p2` key. Those are checked before the shared `player` art.
- The code still applies squash and stretch, the jump arc, apex scale-up, spin, shake and blinking on top of your frames. To animate any of that by hand instead, turn the matching number down in `config.js` (for example `jump.takeoffStretch`, `jump.landSquash`, `jump.apexScale`).

**Your art vs. the robot proxies:** the robots, the dog and the stickman are only *placeholders*. As soon as `player_idle.png` (or `p1_idle.png` / `p2_idle.png`) is present, that state uses your art for whichever character it applies to; states without art keep the placeholder. So you can bring in your stickman frames one state at a time. Robot style also draws the power-up as a glowing blue battery. With `powerup.png` present, your art is used.

**Try it now:** copy `assets/examples/player_idle.png` and `assets/examples/powerup.png` into `assets/`, run the .bat, and refresh. P1/P2 standing turns into a purple blob and the orb becomes a spinning coin.

Placeholders live in `Sprites.registerPlaceholder(...)` calls: the stickman is at the bottom of `player.js`, vehicles/logs/orb are in `entities.js`. They show what each state should read as.

---

## Adding a new lane / hazard type

1. **Entity** (if it needs a new object): add an entry to `ENTITY_TYPES` in `js/entities.js`:
   ```js
   croc: { kind: 'platform', sprite: 'croc', state: 'swim', len: 2.5, height: 0.6 },
   ```
   Add `croc: { swim: { file: 'croc.png', frames: 4, fps: 8 } }` to the manifest and register a placeholder with `Sprites.registerPlaceholder('croc', (ctx, state, t, o) => { ... })`.
2. **Lane type:** in `js/lanes.js`, call `registerLaneType('swamp', { ... })`. Copy `road` (a hazard that kills) or `river` (rideable platforms over a deadly floor) as a starting point. The hooks are:
   - `init(lane, def)`: create the lane's entities from the level data
   - `update(lane, dt, game)`: move them
   - `drawBg(ctx, lane, view, game)`, `drawEntities(ctx, lane, game)`
   - `land(lane, player, game)`: runs when a player lands; returns `{ok:true}`, `{ok:true, ride: entity}` or `{die:'splat'|'drown'|'fall'|'carried'}`
   - `grounded(lane, player, dt, game)`: runs every step while a player stands there; returns `null` or `{die: ...}`
   - `takeoff(lane, player, game)`: good for close-call checks (`game.closeCall(player, 'whoosh!')`)
   - `planJump(lane, player, rows, game, running)` *(v2)*: optional. Called on the destination lane before a jump. It can shorten, lengthen, or cancel ("bonk") the jump; the plain uses it for fallen dominoes.
   - flags: `safe`, `respawn` (checkpoint), `goal`, and `friction`
3. **Use it in a level:** `{ type: 'swamp', dir: 1, speed: 60, ... }` in a level file. Any extra fields you put there arrive in `init` as `def`.
4. **New level:** copy a level file to `levels/level3.js`, give it a new `id` and `name`, and add a `<script>` tag for it in `index.html` after the others. It shows up as a card in the title-screen level select automatically. Put `default: true` on the level that should be pre-selected.

### Level file extras (v2)
```js
{ type: 'grass', rows: 4, items: [{ type: 'powerup', col: 6, row: 2 }] },   // rows: N = N identical rows; items pick a row (0 = bottom)
{ type: 'checkpoint' },                                                      // grass + flags, announces itself
{ type: 'plain', rows: 8, name: 'Domino Meadow',                             // open plain, several rows tall
  dominoes: [
    { pattern: 'line',   from: [0.6, 1], to: [12.4, 1], gaps: [9, 10, 11] },  // gaps = skip those dominoes (a door)
    { pattern: 'wave',   from: [0.6, 5.6], to: [12.4, 5.6], amp: 0.7, waves: 1 },
    { pattern: 'path',   points: [[1, 1], [4, 3], [1, 5]], smooth: true },    // S-shapes / curves
    { pattern: 'arc',    center: [6.5, 4], radius: 3, from: 0, to: 180 },
    { pattern: 'spiral', center: [6.5, 5], r0: 0.9, r1: 3.9, turns: 2.1, start: 90 },
    { pattern: 'zigzag', from: [0.7, 0.6], to: [0.7, 9.4], amp: 0.35, teeth: 5 },
    { pattern: 'grid',   from: [1.5, 3], cols: 6, rows: 3, dx: 2, dy: 0.6, axis: 'v', gaps: [[2, 1], [4, 2]] }
  ] },
```
Domino coordinates are **plain-relative `[col, row]`** in tiles, and fractions are fine. Columns go 0–13 left to right, and row 0 is the plain's bottom row. Dominoes are spaced along each shape every `CONFIG.domino.spacing` px; you can override that per pattern with `spacing`. They only chain if the spacing is less than their fallen length (38 px). For grids, `axis` sets which way the tiles face: `'h'` for rows, `'v'` for columns, `'d'` for diagonal.

### Level file extras (v3)
```js
{ type: 'chute', rows: 7, name: 'Lava Chute' },               // a lava chute, 7 rows long
{ type: 'chute', rows: 9, name: 'The Big Flow', v1: 250, side1: 70 },   // per-chute overrides: v0, v1, accel, chunks, waveGap, side0, side1, sway, spread
{ type: 'plain', run: true, rows: 16, name: 'Domino Dash',    // OPEN STRAIGHT (v3 rules: auto-run, dominoes never block)
  boulders: [[3, 6], [10, 6]],                                 // plain-relative [col, row]
  dominoes: [ { pattern: 'line', from: [0.6, 3.6], to: [12.4, 3.6] } ] },
```
- A chute launches you onto its **ledge** (the row after it), or, if that row starts an open straight, **into the straight** at speed.
- **Switching the domino rules:** a plain is a v3 straight only if it has `run: true`. Remove that flag and the same plain plays by the v2 rules. Add it to a level 2 plain and that plain plays by the v3 rules.

### Surface friction (ice, slides…)
Every lane has a **`friction`** value (1/s): how quickly your sideways velocity fades toward the surface's own speed (0 for ground, the log's speed for logs). The defaults are in `CONFIG.friction` (grass 6, road 7, logs 4). Any lane in a level can override it:
```js
{ type: 'grass', friction: 0.4 }     // an ice strip: land with momentum and keep sliding
```
Sliding is clamped at the playfield edges. A future "slide" or conveyor lane only needs a surface velocity, the same way logs supply one.

---

## Tuning the feel

All the numbers are in **`js/config.js`**, grouped and commented. For tuning together, press **`** in-game: the sliders change values live (charge times, overload grace, air time, arc, landing squash, streak, frictions, log bounce, teeter grace, slow-mo, zoom limits, global time). There are also checkboxes for slow-mo and for drawing hitboxes. **Dump values** prints the current numbers so you can paste them back into `config.js`.

Current key values:

| What | Value |
|---|---|
| tap threshold | 0.15 s |
| charge level 1 (2 rows) / level 2 (3 rows, power-up only) | 0.35 s / 0.75 s |
| overload grace past full charge | 0.6 s → fling 1 row, dizzy 0.5 s |
| air time | 0.10 s + 0.12 s per row (1 row 0.22 s, 2 rows 0.34 s, 3 rows 0.46 s) |
| arc height | 12 px + 11 px per row |
| input buffer (tap just before landing) | 0.12 s |
| tap streak | window 0.3 s, −9 % air time per step, floor 55 %, cap 6 |
| power-up | 10 s or 3 triple jumps; respawns after 8 s |
| log edge teeter | centre within 8 px of the edge → 0.45 s grace; landing tolerance 6 px past the edge |
| log physics | restitution 0.7, speed jitter 35 % of lane mean, drift time 4 s, current pull 0.6 /s |
| friction | grass 6, road 7, logs (rider grip) 4, landing slide on logs 35 % |
| slow-mo | 0.3× for 0.8 s real (0.08 s in, 0.35 s out), cooldown 2.5 s (0.9 s for deaths, overloads, wins), push-in zoom ×1.45 |
| camera | 9 rows visible at zoom 1, zoom range 0.62–1.25, fits full width |
| simulation | fixed 1/120 s steps × global timeScale |
| **v2** dominoes (`CONFIG.domino`) | 22 × 7 px footprint, 38 px long when fallen, spacing 28 px, fall 0.30 s, knocks the next at 62 % of its fall, cone ±62° |
| **v2** domino bumps | stun 0.3 s (0.35 s if one lands on you), slide knockback 50 %, bonk glance toward the nearest open column, 130–480 px/s (0.6 s pass-through) |
| **v2** vaulting fallen dominoes | tap: 1 extra row; charged jump: up to 2 extra rows (`chargeVault`) |
| **v2** CHAIN! slow-mo | chain ≥ 8 within 3.5 tiles of a player (normal slow-mo cooldown) |
| **v2** catch-up (`CONFIG.catchup`) | 3 s off-screen behind the leader (when min zoom can't fit both) → pulled to the leader's last safe row |
| **v2** friction | checkpoint 6, plain 6 |
| **v2** 2P zoom-out cap (`camera.twoPlayerMinZoom`) | 0.75. Players spread further than that: the leader stays framed and the trailing player gets an edge arrow. Set it to 0.62 for the old v1 behaviour |
| **v2** water dunk (`CONFIG.waterDeath`) | sink 0.6 s + swim up 0.4 s + pop out 0.5 s (≈ 1.5 s), rust fades over 1.2 s, no slow-mo (`slowmo: true` to re-enable) |
| **v2** win celebration (`CONFIG.celebrate`) | 5 s of fireworks, ~3 rockets/s plus a 7-rocket finale, 55 % of shells in the winner's colour, then auto-restart (`autoRestart: false` to wait for R) |
| **v2** sit-out (`CONFIG.idleDrop`) | 10 s after GO without a single press (2P only) |
| **v2** characters (`CONFIG.characters`) | style `'robots'` or `'stickman'`, robot reassembly 0.4 s |
| **v3** open straights (`CONFIG.run`, rows/s) | entry speed 5, after a chute launch 7.5 (+1.5 for a BIG LAUNCH), cruise 3.5 (excess decays 60 %/s, recovers 0.25/s), range 1.6–9, tap +1.2 |
| **v3** long jump | 3 rows, airtime rows ÷ (speed × 1.1) clamped to 0.3–0.55 s, arc 28 px (running strides: 1 row, arc 7 px, airtime 1/speed) |
| **v3** slow-downs | landing on a fallen domino or boulder: speed × 0.55. Sideways momentum fades at 2 /s while running |
| **v3** dominoes on straights | a standing domino within 26 px of you (`domino.brushRadius`) tips over, away from you. No block, bounce or stun |
| **v3** lava chutes (`CONFIG.chute`) | flow 55 → 210 px/s along the chute (curve `accel` 2: lazy start, rush at the end), a row of 3 chunks every 40 px at the entrance, chunks 62–86 × 30 px shrinking 40 %, sway ±70 px at 22 → 82 px/s, rows widen 60 %, chunks pushed up to 18 px off the banks along the way (`bankGap`; at the entrance they reach the banks, so you can always board) |
| **v3** chute landing / lip | landing tolerance 6 px past a chunk's edge, 16 px ahead/behind. The lip is the last 22 % (`lipStart` 0.78). The auto launch lands 2 rows into the straight, a BIG LAUNCH 1 row further. Launch 0.5 s airtime, 36 px arc, keeps 50 % of the chunk's sideways speed (`launchCarry`) |
| **v3** lava gag (`CONFIG.lavaDeath`) | scorch 0.5 s + smoking hop 0.6 s (≈ 1.1 s), glow cools over 1.4 s, no slow-mo (`slowmo: true` to re-enable) |
| **v3** friction | chute (grip on a chunk) 4 |

v2 and v3 did **not** change any v1 timing (jump, charge, overload, streak) or any existing camera or slow-mo value. Everything new lives in new config keys or groups. The 2P zoom-out cap is a new key: `minZoom` itself is still 0.62.

---

## Next up / known rough spots
- **Momentum polish:** carried sideways speed is fully modelled (logs → air → landing slide with friction), but grass/road friction is high on purpose, so the free-runner feel shows up mostly around the river. An ice lane (`friction: 0.4`) is a one-line test.
- Logs draw as one stretched image; long logs will want a 9-slice or end-cap/middle-tile setup once there's real art.
- Players don't collide with each other yet (by design for now).
- **v2 dominoes:** the art is a procedural placeholder (3D box with pips). Players always draw on top of dominoes, so a fallen domino lying "in front of" a player still draws under them. Dominoes that sit half on a row only block if your feet actually overlap them.
- The bonk's sideways glance is deliberate. Without it, you could get stuck behind a long fallen wall while running.
- Catch-up is a simple rubber band to the leader's last safe row. If that feels too generous or too harsh, change `CONFIG.catchup.delay`, or set `enabled: false` (the trailing player then just stays off-screen with the arrow).
- **v3 straights are only 13 columns wide**, like the rest of the world. The world width is fixed, so "wider" open areas would mean changing the camera and every lane; v3 made them longer instead.
- **v3 auto-run is deliberately simple.** It runs straight up the column you came in on, with fading sideways momentum and no steering. Strides are 1-row hops, so very high speeds read as a fast patter more than a sprint.
- **v3 chunk hopping** only really works in the first half of a chute (that's the design: the gaps grow). Riding one chunk to the end always works. A chunk is never carried off-screen: rows sway within ±70 px of the centre, and chunks pinned against a bank stay there.
- **v3 domino slow-downs:** running *through* a standing line knocks it down ahead of you, so you often land on the dominoes you just toppled and get slowed. That's intended (tap to jump the line instead), but tune `run.slowMul` or `domino.brushRadius` if it feels too sticky.
- Respawns after a lava death go to the last checkpoint before that chute (the ledge before it). There's no checkpoint inside a straight.
- No fireball state yet.
- No progression between levels yet: pick one on the title screen.
- **Robot proxies are procedural placeholders.** They're meant to read well at game size, not to be final art. The dog is drawn side-on facing right, even while hopping "up" the screen.
- The fireworks and robot parts are drawn on top of the world with no art keys of their own. If you want them as art later, they can get manifest entries like everything else.
- Sounds are synthesised placeholders. Swap the functions in `SOUNDS` in `js/audio.js` for real samples later.
- Untested on gamepads and touch; the plan was keyboard only for now.
