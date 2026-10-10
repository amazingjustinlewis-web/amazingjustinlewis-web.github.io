# Walker (v0.2)
Calm first-person play world for Walker. `index.html` = TV/iPad (QR + "Play here"), `controller.html` = phone pad (`?room=CODE`, `?local=1` for same-browser tests). v0.1 is archived in `v0.1/` (own PeerJS prefix `ztp-walker-v01-`; v0.2 uses `ztp-walker-v02-`).
- Pages/buttons/moments/settings defaults: `js/config.js`. Home page = six categories (Bouncy, Playground, Petting zoo, Water park, Rides, Quiet), each opens six activities. Pad UI shared by phone and Play here: `js/ui.js` + `js/pad.css`.
- `js/world.js` builds the park; `js/world2.js` adds the wooden coaster (NW), petting zoo (NE), water park (SW), bumper boat lagoon (SE) and their idle life. `js/tv.js` runs camera/activities/kids/buddy/weather/Hue stub, `js/sfx.js` synth sounds + speechSynthesis.
- Tap-to-run: travel speed follows tap rate (walk 1.8 m/s, up to ~9), eases back to a stroll. Car toggle: Rides page or settings (6 m/s base).
- Test harness: `/workspace/walker-tests/sim.py` (serve repo on :8765). Shots in `shots/` (`v02-*` for this version).
- TV debug params: `q=0-4` quality, `mute`, `weather=sun|cloud|rain|bow`, `auto=here`, `ff=N` speed, `local=1&room=TEST`.
