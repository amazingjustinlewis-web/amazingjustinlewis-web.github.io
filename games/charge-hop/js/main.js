/* =====================================================================
   main.js - game states (title -> countdown -> play -> won), the fixed-
   timestep loop, world rendering, HUD and overlays.
   ===================================================================== */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1;
const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';

const Game = {
  state: 'title',           // 'title' | 'countdown' | 'play' | 'won'
  paused: false,
  players: [new Player(0), new Player(1)],
  level: null, levelIndex: 0, frame: 0,
  time: 0, realTime: 0, raceTime: 0, timeScale: 1,
  countT: 0, lastBeep: 0, wonT: 0, winner: null, bothJoinedT: -1, playT: 0,
  stats: { jumps: [0, 0, 0], overloads: 0, closeCalls: 0 },

  init() {
    // default level = the one marked  default: true  in its level file (else the last one loaded)
    const d = LEVELS.findIndex((l) => l.default);
    this.loadLevel(d >= 0 ? d : LEVELS.length - 1);
    this.toTitle();
    Camera.snap([]);
  },

  loadLevel(i) {
    this.levelIndex = i;
    this.level = buildLevel(LEVELS[i]);
    const T = World.T;
    Camera.setBounds({ minX: 0, maxX: World.W, minY: -this.level.rows * T, maxY: 0 });
  },

  get active() { return this.players.filter((p) => p.joined); },

  placePlayers() {
    const act = this.active;
    for (const p of act) {
      const col = act.length === 1 ? CONFIG.player.soloColumn : CONFIG.player.startColumns[p.idx];
      p.reset(0, World.colX(col));
    }
  },

  toTitle() {
    this.state = 'title'; this.paused = false; this.winner = null; this.bothJoinedT = -1;
    this.players.forEach((p) => { p.joined = false; p.joinNext = false; p.reset(0, World.W / 2); Input.requireFresh(p.idx); });
    Drama.reset(); Effects.clear(); Fireworks.clear();
  },

  startCountdown() {
    for (const p of this.players) if (p.joinNext) { p.joined = true; p.joinNext = false; }   // sat out / asked to join
    this.loadLevel(this.levelIndex);   // fresh traffic & pickups
    this.state = 'countdown'; this.countT = 3; this.lastBeep = 4; this.winner = null; this.paused = false;
    this.stats = { jumps: [0, 0, 0], overloads: 0, closeCalls: 0 };
    this.placePlayers();
    Drama.reset(); Effects.clear(); Fireworks.clear();
    Camera.snap(this.cameraTargets());
  },

  restart() {
    if (this.state === 'title') return;
    if (!this.active.length) { this.toTitle(); return; }
    this.startCountdown();
  },

  /* ---------------- events from players/lanes ---------------- */
  closeCall(p, reason, priority = false) {
    if (this.state !== 'play' && !priority) return false;
    if (Drama.trigger(p, reason, priority)) {
      this.stats.closeCalls++;
      if (!priority) Effects.text(p.x, p.groundY - 60, reason.toUpperCase(), '#ffffff', 12, 0.9);
      return true;
    }
    return false;
  },

  selectLevel(i) {
    if (this.state !== 'title' || !LEVELS.length) return;
    i = (i + LEVELS.length) % LEVELS.length;
    if (i === this.levelIndex) return;
    this.loadLevel(i);
    this.placePlayers();
    Sfx.play('beep');
  },

  /** trailing players far off the bottom of the screen get pulled up to the leader's checkpoint */
  updateCatchup(realDt) {
    const act = this.active.filter((p) => !p.satOut), C = CONFIG.catchup;
    if (act.length < 2) return;
    const leader = act.reduce((a, b) => (b.progressRow > a.progressRow ? b : a));
    const bottom = Camera.y + Camera.viewH / (2 * Camera.scale);
    for (const p of act) {
      const off = p !== leader && p.groundY > bottom + 4;
      p.offscreen = off;
      if (!off || !C.enabled) { p.offscreenT = 0; continue; }
      if (p.state === 'idle' || p.state === 'dizzy') p.offscreenT = (p.offscreenT || 0) + realDt;
      if (p.offscreenT >= C.delay) {
        p.offscreenT = 0;
        const target = leader.lastSafe;
        if (target.row > p.row) p.pullTo(target.row, Math.max(20, Math.min(World.W - 20, target.x + (p.idx ? 30 : -30))), this);
      }
    }
  },
  onDeath(p, cause) {
    const wet = cause === 'drown' || cause === 'fall';
    if (wet && !CONFIG.waterDeath.slowmo) return;      // the dunk is a quick funny moment, not a dramatic failure
    if (cause === 'lava' && !CONFIG.lavaDeath.slowmo) return;   // same for the lava sizzle
    Camera.shake(CONFIG.shake.death);
    Drama.trigger(p, 'death', true);
  },

  /** 2P: a joined player who hasn't pressed their button at all since GO sits the round out
      (so an accidental join doesn't keep the camera zoomed out on someone standing at the start) */
  updateIdleDrop(realDt) {
    const C = CONFIG.idleDrop, act = this.active;
    if (C.enabled && act.length > 1 && this.playT >= C.after) {
      for (const p of act) {
        if (p.pressedThisRound || p.satOut || !act.some((q) => q !== p && q.pressedThisRound)) continue;
        p.satOut = true; p.fadeOut = 0.6;
        Sfx.play('sitout');
        Effects.text(p.x, p.groundY - 54, `${p.name} sat out`, '#ffffff', 13, 1.6);
        Effects.spawn('sparkle', p.x, p.groundY - 16, 10, { color: p.color });
      }
    }
    for (const p of this.players) {
      if (p.satOut && p.fadeOut > 0 && (p.fadeOut -= realDt) <= 0) { p.joined = false; p.satOut = false; Sfx.stopHum(p.idx); }
      if (!p.joined && !p.satOut) {                  // not in this round: pressing your button joins the NEXT round
        for (const ev of Input.poll(p.idx)) if (ev === 'down' && !p.joinNext) { p.joinNext = true; Sfx.play('join'); }
      }
    }
  },
  onGoal(p) {
    if (this.state !== 'play') { p.win(); return; }
    this.winner = p; p.win();
    this.state = 'won'; this.wonT = 0;
    Sfx.play('win');
    Effects.spawn('confetti', p.x, p.groundY - 20, 70);
    Fireworks.start(p.color);                       // big celebration, then auto-restart (CONFIG.celebrate)
    Drama.trigger(p, 'win', true);
    this.players.forEach((q) => { if (q !== p) Sfx.stopHum(q.idx); });
  },
  checkPickups(p) {
    if (!p.grounded || !p.alive) return;
    const lane = this.level.lanes[p.row];
    for (const it of lane.items) {
      if (it.hidden || it.kind !== 'pickup') continue;
      if (Math.abs(p.x - it.x) < CONFIG.powerup.pickupRadius) {
        it.hidden = true; it.respawnT = CONFIG.powerup.respawnTime;
        if (it.def.effect === 'triple') p.grantPower();
      }
    }
  },

  /* ---------------- update ---------------- */
  update(dt, realDt) {
    this.time += dt; this.realTime += realDt;

    if (this.state === 'title') this.updateTitle(realDt);
    else if (this.state === 'countdown') {
      this.countT -= realDt;
      const n = Math.ceil(this.countT);
      if (n < this.lastBeep && n > 0) { this.lastBeep = n; Sfx.play('beep'); }
      if (this.countT <= 0) {
        this.state = 'play'; this.raceTime = 0; this.playT = 0;
        Sfx.play('go');
        this.active.forEach((p) => Input.requireFresh(p.idx));
      }
    }

    for (const lane of this.level.lanes) {
      lane.impl.update(lane, dt, this);
      for (const it of lane.items) {
        it.t += dt;
        if (it.hidden && (it.respawnT -= dt) <= 0) { it.hidden = false; Effects.spawn('sparkle', it.x, it.y, 10, { color: '#ffe14d' }); }
      }
    }

    if (this.state !== 'title') {
      for (const p of this.active) { p.update(dt, this); this.checkPickups(p); }
    } else {
      for (const p of this.active) p.update(dt, this);
    }

    if (this.state === 'play') {
      this.raceTime += dt; this.playT += realDt; this.updateCatchup(realDt);
      // safety net: anyone standing on the goal row wins, even if a landing event was missed
      const g = this.active.find((p) => p.row === this.level.goalRow && p.grounded && !p.satOut);
      if (g) this.onGoal(g);
    }
    if (this.state !== 'title') this.updateIdleDrop(realDt);
    if (this.state === 'won') {
      this.wonT += realDt;
      if (this.wonT < 2.5 && Math.random() < realDt * 3) Effects.spawn('confetti', this.winner.x, this.winner.groundY - 30, 20);
      Fireworks.update(realDt, canvas.clientWidth, canvas.clientHeight);
      const C = CONFIG.celebrate;
      if (C.autoRestart && this.wonT >= C.duration) { this.restart(); return; }   // same level, same players
    }
    Effects.update(dt);
  },

  updateTitle(realDt) {
    for (const p of this.players) {
      for (const ev of Input.poll(p.idx)) {
        if (ev !== 'down') continue;
        if (!p.joined) {
          p.joined = true; Sfx.play('join');
          this.placePlayers();
          Effects.spawn('sparkle', p.x, p.groundY - 16, 14, { color: p.color });
        } else { this.startCountdown(); return; }
      }
    }
    if (this.players.every((p) => p.joined)) {
      if (this.bothJoinedT < 0) this.bothJoinedT = 0.7;
      this.bothJoinedT -= realDt;
      if (this.bothJoinedT <= 0) this.startCountdown();
    }
  },

  cameraTargets() {
    if (this.state === 'title') {
      const k = 0.5 - 0.5 * Math.cos(this.realTime * 0.18 * Math.min(1, 16 / this.level.rows));
      return [{ x: World.W / 2, y: -World.T * (2 + k * (this.level.rows - 5)) }];
    }
    return this.active.filter((p) => !p.satOut).map((p) => ({ x: p.x, y: p.groundY - p.height * 0.3 }));
  },

  /* ---------------- render ---------------- */
  render() {
    this.frame++;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * DPR) || canvas.height !== Math.round(h * DPR)) {
      canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    }
    Camera.resize(w, h);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#101218'; ctx.fillRect(0, 0, w, h);

    Camera.apply(ctx, DPR);
    const view = Camera.visibleRect(), T = World.T;
    this.drawOutside(view);
    for (const lane of this.level.lanes) {
      if (lane.bottom < view.y0 || lane.top > view.y1) continue;
      lane.impl.drawBg(ctx, lane, view, this);
    }
    Effects.drawUnder(ctx);
    for (let i = this.level.lanes.length - 1; i >= 0; i--) {
      const lane = this.level.lanes[i];
      if (lane.bottom < view.y0 - T || lane.top > view.y1 + T) continue;
      lane.impl.drawEntities(ctx, lane, this);
      for (const it of lane.items) drawEntity(ctx, it, false);
    }
    this.drawCurtains(view);
    Effects.drawBehind(ctx);
    const ps = this.active.slice().sort((a, b) => (a.state === 'air') - (b.state === 'air') || a.groundY - b.groundY);
    for (const p of ps) {
      if (p.satOut) { ctx.save(); ctx.filter = `opacity(${Math.max(0, p.fadeOut / 0.6)})`; p.draw(ctx, this); ctx.restore(); }
      else p.draw(ctx, this);
    }
    Effects.draw(ctx);
    if (CONFIG.debug.showHitboxes) this.drawHitboxes();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // overlays shrink on small screens (phones); exactly 1 at desktop / iPad sizes
    const uiS = this.uiScale = Math.max(0.55, Math.min(1, w / 720, h / 420)), uw = w / uiS, uh = h / uiS;
    const ui = () => ctx.setTransform(DPR * uiS, 0, 0, DPR * uiS, 0, 0);
    if (this.state === 'title') this.drawTitle(w, h);
    else {
      this.drawTouchSplit(w, h);
      ui(); this.drawHUD(uw, uh);
      if (this.state === 'countdown') this.drawCountdown(uw, uh);
      if (this.state === 'won') { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); Fireworks.draw(ctx, w, h, Math.min(1, this.wonT / 0.6)); ui(); this.drawWin(uw, uh); }
    }
    if (this.paused) { ui(); this.drawPaused(uw, uh); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (Drama.amt > 0) { // cinematic letterbox during slow-mo
      const bh = h * 0.06 * Drama.amt;
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh);
    }
    Debug.frame();
  },

  drawOutside(view) {
    const T = World.T, top = -this.level.rows * T;
    ctx.fillStyle = '#2f5f28'; ctx.fillRect(view.x0, 0, view.x1 - view.x0, view.y1);
    ctx.fillStyle = '#234a1e'; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, top - view.y0);
    for (let x = Math.floor(view.x0 / 30) * 30; x < view.x1; x += 30) {   // hedge along the level ends
      ctx.fillStyle = '#1b3a17';
      ctx.beginPath(); ctx.arc(x + 15, top - 8 - hash2(x, 1) * 6, 16, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 15, 14 + hash2(x, 2) * 6, 16, 0, TAU); ctx.fill();
    }
  },

  drawCurtains(view) {
    const W = World.W, c = CONFIG.world.curtainTiles * World.T;
    const g1 = ctx.createLinearGradient(0, 0, -c, 0);
    g1.addColorStop(0, 'rgba(16,18,24,0.35)'); g1.addColorStop(1, 'rgba(16,18,24,1)');
    ctx.fillStyle = g1; ctx.fillRect(-c, view.y0, c, view.y1 - view.y0);
    ctx.fillStyle = '#101218'; ctx.fillRect(view.x0, view.y0, -c - view.x0, view.y1 - view.y0);
    const g2 = ctx.createLinearGradient(W, 0, W + c, 0);
    g2.addColorStop(0, 'rgba(16,18,24,0.35)'); g2.addColorStop(1, 'rgba(16,18,24,1)');
    ctx.fillStyle = g2; ctx.fillRect(W, view.y0, c, view.y1 - view.y0);
    ctx.fillStyle = '#101218'; ctx.fillRect(W + c, view.y0, view.x1 - W - c, view.y1 - view.y0);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(-1, view.y0, 1, view.y1 - view.y0); ctx.fillRect(W, view.y0, 1, view.y1 - view.y0);
  },

  drawHitboxes() {
    ctx.lineWidth = 1;
    for (const lane of this.level.lanes) {
      ctx.strokeStyle = 'rgba(255,0,0,0.8)';
      for (const v of lane.vehicles || []) { const i = CONFIG.road.vehicleInset; ctx.strokeRect(v.x - v.w / 2 + i, lane.top + 4, v.w - 2 * i, World.T - 8); }
      ctx.strokeStyle = 'rgba(0,255,0,0.8)';
      for (const l of lane.logs || []) {
        ctx.strokeRect(l.x - l.w / 2, lane.top + 6, l.w, World.T - 12);
        ctx.strokeStyle = 'rgba(255,255,0,0.6)';
        ctx.strokeRect(l.x - l.w / 2 + CONFIG.river.edgeSafe, lane.top + 10, l.w - 2 * CONFIG.river.edgeSafe, World.T - 20);
        ctx.strokeStyle = 'rgba(0,255,0,0.8)';
      }
    }
    for (const p of this.active) {
      ctx.strokeStyle = p.color; const hw = CONFIG.player.hitHalfWidth;
      ctx.strokeRect(p.x - hw, p.groundY - 6, hw * 2, 8);
    }
  },

  /* ---------------- HUD & overlays (screen space, CSS px) ---------------- */
  text(str, x, y, size, color, align = 'center', weight = 900, outline = 4) {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (outline) { ctx.lineWidth = outline; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  },

  drawHUD(w, h) {
    const act = this.active;
    for (const p of act) {
      const pw = 190, ph = 78, x = p.idx === 0 ? 14 : w - pw - 14, y = 14;
      ctx.fillStyle = 'rgba(10,12,18,0.72)'; rrect(ctx, x, y, pw, ph, 10); ctx.fill();
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.stroke();
      this.text(p.name, x + 12, y + 18, 20, p.color, 'left');
      this.text(`[${CONFIG.player.keys[p.idx]}]`, x + 50, y + 18, 11, 'rgba(255,255,255,0.6)', 'left', 700, 0);
      this.text(`DEATHS ${p.deaths}`, x + pw - 12, y + 18, 14, '#fff', 'right', 800, 3);
      // progress
      const prog = (p.state === 'air' ? p.toRow : p.row) / this.level.goalRow;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 12, y + 34, pw - 24, 4);
      ctx.fillStyle = p.color; ctx.fillRect(x + 12, y + 34, (pw - 24) * prog, 4);
      // power-up status
      if (p.power) {
        const k = p.power.time / p.power.max;
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + 20, y + 56, 7, 0, TAU); ctx.fill();
        this.text(`TRIPLE x${p.power.uses}`, x + 32, y + 56, 13, '#ffe14d', 'left', 900, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 118, y + 52, 60, 8);
        ctx.fillStyle = k < 0.3 && Math.floor(this.realTime * 6) % 2 ? '#ff5a3a' : '#ffd23f'; ctx.fillRect(x + 118, y + 52, 60 * k, 8);
      } else if (p.streak >= 2) {
        this.text(`STREAK x${p.streak + 1}`, x + 12, y + 56, 13, p.color, 'left', 900, 3);
      } else {
        this.text('no power-up', x + 12, y + 56, 12, 'rgba(255,255,255,0.4)', 'left', 700, 0);
      }
    }
    // players not in this round: how to get into the next one
    const uiS = this.uiScale || 1;
    this.joinHits = [];
    for (const p of this.players) {
      if (p.joined) continue;
      const x = p.idx === 0 ? 14 : w - 204, y = 14;
      ctx.fillStyle = 'rgba(10,12,18,0.55)'; rrect(ctx, x, y, 190, 26, 8); ctx.fill();
      // touch: this note is the player's join button (screen px; generous tap area)
      this.joinHits.push({ idx: p.idx, x0: (x - 14) * uiS, x1: (x + 204) * uiS, y0: 0, y1: Math.max(56, (y + 40) * uiS) });
      const how = Input.isTouch ? `${p.name}: tap HERE to join next round`
        : `${p.name}: press ${CONFIG.player.keys[p.idx]} to join next round`;
      this.text(p.joinNext ? `${p.name} joins next round` : how,
        x + 95, y + 13, 11, p.joinNext ? p.color : 'rgba(255,255,255,0.7)', 'center', 800, 0);
    }
    // off-screen arrows for trailing players
    for (const p of act) {
      if (!p.offscreen || this.state !== 'play') continue;
      const [sx] = Camera.worldToScreen(p.x, p.groundY);
      const m = CONFIG.catchup.arrowMargin, x = Math.max(m, Math.min(w - m, sx)), y = h - m;
      const bob = Math.sin(this.realTime * 8) * 3;
      ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 14, y - 8 + bob); ctx.lineTo(x + 14, y - 8 + bob); ctx.lineTo(x, y + 10 + bob); ctx.closePath();
      ctx.stroke(); ctx.fill();
      const leader = act.reduce((a, b) => (b.progressRow > a.progressRow ? b : a));
      const behind = leader.progressRow - p.progressRow;
      this.text(`${p.name}  ${behind} row${behind === 1 ? '' : 's'} behind`, x, y - 24, 13, p.color, 'center', 900, 3);
      if (CONFIG.catchup.enabled && p.offscreenT > 0.3) {
        const left = Math.max(0, CONFIG.catchup.delay - p.offscreenT);
        this.text(`catch-up in ${left.toFixed(1)}`, x, y - 40, 11, '#fff', 'center', 700, 3);
      }
    }
    // timer + level name
    const t = this.raceTime;
    this.text(`${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`, w / 2, 26, 22, '#fff');
    this.text(this.level.name.toUpperCase(), w / 2, 48, 11, 'rgba(255,255,255,0.6)', 'center', 800, 3);
    if (Sfx.muted) this.text(Input.isTouch ? 'MUTED' : 'MUTED (M)', w / 2, 66, 11, '#ff9b9b', 'center', 800, 3);
    if (this.state === 'play') {   // v3: one-time hints the first time anyone reaches a lava chute / open straight
      this.hintSeen = this.hintSeen || {};
      for (const p of this.active) {
        const l = this.level.lanes[p.row], k = l && (l.type === 'chute' ? 'chute' : l.run ? 'run' : null);
        if (k && !this.hintSeen[k]) { this.hintSeen[k] = true; this.ctxHint = { k, t0: this.realTime }; }
      }
    }
    const HINTS = { chute: 'LAVA CHUTE  ·  ride the rocks  ·  TAP near the end for a BIG LAUNCH (or just let it launch you)',
      run: 'OPEN STRAIGHT  ·  you run on your own  ·  TAP = long jump over fallen dominoes  ·  bumps only slow you' };
    const ch = this.ctxHint, chA = ch ? this.realTime - ch.t0 : 99;
    if (this.state === 'play' && chA < 4) {
      ctx.globalAlpha = Math.min(1, (4 - chA) / 1);
      this.text(HINTS[ch.k], w / 2, h - 26, 14, '#ffe14d', 'center', 800, 4);
      ctx.globalAlpha = 1;
    } else if (this.state === 'play' && this.playT < 9) {
      ctx.globalAlpha = Math.min(1, (9 - this.playT) / 1.5);
      const hint = !Input.isTouch ? 'TAP = hop  ·  HOLD = charged jump  ·  hold too long and it BLOWS  ·  tap fast for a streak'
        : this.touchSplit ? 'LEFT side = P1  ·  RIGHT side = P2  ·  tap = hop  ·  hold = charged jump'
        : 'TAP anywhere = hop  ·  HOLD = charged jump  ·  hold too long and it BLOWS';
      this.text(hint, w / 2, h - 26, 14, '#fff', 'center', 800, 4);
      ctx.globalAlpha = 1;
    }
  },

  drawTitle(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(8,10,16,0.85)'); g.addColorStop(0.6, 'rgba(8,10,16,0.55)'); g.addColorStop(1, 'rgba(8,10,16,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const s = Math.min(1.25, Math.max(0.6, Math.min(w / 900, h / 650)));
    const cy = h * 0.19;
    ctx.save(); ctx.translate(w / 2, cy); ctx.scale(s, s);
    const bob = Math.sin(this.realTime * 3) * 4;
    const tg = ctx.createLinearGradient(0, -40, 0, 40);
    tg.addColorStop(0, '#fff3b0'); tg.addColorStop(0.45, '#ffb02e'); tg.addColorStop(1, '#e8401c');
    ctx.font = `900 84px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 12; ctx.strokeStyle = '#1a0b04'; ctx.lineJoin = 'round';
    ctx.strokeText('CHARGE HOP', 0, bob); ctx.fillStyle = tg; ctx.fillText('CHARGE HOP', 0, bob);
    this.text('one button. charge it. don\'t blow it.', 0, 62, 18, '#ffe9c9', 'center', 700, 4);
    ctx.restore();

    // level selector
    const L = this.level, ly0 = h * 0.335, touch = Input.isTouch;
    const lvlLabel = `◀   LEVEL ${this.levelIndex + 1}: ${L.name.toUpperCase()}   ▶`, lsz = 19 * s + 3;
    this.text(lvlLabel, w / 2, ly0, lsz, '#ffffff', 'center', 900, 4);
    this.text(`${L.rows} rows${L.def.blurb ? '  ·  ' + L.def.blurb : ''}   —   ${touch ? 'tap ◀ ▶ to change' : `← → or 1-${LEVELS.length} to change`}`, w / 2, ly0 + 22 * s + 2, 11 * s + 2, 'rgba(255,255,255,0.7)', 'center', 700, 3);
    // touch: tap areas on the title (checked by touchRoute before a tap counts as a join)
    ctx.font = `900 ${lsz}px ${FONT}`;
    const lw = ctx.measureText(lvlLabel).width, ah = Math.max(44, lsz * 2.4);
    this.titleHits = [
      { x0: w / 2 - lw / 2 - 30, x1: w / 2 - lw / 2 + lsz * 2, y0: ly0 - ah / 2, y1: ly0 + ah / 2, fn: () => { this.selectLevel(this.levelIndex - 1); } },
      { x0: w / 2 + lw / 2 - lsz * 2, x1: w / 2 + lw / 2 + 30, y0: ly0 - ah / 2, y1: ly0 + ah / 2, fn: () => { this.selectLevel(this.levelIndex + 1); } }
    ];

    // join cards
    const cw = 270 * s, ch = 120 * s, gap = 30 * s, y0 = h * 0.45;
    if (touch) {   // touch-friendly join hint
      const nj = this.players.filter((p) => p.joined).length;
      const msg = nj === 0 ? 'Tap or hold anywhere on your side  ·  LEFT side = P1  ·  RIGHT side = P2'
        : nj === 1 ? 'Tap your side again to start solo  ·  or a 2nd player taps the other side' : 'Get ready!';
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.realTime * 4);
      this.text(msg, w / 2, y0 - 16 * s - 4, 13 * s + 3, '#ffe14d', 'center', 900, 4);
      ctx.globalAlpha = 1;
    }
    this.players.forEach((p, i) => {
      const x = w / 2 + (i === 0 ? -cw - gap / 2 : gap / 2);
      ctx.fillStyle = p.joined ? 'rgba(20,24,34,0.9)' : 'rgba(20,24,34,0.6)'; rrect(ctx, x, y0, cw, ch, 14 * s); ctx.fill();
      ctx.strokeStyle = p.color; ctx.lineWidth = p.joined ? 4 : 2; ctx.stroke();
      // a little stickman preview in the card
      ctx.save(); ctx.translate(x + (i === 1 && Characters.robots ? 30 : 42) * s, y0 + ch * 0.78); ctx.scale(1.6 * s, 1.6 * s);
      const pose = p.joined
        ? { crouch: 0.05, armL: 2.6 + Math.sin(this.realTime * 10) * 0.3, armR: 2.6 - Math.sin(this.realTime * 10) * 0.3, legSpread: 5, face: 'happy' }
        : { crouch: 0.05 + Math.sin(this.realTime * 3) * 0.03, armL: 0.3, armR: 0.3, legSpread: 5, face: 'normal' };
      Sprites.draw(ctx, ['p' + (i + 1), 'player'], p.joined ? 'win' : 'idle', this.realTime, 0, 0, { pose, color: p.color, dark: p.dark, player: p });
      ctx.restore();
      this.text(p.name, x + 80 * s, y0 + 32 * s, 30 * s, p.color, 'left');
      if (p.joined) {
        this.text('READY!', x + 80 * s, y0 + 66 * s, 20 * s, '#fff', 'left');
        const other = this.players[1 - i];
        if (!other.joined) this.text(touch ? 'tap again = start solo' : `${CONFIG.player.keys[i]} again = start solo`, x + 80 * s, y0 + 92 * s, 12 * s, 'rgba(255,255,255,0.75)', 'left', 700, 3);
      } else {
        const blink = Math.floor(this.realTime * 2.2) % 2 ? 1 : 0.55;
        ctx.globalAlpha = blink;
        this.text(touch ? `tap ${i === 0 ? 'LEFT' : 'RIGHT'} side` : `press ${CONFIG.player.keys[i]}`, x + 80 * s, y0 + 66 * s, 18 * s, '#fff', 'left');
        this.text('to join', x + 80 * s, y0 + 90 * s, 14 * s, 'rgba(255,255,255,0.8)', 'left', 700, 3);
        ctx.globalAlpha = 1;
      }
    });

    const lines = [
      ['TAP', 'hop forward 1 row'],
      ['HOLD', `charge → release for a 2-row jump (3 rows with the glowing ${Characters.robots ? 'battery' : 'orb'})`],
      ['DON\'T', 'hold too long — you\'ll overload, get flung 1 row and see stars'],
      ['RHYTHM', 'quick repeated taps build a speed streak'],
      ['LOGS', 'bump into each other — stay off the edges!']
    ];
    const ly = y0 + ch + 34 * s;
    lines.forEach(([a, b], i) => {
      this.text(a, w / 2 - 170 * s, ly + i * 24 * s, 14 * s, '#ffb02e', 'right', 900, 3);
      this.text(b, w / 2 - 158 * s, ly + i * 24 * s, 14 * s, '#e8e8f0', 'left', 700, 3);
    });
    const chLabel = touch ? `characters: ${Characters.robots ? 'ROBOTS' : 'STICKMEN'}  (tap to switch)` : `C characters: ${Characters.robots ? 'ROBOTS' : 'STICKMEN'}`;
    this.text(chLabel, w / 2, h - 46, 12 * s + 2, '#ffe14d', 'center', 800, 3);
    if (touch) {
      ctx.font = `800 ${12 * s + 2}px ${FONT}`;
      const cwid = ctx.measureText(chLabel).width;
      this.titleHits.push({ x0: w / 2 - cwid / 2 - 16, x1: w / 2 + cwid / 2 + 16, y0: h - 46 - 22, y1: h - 46 + 16, fn: () => { Characters.toggle(); Sfx.play('beep'); } });
    }
    this.text(touch ? 'first to the GOAL wins  ·  ⏸ button (top) = pause / restart / level select'
      : 'first to the GOAL wins  ·  M mute  ·  P pause  ·  R restart  ·  ESC title  ·  ` tuning panel',
      w / 2, h - 24, 12 * s + 2, 'rgba(255,255,255,0.6)', 'center', 700, 3);
  },

  /** touch, 2 players in the round: LEFT half = P1, RIGHT half = P2. Otherwise one player = the whole screen. */
  get touchSplit() {
    if (this.state === 'title') return true;
    return this.players.filter((p) => p.joined && !p.satOut).length > 1;
  },
  /** where a touch at (x, y) goes: 0 = P1 (Space), 1 = P2 (Enter), -1 = consumed / ignored */
  touchRoute(x, y, w, h) {
    if (this.paused) return -1;
    if (this.state === 'title') {
      for (const r of this.titleHits || []) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) { r.fn(); return -1; }
      return x < w / 2 ? 0 : 1;
    }
    // a player sitting out taps their "tap HERE to join" note (same as pressing their key: joins next round)
    for (const r of this.joinHits || []) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && !this.players[r.idx].joined) return r.idx;
    if (this.touchSplit) return x < w / 2 ? 0 : 1;
    const solo = this.players.find((p) => p.joined && !p.satOut);
    return solo ? solo.idx : 0;                       // one player: anywhere on the screen
  },
  /** faint split line + side labels (touch devices, 2 players playing) */
  drawTouchSplit(w, h) {
    if (!Input.isTouch || (this.state !== 'play' && this.state !== 'countdown') || !this.touchSplit) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.setLineDash([10, 12]);
    ctx.beginPath(); ctx.moveTo(w / 2, 96 * (this.uiScale || 1)); ctx.lineTo(w / 2, h - 50); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 0.45;
    const [p1, p2] = this.players, fs = Math.max(12, 18 * (this.uiScale || 1));
    this.text(`◀ ${p1.name}`, 16, h - 60, fs, p1.color, 'left', 900, 3);
    this.text(`${p2.name} ▶`, w - 16, h - 60, fs, p2.color, 'right', 900, 3);
    ctx.restore();
  },
  togglePause() {
    if (this.state === 'title') return;
    this.paused = !this.paused;
    if (this.paused) this.players.forEach((p) => Sfx.stopHum(p.idx));
  },

  drawCountdown(w, h) {
    const n = Math.ceil(this.countT), frac = this.countT - Math.floor(this.countT);
    const s = 1 + frac * 0.6;
    ctx.save(); ctx.translate(w / 2, h * 0.42); ctx.scale(s, s);
    ctx.globalAlpha = Math.min(1, frac * 3 + 0.2);
    this.text(n > 0 ? String(n) : 'GO!', 0, 0, 110, n > 0 ? '#ffffff' : '#7cff6b', 'center', 900, 10);
    ctx.restore(); ctx.globalAlpha = 1;
  },

  drawWin(w, h) {
    const p = this.winner, k = Math.min(1, this.wonT / 0.35);
    const solo = this.active.length === 1;
    const bh = 150;
    ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`; ctx.fillRect(0, h * 0.6 - bh / 2, w, bh);
    ctx.save(); ctx.translate(w / 2, h * 0.6 - 18); const s = 0.5 + 0.5 * k + Math.sin(this.realTime * 5) * 0.02; ctx.scale(s, s);
    this.text(solo ? 'FINISHED!' : `${p.name} WINS!`, 0, 0, 72, p.color, 'center', 900, 10);
    ctx.restore();
    const t = this.raceTime;
    const summary = this.active.map((q) => `${q.name}: ${q.deaths} death${q.deaths === 1 ? '' : 's'}`).join('    ');
    this.text(`${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}    ${summary}`, w / 2, h * 0.6 + 34, 18, '#fff', 'center', 800, 4);
    if (this.wonT > 1) {
      const C = CONFIG.celebrate, left = Math.max(0, Math.ceil(C.duration - this.wonT));
      this.text(Input.isTouch ? (C.autoRestart ? `next round in ${left}   ·   ⏸ = menu` : '⏸ = menu (restart / title)')
        : C.autoRestart ? `next round in ${left}   ·   R = go now   ·   ESC = title` : 'R = play again   ·   ESC = title',
        w / 2, h * 0.6 + 60, 15, 'rgba(255,255,255,0.8)', 'center', 700, 3);
    }
  },

  drawPaused(w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h);
    this.text('PAUSED', w / 2, h / 2 - 10, 64, '#fff', 'center', 900, 8);
    if (!Input.isTouch) this.text('P to resume  ·  R restart  ·  ESC title', w / 2, h / 2 + 40, 16, 'rgba(255,255,255,0.8)', 'center', 700, 3);
  },

  /* ---------------- debug / test helpers ---------------- */
  debug: {
    clearTraffic() { Game.level.lanes.forEach((l) => { if (l.vehicles) { l.vehicles = []; l.spawnPaused = true; } }); },
    restoreTraffic() { Game.level.lanes.forEach((l) => { if (l.vehicles) l.spawnPaused = false; }); },
    teleport(i, row, x) {
      const p = Game.players[i];
      p.state = 'idle'; p.row = row; p.x = x; p.ride = null; p.vx = 0; p.teeterT = 0; p.landT = 99;
      p.lastSafe = Game.level.lanes[row].impl.respawn ? { row, x } : p.lastSafe;
    },
    placeOnLog(i, row, logIndex = 0, offset = 0) {
      const p = Game.players[i], lane = Game.level.lanes[row], log = lane.logs[logIndex];
      p.state = 'idle'; p.row = row; p.ride = log; p.rideOffset = offset; p.riderVx = log.vx; p.x = log.x + offset; p.teeterT = 0; p.landT = 99;
      return log;
    }
  }
};

/* ---------------- hotkeys ---------------- */
Input.onAnyKey(() => Sfx.unlock());
Input.onKey('KeyM', () => Sfx.toggleMute());
Input.onKey('KeyP', () => Game.togglePause());
Input.onKey('KeyR', () => Game.restart());
Input.onKey('KeyC', () => { if (Game.state === 'title') { Characters.toggle(); Sfx.play('beep'); } });
Input.onKey('Escape', () => Game.toTitle());
Input.onKey('Backquote', () => Debug.toggle());
Input.onKey('ArrowLeft', () => Game.selectLevel(Game.levelIndex - 1));
Input.onKey('ArrowRight', () => Game.selectLevel(Game.levelIndex + 1));
for (let i = 1; i <= 9; i++) Input.onKey('Digit' + i, () => Game.selectLevel(i - 1));

/* ---------------- fixed-timestep loop ---------------- */
const Loop = { last: performance.now(), acc: 0, fps: 60, frames: 0, fpsT: 0 };
function step(F) {
  Drama.update(F);
  Game.timeScale = Drama.timeScale * CONFIG.debug.timeScale;
  Game.update(F * Game.timeScale, F);
  Camera.focusAmt = Drama.amt;
  Camera.focusPos = Drama.focus ? { x: Drama.focus.x, y: Drama.focus.groundY - Drama.focus.height } : null;
  Camera.update(F, Game.cameraTargets());
}
function frame(now) {
  const realDt = Math.min((now - Loop.last) / 1000, CONFIG.sim.maxFrameTime);
  Loop.last = now;
  Loop.frames++; Loop.fpsT += realDt;
  if (Loop.fpsT >= 0.5) { Loop.fps = Loop.frames / Loop.fpsT; Loop.frames = 0; Loop.fpsT = 0; }
  if (!Game.paused) {
    const F = CONFIG.sim.fixedDt;
    Loop.acc += realDt;
    let n = 0;
    while (Loop.acc >= F && n++ < 60) { step(F); Loop.acc -= F; }
  }
  Game.render();
  requestAnimationFrame(frame);
}

Game.init();
requestAnimationFrame(frame);
window.ChargeHop = { Game, CONFIG, Camera, Drama, Input, Sprites, Effects, World, Loop, Sfx };
