# Zombie Tiles - Lights Helper (Philips Hue, v0.2.1)

Optional. Your Hue lights react to the game:
- a moody base light during play
- a tint in the current player's colour on their turn
- flickers on dice rolls
- red pulses during fights
- a hard red "crunch" when a player is taken out
- a burst of colours when someone escapes by helicopter
- a white-then-orange flash when dynamite goes off (v0.4; needs this helper version - restart the helper after updating)

When the game ends, your lights go back exactly how they were. The same happens if Hue is switched off or the TV disconnects.

**Why a helper:** the TV page runs on the Chromecast and can't talk to the bridge itself. So this small helper runs on a PC on the same Wi-Fi. It joins the game room like a phone (but not as a player) and passes game events to the bridge's local API.

**How it connects (v0.2.1):** the helper starts a hidden ("headless") Microsoft Edge (or Chrome) in the background. That hidden browser holds the connection to the TV. The helper page you see is just a control panel: open it in any browser, or close it. (Firefox can't connect to the Chromecast on some home networks, while Edge and Chrome can. That's why v0.2 got stuck on "Connecting to room...".)

**What it needs:** Python 3 (standard library only). No cloud account and no Home Assistant.

## One-time pairing
1. Double-click `pair-hue-bridge.bat`.
2. When it says **PRESS THE ROUND LINK BUTTON**, press the big round button on top of the Hue bridge. You have 60 seconds.
3. It prints `SUCCESS` and the rooms it found. The key is saved in `private/hue-key.json`, on this PC only.

## Before each game
1. Double-click `start-lights-helper.bat`. A console window opens (leave it open) and a browser tab shows the Lights Helper page. Only one helper runs at a time: starting it again just opens the page.
2. Connect it to the game, either way:
   - click **Open the game on Bedroom TV & connect** (this uses `D:\AI\HomeHub\cast_url.py`), or
   - open the game on the TV yourself, type the TV's 4-letter room code into the helper page, and click **Connect**.
   The page says **Connected to room ABCD via background Edge** once it's linked. It keeps retrying by itself (for example while the TV is still loading).
3. Pick the lights, either way:
   - on the helper page: tick **Use lights** and the rooms/zones under "3. Lights in the game" (**Test flash** blinks them once), or
   - on the host phone (the first player to join) or in the TV lobby: answer "Philips Hue found - Use your lights in this game?" with **Yes**, then tick rooms.

   Your choice is remembered for next time.
4. Start the game. To switch the lights off/on mid-game, press **L** on a keyboard connected to the TV page.

## If something goes wrong
- **Lights stuck in game colours** (for example, the PC crashed): run `restore-lights.bat`. Or click **Restore my lights now** / **Restore lights from an earlier game** in the helper page.
- **Closing the helper:** closing the helper window or pressing Ctrl+C restores the lights first.
- **TV gone:** if the TV page disappears for 30 seconds mid-game, the helper restores the lights by itself.
- **Stuck on "Connecting to room..."**:
  - Check that the code matches the TV.
  - Look at the "Background link" line on the helper page. If it says *not running*, Edge/Chrome wasn't found: set `browser` in `private/settings.json` to the full path of `msedge.exe` or `chrome.exe`, or open `http://127.0.0.1:8790/` in Edge or Chrome and keep that tab open.
  - The console window and the page's Log show every connection step.

## Settings (`private/settings.json`, created on first run)
- `bridgeIp`: the bridge address (blank = auto-discover).
- `castDevice`: the Chromecast's name.
- `homeHubDir`: where `cast_url.py`, `quit_app.py` and `.venv` live.
- `port`: the helper page port (8790).
- `relay`: `"auto"` (default, hidden background browser) or `"off"` (an open Edge/Chrome helper tab connects instead).
- `browser`: optional full path to `msedge.exe` / `chrome.exe` for the background link.
- `lastRoom`, `lastEnabled`, `lastSelected`: remembered between runs.

Effect colours, brightness, lengths and rate limits live in the game's `js/config.js` (the `hue` block). The TV sends them to the helper when it connects.

## Testing without lights
Run `test-with-mock-bridge.bat` (or `python helper.py --mock`). It starts a fake bridge with fake rooms. Use "Simulate the bridge button" to pair it. Nothing is sent to real lights in mock mode.

## Rate limits
Hue allows about 10 light commands per second and 1 room/zone command per second. The helper stays under that:
- **Caps:** at most 8 light commands/s and 1 group command/s.
- **Merging:** commands that pile up are merged, so effects never lag behind.
- **Few vs many lights:** with up to 6 lights in the chosen rooms, it drives each light (snappier). With more, it uses room/zone commands (slower, smoother effects).

## Privacy and safety
- The helper page only listens on 127.0.0.1, so other devices on the network can't reach it.
- Its API rejects requests from other websites.
- It only sends commands to the lights in the rooms you ticked.
