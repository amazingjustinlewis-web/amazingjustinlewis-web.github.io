# Zombie Tiles - Lights Helper (Philips Hue, v0.2)

Optional. Your Hue lights react to the game:
- a moody base light during play
- a tint in the current player's colour on their turn
- flickers on dice rolls
- red pulses during fights
- a hard red "crunch" when a player is taken out
- a gold flash when someone escapes by helicopter

When the game ends, your lights go back exactly how they were. The same happens if Hue is switched off or the TV disconnects.

**Why a helper:** the TV page runs on the Chromecast and can't talk to the bridge itself. So this small helper runs on a PC on the same Wi-Fi. It joins the game room like a phone (but not as a player) and passes game events to the bridge's local API.

**What it needs:** Python 3 (standard library only). No cloud account and no Home Assistant.

## One-time pairing
1. Double-click `pair-hue-bridge.bat`.
2. When it says **PRESS THE ROUND LINK BUTTON**, press the big round button on top of the Hue bridge. You have 60 seconds.
3. It prints `SUCCESS` and the rooms it found. The key is saved in `private/hue-key.json`, on this PC only.

## Before each game
1. Double-click `start-lights-helper.bat`. A console window opens (leave it open) and a browser tab shows the Lights Helper page.
2. Connect it to the game, either way:
   - click **Open the game on Bedroom TV & connect** (this uses `D:\AI\HomeHub\cast_url.py`), or
   - open the game on the TV yourself, type the TV's 4-letter room code into the helper page, and click **Connect**.
3. On the host phone (the first player to join) or in the TV lobby, you'll see "Philips Hue found - Use your lights in this game?". Tap **Yes**, then tick the rooms/zones to use. **Flash ticked rooms** blinks them once so you can check.
4. Start the game. To switch the lights off/on mid-game, press **L** on a keyboard connected to the TV page.

## If something goes wrong
- **Lights stuck in game colours** (for example, the PC crashed): run `restore-lights.bat`. Or click **Restore my lights now** / **Restore lights from an earlier game** in the helper page.
- **Closing the helper:** closing the helper window or pressing Ctrl+C restores the lights first.
- **TV gone:** if the TV page disappears for 30 seconds mid-game, the helper restores the lights by itself.

## Settings (`private/settings.json`, created on first run)
- `bridgeIp`: the bridge address (blank = auto-discover).
- `castDevice`: the Chromecast's name.
- `homeHubDir`: where `cast_url.py`, `quit_app.py` and `.venv` live.
- `port`: the helper page port (8790).

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
