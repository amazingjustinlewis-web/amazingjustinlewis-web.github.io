/* =====================================================================
   sprites.js - the ART-SWAP system.

   Everything on screen is drawn through Sprites.draw(key, state, ...).
   If assets/<file> exists and loads, that image (or sprite-sheet strip)
   is used; otherwise the procedural placeholder registered for that key
   is drawn instead. So you can drop in art one file at a time.
   After adding/removing PNGs in assets/, double-click
   assets/update-art-list.bat (rewrites assets/art.js), then refresh.

   SPRITE SHEET FORMAT: one PNG per animation state, frames laid out in a
   single HORIZONTAL strip, all frames the same width
   (image width = frameWidth * frames). Transparent background.

   Per-entry fields (all optional except file):
     file     filename inside assets/
     frames   number of frames in the strip           (default 1)
     fps      playback speed                          (default 8)
     loop     loop the animation? false = hold last   (default true)
     anchorX  0..1 horizontal pivot inside the frame  (default from key defaults)
     anchorY  0..1 vertical pivot inside the frame    (default from key defaults)
     w, h     drawn size in WORLD px (1 tile = 48). If only h is given the
              width follows the frame's aspect ratio. If neither is given the
              entity's own size is used (vehicles/logs stretch to fit).
     fallback another state of the same key to use if this file is missing
   (opts.progress 0..1 picks the frame by progress instead of time - used for falling dominoes)
   Vehicles/logs are drawn facing RIGHT; they are mirrored automatically
   when moving left.
   ===================================================================== */
const SPRITE_MANIFEST = {
  // Player art shared by both players. Feet = anchor (0.5, 1.0).
  player: {
    defaults: { anchorX: 0.5, anchorY: 1.0, h: 56 },
    idle:   { file: 'player_idle.png',   frames: 4, fps: 6 },
    charge: { file: 'player_charge.png', frames: 4, fps: 14 },
    jump:   { file: 'player_jump.png',   frames: 4, fps: 10, loop: false },
    fling:  { file: 'player_fling.png',  frames: 4, fps: 12, fallback: 'jump' },  // overload tumble
    run:    { file: 'player_run.png',    frames: 4, fps: 16, fallback: 'jump' },  // tap-streak pitter-patter hop
    land:   { file: 'player_land.png',   frames: 3, fps: 20, loop: false },
    dizzy:  { file: 'player_dizzy.png',  frames: 6, fps: 10 },
    teeter: { file: 'player_teeter.png', frames: 4, fps: 14 },
    fall:   { file: 'player_fall.png',   frames: 6, fps: 10, loop: false },       // into water (also the sinking part)
    swim:   { file: 'player_swim.png',   frames: 4, fps: 12, fallback: 'fall' },  // flailing back up to the surface
    burn:   { file: 'player_burn.png',   frames: 4, fps: 12, fallback: 'fall' },  // v3: fell in lava (red-hot, sizzling)
    splat:  { file: 'player_splat.png',  frames: 4, fps: 16, loop: false },       // hit by vehicle
    win:    { file: 'player_win.png',    frames: 4, fps: 8 }
  },
  // Optional per-player overrides (checked before "player"). Same state names, e.g.
  //   p1: { defaults: { anchorX: 0.5, anchorY: 1, h: 56 }, idle: { file: 'p1_idle.png', frames: 4, fps: 6 } },
  p1: { defaults: { anchorX: 0.5, anchorY: 1.0, h: 56 } },
  p2: { defaults: { anchorX: 0.5, anchorY: 1.0, h: 56 } },

  car:     { defaults: { anchorX: 0.5, anchorY: 0.5 }, drive: { file: 'car.png',   frames: 2, fps: 10 } },
  truck:   { defaults: { anchorX: 0.5, anchorY: 0.5 }, drive: { file: 'truck.png', frames: 2, fps: 10 } },
  log:     { defaults: { anchorX: 0.5, anchorY: 0.5 }, float: { file: 'log.png',   frames: 1 } },
  powerup: { defaults: { anchorX: 0.5, anchorY: 0.5, w: 30, h: 30 }, idle: { file: 'powerup.png', frames: 6, fps: 10 } },

  // Dominoes (open plains). Drawn FALLING TOWARD THE TOP of the image; the game rotates them to the
  // real fall direction. Anchor = the spot where the domino stands (bottom-centre).
  // 'falling' frames are picked by fall progress (first frame = upright, last = flat), not by fps.
  domino: {
    defaults: { anchorX: 0.5, anchorY: 1.0 },
    standing: { file: 'domino_standing.png', frames: 1 },
    falling:  { file: 'domino_falling.png',  frames: 6, fallback: 'standing' },
    fallen:   { file: 'domino_fallen.png',   frames: 1 }
  },
  flag: { defaults: { anchorX: 0.5, anchorY: 1.0, h: 40 }, idle: { file: 'flag.png', frames: 4, fps: 8 } },  // checkpoint flags

  // Lane background tiles: drawn repeated, one per 48x48 tile (frames animate, e.g. water).
  tile_grass: { idle: { file: 'tile_grass.png', frames: 1 } },
  tile_road:  { idle: { file: 'tile_road.png',  frames: 1 } },
  tile_water: { idle: { file: 'tile_water.png', frames: 4, fps: 4 } },
  tile_goal:  { idle: { file: 'tile_goal.png',  frames: 1 } },
  tile_plain: { idle: { file: 'tile_plain.png', frames: 1 } },
  // v3 lava chutes & open straights
  tile_lava:  { idle: { file: 'tile_lava.png',  frames: 4, fps: 6 } },              // lava surface, one per 48x48 tile
  chunk:      { defaults: { anchorX: 0.5, anchorY: 0.5 }, idle: { file: 'chunk.png', frames: 1 } },   // floating rock (stretched to each chunk's size)
  boulder:    { defaults: { anchorX: 0.5, anchorY: 0.85 }, idle: { file: 'boulder.png', frames: 1 } } // obstacle on straights (slows you)
};

