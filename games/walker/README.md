# Walker (v0.1)
Calm first-person play world for Walker. `index.html` = TV/iPad (QR + "Play here"), `controller.html` = phone pad (`?room=CODE`, `?local=1` for same-browser tests).
- Pages/buttons/moments/settings defaults: `js/config.js`. Pad UI shared by phone and Play here: `js/ui.js` + `js/pad.css`.
- `js/world.js` builds the park, `js/tv.js` runs camera/activities/kids/buddy/weather/Hue stub, `js/sfx.js` synth sounds + speechSynthesis.
- Test harness: `/workspace/walker-tests/sim.py` (serve repo on :8765). Shots in `shots/`.
- TV debug params: `q=0-4` quality, `mute`, `weather=sun|cloud|rain|bow`, `auto=here`, `ff=N` speed, `local=1&room=TEST`.
