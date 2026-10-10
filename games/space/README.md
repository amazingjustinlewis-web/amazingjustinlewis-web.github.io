# Drift Signal (v0.3)
Chill 3D space sim. `index.html` = the TV bridge, `controller.html` = crew phones (PeerJS room code + QR, `?local=1` for same-browser tests). Older builds: `v0.1/`, `v0.2/` (each on its own PeerJS channel).
- Rename: `TITLE` in `js/config.js`.
- Tuning, sector catalogue, events, encounters, cargo items, traders (greed / likes / hates / counter), weapons, dune timings: `js/config.js`.
- `js/world.js` builds the 3D scene, `js/tv.js` runs the ship/AI pilot/events/crew, `js/sfx.js` is WebAudio + speechSynthesis voice.
- `js/v03.js` (TV) plugs into tv.js via `window.SPACE_X` hooks: target lock + phasers/torpedoes/tractor, trading + wireframe beaming, the asteroid cave, the Sere Khamsin sandworm desert + end screen. `js/v03-phone.js` is the phone side (targeting list, drag-to-trade sheet, escape card, restart).
- Sim harness: `/workspace/space/tests/sim.py` (`python3 sim.py v03only` runs just the v0.3 checks), shots in `/workspace/space/shots/`.
- Debug URL params on the TV: `?q=0-4` quality rung, `fps`, `mute`, `danger=off`, `voice=off`, `glass`, `liftok` (emergency lift-off always works).
