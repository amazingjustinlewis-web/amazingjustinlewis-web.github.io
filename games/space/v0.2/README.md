# Drift Signal (v0.1)
Chill 3D space sim. `index.html` = the TV bridge, `controller.html` = crew phones (PeerJS room code + QR, `?local=1` for same-browser tests).
- Rename: `TITLE` in `js/config.js`.
- Tuning, sector catalogue, events (data-driven list), alien encounters, distress outcomes: `js/config.js`.
- `js/world.js` builds the 3D scene, `js/tv.js` runs the ship/AI pilot/events/crew, `js/sfx.js` is WebAudio + speechSynthesis voice.
- Sim harness: `/workspace/space/tests/sim.py` (scripted phones), shots in `/workspace/space/shots/`.
- Debug URL params on the TV: `?q=0-4` quality rung, `fps`, `mute`, `danger=off`, `voice=off`, `glass` (alien comes to the glass fast).
