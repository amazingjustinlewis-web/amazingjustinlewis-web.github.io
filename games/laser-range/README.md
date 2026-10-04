# Laser Range - v0.1 prototype (working title)

A phone-aimed light-gun shooting gallery by Zero to Phi. Same architecture as Zombie Tiles and Red Deer Rich:
plain HTML/JS with no build step. The TV page (`index.html`) holds the whole game state, phones are controllers
(`controller.html`) over PeerJS (QR code or 4-letter room code), and every number lives in `js/config.js`.
`index.html` keeps the legacy PeerJS fallback for the old Samsung Tizen browser (`js/vendor/peerjs.legacy.min.js`).

Live: https://amazingjustinlewis-web.github.io/games/laser-range/

## How to play
1. Open `index.html` on the TV (Chromecast/DashCast, Samsung TV browser, or a PC on the TV). Turn the sound on.
2. Phones scan the QR code (or open `controller.html` and type the code) and enter a name. 1 to 4 players.
3. **Enable aiming.** On iPhone tap **Tap to enable aiming** (the iOS motion permission). Android just works.
   Phones without a gyro (or anyone who prefers it) use **touchpad mode**: drag on the pad to move the cursor.
4. **Calibrate.** The TV shows 5 targets in your colour (4 corners + centre). The phone says which one to point at.
   Hold the phone like a remote, point its top edge straight at that target and tap **SHOOT** to confirm. After 5 taps
   your crosshair follows your aim.
5. While you wait, shoot the practice targets. The first phone (host) taps **START** (or press Enter on the TV).
6. 90-second round. Cartoon targets pop up from behind barrels, crates and walls, then duck back:
   bullseye 100, bandit 150, gold runner 300, and **don't shoot granny** (-100). Hit streaks give a bonus.
   Red barrels take 3 hits, then explode, taking out nearby targets and chaining to other barrels.
   Shoot the floating balloon for 12 s of the **charge cannon** (press and hold SHOOT, release for an area blast).
7. Results screen with scores, accuracy and awards. The host taps PLAY AGAIN or Lobby.

### Phone controls
- **SHOOT** (big button at the bottom): tap to fire; hold to charge when you have the charge cannon.
- **Swipe** on the middle area (or flick off the SHOOT button) to fire a piercing blast from your cursor in that direction.
- **Re-centre** (◎): point at the middle of the TV and tap SHOOT. Fixes drift without a full recalibration.
- **Recalibrate**: redo the 5 points. **Touchpad / Motion**: switch aim mode.

### TV keys
Enter start · Esc back to lobby · M mute · D low/high detail · B add a bot · L Hue lights on/off

### URL parameters (TV)
`?round=N` round length in seconds · `?bots=N` add bots · `?mute` · `?lowfx` / `?hifx` force detail ·
`?fps` show an FPS meter · `?seed=N` · `?autostart` · `?local=1` same-browser test mode (BroadcastChannel, no PeerJS) ·
`?nonet` no networking. Controller: `?room=ABCD&name=X&auto` auto-join, `?pad` force touchpad.

## How the aiming works (`js/aim.js`)
The phone streams raw `alpha/beta/gamma` at 30 Hz. The TV turns them into a pointing vector with the full W3C
ZXY rotation matrix (so the 359°→0° alpha wrap and the beta/gamma gimbal flips don't matter), projects it onto a
plane facing the centre target, and fits a homography from the 5 calibration points (falls back to affine if the fit
is unstable). The cursor goes through a light one-euro filter. Re-centre rotates the calibration about world-up
and adds a small screen offset. Settings: `LR_CONFIG.aim`.

## Performance
The TV renders a cached backdrop and simple sprites. If it averages under 40 fps for 3 s it switches to low detail
(lower resolution, no shake, fewer particles, lighter sound) and tries high detail again later. `D` toggles it.

## Philips Hue (optional)
Uses the Zombie Tiles Lights Helper unchanged: the TV also opens a door on the Zombie Tiles room prefix, so connect
the helper to the same room code. The lobby shows a Hue panel (YES/NO + rooms). Barrel explosions send `fx boom`
(throttled to one per 1.5 s), plus `start` / `over` / `end` around the round.

## Status / not yet tested
Tested on a headless desktop browser with synthetic orientation data and simulated phones (calibration maths,
drift + Re-centre, touchpad, scoring, barrels, results, auto low detail, Chromium 74 legacy PeerJS path).
**Not tested on real hardware:** real phone gyros and iOS permission, real phones over Wi-Fi to a Chromecast,
a real Hue bridge, TV audio on Chromecast. Art is placeholder.
