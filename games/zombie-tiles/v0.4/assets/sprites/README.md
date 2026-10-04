# Character sprites (Zombie Tiles v0.4+)

The game draws placeholder characters in code. You can replace them with your own drawings.

## Frame format
- One PNG per character type: `player.png` and `zombie.png`.
- Each frame is **32 x 32 pixels** (change `sprites.frame` in `js/config.js` if you draw bigger, e.g. 64).
- **6 columns x 4 rows** = a 192 x 128 px sheet (or 384 x 256 for 64 px frames).

| Columns | What |
|---|---|
| 1-2 | idle (the game alternates them slowly, a little breathing bob) |
| 3-6 | walk cycle (played while the token steps from square to square) |

| Row | Facing |
|---|---|
| 1 | down (toward the TV viewer) |
| 2 | left |
| 3 | right |
| 4 | up (back view) |

- Transparent background. Keep the feet near the bottom middle of each frame (about 4 px up from the bottom edge).
- **Player colour:** paint anything that should be the player's colour (shirt, cape...) in pure magenta
  **#FF00FF**, and its shading in **#800080**. The game swaps those for each player's colour. All other colours stay as drawn.
- The zombie sheet is drawn exactly as you paint it (player-zombies get a coloured ring under them).
- Snared zombies use the zombie's facing-down walk frames, drawn upside down.

## Templates
`player-template.png` and `zombie-template.png` in this folder are the current placeholders in exactly this layout.
Open one in any pixel editor (Aseprite, Piskel, Paint.NET...), draw over it, save as `player.png` / `zombie.png`.

## Switch them on
In `js/config.js`:
```js
sprites: { enabled: true, frame: 32, player: 'assets/sprites/player.png', zombie: 'assets/sprites/zombie.png', ... }
```
Leave a path empty (`''`) to keep the built-in placeholder for that character. `enabled: false` brings back the old round tokens.
If a sheet fails to load or is too small, the placeholder is used.
