# Iron Stride (working title) - v0.1 "First steps"

TV + phones mech prototype. `index.html` = TV (three.js cockpit view), `controller.html` = phone (portrait).

- Networking/lobby: same PeerJS room-code + QR pattern as Laser Range / Red Deer Rich (`js/net.js`, peer prefix `ztp-ironstride-v01-`). `?local=1&room=ABCD` on both pages = BroadcastChannel test mode.
- Aiming: phone `deviceorientation` -> pointing vector (`js/aim.js` from Laser Range) -> yaw/pitch. 3-tap calibration (centre, left edge, right edge) on the phone. Crosshair past 55% of the half-screen turns the torso.
- Hidden aim assist (`assist()` in `js/tv.js`, numbers in `js/config.js`): RMS crosshair speed over 450 ms -> steadiness. Steady = small cone and strong pull; shaky = wide cone, soft pull and a bit of scatter. Locks are sticky for 350 ms.
- Map: finger stroke -> RDP simplify -> Catmull-Rom as cubic Beziers -> points every 3 m -> the TV follows them with a lookahead.
- Seats: pilot (seat 0) and an optional gunner (seat 1, own crosshair + autocannon).
- Mouse + keys: "Play here with mouse + keys" on the TV lobby, or `?kb`.
- Quality: rungs in `config.js` (render scale + particle count). Starts low on TV sticks (CrKey etc.), steps down if fps < 40 for 3 s. `?fx=0..4` pins a rung, `?fps` shows fps.
- Debug: `?mute`, `?nonet`, `window.MECH` on the TV, `window.MP` on the phone.