const Sprites = (() => {
  const ASSET_DIR = 'assets/';
  // Which files to request: the ones listed in assets/art.js (ART_FILES), or every manifest file
  // when ART_PROBE_ALL is true there (simplest, but missing files then show as harmless
  // "not found" lines in the browser's dev console).
  const listed = new Set((window.ART_FILES || []).map((f) => String(f).toLowerCase()));
  const probeAll = !!window.ART_PROBE_ALL;
  const placeholders = {};
  const report = { loaded: [], missing: [] };

  // Kick off loading of every file in the manifest. Missing files simply fall
  // back to placeholders (the browser console may list them as "not found";
  // that is expected and harmless).
  for (const key in SPRITE_MANIFEST) {
    const group = SPRITE_MANIFEST[key];
    const defs = group.defaults || {};
    for (const state in group) {
      if (state === 'defaults') continue;
      const e = group[state];
      for (const k in defs) if (e[k] === undefined) e[k] = defs[k];
      e.frames = e.frames || 1; e.fps = e.fps || 8;
      if (e.loop === undefined) e.loop = true;
      if (e.anchorX === undefined) e.anchorX = 0.5;
      if (e.anchorY === undefined) e.anchorY = 0.5;
      e.ready = false;
      if (!e.file) continue;
      if (!probeAll && !listed.has(e.file.toLowerCase())) { report.missing.push(e.file); continue; }
      const img = new Image();
      img.onload = () => {
        e.img = img; e.ready = true;
        e.fw = img.width / e.frames; e.fh = img.height;
        report.loaded.push(e.file);
      };
      img.onerror = () => { e.failed = true; report.missing.push(e.file); };
      img.src = ASSET_DIR + e.file;
    }
  }

  function findEntry(keys, state) {
    for (const key of keys) {
      const g = SPRITE_MANIFEST[key];
      if (!g) continue;
      let e = g[state];
      if (e && e.ready) return e;
      if (e && e.fallback && g[e.fallback] && g[e.fallback].ready) return g[e.fallback];
    }
    return null;
  }

  function frameIndex(e, t, progress) {
    if (progress !== undefined) return Math.min(e.frames - 1, Math.floor(Math.max(0, progress) * e.frames));
    const f = Math.floor(Math.max(0, t) * e.fps);
    return e.loop ? f % e.frames : Math.min(e.frames - 1, f);
  }

  return {
    /** Register the procedural fallback for a sprite key.
        fn(ctx, state, t, opts) draws in local space: origin = anchor point. */
    registerPlaceholder(key, fn) { placeholders[key] = fn; },

    /** Draw key/state at world (x, y).
        key: string or array of keys to try in order (last one supplies the placeholder).
        opts: { w, h, flipX, rot, sx, sy, alpha, ...anything the placeholder needs } */
    draw(ctx, key, state, t, x, y, opts = {}) {
      const keys = Array.isArray(key) ? key : [key];
      const e = findEntry(keys, state);
      ctx.save();
      ctx.translate(x, y);
      if (opts.rot) ctx.rotate(opts.rot);
      const sx = (opts.sx === undefined ? 1 : opts.sx) * (opts.flipX ? -1 : 1);
      const sy = opts.sy === undefined ? 1 : opts.sy;
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
      if (e) {
        let w = e.w || opts.w || e.fw, h = e.h || opts.h || e.fh;
        if (e.h && !e.w) w = e.h * e.fw / e.fh;
        const f = frameIndex(e, t, opts.progress);
        ctx.drawImage(e.img, f * e.fw, 0, e.fw, e.fh, -e.anchorX * w, -e.anchorY * h, w, h);
      } else {
        const ph = placeholders[keys[keys.length - 1]];
        if (ph) ph(ctx, state, t, opts);
      }
      ctx.restore();
      return !!e;
    },

    /** Fill a world rect with a repeating tile image. Returns false if no art (caller draws its own). */
    drawTiles(ctx, key, t, x0, y0, w, h, tile) {
      const e = findEntry([key], 'idle');
      if (!e) return false;
      const f = frameIndex(e, t);
      for (let x = x0; x < x0 + w; x += tile) {
        ctx.drawImage(e.img, f * e.fw, 0, e.fw, e.fh, x, y0, tile + 0.5, h + 0.5);
      }
      return true;
    },

    has(key, state) { return !!findEntry([key], state); },
    report
  };
})();
