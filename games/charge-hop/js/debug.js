/* =====================================================================
   debug.js - tuning overlay, toggled with ` (backquote).
   Sliders edit CONFIG live. "Dump values" prints the current numbers so
   you can paste them back into config.js. Add a slider = add a line to SLIDERS.
   ===================================================================== */
const Debug = (() => {
  const SLIDERS = [
    // [label, CONFIG path, min, max, step]
    ['Tap threshold (s)',       'input.tapThreshold',     0.05, 0.30, 0.01],
    ['Charge L1 time (s)',      'charge.level1Time',      0.15, 0.90, 0.01],
    ['Charge L2 time (s)',      'charge.level2Time',      0.40, 1.60, 0.01],
    ['Overload grace (s)',      'charge.overloadGrace',   0.20, 1.50, 0.02],
    ['Jump air base (s)',       'jump.airBase',           0.02, 0.30, 0.01],
    ['Jump air / row (s)',      'jump.airPerRow',         0.04, 0.30, 0.01],
    ['Arc per row (px)',        'jump.arcPerRow',         0,    30,   1],
    ['Land squash',             'jump.landSquash',        0,    0.6,  0.02],
    ['Streak window (s)',       'streak.window',          0.05, 0.8,  0.01],
    ['Streak per tap',          'streak.perTap',          0,    0.2,  0.01],
    ['Log grip (friction)',     'friction.river',         0.5,  15,   0.5],
    ['Grass friction',          'friction.grass',         0.2,  20,   0.2],
    ['Log restitution',         'river.restitution',      0,    1,    0.05],
    ['Teeter grace (s)',        'river.teeterGrace',      0.1,  1.2,  0.05],
    ['Log edge safe (px)',      'river.edgeSafe',         0,    20,   1],
    ['Slow-mo timeScale',       'slowmo.timeScale',       0.05, 1,    0.05],
    ['Slow-mo hold (s real)',   'slowmo.hold',            0.1,  2,    0.05],
    ['Slow-mo cooldown (s)',    'slowmo.cooldown',        0,    8,    0.25],
    ['Camera min zoom',         'camera.minZoom',         0.3,  1.2,  0.02],
    ['v3 run cruise (rows/s)',  'run.cruise',             1.5,  8,    0.1],
    ['v3 run launch speed',     'run.launchSpeed',        3,    12,   0.25],
    ['v3 run tap boost',        'run.tapBoost',           0,    4,    0.1],
    ['v3 run slow-down mul',    'run.slowMul',            0.2,  1,    0.05],
    ['v3 chute speed end (px/s)','chute.v1',              80,   400,  5],
    ['v3 chute spread',         'chute.spread',           0,    1.5,  0.05],
    ['Camera max zoom',         'camera.maxZoom',         0.8,  2.5,  0.05],
    ['Global time (debug)',     'debug.timeScale',        0.1,  1.5,  0.05]
  ];
  const TOGGLES = [['Slow-mo enabled', 'slowmo.enabled'], ['Show hitboxes', 'debug.showHitboxes']];

  const get = (path) => path.split('.').reduce((o, k) => o[k], CONFIG);
  const set = (path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], CONFIG)[last] = v; };

  let panel = null, stats = null, out = null, visible = false, lastStats = 0;

  function build() {
    panel = document.createElement('div');
    panel.id = 'debug';
    panel.innerHTML = '<div class="dbg-title">TUNING <span>` to close</span></div><pre class="dbg-stats"></pre>';
    stats = panel.querySelector('.dbg-stats');
    for (const [label, path, min, max, stepv] of SLIDERS) {
      const row = document.createElement('label'); row.className = 'dbg-row';
      const val = document.createElement('span'); val.className = 'dbg-val';
      const input = document.createElement('input');
      Object.assign(input, { type: 'range', min, max, step: stepv, value: get(path) });
      const show = () => { val.textContent = (+get(path)).toFixed(stepv < 0.1 ? 2 : stepv < 1 ? 1 : 0); };
      input.addEventListener('input', () => {
        set(path, parseFloat(input.value));
        if (path === 'charge.level2Time' || path === 'charge.level1Time') { // keep L2 after L1
          if (CONFIG.charge.level2Time < CONFIG.charge.level1Time + 0.05) CONFIG.charge.level2Time = CONFIG.charge.level1Time + 0.05;
        }
        show();
      });
      input.addEventListener('change', () => input.blur());   // give keys back to the game
      row.append(Object.assign(document.createElement('span'), { textContent: label, className: 'dbg-label' }), input, val);
      show();
      panel.append(row);
    }
    for (const [label, path] of TOGGLES) {
      const row = document.createElement('label'); row.className = 'dbg-row';
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!get(path) });
      cb.addEventListener('change', () => { set(path, cb.checked); cb.blur(); });
      row.append(cb, Object.assign(document.createElement('span'), { textContent: ' ' + label }));
      panel.append(row);
    }
    const btn = Object.assign(document.createElement('button'), { textContent: 'Dump values (paste into config.js)' });
    out = Object.assign(document.createElement('textarea'), { rows: 6, readOnly: true });
    btn.addEventListener('click', () => {
      const o = {};
      for (const [, path] of SLIDERS) o[path] = get(path);
      out.value = Object.entries(o).map(([k, v]) => `${k} = ${v}`).join('\n');
      out.style.display = 'block'; btn.blur();
      try { navigator.clipboard && navigator.clipboard.writeText(out.value).catch(() => {}); } catch (e) {}
    });
    panel.append(btn, out);
    document.body.append(panel);
  }

  return {
    toggle() {
      if (!panel) build();
      visible = !visible;
      panel.style.display = visible ? 'block' : 'none';
    },
    get visible() { return visible; },
    frame() {
      if (!visible || !stats) return;
      const now = performance.now();
      if (now - lastStats < 100) return;
      lastStats = now;
      const G = window.ChargeHop.Game;
      const lines = [
        `fps ${Loop.fps.toFixed(0)}   timeScale ${G.timeScale.toFixed(2)}   zoom ${Camera.zoom.toFixed(2)}`,
        `slow-mo ${Drama.active ? 'ON (' + Drama.reason + ')' : 'off'}  fired ${Drama.count}   particles ${Effects.count}`,
        `art loaded ${Sprites.report.loaded.length}  missing ${Sprites.report.missing.length}`
      ];
      for (const p of G.active) {
        lines.push(`${p.name} ${p.state.padEnd(6)} row ${p.row} x ${p.x.toFixed(0)} vx ${(p.ride ? p.riderVx : p.vx).toFixed(0)} streak ${p.streak}` +
          (p.state === 'charge' ? ` charge ${p.chargeT.toFixed(2)}s L${p.levelFor(p.chargeT)}` : ''));
      }
      stats.textContent = lines.join('\n');
    }
  };
})();
