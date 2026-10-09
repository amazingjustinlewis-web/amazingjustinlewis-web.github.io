# Iron Stride (working title) - v0.2 "Thumb pad" (v0.1 archived in v0.1/)

TV + phones mech prototype. `index.html` = TV (three.js cockpit view), `controller.html` = phone (portrait).

- Networking/lobby: same PeerJS room-code + QR pattern as Laser Range / Red Deer Rich (`js/net.js`, peer prefix `ztp-ironstride-v01-`). `?local=1&room=ABCD` on both pages = BroadcastChannel test mode.
- Aiming: phone `deviceorientation` -> pointing vector (`js/aim.js` from Laser Range) -> yaw/pitch. 3-tap calibration (centre, left edge, right edge) on the phone. Crosshair past 55% of the half-screen turns the torso.
- Hidden aim assist (`assist()` in `js/tv.js`, numbers in `js/config.js`): RMS crosshair speed over 450 ms -> steadiness. Steady = small cone and strong pull; shaky = wide cone, soft pull and a bit of scatter. Locks are sticky for 350 ms.
- Map: finger stroke -> RDP simplify -> Catmull-Rom as cubic Beziers -> points every 3 m -> the TV follows them with a lookahead.
- Seats: pilot (seat 0) and an optional gunner (seat 1, own crosshair + autocannon).
- Mouse + keys: "Play here with mouse + keys" on the TV lobby, or `?kb`.
- Quality: rungs in `config.js` (render scale + particle count). Starts low on TV sticks (CrKey etc.), steps down if fps < 40 for 3 s. `?fx=0..4` pins a rung, `?fps` shows fps.
- Debug: `?mute`, `?nonet`, `window.MECH` on the TV, `window.MP` on the phone.

## v0.2
- Two reticles: small raw gyro crosshair + big intent reticle (smoothed, tau 0.07 s steady .. 0.32 s shaky). Shots go to the intent reticle with steadiness-based spread. Reticle gravity: soft pull toward an enemy inside the assist cone, fading toward the cone edge.
- Edge turning: outer 20% each side (|x| > 0.6), speed = 115 deg/s * u^2.6.
- Pitch: full -89..+89 degrees.
- Phone thumb pad (`move` {x,y} relative to the facing, `face` {a}, `tap`): floating stick; release slows to a stop. Outer ring = facing arrow (drag + release -> pod turns at 150 deg/s, the whole pad display rotates back in sync). Inner ring = travel direction + speed. Holo mini-map (heading-up, ~12 Hz state).
- Mouse + keys: WASD walk relative to facing, Q/E swing torso, mouse aims.
- Tests: /workspace/mech/tests/sim.py (v0.1 flow) and sim02.py (v0.2 controls).
