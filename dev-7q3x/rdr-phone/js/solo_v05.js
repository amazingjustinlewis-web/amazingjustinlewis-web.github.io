/* RED DEER RICH - solo phone mode v0.4 (dev). v0.4: everything scales from the real window size (window.innerWidth/innerHeight), so a phone
   in desktop-site mode or with a wide layout viewport gets the same full-screen setup and in-game UI as a normal phone; the setup column fills
   ~95% of the width and the height with no dead gap; rename yourself with the small pencil beside the big name on the front card (prefilled
   from your Zero to Phi profile name on this site when there is one).
   v0.3: v0.3: pop-up cards are big in the normal camera (about 88% of the screen width, text and buttons
   scaled up, centred) and shrink back to their v0.2 size in close follow, gliding between the two; close follow gets edge radar: player-colour
   triangles pointing at offscreen players (smaller and fainter when far) plus faint pips for offscreen owned deeds (green = yours, thin red = rent you'd pay).
   v0.2: v0.2: full-height setup with swipeable character stat cards (golden-spiral meters),
   runners hop and land hard on their final space (no more overshoot / back-up), a heavy step... step... STEP march into the Snowbank,
   and a cosmetic head smack (tap as you run past someone; the victim's head boings like a doorstop spring). Saves share v0.1's slot.
   v0.1 notes: One phone, no TV, 1-3 computer opponents.
   Reuses the real rules engine (js/game.js) and AI (js/ai.js) untouched; this file is only the phone UI:
   full-screen map camera, walking people, bottom dice, lift-up drawer, pop-ups, thin standings bar, tap-a-player deals + chat.
   Replay/PiP-ready: every engine event is recorded with its game time in REC (see RDRSolo.replay()), and the whole scene
   draws through drawScene(ctx, cam, w, h) so a second camera (picture-in-picture, replays) can reuse it. */
(function () {
  'use strict';
  const C = window.RDR_CONFIG, B = window.RDR_BOARD, S = B.SPACES, Game = window.RDRGame, AI = window.RDRAI, SFX = window.RDRSfx, PPL = window.RDRPeople;
  const VER = 'solo v0.5', SAVE_KEY = 'rdr_solo_save_v01', PREF_KEY = 'rdr_solo_prefs_v01';   // same save + prefs keys as v0.1 on purpose: a v0.1 game resumes here
  const Q = new URLSearchParams(location.search), BASE_SPEED = Math.max(1, +Q.get('speed') || 1);
  const $ = (id) => document.getElementById(id);
  const money = Game.money, esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const charById = Game.charById;
  // v0.2 character cards. 5 = standard rules (the engine treats everyone the same); a perk pushes the stat it really changes.
  // Every number maps to something in js/game.js (perks) or to a cosmetic effect in this file (labelled cosmetic). 'soon' perks do nothing yet.
  const COMMON = [
    { k: 'cash', n: 'Cash Flow', d: 'bonus money from the bank' },
    { k: 'tough', n: 'Toughness', d: 'shrugs off bad breaks' },
    { k: 'buy', n: 'Buying Power', d: 'cheaper deeds' },
    { k: 'reach', n: 'Catch Window', d: 'PAY UP catch time (race on)' }
  ];
  const CSTATS = {
    justin: { custom: [{ n: 'Count-In', v: 0, d: 'one re-roll a game', soon: true }, { n: 'Smack Power', v: 9, d: 'cosmetic: biggest head boing', cos: 'smack' }] },
    mike:   { reach: 7, custom: [{ n: 'Loud Amp', v: 6, d: 'PAY UP window +1 s' }] },
    doug:   { tough: 7, custom: [{ n: 'Steady Groove', v: 7, d: 'Randomness costs max $100' }] },
    drew:   { custom: [{ n: 'High Kick', v: 0, d: 'roll 3 keep 2', soon: true }, { n: 'Hop Height', v: 10, d: 'cosmetic: biggest landing hop', cos: 'hop' }] },
    grace:  { cash: 6, custom: [{ n: 'Blessed Finds', v: 5, d: 'paying Finds +$25' }] },
    walt:   { custom: [{ n: 'Knows Every Shortcut', v: 0, d: 'nudge 1 space a lap', soon: true }] },
    dez:    { tough: 7, custom: [{ n: 'Iron Neck', v: 6, d: 'skips his first WHITEOUT' }] },
    lenore: { tough: 6, custom: [{ n: 'Unbothered', v: 5, d: 'ignores 1st lose-a-turn' }] },
    priya:  { buy: 8, custom: [{ n: 'Pre-Approved', v: 7, d: '1st deed each lap 10% off' }] },
    minh:   { cash: 7, custom: [{ n: 'Regulars', v: 6, d: '+$10 on every rent paid to him' }] },
    cody:   { cash: 7, custom: [{ n: 'Two-and-Two', v: 7, d: 'every 2nd Halfway +$100' }] }
  };
  function statsOf(id) { const x = CSTATS[id] || { custom: [] }, o = { custom: x.custom || [] }; COMMON.forEach((c) => { o[c.k] = x[c.k] != null ? x[c.k] : 5; }); return o; }
  function cosOf(charId, k) { const c = (statsOf(charId).custom || []).find((q) => q.cos === k); return c ? c.v : 5; }   // cosmetic stat, 5 = normal
  const sfx = (n) => { try { if (!prefs.mute && SFX) SFX.play(n); } catch (e) {} };
  const vib = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  // ------------------------------------------------------------------ prefs
  const DEF = { name: '', look: PPL.profile() || PPL.clean({ pants: '#2b3550', shoes: '#ffffff', hat: '#ff5d73', hatStyle: 'cap', skin: '#f1c7a1' }), charId: 'justin', opp: 2, level: 'normal', len: 'regular', timer: 0, payup: 0, trade: 'open',
    covertN: 3, mute: false, fastAI: true, shake: true, camMode: 'mild' };
  let prefs = Object.assign({}, DEF);
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} };

  // ------------------------------------------------------------------ state
  let g = null, meId = 0, looks = {}, REC = null;
  let frozen = false, clock0 = performance.now(), clockAdd = 0, frozenAt = 0;
  const nowMs = () => (frozen ? frozenAt : performance.now() - clock0 + clockAdd);
  function freeze(on) { if (on === frozen) return; if (on) { frozenAt = nowMs(); frozen = true; } else { clockAdd = frozenAt; clock0 = performance.now(); frozen = false; } }
  const me = () => (g ? g.byId(meId) : null);
  const myTurn = () => !!(g && g.turn && g.turn.pid === meId && g.phase === 'play');
  const ui = { drawer: false, tab: 'deeds', panel: false, rules: false, skipAuction: -1, snowAsked: -1, cardKey: '', cardDecided: '', info: null, overSeen: false,
    trade: { to: 0, give: [], get: [], gCash: 0, tCash: 0, msg: '' }, bubble: null, chatMode: false, popKey: '', drawerKey: '', topKey: '', lastDice: 0 };

  // ------------------------------------------------------------------ board geometry (world units)
  const CELL = 100, CORNER = 150, BW = CORNER * 2 + CELL * 9;
  function rectOf(i) {
    if (i === 0) return { x: BW - CORNER, y: BW - CORNER, w: CORNER, h: CORNER, side: 'c' };
    if (i < 10) return { x: BW - CORNER - i * CELL, y: BW - CORNER, w: CELL, h: CORNER, side: 'b' };
    if (i === 10) return { x: 0, y: BW - CORNER, w: CORNER, h: CORNER, side: 'c' };
    if (i < 20) return { x: 0, y: BW - CORNER - (i - 10) * CELL, w: CORNER, h: CELL, side: 'l' };
    if (i === 20) return { x: 0, y: 0, w: CORNER, h: CORNER, side: 'c' };
    if (i < 30) return { x: CORNER + (i - 21) * CELL, y: 0, w: CELL, h: CORNER, side: 't' };
    if (i === 30) return { x: BW - CORNER, y: 0, w: CORNER, h: CORNER, side: 'c' };
    return { x: BW - CORNER, y: CORNER + (i - 31) * CELL, w: CORNER, h: CELL, side: 'r' };
  }
  const RECTS = S.map((_, i) => rectOf(i));
  const BAND = 26;
  function bandRect(r) {      // colour band on the inner edge
    if (r.side === 'b') return { x: r.x, y: r.y, w: r.w, h: BAND };
    if (r.side === 't') return { x: r.x, y: r.y + r.h - BAND, w: r.w, h: BAND };
    if (r.side === 'l') return { x: r.x + r.w - BAND, y: r.y, w: BAND, h: r.h };
    if (r.side === 'r') return { x: r.x, y: r.y, w: BAND, h: r.h };
    return null;
  }
  // where people stand on a space (feet point), slot k of n
  const SLOTS = { 2: [[-0.22, 0], [0.22, 0]], 3: [[-0.26, -8], [0.26, -8], [0, 16]], 4: [[-0.24, -12], [0.24, -12], [-0.24, 14], [0.24, 14]] };
  function spot(i, k, n) {
    const r = RECTS[i]; let cx = r.x + r.w / 2, cy = r.y + r.h * (r.side === 'l' || r.side === 'r' ? 0.56 : r.side === 'c' ? 0.7 : 0.62);
    if (r.side === 't') cy = r.y + r.h * 0.55;
    if (n > 1) { const L = SLOTS[Math.min(4, n)], o = L[k % L.length]; cx += o[0] * r.w; cy += o[1] + (k >= 4 ? 10 : 0); }
    return { x: cx, y: cy };
  }
  const ringDist = (a, b) => { const d = Math.abs(a - b) % 40; return Math.min(d, 40 - d); };
  const groupColor = (sp) => (S[sp].group && B.GROUPS[S[sp].group] ? B.GROUPS[S[sp].group].color : '#777');

  // ------------------------------------------------------------------ people (visual)
  const vis = {};          // pid -> { x, y, face, walk: {path, from, start, durs}, phase }
  const bubbles = {};      // pid -> { txt, until }
  function visOf(p) { return vis[p.id] || (vis[p.id] = Object.assign({ face: -1, walk: null, phase: -1, hop: -1, lift: 0, hold: null, march: null, impact: 0, impactAmp: 0, swing: null, bonk: null }, spot(p.pos, 0, 1))); }
  // v0.2: the engine only moves p.pos after the walk + a short pause, so a runner that finished its walk used to drift back to the old
  // space and then forward again. The finished runner now 'holds' its landing space until the engine catches up.
  function posOf(p) {
    const v = vis[p.id];
    if (v && v.hold) { if (g && p.pos === v.hold.from && g.now < v.hold.until) return v.hold.sp; v.hold = null; }
    return p.pos;
  }
  const busy = (v) => !!(v && (v.walk || v.march));
  function endSpotFor(p, sp) {      // the exact slot p will stand in on space sp (so the landing needs no slide afterwards)
    const ids = g.players.filter((q) => !q.bankrupt && (q.id === p.id || (!busy(vis[q.id]) && posOf(q) === sp))).map((q) => q.id);
    return spot(sp, Math.max(0, ids.indexOf(p.id)), ids.length);
  }
  const dust = [], pows = [], ghosts = [];
  let shake = { at: 0, amp: 0 }, smackTap = -1e9;
  function nudge(amp) { if (amp > shake.amp * Math.max(0, 1 - (performance.now() - shake.at) / 260)) shake = { at: performance.now(), amp: amp }; }
  function puff(x, y, n, big) { const t = performance.now(); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * 0.5; dust.push({ x: x, y: y, vx: Math.cos(a) * (big ? 95 : 70), vy: Math.sin(a) * 22 - 6, born: t, life: 420 + Math.random() * 200, r: (big ? 9 : 7) + Math.random() * 4 }); } if (dust.length > 80) dust.splice(0, dust.length - 80); }
  function land(p, v, heavy) {
    v.impact = performance.now(); v.impactAmp = heavy ? 0.5 : 0.36;
    puff(v.x, v.y, heavy ? 10 : 7, heavy);
    const watch = p.id === meId || (g.cur() && g.cur().id === p.id);
    if (watch) nudge(heavy ? 9 : 5);
    if (p.id === meId || !prefs.fastAI) lsfx(heavy ? 'thudBig' : 'thud');
    if (p.id === meId) vib(heavy ? 45 : 22);
  }
  function slotMap() {
    const m = {}, out = {};
    g.players.forEach((p) => { if (p.bankrupt) return; const v = visOf(p); if (busy(v)) return; const ps = posOf(p); (m[ps] = m[ps] || []).push(p.id); });
    Object.keys(m).forEach((sp) => m[sp].forEach((pid, k) => { out[pid] = spot(+sp, k, m[sp].length); }));
    return out;
  }
  // where a runner is at game time t of its walk (also used to work out ahead of time when it passes each standing player)
  function walkPos(p, w, t) {
    const L = w.path.length; let t0 = w.start, k = 0;
    while (k < L - 1 && t >= t0 + w.durs[k]) { t0 += w.durs[k]; k++; }
    const to = w.path[k], f = Math.max(0, Math.min(1, (t - t0) / w.durs[k])), a = k === 0 ? { x: w.x0, y: w.y0 } : spot(w.path[k - 1], 0, 1);
    if (k === L - 1) {   // the final space: a hop that lands hard, right in the slot
      const b = endSpotFor(p, to), fe = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      return { x: a.x + (b.x - a.x) * fe, y: a.y + (b.y - a.y) * fe, lift: Math.sin(Math.PI * Math.min(1, f * 1.04)) * w.hopH, phase: 0.22, face: Math.abs(b.x - a.x) > 1 ? (b.x > a.x ? 1 : -1) : 0 };
    }
    const b = spot(to, 0, 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, lift: 0, phase: ((k + f) * 2) % 1, face: Math.abs(b.x - a.x) > 1 ? (b.x > a.x ? 1 : -1) : 0 };
  }
  function updatePeople(dtS) {
    const slots = slotMap(), now = g.now;
    g.players.forEach((p) => {
      const v = visOf(p);
      if (v.march) { stepMarch(p, v); return; }
      if (v.walk) {
        const w = v.walk, L = w.path.length; let t0 = w.start, k = 0;
        while (k < L && now >= t0 + w.durs[k]) { t0 += w.durs[k]; k++; }
        if (k >= L) {          // touchdown: already standing in the exact slot, so nothing slides back
          v.walk = null; v.phase = -1; v.lift = 0; const last = w.path[L - 1], e = endSpotFor(p, last); v.x = e.x; v.y = e.y;
          v.hold = { sp: last, from: w.from, until: now + 5000 };
          land(p, v, w.dread > 0);
        } else {
          const q = walkPos(p, w, now); v.x = q.x; v.y = q.y; v.lift = q.lift; v.phase = q.phase; if (q.face) v.face = q.face;
          if (k !== v.hop) { v.hop = k; if (p.id === meId || !prefs.fastAI) sfx('step'); }
          firePasses(p, w, now);
        }
        return;
      }
      const tg = slots[p.id] || spot(posOf(p), 0, 1), dx = tg.x - v.x, dy = tg.y - v.y, d = Math.hypot(dx, dy);
      if (d > 2) { const sp = Math.max(260, d * 2.5) * dtS; if (d <= sp) { v.x = tg.x; v.y = tg.y; } else { v.x += dx / d * sp; v.y += dy / d * sp; } v.phase = (v.phase < 0 ? 0 : v.phase + dtS * 2.2) % 1; if (Math.abs(dx) > 2) v.face = dx > 0 ? 1 : -1; }
      else { v.x = tg.x; v.y = tg.y; v.phase = -1; }
    });
  }
  // ---- head smack (cosmetic: no money moves). v0.3: when a walk starts we work out the exact moment the runner passes each standing player.
  // A tap anywhere in the generous window around that moment = a normal smack (it lands as you pass). A tap inside the tight sweet spot
  // (+/- 60 ms of the pass, a closing ring shows it) = PERFECT: SMACK - five blurred slaps - SMACK. AI runners smack sometimes, PERFECT ~3% of those.
  const SMACK_R = 90, SMACK_PRE = 450, SMACK_POST = 350, SWEET = 60;
  function planPasses(p, w) {
    const out = [], L = w.path.length, end = w.start + w.durs.reduce((x, y) => x + y, 0), t1 = w.start + Math.min(w.durs[0] * 0.5, 120);
    g.players.forEach((q) => {
      if (q.id === p.id || q.bankrupt) return; const vq = visOf(q); if (busy(vq)) return;
      let best = 1e9, tc = 0; for (let t = t1; t <= end; t += 8) { const ps = walkPos(p, w, t), d = Math.hypot(ps.x - vq.x, ps.y - vq.y); if (d < best) { best = d; tc = t; } }
      if (best < SMACK_R) out.push({ pid: q.id, tc: tc, d: best, done: false, tap: null, perfect: false, ai: false });
    });
    return out;
  }
  function firePasses(p, w, now) {
    (w.passes || []).forEach((ps) => { if (!ps.done && ps.tap != null && now >= ps.tc) doSmack(p, ps, w); });
  }
  function tapSmack() {      // a tap anywhere on the map while your own runner is running
    const m = me(); if (!m) return false; const v = visOf(m), w = v.walk; if (!w) return false;
    const tt = g.now; smackTap = performance.now();
    let best = null; (w.passes || []).forEach((ps) => { if (ps.done || ps.tap != null) return; if (tt < ps.tc - SMACK_PRE || tt > ps.tc + SMACK_POST) return; if (!best || Math.abs(tt - ps.tc) < Math.abs(tt - best.tc)) best = ps; });
    if (best) { best.tap = tt; best.perfect = Math.abs(tt - best.tc) <= SWEET; if (tt >= best.tc) doSmack(m, best, w); }
    return true;
  }
  const OUCH = ['Hey!', 'Ow!', 'Really?!', 'My hair!', 'Rude!', 'Boing...'], GLOAT = ['Gotcha', 'Tag!', 'Ha!', 'Love you too'], OUCH3 = ['WHAT WAS THAT', 'My whole head!', 'Seven?!', 'I saw stars'];
  const PERFECT_HITS = [{ t: 0, big: 1 }, { t: 300 }, { t: 355 }, { t: 410 }, { t: 465 }, { t: 520 }, { t: 700, big: 2 }];   // SMACK - 1,2,3,4,5 - SMACK
  function doSmack(p, ps, w) {
    ps.done = true; const q = g.byId(ps.pid); if (!q || q.bankrupt) return;
    const v = visOf(p), vq = visOf(q), pw = cosOf(p.charId, 'smack'), dir = v.face || 1, base = 0.55 + 0.05 * pw;   // Smack Power (cosmetic) sets how hard the head boings
    if (!ps.perfect) {
      v.swing = { at: performance.now(), dur: 380 };
      vq.bonk = { at: performance.now(), dir: dir, amp: base, decay: 2.6 };
      pows.push({ x: vq.x, y: vq.y - 72, born: performance.now(), col: p.color, txt: 'BONK!', sc: 1, life: 750 });
      lsfx('smack'); setTimeout(() => lsfx('boing'), 70);
      if (q.id === meId) vib([600, 70, 300, 60, 180, 50, 110, 40, 60]);      // long decaying doorstop boing
      else if (p.id === meId) vib(18);
      if (q.id === meId || p.id === meId || Math.random() < 0.6) say(q.id, OUCH[Math.floor(Math.random() * OUCH.length)], 1500);
    } else {
      // the runner keeps running, so a speed-blur afterimage of them stays behind and does the slapping
      const gh = { pid: p.id, x: vq.x - dir * 34, y: vq.y + 2, face: dir, born: performance.now(), until: performance.now() + 1250, swing: null };
      ghosts.push(gh);
      PERFECT_HITS.forEach((h, i) => setTimeout(() => {
        const tN = performance.now();
        gh.swing = { at: tN, dur: h.big ? 260 : 55, blur: !h.big };
        const flick = h.big ? 0 : (i % 2 ? -1 : 1);
        vq.bonk = { at: tN, dir: h.big ? dir : dir * flick, amp: h.big === 2 ? base * 2.1 : h.big ? base * 1.4 : base * 0.7, decay: h.big === 2 ? 1.5 : 3.2, long: h.big === 2 };
        if (h.big === 1) { pows.push({ x: vq.x, y: vq.y - 76, born: tN, col: '#ffd23f', txt: 'PERFECT!', sc: 1.5, life: 900 }); lsfx('ding'); lsfx('smack'); }
        else if (h.big === 2) { pows.push({ x: vq.x, y: vq.y - 80, born: tN, col: p.color, txt: 'SMACK!', sc: 1.7, life: 1100 }); lsfx('smack'); setTimeout(() => lsfx('boing'), 60); setTimeout(() => lsfx('ding'), 140); nudge(8); }
        else { lsfx('slap'); if (i === 1) pows.push({ x: vq.x + 44, y: vq.y - 132, born: tN, col: '#ff5d73', txt: 'TOO FAST!', sc: 1.1, life: 700 }); }
      }, h.t));
      if (q.id === meId) vib([380, 120, 45, 25, 45, 25, 45, 25, 45, 25, 45, 130, 1000, 80, 400, 60, 200, 50, 100]);   // the strongest buzz: matches SMACK - 1,2,3,4,5 - SMACK
      else if (p.id === meId) vib([30, 270, 12, 43, 12, 43, 12, 43, 12, 43, 12, 170, 40]);
      setTimeout(() => say(q.id, OUCH3[Math.floor(Math.random() * OUCH3.length)], 1800), 900);
    }
    if (p.id !== meId && Math.random() < 0.4) setTimeout(() => say(p.id, GLOAT[Math.floor(Math.random() * GLOAT.length)], 1300), ps.perfect ? 1000 : 0);
    if (REC) REC.events.push({ t: Math.round(g.now), turn: g.turnCount, e: 'smack', d: { from: p.id, to: q.id, perfect: !!ps.perfect } });
  }
  // the closing-ring timing cue over each player your runner is about to pass: it closes on the head and flashes gold in the sweet spot
  function drawSmackCues(c) {
    const m = me(); if (!m) return; const w = visOf(m).walk; if (!w || !w.passes) return;
    w.passes.forEach((ps) => {
      if (ps.done || ps.tap != null) return; const dt = ps.tc - g.now; if (dt > 650 || dt < -SWEET - 40) return;
      const q = g.byId(ps.pid); if (!q) return; const vq = visOf(q), hx = vq.x, hy = vq.y - 52, sweet = Math.abs(dt) <= SWEET;
      const r = 13 + 48 * Math.max(0, dt) / 650;
      c.save(); c.globalAlpha = sweet ? 0.95 : 0.25 + 0.35 * (1 - Math.max(0, dt) / 650);
      c.strokeStyle = sweet ? '#ffd23f' : '#ffffff'; c.lineWidth = sweet ? 5 : 2.2; c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.stroke();
      if (sweet) { c.globalAlpha = 0.25; c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(hx, hy, r + 6, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 0.35; c.strokeStyle = '#ffd23f'; c.lineWidth = 1.2; c.beginPath(); c.arc(hx, hy, 13, 0, Math.PI * 2); c.stroke();
      c.restore();
    });
  }
  // head on a doorstop spring: big overshoot, lots of decaying wobbles (~1.8 s)
  function springHead(b, tNow) { const t = (tNow - b.at) / 1000; if (t > (b.long ? 3 : 1.9)) return 0; return b.amp * Math.exp(-t * (b.decay || 2.6)) * Math.sin(t * Math.PI * 2 * 5.2 + 0.25); }
  function staggerOf(b, tNow) { const t = (tNow - b.at) / 1000; if (t > 0.9) return 0; return t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 4.5); }
  // ---- v0.2 the WHITEOUT march: step... step... STEP into the Snowbank (visual only; the engine already put them there)
  function startMarch(p) {
    const v = visOf(p); v.walk = null; v.hold = null; v.lift = 0;
    const e = endSpotFor(p, 10), k = BASE_SPEED * (prefs.fastAI && g.isBot(p) ? 1.6 : 1);
    v.march = { x0: v.x, y0: v.y, x1: e.x, y1: e.y, start: performance.now(), steps: [430, 470, 560, 900].map((d) => d / k), fired: -1 };
  }
  function stepMarch(p, v) {
    const m = v.march, el = performance.now() - m.start; let t0 = 0, i = 0;
    while (i < m.steps.length && el >= t0 + m.steps[i]) { t0 += m.steps[i]; i++; }
    if (i > m.fired) { for (let j = m.fired + 1; j < Math.min(i, m.steps.length); j++) { const big = j === m.steps.length - 1; if (!big) { lsfx('thud'); v.impact = performance.now(); v.impactAmp = 0.18; nudge(2); } } m.fired = Math.min(i, m.steps.length) - 1; }
    if (i >= m.steps.length) { v.march = null; v.x = m.x1; v.y = m.y1; v.lift = 0; v.phase = -1; land(p, v, true); nudge(12); return; }
    const n = m.steps.length, f = (el - t0) / m.steps[i], fe = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2, pr = (i + fe) / n;
    v.x = m.x0 + (m.x1 - m.x0) * pr; v.y = m.y0 + (m.y1 - m.y0) * pr;
    v.lift = Math.sin(Math.PI * f) * (i === n - 1 ? 46 : 16); v.phase = (i % 2 ? 0.25 : 0.75);
    if (Math.abs(m.x1 - m.x0) > 1) v.face = m.x1 > m.x0 ? 1 : -1;
  }
  // ---- v0.2 a few local sounds (smack, spring boing, landing thud); the shared sfx.js stays untouched
  let LA = null; document.addEventListener('pointerdown', () => laUnlock(), { passive: true });
  function laUnlock() { try { if (!LA) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) LA = new AC(); } if (LA && LA.state === 'suspended') LA.resume(); } catch (e) {} }
  function lsfx(n) {
    if (prefs.mute || !LA || LA.state !== 'running') return;
    try {
      const t = LA.currentTime, out = LA.destination;
      const tone = (type, f0, f1, at, dur, vol) => { const o = LA.createOscillator(), gn = LA.createGain(); o.type = type; o.frequency.setValueAtTime(f0, at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur); gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(vol, at + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(gn); gn.connect(out); o.start(at); o.stop(at + dur + 0.02); return o; };
      const hiss = (at, dur, vol, fq) => { const len = Math.max(1, Math.floor(LA.sampleRate * dur)), buf = LA.createBuffer(1, len, LA.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); const s2 = LA.createBufferSource(), f = LA.createBiquadFilter(), gn = LA.createGain(); s2.buffer = buf; f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 0.8; gn.gain.value = vol; s2.connect(f); f.connect(gn); gn.connect(out); s2.start(at); };
      if (n === 'smack') { hiss(t, 0.09, 0.9, 2400); tone('square', 380, 120, t, 0.07, 0.12); }
      else if (n === 'boing') { const o = tone('sine', 150, 0, t, 1.2, 0.22), lfo = LA.createOscillator(), lg = LA.createGain(); lfo.frequency.setValueAtTime(11, t); lfo.frequency.linearRampToValueAtTime(5, t + 1.2); lg.gain.setValueAtTime(90, t); lg.gain.exponentialRampToValueAtTime(4, t + 1.2); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.25); o.frequency.setValueAtTime(220, t); }
      else if (n === 'ding') { tone('sine', 1568, 0, t, 0.6, 0.22); tone('sine', 2093, 0, t + 0.05, 0.7, 0.14); tone('triangle', 3136, 0, t, 0.25, 0.05); }
      else if (n === 'slap') { hiss(t, 0.035, 0.5, 3200); tone('square', 520, 260, t, 0.03, 0.05); }
      else if (n === 'thud') { tone('sine', 140, 55, t, 0.13, 0.32); hiss(t, 0.05, 0.25, 500); }
      else if (n === 'thudBig') { tone('sine', 110, 38, t, 0.25, 0.5); hiss(t, 0.12, 0.5, 350); }
    } catch (e) {}
  }
  const lookOf = (p) => looks[p.id] || (looks[p.id] = PPL.random(Math.random, p.color));

  // ------------------------------------------------------------------ camera
  const cv = $('board'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  // v0.4: one UI scale from the real window size. A normal phone = 1; a wide layout viewport (desktop-site mode) scales every overlay up to match.
  let UIZ = 1;
  function resize() {
    DPR = Math.min(3, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const land = W > H; UIZ = Math.max(1, Math.min(3.5, land ? Math.min(W / 860, H / 400) : Math.min(W / 400, H / 860)));
    document.documentElement.style.setProperty('--uiz', UIZ.toFixed(3));
  }
  window.addEventListener('resize', resize); resize();
  const cam = { x: BW / 2, y: BW / 2, s: 0.3, mode: prefs.camMode === 'close' ? 'close' : 'mild', whole: false, manual: false, manualAt: 0, touching: false };
  function fitWhole() { const land = W > H; return Math.min((land ? W - 200 * UIZ : W) / (BW + 40), (H - (land ? 110 : 250) * UIZ) / (BW + 40)); }
  function focusPoint() {
    if (!g || !g.turn) return { x: BW / 2, y: BW / 2 };
    const t = g.turn;
    if (t.auction && !(t.pid === meId && t.stage === 'act' && t.buy != null)) { const r = RECTS[t.auction.sp]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    const p = g.cur(); if (!p) return { x: BW / 2, y: BW / 2 };
    const v = visOf(p); return { x: v.x, y: v.y - 35 };
  }
  // keep the action in the upper-middle of the screen (the dice + drawer live at the bottom)
  function frameOn(f, s) {
    const land = W > H && H < 600 * UIZ, padT = 56 * UIZ / s, padB = (land ? 70 : 190) * UIZ / s, M = 40;
    let x = f.x, y = f.y + (H * 0.5 - H * 0.42) / s;
    const hw = W / 2 / s, hh = H / 2 / s;
    x = hw * 2 >= BW + M * 2 ? BW / 2 : Math.max(hw - M, Math.min(BW - hw + M, x));
    y = hh * 2 >= BW + padT + padB ? BW / 2 + (padB - padT) / 2 : Math.max(hh - padT, Math.min(BW - hh + padB, y));
    return { x: x, y: y, s: s };
  }
  function camTarget() {
    if (cam.whole) { const s = fitWhole(); return { x: BW / 2, y: BW / 2 + 60 / s, s: s }; }
    const f = focusPoint(), m = Math.min(W, H);
    if (cam.mode === 'close') return frameOn(f, m / (CELL * 3.6));
    const s = Math.max(fitWhole() * 1.15, m / (BW * 0.5));
    return frameOn(f, s);
  }
  function stepCam(dtS) {
    if (cam.manual && !cam.touching && performance.now() - cam.manualAt > 7000) cam.manual = false;
    if (cam.manual) return;
    const t = camTarget(), k = 1 - Math.exp(-dtS * 3.2);
    cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k; cam.s = Math.exp(Math.log(cam.s) + (Math.log(t.s) - Math.log(cam.s)) * k);
  }
  const toWorld = (sx, sy, c) => { c = c || cam; return { x: (sx - W / 2) / c.s + c.x, y: (sy - H / 2) / c.s + c.y }; };
  const toScreen = (wx, wy, c) => { c = c || cam; return { x: (wx - c.x) * c.s + W / 2, y: (wy - c.y) * c.s + H / 2 }; };
  function setCamMode(m) { cam.mode = m; cam.whole = false; cam.manual = false; prefs.camMode = m; savePrefs(); camTag(m === 'close' ? 'Close follow' : 'Wide follow'); syncZoomBtn(); }
  function camTag(txt) { const el = $('camTag'); el.textContent = txt; el.hidden = false; clearTimeout(camTag.t); camTag.t = setTimeout(() => { el.hidden = true; }, 1300); }
  function syncZoomBtn() { $('zoomOut').classList.toggle('on', cam.whole); }
  $('zoomOut').onclick = () => { cam.whole = !cam.whole; cam.manual = false; syncZoomBtn(); camTag(cam.whole ? 'Whole board' : (cam.mode === 'close' ? 'Close follow' : 'Wide follow')); };

  // ---- touch: pinch / pan / tap / double-tap on the map
  const ptrs = new Map(); let gest = null, lastTap = { t: 0, x: 0, y: 0 }, tapTimer = 0;
  cv.addEventListener('pointerdown', (e) => {
    if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    cam.touching = true;
    if (ptrs.size === 1 && g && g.phase === 'play' && tapSmack()) { gest = { pinch: false, moved: true, smack: true }; return; }
    if (ptrs.size === 2) { const a = [...ptrs.values()]; gest = { pinch: true, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), s: cam.s, moved: true }; }
    else if (ptrs.size === 1) gest = { pinch: false, moved: false };
  });
  cv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p || !gest || gest.smack) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (gest.pinch && ptrs.size >= 2) {
      const a = [...ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      const wBefore = toWorld(mx, my), ns = Math.max(fitWhole() * 0.7, Math.min(4, gest.s * d / Math.max(20, gest.d)));
      cam.s = ns; const wAfter = toWorld(mx, my); cam.x += wBefore.x - wAfter.x; cam.y += wBefore.y - wAfter.y;
      cam.x -= dx / 2 / cam.s; cam.y -= dy / 2 / cam.s;
      cam.manual = true; cam.manualAt = performance.now(); cam.whole = false; syncZoomBtn();
    } else if (!gest.pinch) {
      if (!gest.moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 10) gest.moved = true;
      if (gest.moved) { cam.x -= dx / cam.s; cam.y -= dy / cam.s; cam.manual = true; cam.manualAt = performance.now(); }
    }
  });
  function ptrEnd(e) {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (!ptrs.size) cam.touching = false;
    if (!p || !gest) return;
    if (gest.smack) { gest = null; return; }
    if (gest.pinch) { if (!ptrs.size) gest = null; return; }
    if (!gest.moved && performance.now() - p.t0 < 400) {
      const t = performance.now();
      if (t - lastTap.t < 300 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) { clearTimeout(tapTimer); lastTap.t = 0; doubleTap(); }
      else { lastTap = { t: t, x: p.x, y: p.y }; const x = p.x, y = p.y; tapTimer = setTimeout(() => singleTap(x, y), 260); }
    }
    gest = null;
  }
  cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const wb = toWorld(e.clientX, e.clientY); cam.s = Math.max(fitWhole() * 0.7, Math.min(4, cam.s * Math.exp(-e.deltaY * 0.0015))); const wa = toWorld(e.clientX, e.clientY); cam.x += wb.x - wa.x; cam.y += wb.y - wa.y; cam.manual = true; cam.manualAt = performance.now(); }, { passive: false });
  ['gesturestart', 'gesturechange', 'dblclick'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  function doubleTap() { closeBubble(); setCamMode(cam.whole || cam.mode === 'close' ? 'mild' : 'close'); }
  function personAt(sx, sy) {
    let best = null, bd = 1e9; const h = 62 * cam.s;
    g.players.forEach((p) => { if (p.bankrupt) return; const v = visOf(p), s = toScreen(v.x, v.y); const d = Math.hypot(sx - s.x, sy - (s.y - h * 0.5)); const r = Math.max(26, h * 0.6); if (d < r && d < bd) { bd = d; best = p; } });
    return best;
  }
  function spaceAt(wx, wy) { for (let i = 0; i < 40; i++) { const r = RECTS[i]; if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return i; } return -1; }
  function singleTap(sx, sy) {
    if (!g || g.phase === 'lobby') return;
    if (ui.bubble) { closeBubble(); return; }
    const p = personAt(sx, sy); if (p) { openBubble(p); return; }
    const w = toWorld(sx, sy), sp = spaceAt(w.x, w.y); if (sp >= 0) { ui.info = { sp: sp }; sfx('click'); }
  }

  // ------------------------------------------------------------------ drawing
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function wrap(text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  const SPACE_LABEL = { halfway: 'THE HALFWAY', finds: 'SECRET FINDS', random: 'RANDOM- NESS', snowbank: 'SNOW- BANK', dirtlot: 'SECRET DIRT LOT', whiteout: 'WHITE- OUT!' };
  const BAND_COL = { whistle: '#3b3b46', juice: '#7a8a99', tax: '#c9a227', random: '#ffcf3f', finds: '#59b4e8' };
  const CORNER_FILL = { halfway: '#ffe9a8', snowbank: '#e1f1ff', dirtlot: '#e8d6b8', whiteout: '#f0f4ff' };
  function drawScene(c, view, w, h, opt) {
    opt = opt || {};
    const s = view.s, T = performance.now() / 1000;
    c.save(); c.translate(w / 2, h / 2); c.scale(s, s); c.translate(-view.x, -view.y);
    c.fillStyle = '#0d0b12'; c.fillRect(-4000, -4000, BW + 8000, BW + 8000);
    c.fillStyle = '#2a3b2f'; rr(-14, -14, BW + 28, BW + 28, 24); c.fill();
    c.fillStyle = '#f2ecd8'; c.fillRect(0, 0, BW, BW);
    // centre: title + the two decks
    c.fillStyle = '#1f4d3a'; c.fillRect(CORNER, CORNER, BW - CORNER * 2, BW - CORNER * 2);
    c.save(); c.translate(BW / 2, BW / 2); c.rotate(-0.12);
    c.fillStyle = '#ffd23f'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 96px Fredoka, sans-serif'; c.fillText('RED DEER', 0, -150); c.fillText('RICH', 0, -50);
    c.font = '600 30px Fredoka, sans-serif'; c.fillStyle = '#cfe8d6'; c.fillText('solo on your phone', 0, 10);
    [['RED DEER RANDOMNESS', '#ffe07a', -170], ['SECRET FINDS', '#9bd3f5', 170]].forEach((d) => { c.save(); c.translate(d[2], 170); c.rotate(0.08 * Math.sign(d[2])); c.fillStyle = 'rgba(0,0,0,.3)'; rr(-118, -72, 240, 150, 16); c.fill(); c.fillStyle = d[1]; rr(-120, -76, 240, 150, 16); c.fill(); c.fillStyle = '#2e2200'; c.font = '700 24px Fredoka, sans-serif'; wrap(d[0], 200).forEach((l, k, a) => c.fillText(l, 0, (k - (a.length - 1) / 2) * 28)); c.restore(); });
    if (g && g.rules.jackpot) { c.fillStyle = '#fff'; c.font = '700 34px Fredoka, sans-serif'; c.fillText('Dirt Lot pot ' + money(g.pot), 0, 300); }
    c.restore();
    const t = g && g.turn, cur = g && g.cur();
    for (let i = 0; i < 40; i++) {
      const r = RECTS[i], sp = S[i], pr = g ? g.props[i] : null;
      c.fillStyle = '#fbf8ef'; c.fillRect(r.x, r.y, r.w, r.h);
      const br = bandRect(r);
      if (br) { c.fillStyle = sp.type === 'prop' ? groupColor(i) : BAND_COL[sp.type] || '#ddd'; c.fillRect(br.x, br.y, br.w, br.h); }
      if (CORNER_FILL[sp.type]) { c.fillStyle = CORNER_FILL[sp.type]; c.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); }
      if (pr && pr.hocked) { c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip(); c.strokeStyle = 'rgba(80,80,90,.35)'; c.lineWidth = 8; for (let k = -200; k < 300; k += 26) { c.beginPath(); c.moveTo(r.x + k, r.y); c.lineTo(r.x + k + 150, r.y + 150); c.stroke(); } c.restore(); }
      if (pr && pr.dmg) { c.fillStyle = 'rgba(229,38,47,.18)'; c.fillRect(r.x, r.y, r.w, r.h); }
      c.strokeStyle = '#b9ae92'; c.lineWidth = 2; c.strokeRect(r.x, r.y, r.w, r.h);
      // owner tag (token colour) + Shops
      if (pr && pr.owner >= 0 && br) {
        const o = g.byId(pr.owner), oc = o ? o.color : '#888';
        const inner0 = r.side === 'l' || r.side === 'r' ? { x: r.x + (r.side === 'r' ? BAND : 0), w: r.w - BAND } : { x: r.x, w: r.w };
        const pillY = (r.side === 'b' ? r.y + r.h : r.side === 't' ? r.y + r.h - BAND : r.y + r.h) - 34;
        c.fillStyle = oc; rr(inner0.x + 6, pillY, inner0.w - 12, 26, 13); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        if (pr.shops) {
          const n = pr.shops === 5 ? 1 : pr.shops, mega = pr.shops === 5, vert = r.side === 'l' || r.side === 'r';
          for (let k = 0; k < n; k++) {
            const bw2 = mega ? (vert ? 18 : 60) : 16, bh2 = mega ? (vert ? 60 : 18) : 16;
            const bx = vert ? br.x + (BAND - bw2) / 2 : br.x + (mega ? (br.w - bw2) / 2 : 8 + k * 22), by = vert ? br.y + (mega ? (br.h - bh2) / 2 : 8 + k * 22) : br.y + (BAND - bh2) / 2;
            c.fillStyle = mega ? '#e5262f' : '#2e9e4f'; rr(bx, by, bw2, bh2, 3); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
          }
        }
      }
      if (t && ((t.auction && t.auction.sp === i) || t.buy === i)) { c.strokeStyle = 'rgba(255,210,63,' + (0.55 + 0.45 * Math.sin(T * 6)) + ')'; c.lineWidth = 8; c.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); }
      if (ui.info && ui.info.sp === i) { c.strokeStyle = '#3fa7ff'; c.lineWidth = 8; c.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); }
      // names only once they are big enough to read on a phone (never under ~11 px)
      if (s * CELL >= 56 || opt.text) {
        const fs = Math.max(15, Math.min(24, 12.5 / s)), inner = br ? (r.side === 'l' || r.side === 'r' ? { x: r.x + (r.side === 'r' ? BAND : 0), y: r.y, w: r.w - BAND, h: r.h } : { x: r.x, y: r.y + (r.side === 'b' ? BAND : 0), w: r.w, h: r.h - BAND }) : r;
        c.fillStyle = '#2a2433'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '600 ' + fs + 'px Fredoka, sans-serif';
        const label = SPACE_LABEL[sp.type] || sp.short;
        const lines = wrap(label, inner.w - 8).slice(0, 3), lh = fs * 1.08, topY = inner.y + 8 + lh / 2;
        lines.forEach((l, k) => c.fillText(l, inner.x + inner.w / 2, topY + k * lh));
        let sub = '';
        if (sp.price) { if (pr && pr.owner >= 0) { const rent = g.rentFor(i, 7, false); sub = pr.hocked ? 'mtg' : rent ? money(rent) : '-'; } else sub = money(sp.price); }
        else if (sp.type === 'tax') sub = 'pay ' + money(sp.amount); else if (sp.type === 'halfway') sub = '+' + money(C.halfwayPay);
        if (sub) { const ow = pr && pr.owner >= 0 ? g.byId(pr.owner) : null; c.font = '700 ' + (ow ? Math.min(fs, 17) : fs) + 'px Fredoka, sans-serif'; c.fillStyle = ow ? (ow.ink || '#fff') : '#6b5a2b'; c.fillText(sub, inner.x + inner.w / 2, ow ? inner.y + inner.h - 21 : inner.y + inner.h - 10 - fs / 2); }
      }
    }
    // people, back to front, each standing on their token disc
    if (g) {
      const list = g.players.filter((p) => !p.bankrupt).map((p) => ({ p: p, v: visOf(p) })).sort((a, b) => a.v.y - b.v.y);
      list.forEach((o) => {
        const p = o.p, v = o.v, active = cur && cur.id === p.id;
        const tP = performance.now(), b = v.bonk, stg = b ? staggerOf(b, tP) : 0, ox = b ? b.dir * 13 * stg : 0, lift = v.lift || 0;
        const it = (tP - v.impact) / 1000, sq = it < 0.55 ? 1 - v.impactAmp * Math.exp(-it * 9) * Math.cos(it * 30) : lift > 4 ? 1.1 : 1;
        const sw = v.swing && tP - v.swing.at < v.swing.dur ? (tP - v.swing.at) / v.swing.dur : -1, head = b ? springHead(b, tP) * b.dir * (v.face || 1) : 0;
        if (b && tP - b.at > (b.long ? 3100 : 2000)) v.bonk = null;
        const shrink = 1 - Math.min(0.35, lift / 120);
        c.fillStyle = p.color; c.beginPath(); c.ellipse(v.x, v.y, 22 * shrink, 9 * shrink, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = active ? '#ffd23f' : '#fff'; c.lineWidth = active ? 4 : 2.5; c.stroke();
        if (sw >= 0 && v.swing.blur) PPL.draw(c, v.x + ox, v.y - lift, active ? 76 : 68, lookOf(p), { walk: v.phase, face: v.face, badge: p.ink, squash: sq, swing: (sw + 0.45) % 1, alpha: 0.35 });   // the flurry blur
        PPL.draw(c, v.x + ox, v.y - lift, active ? 76 : 68, lookOf(p), { walk: v.phase, face: v.face, badge: p.ink, squash: sq, swing: sw, head: head, tilt: b ? 0.32 * stg * b.dir * (v.face || 1) : 0 });
        if (active && !busy(v)) { c.fillStyle = '#ffd23f'; c.beginPath(); const ay = v.y - 82 - Math.abs(Math.sin(T * 4)) * 6; c.moveTo(v.x - 9, ay - 12); c.lineTo(v.x + 9, ay - 12); c.lineTo(v.x, ay); c.fill(); }
      });
      const tD = performance.now();
      for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i], a = (tD - d.born) / d.life; if (a >= 1) { dust.splice(i, 1); continue; } const e = 1 - Math.pow(1 - a, 2), dt = a * d.life / 1000;
        c.globalAlpha = 0.55 * (1 - a); c.fillStyle = '#d9c9a3'; c.beginPath(); c.arc(d.x + d.vx * dt * (1 - a * 0.5), d.y + d.vy * dt, d.r * (0.6 + e), 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
      drawSmackCues(c);
      for (let i = ghosts.length - 1; i >= 0; i--) { const o = ghosts[i], gp = g.byId(o.pid); if (tD > o.until || !gp) { ghosts.splice(i, 1); continue; }
        const fa = Math.min(1, (tD - o.born) / 80) * Math.min(1, (o.until - tD) / 250), sw = o.swing && tD - o.swing.at < o.swing.dur ? (tD - o.swing.at) / o.swing.dur : -1;
        if (sw >= 0 && o.swing.blur) PPL.draw(c, o.x, o.y, 68, lookOf(gp), { face: o.face, badge: gp.ink, swing: (sw + 0.45) % 1, alpha: 0.3 * fa });
        PPL.draw(c, o.x, o.y, 68, lookOf(gp), { face: o.face, badge: gp.ink, swing: sw, alpha: 0.75 * fa }); }
      for (let i = pows.length - 1; i >= 0; i--) { const o = pows[i], a = (tD - o.born) / (o.life || 750); if (a >= 1) { pows.splice(i, 1); continue; }
        c.save(); c.translate(o.x, o.y - a * 26); c.globalAlpha = 1 - a * a; c.rotate(-0.15); const sc = (a < 0.15 ? a / 0.15 * 1.25 : 1.25 - (a - 0.15) * 0.3) * (o.sc || 1); c.scale(sc, sc); const tw = (o.txt || 'BONK!').length > 6 ? 1.35 : 1;
        c.fillStyle = '#ffd23f'; c.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 13 : 27, an = k / 16 * Math.PI * 2; c.lineTo(Math.cos(an) * r * 1.4 * tw * 1.25, Math.sin(an) * r); } c.closePath(); c.fill(); c.strokeStyle = o.col; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#1d1a26'; c.font = '700 17px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.txt || 'BONK!', 0, 1);
        for (let k = 0; k < 3; k++) { const an = tD / 160 + k * 2.1; c.fillStyle = '#fff'; c.font = '700 13px sans-serif'; c.fillText('\u2605', Math.cos(an) * 34, 26 + Math.sin(an) * 7); }
        c.restore(); }
      c.globalAlpha = 1;
    }
    c.restore();
    // speech bubbles above the figures (screen space, readable size)
    if (g && !opt.noBubbles) {
      const nowP = performance.now(), placed = [];
      g.players.forEach((p) => {
        if (p.bankrupt) return; const b = bubbles[p.id]; if (!b || nowP > b.until) return;
        const v = visOf(p), sc = { x: (v.x - view.x) * s + w / 2, y: (v.y - (v.lift || 0) - view.y) * s + h / 2 }, top = sc.y - 70 * s;
        c.font = '600 16px Fredoka, sans-serif'; const lines = wrap(b.txt, 190).slice(0, 4), bw = Math.min(214, Math.max.apply(null, lines.map((l) => c.measureText(l).width)) + 22), bh = lines.length * 20 + 14;
        const bx = Math.max(6, Math.min(w - bw - 6, sc.x - bw / 2)); let by = Math.max(60, top - bh - 14);
        for (let q = 0; q < placed.length; q++) { const o = placed[q]; if (bx < o.x + o.w && bx + bw > o.x && by < o.y + o.h && by + bh > o.y) { by = o.y - bh - 8; q = -1; } }
        placed.push({ x: bx, y: by, w: bw, h: bh }); const tipX = Math.max(bx + 14, Math.min(bx + bw - 14, sc.x));
        c.globalAlpha = Math.min(1, (b.until - nowP) / 300);
        c.fillStyle = '#fff'; rr(bx, by, bw, bh, 12); c.fill(); c.strokeStyle = p.color; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.moveTo(tipX - 8, by + bh - 1); c.lineTo(tipX + 8, by + bh - 1); c.lineTo(sc.x, Math.max(by + bh + 6, top - 2)); c.closePath(); c.fill();
        c.fillStyle = '#1d1a26'; c.textAlign = 'left'; c.textBaseline = 'top'; lines.forEach((l, k) => c.fillText(l, bx + 11, by + 8 + k * 20));
        c.globalAlpha = 1;
      });
    }
  }
  function say(pid, txt, ms) { bubbles[pid] = { txt: txt, until: performance.now() + (ms || 3200) }; }

  // ------------------------------------------------------------------ replay recorder (picture-in-picture / replays later)
  function recEvent(type, d) {
    if (!REC || type === 'cash') return;
    let dd = null; try { dd = JSON.parse(JSON.stringify(d)); } catch (e) {}
    REC.events.push({ t: Math.round(g.now), turn: g.turnCount, e: type, d: dd });
    if (type === 'turn') REC.snaps.push({ t: Math.round(g.now), turn: g.turnCount, pos: g.players.map((p) => [p.id, p.pos, p.cash, p.bankrupt ? 1 : 0]) });
    if (REC.events.length > 3000) REC.events.splice(0, 500);
    if (REC.snaps.length > 400) REC.snaps.splice(0, 100);
  }

  // ------------------------------------------------------------------ toasts
  function toast(txt, col, ms) {
    const el = document.createElement('div'); el.textContent = txt; if (col) el.style.borderLeftColor = col;
    const box = $('toasts'); box.appendChild(el); while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { el.remove(); }, ms || 2600);
  }
  const nm = (pid) => { if (pid === meId) return 'You'; const p = g.byId(pid); return p ? p.name : 'The bank'; };
  const tradeVisible = (tr) => prefs.trade === 'open' || (tr && (tr.a === meId || tr.b === meId));

  // ------------------------------------------------------------------ engine events
  function onEvent(type, d) {
    recEvent(type, d);
    const p = d.pid != null ? g.byId(d.pid) : null, mine = d.pid === meId;
    switch (type) {
      case 'turn': if (mine) { sfx('turn'); vib(30); toast('Your turn', p.color, 1400); } autosave(); break;
      case 'roll': sfx('dice'); ui.lastDice = performance.now(); break;
      case 'move': {
        const v = visOf(p), t = g.turn, durs = d.durs ? d.durs.slice() : d.path.map(() => t.moving.step);
        durs[durs.length - 1] += g.ms(C.timing.afterMove) * 0.45 + (d.dread ? 0 : t.moving.step * 0.35);   // the final hop hangs a touch longer, still lands before the engine moves on
        const aiSmack = {}; if (g.isBot(p)) g.players.forEach((q) => { if (q.id !== p.id) aiSmack[q.id] = Math.random() < (q.id === meId ? 0.22 : 0.14); });
        const hopH = (d.dread ? 20 : 34) * (0.6 + 0.08 * cosOf(p.charId, 'hop'));      // Hop Height (cosmetic): Drew jumps highest
        v.march = null; v.hold = null;
        v.walk = { path: d.path.slice(), from: p.pos, start: g.now, durs: durs, x0: v.x, y0: v.y, dread: d.dread || 0, hopH: hopH };
        v.walk.passes = planPasses(p, v.walk);
        v.walk.passes.forEach((ps) => { if (aiSmack[ps.pid]) { ps.ai = true; ps.tap = ps.tc; ps.perfect = Math.random() < 0.03; } });
        v.hop = -1; break; }
      case 'buy': sfx('buy'); if (!mine) toast(p.name + ' bought ' + S[d.sp].name, p.color); break;
      case 'pay':
        if (d.from === meId) { sfx('cashOut'); toast('You paid ' + (typeof d.to === 'number' ? nm(d.to) + ' ' : '') + money(d.amount) + (d.reason ? ' (' + d.reason + ')' : ''), '#e5262f'); }
        else if (d.to === meId) { sfx('cashIn'); toast(nm(d.from) + ' paid you ' + money(d.amount) + (d.reason ? ' (' + d.reason + ')' : ''), '#2e9e4f'); }
        break;
      case 'halfway': if (mine) { sfx('cash'); toast('+' + money(d.amount) + ' for passing The Halfway', '#2e9e4f'); } break;
      case 'card': if (!mine) { const cd = B.DECKS[d.deck][d.idx]; toast(p.name + ' drew: ' + cd.h, p.color, 3000); } sfx('card'); break;
      case 'whiteout': startMarch(p); sfx('whiteout'); toast((mine ? 'You hit' : p.name + ' hit') + ' the ditch: stuck in the Snowbank', '#59b4e8'); break;
      case 'free': if (mine) toast('Out of the Snowbank!', '#59b4e8'); break;
      case 'stuck': if (mine) toast('Still stuck (' + d.tries + ' of ' + C.snowTries + ')', '#59b4e8'); break;
      case 'build': sfx('build'); if (!mine) toast(p.name + ' built on ' + S[d.sp].name, p.color); break;
      case 'auctionStart': sfx('pop'); break;
      case 'bid': if (d.pid !== meId) sfx('click'); break;
      case 'auctionWon': toast((mine ? 'You won ' : p.name + ' won ') + S[d.sp].name + ' at auction for ' + money(d.price), p.color); sfx('buy'); break;
      case 'auctionNone': toast('No bids: the bank keeps ' + S[d.sp].name); break;
      case 'tradeOffer': { const tr = g.tradeById(d.id); if (d.to === meId) { sfx('deal'); vib(40); } else if (tradeVisible(tr) && d.from !== meId) toast(nm(d.from) + ' offers ' + nm(d.to) + ' a deal', (g.byId(d.from) || {}).color); break; }
      case 'tradeDone': { const tr = g.tradeById(d.id); if (tradeVisible(tr)) { sfx('deal'); toast('\uD83E\uDD1D Deal done: ' + nm(d.a) + ' + ' + nm(d.b)); } if (tr && (tr.a === meId || tr.b === meId)) ui.trade = { to: ui.trade.to, give: [], get: [], gCash: 0, tCash: 0, msg: '' }; break; }
      case 'tradeClosed': { const tr = g.tradeById(d.id); if (tr && tr.a === meId && d.by !== meId) { toast(nm(d.by) + ' said no to your deal'); ui.trade.msg = nm(d.by) + ' said no. Try sweetening it?'; } break; }
      case 'tradeStale': { const tr = g.tradeById(d.id); if (tr && (tr.a === meId || tr.b === meId)) toast('A deal went stale: ' + (tr.why || 'something changed')); break; }
      case 'bankrupt': sfx('boom'); toast((mine ? 'You went' : p.name + ' went') + ' bust', '#e5262f', 3500); break;
      case 'autoPass': if (mine) toast('Nothing left to do: dice passed', '#ffd23f', 1800); break;
      case 'jackpot': toast((mine ? 'You' : p.name) + ' found the Dirt Lot jackpot: +' + money(d.amount) + '!', '#ffd23f'); sfx('jackpot'); break;
      case 'chat': { const from = g.byId(d.from); if (from) say(from.id, d.text); break; }
      case 'state': if (d.to === 'gold') sfx('gold'); break;
      case 'perk': toast((mine ? 'You' : p.name) + ': ' + d.perk + '!', p && p.color); break;
      case 'over': sfx('fanfare'); clearSave(); break;
    }
  }
  function attach() {
    g.on(onEvent);
    g.onBubble = (p, txt) => say(p.id, txt);
    // Deals setting: open table = offers only on your own turn and everyone sees them;
    // covert = private deals, only while both people stand within N squares of each other. Applies to the AI too.
    g.proposeTrade = function (from, to, give, get) {
      const a = this.byId(from), b = this.byId(to);
      if (a && b) {
        if (prefs.trade === 'covert') { const dd = ringDist(a.pos, b.pos); if (dd > prefs.covertN) return 'Too far apart for a covert deal (' + dd + ' squares, max ' + prefs.covertN + ')'; }
        else if (!this.turn || this.turn.pid !== from) return 'Open table: deals are offered on your own turn';
      }
      return Game.prototype.proposeTrade.call(this, from, to, give, get);
    };
  }

  // ------------------------------------------------------------------ new game / save / resume
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function newGame() {
    const seed = Q.get('seed') != null ? +Q.get('seed') : Math.floor(Math.random() * 1e9);
    g = new Game({ seed: seed, speed: BASE_SPEED });
    g.rules.payupRace = !!+prefs.payup; g.rules.heckle = false; g.rules.auctions = true;
    g.setMode(prefs.len); g.setTimer(+prefs.timer || 0);
    const meP = g.addPlayer({ name: (prefs.name || '').slice(0, 12), charId: prefs.charId });      // no name = your character's name
    meId = meP.id; looks = {};
    looks[meId] = PPL.clean(Object.assign({}, prefs.look, { shirt: meP.color }));      // your shirt = your token colour
    const pool = shuffle(C.characters.map((c) => c.id).filter((id) => id !== meP.charId));
    for (let k = 0; k < Math.max(1, Math.min(3, +prefs.opp || 2)); k++) { const p = g.addPlayer({ ai: prefs.level, charId: pool[k] }); looks[p.id] = PPL.random(g.rand, p.color); }
    REC = { v: 1, kind: 'rdr-solo-replay', ver: VER, seed: seed, started: Date.now(), players: g.players.map((p) => ({ id: p.id, name: p.name, charId: p.charId, color: p.color, ai: p.ai ? p.ai.level : null, look: looks[p.id] })), events: [], snaps: [] };
    clock0 = performance.now(); clockAdd = 0; frozen = false; g.now = 0;
    Object.keys(vis).forEach((k) => delete vis[k]);
    attach();
    g.start();
    REC.order = g.order.slice();
    AI.greet(g);
    resetUi(); enterGame();
  }
  function snapshot() { return JSON.parse(JSON.stringify(g, (k, v) => (k === 'listeners' || k === 'rand' ? undefined : v))); }
  function autosave() { if (!g || g.phase !== 'play') return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, at: Date.now(), ver: VER, game: snapshot(), meId: meId, looks: looks, rec: REC ? Object.assign({}, REC, { events: REC.events.slice(-1500) }) : null })); } catch (e) { console.warn('autosave failed', e); } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 && s.game && s.game.phase === 'play' ? s : null; } catch (e) { return null; } }
  function resume() {
    const s = loadSave(); if (!s) return false;
    g = new Game({ seed: s.game.seed, speed: BASE_SPEED });
    Object.keys(s.game).forEach((k) => { g[k] = s.game[k]; });
    g.listeners = []; g.speed = BASE_SPEED;
    meId = s.meId; looks = s.looks || {}; REC = s.rec || { v: 1, events: [], snaps: [] };
    clockAdd = g.now; clock0 = performance.now(); frozen = false;
    Object.keys(vis).forEach((k) => delete vis[k]);
    attach(); resetUi(); enterGame(); toast('Welcome back. Game resumed.');
    return true;
  }
  function resetUi() { Object.assign(ui, { drawer: false, tab: 'deeds', panel: false, rules: false, skipAuction: -1, snowAsked: -1, cardKey: '', cardDecided: '', info: null, overSeen: false, bubble: null, popKey: '', drawerKey: '', topKey: '' }); ui.trade = { to: 0, give: [], get: [], gCash: 0, tCash: 0, msg: '' }; paintPeek.k = ''; }
  function enterGame() {
    $('setup').hidden = true; ['top', 'zoomOut', 'drawer'].forEach((id) => { $(id).hidden = false; });
    $('panel').hidden = true; setDrawer(false); cam.whole = false; cam.manual = false; cam.mode = prefs.camMode === 'close' ? 'close' : 'mild';
    const t = camTarget(); cam.x = t.x; cam.y = t.y; cam.s = t.s * 0.6;
    askMotion();
  }
  function quitToSetup(save) {
    if (save) autosave();
    g = null; ['top', 'zoomOut', 'drawer', 'dice', 'pop', 'cardPop', 'panel', 'bubbleMenu', 'scrim'].forEach((id) => { $(id).hidden = true; });
    ui.panel = false; ui.drawer = false; frozen = false;
    $('setup').hidden = false; paintSetup();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { autosave(); if (g) freeze(true); } else if (g && !ui.panel) freeze(false); });
  window.addEventListener('pagehide', autosave);


  // Invite a friend / Play on a TV: fresh shared room (solo state is not carried over yet).
  let tvInv = null, tvCode = '';
  function makeRoomCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A.charAt((Math.random() * A.length) | 0); return s; }
  function rdrDir() { return location.href.replace(/[^/]*([?#].*)?$/, ''); }
  function openTvInvite() {
    if (!tvCode) tvCode = makeRoomCode();
    const loc = /[?&]local=1/.test(location.search) ? '&local=1' : '';
    if (!tvInv && window.Invite) {
      tvInv = Invite.mount({
        title: 'Red Deer Rich',
        hideBtn: true,
        corner: 'bl',
        code: function () { return tvCode; },
        url: function (c) { return rdrDir() + 'controller_v072.html?room=' + c + loc + '&auto=1'; },
        tvUrl: function (c) { return rdrDir() + 'index_v072.html?room=' + c + loc; }
      });
    }
    if (tvInv) tvInv.open();
    else toast('Invite panel is still loading. Try again in a moment.');
  }

  // ------------------------------------------------------------------ top bar + pull-down panel
  const inkOn = (c) => (c === '#1d1d24' ? '#ddd' : c);
  function standings() { return g.players.map((p) => ({ p: p, w: p.bankrupt ? 0 : g.worthOf(p) })).sort((a, b) => (a.p.bankrupt - b.p.bankrupt) || b.w - a.w); }
  function paintTop() {
    const cur = g.cur(), m = me(), last = g.log.length ? g.log[g.log.length - 1].s : '';
    const key = g.players.map((p) => p.id + ':' + (p.bankrupt ? 0 : Math.round(g.worthOf(p) / 10))).join(',') + '|' + (cur ? cur.id : 0) + g.phase;
    if (key !== ui.topKey) {
      ui.topKey = key;
      // one block per player in turn order, width = their share of the table's total net worth
      $('bar').innerHTML = g.order.map((id) => g.byId(id)).filter(Boolean).map((p) => '<i title="' + esc(p.name) + '" style="background:' + p.color + ';flex-grow:' + (p.bankrupt ? 0.0001 : Math.max(1, g.worthOf(p))) + '" class="' + (cur && cur.id === p.id && g.phase === 'play' ? 'turn' : '') + (p.bankrupt ? ' out' : '') + '"></i>').join('');
    }
    $('turnDot').style.background = cur ? cur.color : '#888';
    $('turnName').textContent = g.phase === 'over' ? 'Game over' : cur ? (cur.id === meId ? 'Your turn' : cur.name) : '';
    $('cash').textContent = m ? money(m.cash) : '';
    if ($('event').textContent !== last) $('event').textContent = last;
    if (ui.panel) paintPanel(false);
  }
  function fmtLeft() { if (!g.endsAt) return 'Off'; const ms = Math.max(0, g.endsAt - g.now) * g.spd(); const mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60; return mm + ':' + String(ss).padStart(2, '0'); }
  function paintPanel(full) {
    if (!full) { const el = $('pTimer'); if (el) el.textContent = fmtLeft(); return; }
    const st = standings(), top = Math.max(1, st[0] ? st[0].w : 1), m = me();
    const owned = g.props.filter((pr) => pr && pr.owner >= 0).length, total = g.props.filter(Boolean).length;
    let h = '<div class="sect">Standings (about)</div>' + st.map((o, k) => {
      const p = o.p, deeds = g.props.filter((pr) => pr && pr.owner === g.oid(p)).length;
      const sets = Object.keys(B.GROUP_MEMBERS).filter((gr) => gr !== 'whistle' && gr !== 'juice' && g.ownsGroup(g.oid(p), gr)).length;
      return '<div class="rank' + (p.bankrupt ? ' bust' : '') + '"><span class="pl">' + (p.bankrupt ? '\u2715' : k + 1) + '</span><div class="who"><b style="color:' + inkOn(p.color) + '">' + esc(p.id === meId ? (p.name === 'You' ? 'You' : p.name + ' (you)') : p.name) + (p.ai ? ' <small>AI</small>' : '') + '</b>' +
        '<small>' + money(p.cash) + ' cash \u00b7 ' + deeds + ' deed' + (deeds === 1 ? '' : 's') + (sets ? ' \u00b7 ' + sets + ' set' + (sets > 1 ? 's' : '') : '') + (p.snow ? ' \u00b7 in the Snowbank' : '') + '</small>' +
        '<div class="meter" style="width:' + Math.max(3, Math.round(o.w / top * 100)) + '%;background:' + p.color + '"></div></div><span class="w">' + (p.bankrupt ? 'bust' : '~' + money(Math.round(o.w / 50) * 50)) + '</span></div>';
    }).join('');
    h += '<div class="sect">What\'s going on</div><div class="facts">' +
      '<div>Round<b>' + g.round + '</b></div><div>Deeds owned<b>' + owned + ' / ' + total + '</b></div>' +
      '<div>Game timer<b id="pTimer">' + fmtLeft() + '</b></div><div>Shops in the bank<b>' + g.bankShops + '</b></div>' +
      (m ? '<div>Your rent collected<b>' + money(g.statsOf(m).rent) + '</b></div><div>Your net worth<b>' + money(g.worthOf(m)) + '</b></div>' : '') + '</div>';
    h += '<div class="sect">Recent</div><div class="note">' + g.log.slice(-5).reverse().map((e) => esc(e.s)).join('<br>') + '</div>';
    h += '<div class="sect">Settings</div>' +
      setRow('Sound', '', 'mute', !prefs.mute ? 'On' : 'Off', !prefs.mute) +
      setRow('Fast computer turns', 'Speeds up the AI\'s walking and thinking', 'fastAI', prefs.fastAI ? 'On' : 'Off', prefs.fastAI) +
      setRow('Shake to roll / pass', 'Uses the motion sensor (asks once on iPhone)', 'shake', prefs.shake ? 'On' : 'Off', prefs.shake) +
      setRow('Game timer', g.endsAt ? 'Richest player wins when it runs out' : (g.timerLeft ? 'Paused with time left' : 'No timer: last one standing'), 'timer', g.endsAt ? 'On' : 'Off', !!g.endsAt) +
      setRow('Camera', 'Double-tap the map to switch', 'cam', cam.mode === 'close' ? 'Close' : 'Wide', true) +
      setRow('Deals', prefs.trade === 'open' ? 'Open table: offer on your turn, everyone sees it' : 'Covert: private deals only within ' + prefs.covertN + ' squares of each other', 'trade', prefs.trade === 'open' ? 'Open' : 'Covert', prefs.trade === 'covert') +
      (prefs.trade === 'covert' ? setRow('Covert range', 'Squares apart (either direction)', 'covertN', prefs.covertN + ' sq', true) : '') +
      '<div class="btnrow"><button class="btn" data-p="invite">Invite a friend / Play on a TV</button></div>' +
      '<div class="btnrow"><button class="btn" data-p="rules">' + (ui.rules ? 'Hide rules' : 'Rules') + '</button><button class="btn go" data-p="save">Save &amp; quit</button></div>' +
      (ui.rules ? rulesHtml() : '') +
      '<div class="btnrow"><button class="btn ghost" data-p="close">Back to the game</button></div><p class="note">Red Deer Rich ' + VER + ' \u00b7 dev page \u00b7 the game pauses while this is open</p>';
    $('panelIn').innerHTML = h;
  }
  function setRow(lab, sub, k, val, on) { return '<div class="set"><span>' + lab + (sub ? '<small>' + sub + '</small>' : '') + '</span><button class="tog' + (on ? ' on' : '') + '" data-p="' + k + '">' + val + '</button></div>'; }
  function rulesHtml() {
    return '<ul class="rules"><li>Roll: tap, swipe or shake the dice at the bottom. Collect ' + money(C.halfwayPay) + ' each time you pass The Halfway.</li>' +
      '<li>Land on an unowned deed: buy it or pass. Passed deeds go to a quick auction everyone can bid on.</li>' +
      '<li>Land on someone\'s deed: pay rent. Own a whole colour set to double the rent and build Shops (then a Mega-Plex).</li>' +
      '<li>Doubles roll again. Three doubles in a row, or the WHITEOUT corner, puts you in the Snowbank: roll doubles, pay the ' + money(C.towFee) + ' tow, or use a Tow Truck Pass.</li>' +
      '<li>Cards pop up on RANDOMNESS and SECRET FINDS: swipe up to play. Keeper cards (Tow Truck Pass) can be swiped down into your stash.</li>' +
      '<li>Short on cash? Lift the bottom edge to sell Shops or mortgage deeds. Can\'t pay at all and you\'re out.</li>' +
      '<li>Tap any player for a deal or a quick chat. Last one standing wins, or the richest when the timer runs out.</li>' +
      '<li>When nothing is left to do on your turn, the dice pass themselves.</li></ul>';
  }
  function setPanel(on) {
    ui.panel = on; $('panel').hidden = !on; freeze(on || document.visibilityState === 'hidden');
    if (on) { closeBubble(); paintPanel(true); }
  }
  $('pull').onclick = () => setPanel(!ui.panel);
  $('bar').onclick = () => setPanel(true);
  $('strip').onclick = () => setPanel(true);
  $('panelGrip').onclick = () => setPanel(false);
  (function () { let y0 = null; const pg = $('panel'); pg.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true }); pg.addEventListener('touchend', (e) => { if (y0 != null && y0 - e.changedTouches[0].clientY > 70 && $('panelIn').scrollTop <= 0) setPanel(false); y0 = null; }, { passive: true }); })();
  $('panelIn').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (!b || !g) return; const k = b.dataset.p; sfx('click');
    if (k === 'close') return setPanel(false);
    if (k === 'invite') { setPanel(false); openTvInvite(); return; }
    if (k === 'save') { setPanel(false); quitToSetup(true); return; }
    if (k === 'rules') ui.rules = !ui.rules;
    if (k === 'mute') { prefs.mute = !prefs.mute; try { SFX.setMuted(prefs.mute); } catch (er) {} }
    if (k === 'fastAI') prefs.fastAI = !prefs.fastAI;
    if (k === 'shake') { prefs.shake = !prefs.shake; if (prefs.shake) askMotion(true); }
    if (k === 'timer') { if (g.endsAt) g.timerOff(); else g.timerOn(); }
    if (k === 'cam') { cam.mode = cam.mode === 'close' ? 'mild' : 'close'; prefs.camMode = cam.mode; cam.whole = false; syncZoomBtn(); }
    if (k === 'trade') prefs.trade = prefs.trade === 'open' ? 'covert' : 'open';
    if (k === 'covertN') { const L = [2, 3, 5, 8]; prefs.covertN = L[(L.indexOf(prefs.covertN) + 1) % L.length]; }
    savePrefs(); paintPanel(true);
  });

  // ------------------------------------------------------------------ dice (bottom middle): tap, swipe or shake
  const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  let diceFaces = '';
  function faces(a, b, dbl) { const k = a + ',' + b + dbl; if (k === diceFaces) return; diceFaces = k; [[$('d1'), a], [$('d2'), b]].forEach((x) => { x[0].innerHTML = PIPS[x[1]].map((p) => '<i style="left:' + p[0] + '%;top:' + p[1] + '%"></i>').join(''); x[0].classList.toggle('dbl', !!dbl); }); }
  function diceMode() {
    const t = g.turn, m = me(); if (!t || g.phase !== 'play' || !m) return null;
    if (t.stage === 'rolling') return 'tumble';
    if (t.pid !== meId || m.bankrupt) return performance.now() - ui.lastDice < 1600 ? 'show' : null;
    if (t.tab || t.auction || t.buy != null) return null;
    if (t.stage === 'roll') return m.snow && ui.snowAsked !== g.turnCount ? null : 'roll';
    if (t.stage === 'act') return t.canRollAgain ? 'again' : 'pass';
    return performance.now() - ui.lastDice < 1600 ? 'show' : null;
  }
  function paintDice() {
    const d = $('dice'), blocked = ui.drawer || ui.panel || !$('cardPop').hidden || (!$('pop').hidden && !$('pop').classList.contains('soft'));
    const mode = blocked ? null : diceMode(), t = g.turn;
    if (!mode) { d.hidden = true; return; }
    d.hidden = false;
    const cls = (mode === 'roll' || mode === 'again' ? 'mine' : mode === 'pass' ? 'mine pass' : t && t.pid !== meId ? 'ai' : '') + (mode === 'tumble' ? ' tumble' : '');
    if (d.className !== cls) d.className = cls;
    if (mode === 'tumble') { if (Math.random() < 0.3) faces(1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), false); }
    else if (t.roll) faces(t.roll.d[0], t.roll.d[1], t.roll.dbl); else faces(5, 2, false);
    const wait = t && t.graceUntil && g.now < t.graceUntil ? Math.ceil((t.graceUntil - g.now) / 1000) : 0;
    const lbl = mode === 'roll' ? (me().snow ? 'Roll for doubles' : 'Tap, swipe' + (shk.on ? ' or shake' : '') + ' to roll') : mode === 'again' ? 'Doubles! Roll again' :
      mode === 'pass' ? (wait ? 'Pass in ' + wait + '\u2026' : g.onlyPass(me()) ? 'All done: passing\u2026' : 'Tap or swipe to pass') : mode === 'tumble' ? '' : t.roll ? (t.pid === meId ? 'You' : (g.byId(t.pid) || {}).name) + ' rolled ' + t.roll.total : '';
    if ($('diceLbl').textContent !== lbl) $('diceLbl').textContent = lbl;
  }
  function diceAct(force) {
    const mode = diceMode(); if (!mode || ui.drawer) return '';
    let r = '';
    if (mode === 'roll' || mode === 'again') { r = g.intent(meId, { t: 'roll', f: force != null ? force : 0.6 }); vib(20); }
    else if (mode === 'pass') { r = g.intent(meId, { t: 'pass' }); if (!r) { sfx('whistle'); toast('Dice passed', '#ffd23f', 1200); } }
    if (r === 'wait') toast('Hang on: they can still catch you for rent'); else if (r) toast(r);
    shk.last = Date.now();
    return r;
  }
  (function () {
    const d = $('dice'); let st = null;
    d.addEventListener('pointerdown', (e) => { st = { x: e.clientX, y: e.clientY, t: performance.now() }; if (d.setPointerCapture) try { d.setPointerCapture(e.pointerId); } catch (er) {} });
    d.addEventListener('pointerup', (e) => { if (!st) return; const dist = Math.hypot(e.clientX - st.x, e.clientY - st.y), dt = performance.now() - st.t; st = null; if (dist > 24) diceAct(Math.min(1, dist / Math.max(60, dt) / 2)); else if (dt < 600) diceAct(); });
    d.addEventListener('pointercancel', () => { st = null; });
  })();

  // ---- shake (DeviceMotion; iPhone asks once, on a tap)
  const shk = { on: false, asked: false, prev: null, last: 0, win: null };
  function onMotion(e) {
    if (!prefs.shake || !g) return;
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a || a.x == null) return;
    const p = shk.prev; shk.prev = [a.x, a.y, a.z]; if (!p) return;
    const jerk = Math.abs(a.x - p[0]) + Math.abs(a.y - p[1]) + Math.abs((a.z || 0) - (p[2] || 0)), now = Date.now();
    if (shk.win) { shk.win.peak = Math.max(shk.win.peak, jerk * 0.5); return; }
    if (jerk < ((C.shake && C.shake.jerk) || 28) || now - shk.last < 2200) return;   // 2.2 s so a roll-shake never turns into a pass-shake
    const mode = diceMode(); if (mode !== 'roll' && mode !== 'again' && mode !== 'pass') return;
    shk.last = now; shk.win = { peak: jerk * 0.5 };
    setTimeout(() => { const w = shk.win; shk.win = null; const S2 = C.shake || {}, f = Math.max(0, Math.min(1, (w.peak - (S2.magLo || 12)) / ((S2.magHi || 45) - (S2.magLo || 12)))); diceAct(Math.round(f * 100) / 100); }, 300);
  }
  function startMotion() { if (shk.on) return; shk.on = true; window.addEventListener('devicemotion', onMotion); }
  function askMotion(force) {
    if (!prefs.shake || shk.on || typeof DeviceMotionEvent === 'undefined') return;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {      // iOS 13+: must come from a tap (START / Resume / the setting)
      if (shk.asked && !force) return; shk.asked = true;
      try { DeviceMotionEvent.requestPermission().then((r) => { if (r === 'granted') { startMotion(); toast('\uD83D\uDCF3 Shake to roll is on', null, 1600); } }).catch(() => {}); } catch (e) {}
    } else if ('ontouchstart' in window || navigator.maxTouchPoints > 0) startMotion();
  }

  // ------------------------------------------------------------------ bottom drawer (lift the bottom edge)
  const drawer = $('drawer');
  function setDrawer(on) { ui.drawer = on; drawer.classList.toggle('open', on); drawer.style.height = ''; $('scrim').hidden = !on; if (on) { closeBubble(); ui.drawerKey = ''; paintDrawer(); sfx('pop'); } }
  (function () {
    const grip = $('grip'); let st = null;
    grip.addEventListener('pointerdown', (e) => { st = { y: e.clientY, h: drawer.getBoundingClientRect().height, moved: false }; if (grip.setPointerCapture) try { grip.setPointerCapture(e.pointerId); } catch (er) {} });
    grip.addEventListener('pointermove', (e) => { if (!st) return; const dy = e.clientY - st.y; if (Math.abs(dy) > 8) st.moved = true; if (st.moved) { drawer.classList.add('drag'); drawer.style.height = Math.max(56, Math.min(H * 0.86, st.h - dy)) + 'px'; } });
    grip.addEventListener('pointerup', (e) => { if (!st) return; const dy = e.clientY - st.y, moved = st.moved; st = null; drawer.classList.remove('drag'); if (!moved) setDrawer(!ui.drawer); else setDrawer(ui.drawer ? dy < 60 : dy < -40); });
    grip.addEventListener('pointercancel', () => { st = null; drawer.classList.remove('drag'); drawer.style.height = ''; });
  })();
  $('scrim').onclick = () => setDrawer(false);
  $('dTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; ui.tab = b.dataset.tab; ui.drawerKey = ''; paintDrawer(); sfx('click'); });
  const myDeeds = () => { const m = me(); return g && m ? g.props.map((pr, i) => (pr && pr.owner === g.oid(m) ? i : -1)).filter((i) => i >= 0) : []; };
  function paintPeek() {
    const m = me(); if (!m) return;
    const ds = myDeeds(), k = ds.map((i) => i + (g.props[i].hocked ? 'h' : '')).join(',') + '|' + m.passes.length + '|' + W;
    if (paintPeek.k === k) return; paintPeek.k = k;
    const maxL = Math.max(3, Math.floor((W / 2 - 64) / 25));
    $('peekL').innerHTML = (ds.length > maxL ? '<span class="more">+' + (ds.length - maxL + 1) + '</span>' : '') + ds.slice(-(ds.length > maxL ? maxL - 1 : maxL)).map((i) => '<i style="background:' + groupColor(i) + '" class="' + (g.props[i].hocked ? 'hock' : '') + '"></i>').join('') + (ds.length ? '' : '<span class="more">no deeds yet</span>');
    $('peekR').innerHTML = m.passes.map(() => '<i class="card">TOW</i>').join('') + (m.passes.length ? '' : '<span class="more">my stuff</span>');
  }
  function rentRows(i) {
    const sp = S[i], pr = g.props[i];
    if (sp.type === 'prop') { const L = ['Rent', '1 Shop', '2 Shops', '3 Shops', '4 Shops', 'Mega-Plex']; return sp.rents.map((r, k) => '<div class="r' + (pr && pr.owner >= 0 && pr.shops === k ? ' cur' : '') + '"><span>' + L[k] + (k === 0 ? ' (x2 with the set)' : '') + '</span><b>' + money(r) + '</b></div>').join('') + '<div class="r"><span>Shop costs</span><b>' + money(g.shopCost(i)) + '</b></div>'; }
    if (sp.type === 'whistle') return B.WHISTLE_RENT.slice(1).map((r, k) => '<div class="r"><span>Own ' + (k + 1) + ' Whistle Stop' + (k ? 's' : '') + '</span><b>' + money(r) + '</b></div>').join('');
    if (sp.type === 'juice') return '<div class="r"><span>Own 1</span><b>' + B.JUICE_MULT[1] + 'x dice</b></div><div class="r"><span>Own both</span><b>' + B.JUICE_MULT[2] + 'x dice</b></div>';
    return '';
  }
  function deedCard(i) {
    const p = me(), pr = g.props[i], sp = S[i], hockLbl = pr.hocked ? 'Unmortgage ' + money(g.unhockCost(i)) : 'Mortgage +' + money(sp.hock);
    const cb = sp.type === 'prop' ? g.canBuild(p, i) : 'n/a', cs = sp.type === 'prop' ? g.canSell(p, i) : 'n/a';
    const ch = pr.hocked ? (p.cash < g.unhockCost(i) ? 'Not enough cash' : '') : g.groupHasShops(sp.group) ? 'Sell the Shops in this set first' : '';
    const why = cb && cb !== 'n/a' && cb !== 'Not yours' ? cb : '';
    return '<div class="deed' + (pr.hocked ? ' hocked' : '') + '" data-sp="' + i + '"><div class="hd" style="background:' + groupColor(i) + '">' + esc(sp.name) + '</div><div class="bd">' + rentRows(i) +
      '<div class="r"><span>Mortgage value</span><b>' + money(sp.hock) + '</b></div>' + (pr.shops ? '<div class="r cur"><span>Built</span><b>' + (pr.shops === 5 ? 'Mega-Plex' : pr.shops + ' Shop' + (pr.shops > 1 ? 's' : '')) + '</b></div>' : '') + (pr.dmg ? '<div class="r"><span>Repairs</span><b>' + pr.dmg.left + ' turns</b></div>' : '') + '</div>' +
      '<div class="why">' + esc(why) + '</div><div class="acts">' +
      (sp.type === 'prop' ? '<button class="go" data-a="build" ' + (cb ? 'disabled' : '') + '>Build ' + money(g.shopCost(i)) + '</button><button data-a="sell" ' + (cs ? 'disabled' : '') + '>Sell Shop +' + money(Math.floor(g.shopCost(i) * C.shopSellBack)) + '</button>' : '') +
      '<button data-a="hock" ' + (ch ? 'disabled' : '') + '>' + hockLbl + '</button><button data-a="find">Show on map</button>' +
      (pr.dmg ? '<button data-a="rush" ' + (p.cash < g.rushCost(i) ? 'disabled' : '') + '>Rush repair ' + money(g.rushCost(i)) + '</button>' : '') + '</div></div>';
  }
  function paintDrawer(force) {
    if (!g || !ui.drawer) return;
    const m = me(); if (!m) return;
    const tr = ui.trade, key = ui.tab + '|' + g.version + '|' + JSON.stringify(tr) + (ui.tab === 'trade' ? '|' + myTurn() : '');
    if (!force && key === ui.drawerKey) return; ui.drawerKey = key;
    [...$('dTabs').children].forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
    const body = $('dBody'), wheel = body.querySelector('.wheel'), sl = wheel ? wheel.scrollLeft : 0, st = body.scrollTop;
    let h = '';
    if (ui.tab === 'deeds') {
      const ds = myDeeds();
      h = ds.length ? '<div class="note">' + money(m.cash) + ' cash \u00b7 swipe sideways through your deeds</div><div class="wheel">' + ds.map(deedCard).join('') + '</div>' : '<div class="empty">No deeds yet. Land on one and buy it, win an auction, or make a deal.</div>';
      if (g.turn && g.turn.tab && g.turn.pid === meId) h = '<div class="gcard"><b>You owe ' + money(g.turn.tab.amount) + '</b>Sell Shops or mortgage below; it pays itself the moment you have enough.</div>' + h;
    } else if (ui.tab === 'cards') {
      h = m.passes.length ? m.passes.map(() => '<div class="gcard"><b>Tow Truck Pass</b>Gets you out of the Snowbank for free. Tradeable.' +
        (m.snow && myTurn() && g.turn.stage === 'roll' ? '<div class="btnrow"><button class="btn go" data-a="usePass">Use it now</button></div>' : '') + '</div>').join('') : '<div class="empty">Your stash is empty. Keeper cards you swipe down land here.</div>';
      const seen = g.cardsDrawn.filter((c) => c[2] === meId).slice(-5).reverse();
      if (seen.length) h += '<div class="sect">Cards you drew</div>' + seen.map((c) => '<div class="note">\u2022 ' + esc(B.DECKS[c[0]][c[1]].h) + ' (round ' + c[3] + ')</div>').join('');
    } else h = tradeHtml();
    body.innerHTML = h;
    const w2 = body.querySelector('.wheel'); if (w2) w2.scrollLeft = sl; body.scrollTop = st;
  }
  $('dBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || !g) return; const a = b.dataset.a, card = b.closest('.deed'), sp = card ? +card.dataset.sp : -1, pr = sp >= 0 ? g.props[sp] : null; let r = '';
    sfx('click');
    if (a === 'build') r = g.intent(meId, { t: 'build', sp: sp });
    else if (a === 'sell') r = g.intent(meId, { t: 'sell', sp: sp });
    else if (a === 'hock') r = g.intent(meId, { t: pr.hocked ? 'unhock' : 'hock', sp: sp });
    else if (a === 'rush') r = g.intent(meId, { t: 'rush', sp: sp });
    else if (a === 'find') { const rc = RECTS[sp]; setDrawer(false); cam.x = rc.x + rc.w / 2; cam.y = rc.y + rc.h / 2; cam.s = Math.min(W, H) / (CELL * 3.7); cam.manual = true; cam.manualAt = performance.now(); ui.info = { sp: sp }; return; }
    else if (a === 'usePass') { r = g.intent(meId, { t: 'usePass' }); if (!r) setDrawer(false); }
    else return tradeClick(a, b);
    if (r) toast(r);
    paintDrawer(true);
  });

  // ---- deals (drawer Trade tab)
  function canDealWith(to) {
    const a = me(), b = g.byId(to); if (!a || !b || b.bankrupt) return 'Pick someone';
    if (a.bankrupt) return 'You\'re out of the game';
    if (prefs.trade === 'covert') { const d = ringDist(a.pos, b.pos); return d <= prefs.covertN ? '' : b.name + ' is ' + d + ' squares away (covert deals need ' + prefs.covertN + ' or closer)'; }
    return myTurn() ? '' : 'Open table: you can offer deals on your turn';
  }
  function tradeHtml() {
    const m = me(), tr = ui.trade, opps = g.players.filter((p) => p.id !== meId && !p.bankrupt);
    if (!opps.length) return '<div class="empty">No one left to deal with.</div>';
    if (!opps.some((p) => p.id === tr.to)) tr.to = opps[0].id;
    const o = g.byId(tr.to), mine = g.trades.filter((t) => t.status === 'open' && t.a === meId);
    let h = '<div class="note">' + (prefs.trade === 'open' ? 'Open table: offer a deal on your turn. Everyone sees it.' : 'Covert deals: private, only within ' + prefs.covertN + ' squares.') + '</div>';
    h += '<div class="who-row">' + opps.map((p) => '<button data-a="to" data-id="' + p.id + '" class="' + (p.id === tr.to ? 'on' : '') + '" style="color:' + inkOn(p.color) + '">' + esc(p.name) + (prefs.trade === 'covert' ? ' \u00b7 ' + ringDist(m.pos, p.pos) + ' sq' : '') + '</button>').join('') + '</div>';
    const chips = (pid, sel, a) => { const pp = g.byId(pid), ds = g.props.map((pr, i) => (pr && pr.owner === g.oid(pp) ? i : -1)).filter((i) => i >= 0); return ds.length ? '<div class="chips">' + ds.map((i) => '<button data-a="' + a + '" data-sp="' + i + '" class="' + (sel.indexOf(i) >= 0 ? 'on' : '') + '"><i style="background:' + groupColor(i) + '"></i>' + esc(S[i].short) + (g.props[i].hocked ? ' (mtg)' : '') + '</button>').join('') + '</div>' : '<div class="note">No deeds</div>'; };
    h += '<div class="side"><h4>You give</h4>' + chips(meId, tr.give, 'give') + '<div class="stepper"><button data-a="gc-">\u2212</button><b>' + money(tr.gCash) + '</b><button data-a="gc+">+</button><span class="note">of ' + money(m.cash) + '</span></div></div>';
    h += '<div class="side"><h4>' + esc(o.name) + ' gives</h4>' + chips(o.id, tr.get, 'get') + '<div class="stepper"><button data-a="tc-">\u2212</button><b>' + money(tr.tCash) + '</b><button data-a="tc+">+</button><span class="note">of ' + money(o.cash) + '</span></div></div>';
    const gate = canDealWith(o.id);
    h += '<div class="msg">' + esc(tr.msg || gate) + '</div><div class="btnrow"><button class="btn go" data-a="send" ' + (gate ? 'disabled' : '') + '>Offer the deal</button><button class="btn ghost" data-a="clear">Clear</button></div>';
    if (mine.length) h += '<div class="sect">Waiting on</div>' + mine.map((t) => '<div class="note">' + esc(nm(t.b)) + ' is thinking\u2026 <button class="tog" data-a="cancel" data-id="' + t.id + '">Cancel</button></div>').join('');
    return h;
  }
  function tradeClick(a, b) {
    const tr = ui.trade, m = me(), o = g.byId(tr.to);
    if (a === 'to') { tr.to = +b.dataset.id; tr.get = []; tr.tCash = 0; tr.msg = ''; }
    else if (a === 'give' || a === 'get') { const L = tr[a], sp = +b.dataset.sp, k = L.indexOf(sp); if (k >= 0) L.splice(k, 1); else L.push(sp); tr.msg = ''; }
    else if (a === 'gc+') tr.gCash = Math.min(m.cash, tr.gCash + 50); else if (a === 'gc-') tr.gCash = Math.max(0, tr.gCash - 50);
    else if (a === 'tc+') tr.tCash = Math.min(o ? o.cash : 0, tr.tCash + 50); else if (a === 'tc-') tr.tCash = Math.max(0, tr.tCash - 50);
    else if (a === 'clear') Object.assign(tr, { give: [], get: [], gCash: 0, tCash: 0, msg: '' });
    else if (a === 'cancel') g.declineTrade(meId, +b.dataset.id);
    else if (a === 'send') {
      const r = g.proposeTrade(meId, tr.to, { cash: tr.gCash, props: tr.give.slice(), passes: 0 }, { cash: tr.tCash, props: tr.get.slice(), passes: 0 });
      tr.msg = r || 'Offer sent to ' + o.name + '.'; if (!r) sfx('deal');
    }
    paintDrawer(true);
  }
  function openTrade(pid, getSp) { ui.trade = { to: pid, give: [], get: getSp != null ? [getSp] : [], gCash: 0, tCash: 0, msg: '' }; ui.tab = 'trade'; ui.info = null; setDrawer(true); }

  // ------------------------------------------------------------------ tap a player: options pop out of them
  const CHAT_LINES = ['Nice roll!', 'Wanna make a deal?', 'That rent hurts \uD83D\uDE05', 'I\'m coming for that set.', 'Good game!', 'Ha! Good one.'];
  function openBubble(p) { ui.bubble = { pid: p.id }; ui.chatMode = false; paintBubble(); sfx('pop'); }
  function closeBubble() { ui.bubble = null; $('bubbleMenu').hidden = true; }
  function paintBubble() {
    const el = $('bubbleMenu'), b = ui.bubble; if (!b) return; const p = g.byId(b.pid); if (!p || p.bankrupt) return closeBubble();
    let h;
    if (ui.chatMode) h = CHAT_LINES.map((l, k) => '<button data-b="say" data-k="' + k + '">' + esc(l) + '</button>').join('') + '<button class="x" data-b="x">\u2715</button>';
    else if (p.id === meId) h = '<button data-b="stuff">\uD83D\uDCBC My stuff</button><button data-b="chat">\uD83D\uDCAC Say\u2026</button><button class="x" data-b="x">\u2715</button>';
    else h = '<button data-b="deal">\uD83E\uDD1D Make an offer</button><button data-b="chat">\uD83D\uDCAC Chat</button><button class="x" data-b="x">\u2715</button>';
    el.innerHTML = '<div style="width:100%;text-align:center;font-weight:700;text-shadow:0 1px 4px #000">' + esc(p.id === meId ? 'You' : p.name) + '</div>' + h; el.hidden = false; posBubble();
  }
  function posBubble() { const b = ui.bubble; if (!b || !g) return; const p = g.byId(b.pid); if (!p) return; const v = visOf(p), s = toScreen(v.x, v.y - 74), el = $('bubbleMenu'); el.style.left = Math.max(150 * UIZ, Math.min(W - 150 * UIZ, s.x)) + 'px'; el.style.top = Math.max(el.offsetHeight * UIZ + 50 * UIZ, Math.min(H - 80 * UIZ, s.y)) + 'px'; }
  $('bubbleMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-b]'); if (!b || !ui.bubble) return; const a = b.dataset.b, pid = ui.bubble.pid; sfx('click');
    if (a === 'x') return closeBubble();
    if (a === 'chat') { ui.chatMode = true; return paintBubble(); }
    if (a === 'say') { g.chat(meId, pid === meId ? 'all' : pid, CHAT_LINES[+b.dataset.k]); return closeBubble(); }
    if (a === 'deal') { closeBubble(); return openTrade(pid); }
    if (a === 'stuff') { closeBubble(); ui.tab = 'deeds'; return setDrawer(true); }
  });

  // ------------------------------------------------------------------ pop-ups: landing events, auctions, offers, tapped spaces
  const R2 = (a, b) => '<div class="r" style="display:flex;justify-content:space-between"><span>' + a + '</span><b>' + b + '</b></div>';
  function tileHtml(i, extra) { const sp = S[i]; return '<div class="tile"><div class="hd" style="background:' + (sp.price ? groupColor(i) : '#3a3352') + '">' + esc(sp.name) + '</div><div class="bd">' + (extra || '') + rentRows(i).replace(/class="r/g, 'style="display:flex;justify-content:space-between" class="r') + '</div></div>'; }
  function sideList(side) { const out = []; if (side.cash) out.push(money(side.cash)); (side.props || []).forEach((sp) => out.push(S[sp].name)); if (side.passes) out.push(side.passes + ' Tow Pass'); return out.length ? out.map(esc).join(', ') : 'nothing'; }
  function computePop() {
    const t = g.turn, m = me();
    if (g.phase === 'over') {
      if (ui.overSeen) return null;
      const res = g.results || [];
      return { key: 'over', html: '<h2>' + esc(res[0] ? (res[0].pid === meId ? 'You win!' : res[0].name + ' wins') : 'Game over') + '</h2>' + res.map((r) => '<div class="rank' + (r.bankrupt ? ' bust' : '') + '"><span class="pl">' + r.place + '</span><div class="who"><b style="color:' + inkOn(r.color) + '">' + esc(r.pid === meId ? r.name + ' (you)' : r.name) + '</b><small>' + esc(r.title || '') + '</small></div><span class="w">' + (r.bankrupt ? 'bust' : money(r.worth)) + '</span></div>').join('') +
        '<div class="btnrow"><button class="btn go" data-x="again">New game</button><button class="btn ghost" data-x="seeBoard">See the board</button></div>' };
    }
    if (!t || !m) return null;
    const mine = t.pid === meId;
    if (mine && t.tab) {
      let plan = ''; try { if (!t.tab.hopeless) plan = g.planText(g.planRaise(m, t.tab.amount)); } catch (e) {}
      if (plan && typeof plan === 'object') plan = plan.text || '';
      return { key: 'tab' + t.tab.amount + t.tab.hopeless + plan, html: '<h2>You owe ' + money(t.tab.amount) + '</h2><p>' + esc(t.tab.reason || '') + '. You have ' + money(m.cash) + ' cash.</p>' + (plan ? '<p class="note">Plan: ' + esc(plan) + '</p>' : '') +
        '<div class="btnrow">' + (t.tab.hopeless ? '<button class="btn red" data-x="giveUp">Go bankrupt</button>' : '<button class="btn go" data-x="raise">Raise it for me</button>') + '<button class="btn" data-x="stuff">Open my stuff</button></div>' };
    }
    if (t.auction && ui.skipAuction !== t.auction.seq) {
      const a = t.auction, lead = a.leader >= 0 ? g.byId(a.leader) : null, mx = g.maxBid(m);
      return { key: 'auc' + a.seq + ':' + a.bid + ':' + a.leader, soft: true, html: '<h2>Auction</h2>' + tileHtml(a.sp, R2('List price', money(S[a.sp].price))) +
        '<p>Top bid <b>' + money(a.bid) + '</b> ' + (lead ? '(' + esc(lead.id === meId ? 'you' : lead.name) + ')' : '(no bids yet)') + '</p><div class="cd"><i id="cdBar"></i></div>' +
        (m.bankrupt ? '' : '<div class="btnrow">' + C.auction.steps.map((s) => '<button class="btn go" data-x="bid" data-v="' + s + '" ' + (a.leader === meId || a.bid + s > mx ? 'disabled' : '') + '>+' + money(s) + '</button>').join('') + '</div>') +
        '<div class="btnrow"><button class="btn ghost" data-x="skipAuc">Not interested</button></div>' };
    }
    if (mine && t.stage === 'act' && t.buy != null) {
      const sp = t.buy, price = g.priceFor(m, sp), gr = S[sp].group, have = gr ? g.countOwned(g.oid(m), gr) : 0, size = gr ? B.GROUP_MEMBERS[gr].length : 1;
      return { key: 'buy' + sp + ':' + (m.cash >= price) + ':' + t.landedAt, soft: true, html: '<p>You landed on</p>' + tileHtml(sp, R2('Price', money(price)) + R2('You own', have + ' of ' + size)) +
        (m.cash < price ? '<p>Not enough cash. Mortgage something in your stuff, or pass.</p>' : '') +
        '<div class="btnrow"><button class="btn go" data-x="buy" ' + (m.cash < price ? 'disabled' : '') + '>Buy ' + money(price) + '</button><button class="btn" data-x="skip">Pass' + (g.rules.auctions ? ' (auction)' : '') + '</button></div>' + (m.cash < price ? '<div class="btnrow"><button class="btn ghost" data-x="stuff">Open my stuff</button></div>' : '') };
    }
    if (t.payup && !t.payup.done && t.payup.owner === g.oid(m)) {
      const mv = g.byId(t.payup.mover);
      return { key: 'pu' + t.payup.seq + ':' + g.turnCount, html: '<h2>' + esc(mv.name) + ' is on your ' + esc(S[t.payup.sp].name) + '!</h2><p>Catch them before they pass the dice.</p><div class="btnrow"><button class="btn go payup" data-x="payup">PAY UP! ' + money(t.payup.rent) + '</button></div>' };
    }
    if (mine && t.stage === 'roll' && m.snow && ui.snowAsked !== g.turnCount) {
      return { key: 'snow' + g.turnCount + ':' + m.passes.length + ':' + (m.cash >= C.towFee), html: '<h2>Stuck in the Snowbank</h2><p>Try ' + (m.snowTries + 1) + ' of ' + C.snowTries + '. Roll doubles to drive out, or get towed.</p><div class="btnrow"><button class="btn go" data-x="snowRoll">Roll for doubles</button><button class="btn" data-x="tow" ' + (m.cash < C.towFee ? 'disabled' : '') + '>Pay ' + money(C.towFee) + ' tow</button></div>' +
        (m.passes.length ? '<div class="btnrow"><button class="btn" data-x="pass">Use a Tow Truck Pass</button></div>' : '') };
    }
    const offer = g.trades.filter((x) => x.status === 'open' && x.waiting === meId)[0];
    if (offer) {
      const other = g.byId(offer.a === meId ? offer.b : offer.a), theyGive = offer.a === meId ? offer.bGives : offer.aGives, iGive = offer.a === meId ? offer.aGives : offer.bGives;
      return { key: 'tr' + offer.id + ':' + offer.v, soft: true, html: '<h2>' + esc(other.name) + ' offers a deal</h2><p><b>You get:</b> ' + sideList(theyGive) + '</p><p><b>You give:</b> ' + sideList(iGive) + '</p>' +
        '<div class="btnrow"><button class="btn go" data-x="accept" data-id="' + offer.id + '">Accept</button><button class="btn" data-x="decline" data-id="' + offer.id + '">No thanks</button></div>' };
    }
    if (ui.info) {
      const i = ui.info.sp, sp = S[i], pr = g.props[i]; let body = '', btns = '';
      if (pr) {
        const o = pr.owner >= 0 ? g.byId(pr.owner) : null;
        body = tileHtml(i, R2('Owner', o ? esc(o.id === meId ? 'You' : o.name) : 'For sale ' + money(sp.price)) + (o ? R2('Rent now', pr.hocked ? 'mortgaged' : money(g.rentFor(i, 7, false))) : ''));
        if (B.STORIES[i]) body += '<p class="note">' + esc(B.STORIES[i]) + '</p>';
        if (o && o.id !== meId && !o.bankrupt && !m.bankrupt) btns = '<button class="btn go" data-x="offerFor" data-id="' + o.id + '" data-sp="' + i + '">Make ' + esc(o.name) + ' an offer</button>';
        if (o && o.id === meId) btns = '<button class="btn go" data-x="manage" data-sp="' + i + '">Manage it</button>';
      } else {
        const D = { halfway: 'Collect ' + money(C.halfwayPay) + ' every time you pass.', snowbank: 'Just driving by, unless you got stuck. Roll doubles, pay ' + money(C.towFee) + ' or use a Tow Truck Pass to leave.', whiteout: 'WHITEOUT! Straight into the Snowbank.', dirtlot: g.rules.jackpot ? 'Land here to win the pot: ' + money(g.pot) + '.' : 'A free rest stop.', random: 'Draw a RED DEER RANDOMNESS card.', finds: 'Draw a SECRET FINDS card: a true Red Deer story.', tax: 'Pay ' + money(sp.amount || 0) + '.' };
        body = '<h2>' + esc(sp.name) + '</h2><p>' + esc(D[sp.type] || '') + '</p>';
      }
      const here = g.players.filter((p) => !p.bankrupt && p.pos === i);
      if (here.length) body += '<p class="note">Here now: ' + here.map((p) => esc(p.id === meId ? 'you' : p.name)).join(', ') + '</p>';
      return { key: 'info' + i + ':' + g.version, soft: true, html: body + '<div class="btnrow">' + btns + '<button class="btn ghost" data-x="closeInfo">Close</button></div>' };
    }
    return null;
  }
  function paintPop() {
    const pop = $('pop'), hold = ui.drawer || ui.panel || !$('cardPop').hidden, P = hold ? null : computePop();
    if (!P) { if (!pop.hidden) { pop.hidden = true; ui.popKey = ''; } return; }
    if (P.key !== ui.popKey) { ui.popKey = P.key; $('popCard').innerHTML = P.html; pop.classList.toggle('soft', !!P.soft); pop.hidden = false; }
    const a = g.turn && g.turn.auction, bar = $('cdBar'); if (a && bar) bar.style.width = Math.max(0, Math.min(100, (a.endsAt - g.now) / (C.auction.ms / g.speed) * 100)) + '%';
  }
  $('pop').addEventListener('click', (e) => {
    if (e.target === $('pop') && ui.info) { ui.info = null; return; }
    const b = e.target.closest('[data-x]'); if (!b || !g) return; const x = b.dataset.x, t = g.turn; let r = '';
    sfx('click');
    switch (x) {
      case 'buy': r = g.intent(meId, { t: 'buy' }); break;
      case 'skip': r = g.intent(meId, { t: 'skipBuy' }); break;
      case 'bid': r = g.intent(meId, { t: 'bid', add: +b.dataset.v }); break;
      case 'skipAuc': ui.skipAuction = t.auction ? t.auction.seq : -1; break;
      case 'raise': r = g.intent(meId, { t: 'raise' }); break;
      case 'giveUp': r = g.intent(meId, { t: 'giveUp' }); break;
      case 'stuff': ui.tab = 'deeds'; setDrawer(true); break;
      case 'payup': if (g.payup(meId)) { sfx('caught'); vib([30, 30, 60]); } else r = 'Too late!'; break;
      case 'snowRoll': ui.snowAsked = g.turnCount; break;
      case 'tow': r = g.intent(meId, { t: 'payTow' }); break;
      case 'pass': r = g.intent(meId, { t: 'usePass' }); break;
      case 'accept': r = g.acceptTrade(meId, +b.dataset.id); if (!r) sfx('deal'); break;
      case 'decline': g.declineTrade(meId, +b.dataset.id); break;
      case 'offerFor': openTrade(+b.dataset.id, +b.dataset.sp); break;
      case 'manage': { const sp = +b.dataset.sp; ui.info = null; ui.tab = 'deeds'; setDrawer(true); setTimeout(() => { const el = document.querySelector('.deed[data-sp="' + sp + '"]'); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 60); break; }
      case 'closeInfo': ui.info = null; break;
      case 'again': quitToSetup(false); return;
      case 'seeBoard': ui.overSeen = true; cam.whole = true; syncZoomBtn(); break;
    }
    if (r) toast(r);
    ui.popKey = '';
  });

  // ------------------------------------------------------------------ drawn card: swipe up onto the board to play, down to stash (keepers)
  function paintCard() {
    const t = g.turn, el = $('cardPop');
    const live = t && g.phase === 'play' && t.stage === 'card' && t.pid === meId && t.card;
    if (!live) { if (!el.hidden) el.hidden = true; return; }
    const key = g.turnCount + ':' + t.rollSeq + ':' + t.card.deck + ':' + t.card.idx;
    if (ui.cardDecided === key) { t.card.until = Math.min(t.card.until, g.now + 330); return; }
    t.card.until = g.now + 600000;            // the card waits for your swipe
    if (ui.cardKey === key && !el.hidden) return;
    ui.cardKey = key; closeBubble(); if (ui.drawer) setDrawer(false);
    const cd = B.DECKS[t.card.deck][t.card.idx], keeper = cd.fx.k === 'pass', dc = $('drawCard');
    dc.className = t.card.deck === 'finds' ? 'finds' : ''; dc.style.transform = ''; dc.style.opacity = '';
    dc.innerHTML = '<div class="dk">' + esc(C.decks[t.card.deck].name) + (cd.year ? ' \u00b7 ' + esc(cd.year) : '') + '</div><h3>' + esc(cd.h) + '</h3>' + (cd.story ? '<p>' + esc(cd.story) + '</p>' : '') + '<p class="fx">' + esc(cd.t) + '</p>';
    el.querySelector('.hint.up').textContent = keeper ? '\u21E7 Swipe up: keep it handy' : '\u21E7 Swipe up to play it';
    const dh = $('downHint'); dh.textContent = keeper ? '\u21E9 Swipe down to stash it' : 'This one plays right away'; dh.classList.toggle('off', !keeper);
    el.hidden = false; sfx('card'); vib(20);
  }
  function decideCard(dir) {
    const t = g.turn; if (!t || t.stage !== 'card' || !t.card || ui.cardDecided === ui.cardKey) return false;
    const cd = B.DECKS[t.card.deck][t.card.idx], keeper = cd.fx.k === 'pass', dc = $('drawCard');
    if (dir > 0 && !keeper) { dc.classList.add('fly'); dc.style.transform = 'translateY(30px)'; setTimeout(() => { dc.style.transform = ''; setTimeout(() => dc.classList.remove('fly'), 360); }, 150); toast('This card plays right away: swipe it up'); return false; }
    ui.cardDecided = ui.cardKey; dc.classList.add('fly'); dc.style.transform = dir < 0 ? 'translateY(-120vh) rotate(-8deg)' : 'translateY(120vh) scale(.4)'; dc.style.opacity = '0';
    if (keeper) toast('\uD83D\uDE9A Tow Truck Pass stashed in your stuff', '#ffd23f');
    setTimeout(() => { $('cardPop').hidden = true; dc.classList.remove('fly'); }, 330);
    return true;
  }
  (function () {
    const dc = $('drawCard'), cp = $('cardPop'); let st = null;
    cp.addEventListener('pointerdown', (e) => { st = { y: e.clientY, t: performance.now() }; if (cp.setPointerCapture) try { cp.setPointerCapture(e.pointerId); } catch (er) {} });
    cp.addEventListener('pointermove', (e) => { if (!st) return; dc.style.transform = 'translateY(' + ((e.clientY - st.y) / popK.card) + 'px) rotate(' + ((e.clientY - st.y) / 40) + 'deg)'; });
    cp.addEventListener('pointerup', (e) => { if (!st) return; const dy = e.clientY - st.y, dt = performance.now() - st.t; st = null; if (dy < -70) decideCard(-1); else if (dy > 70) decideCard(1); else { dc.style.transform = ''; if (Math.abs(dy) < 8 && dt < 400) toast('Swipe the card up to play it'); } });
    cp.addEventListener('pointercancel', () => { st = null; dc.style.transform = ''; });
  })();

  // ------------------------------------------------------------------ v0.3 pop sizing: big in the normal camera, v0.2 size in close follow
  const popK = { pop: 1, card: 1, big: null, popSt: '', wrapSt: '' };
  const bigCam = () => !(cam.mode === 'close' && !cam.whole);
  function safeBottom() { const d = $('drawer'); return d ? parseFloat(getComputedStyle(d).paddingBottom) || 0 : 0; }
  function layoutPops() {
    const big = bigCam(), changed = popK.big !== null && popK.big !== big; popK.big = big;
    const pop = $('pop'), pc = $('popCard');
    if (!pop.hidden) {
      if (!pop.classList.contains('sized')) { pop.classList.add('sized', 'nomove'); requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.remove('nomove'))); }
      let k = big ? Math.max(1.4, 0.88 * W / 380) : 1;
      if (!big) k = UIZ;
      const w = big ? 0.88 * W / k : Math.min(W - 32 * UIZ, 380 * UIZ) / UIZ;
      if (Math.abs((parseFloat(pc.style.width) || 0) - w) > 0.5) pc.style.width = w.toFixed(1) + 'px';
      const h = pc.offsetHeight || 1, avail = H - 96 * UIZ;          // keep clear of the top bar and the drawer grip
      if (h * k > avail) k = Math.max(big ? 1 : 0.6, avail / h);
      const soft = pop.classList.contains('soft'), top = big || !soft ? H / 2 + 8 * UIZ : H - (safeBottom() + 70) * UIZ - h * k / 2;
      const st = top.toFixed(1) + '|' + k.toFixed(3);
      if (st !== popK.popSt) { popK.popSt = st; pc.style.top = top.toFixed(1) + 'px'; pc.style.transform = 'translate(-50%, -50%) scale(' + k.toFixed(3) + ')'; }
      popK.pop = k;
    } else popK.popSt = '';
    const cp = $('cardPop'), wr = $('drawWrap');
    if (!cp.hidden) {
      let k = big ? Math.max(1.35, 0.88 * W / 320) : UIZ;
      const w = big ? 0.88 * W / k : Math.min(0.78 * W, 320 * UIZ) / UIZ;
      if (Math.abs((parseFloat(wr.style.width) || 0) - w) > 0.5) wr.style.width = w.toFixed(1) + 'px';
      const h = wr.offsetHeight || 1, avail = H * 0.66;
      if (h * k > avail) k = Math.max(big ? 1 : 0.6, avail / h);
      const st = k.toFixed(3) + '|' + h;
      if (st !== popK.wrapSt) { popK.wrapSt = st; wr.style.transform = 'scale(' + k.toFixed(3) + ')'; wr.style.margin = Math.max(0, h * (k - 1) / 2).toFixed(1) + 'px 0'; }
      popK.card = k;
    } else popK.wrapSt = '';
    return changed;
  }

  // ------------------------------------------------------------------ v0.3 edge radar (close follow only)
  // players offscreen: a small triangle on the screen edge in their direction, in their token colour (smaller + fainter when far away)
  // owned deeds offscreen: tiny green dots for yours, very thin red ticks for ones you'd pay rent on. Drawn in screen space, never on the map.
  function edgePoint(sx, sy, L, T, R, Bt) {
    const cx = (L + R) / 2, cy = (T + Bt) / 2, dx = sx - cx, dy = sy - cy;
    const tx = dx > 0 ? (R - cx) / dx : dx < 0 ? (L - cx) / dx : Infinity, ty = dy > 0 ? (Bt - cy) / dy : dy < 0 ? (T - cy) / dy : Infinity, t = Math.min(tx, ty);
    return { x: cx + dx * t, y: cy + dy * t, a: Math.atan2(dy, dx), side: tx < ty ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't') };
  }
  function drawRadar(c, view) {
    if (!g || g.phase !== 'play' || bigCam()) return;
    const m = me(); if (!m) return;
    const top = 50 * UIZ, bot = H - (safeBottom() + 66) * UIZ, inset = 9 * UIZ, L = inset, T = top + inset, R = W - inset, Bt = bot - inset;
    const offscreen = (s, pad) => s.x < -pad || s.x > W + pad || s.y < top - pad || s.y > bot + pad;
    const cw = { x: view.x, y: view.y };
    c.save();
    // property pips first (under the player markers)
    const myO = g.oid(m);
    for (let i = 0; i < 40; i++) {
      const pr = g.props[i]; if (!pr || pr.owner == null || pr.owner < 0) continue;
      const r = RECTS[i], s = toScreen(r.x + r.w / 2, r.y + r.h / 2, view); if (!offscreen(s, 0)) continue;
      const e = edgePoint(s.x, s.y, L - 4, T - 4, R + 4, Bt + 4);
      if (pr.owner === myO) { c.globalAlpha = pr.hocked ? 0.25 : 0.55; c.fillStyle = '#3ddc84'; c.beginPath(); c.arc(e.x, e.y, 2.4, 0, Math.PI * 2); c.fill(); }
      else {
        const ow = g.byId(pr.owner); if (!ow || ow.bankrupt || pr.hocked) continue;
        c.globalAlpha = 0.5; c.strokeStyle = '#ff4a4a'; c.lineWidth = 1.4; c.beginPath();
        if (e.side === 'l' || e.side === 'r') { c.moveTo(e.x, e.y - 4); c.lineTo(e.x, e.y + 4); } else { c.moveTo(e.x - 4, e.y); c.lineTo(e.x + 4, e.y); }
        c.stroke();
      }
    }
    // player waypoints
    g.players.forEach((p) => {
      if (p.id === meId || p.bankrupt) return;
      const v = visOf(p), s = toScreen(v.x, v.y - 30, view); if (!offscreen(s, 10)) return;
      const d = Math.hypot(v.x - cw.x, v.y - cw.y), f = Math.max(0, Math.min(1, d / (BW * 0.75)));
      const size = (13 - 4 * f) * Math.min(UIZ, 2), e = edgePoint(s.x, s.y, L + size, T + size, R - size, Bt - size);
      c.globalAlpha = 1 - 0.4 * f;
      c.translate(e.x, e.y); c.rotate(e.a);
      c.beginPath(); c.moveTo(size, 0); c.lineTo(-size * 0.7, -size * 0.75); c.lineTo(-size * 0.7, size * 0.75); c.closePath();
      c.fillStyle = p.color; c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
    });
    c.restore();
  }

  // ------------------------------------------------------------------ main loop
  let lastT = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const nowP = performance.now(), dtS = Math.min(0.1, (nowP - lastT) / 1000); lastT = nowP;
    if (!g) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#14121b'; ctx.fillRect(0, 0, W, H); return; }
    try {
      if (!frozen) {
        const cur = g.cur(); g.speed = BASE_SPEED * (prefs.fastAI && cur && g.isBot(cur) && !(g.turn && g.turn.auction) ? 2.2 : 1);
        if (g.phase === 'play') paintCard();          // holds a drawn card for your swipe before the engine applies it
        g.tick(nowMs());
        if (g.phase === 'play') AI.tick(g);
        updatePeople(dtS);
      }
      stepCam(dtS);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const sa = shake.amp * Math.max(0, 1 - (performance.now() - shake.at) / 260), view = sa > 0.2 ? { x: cam.x + (Math.random() - 0.5) * sa / cam.s, y: cam.y + (Math.random() * 0.6 + 0.2) * sa / cam.s, s: cam.s } : cam;
      drawScene(ctx, view, W, H);
      drawRadar(ctx, view);
      paintTop(); paintDice(); paintPop(); layoutPops(); paintPeek(); if (ui.drawer) paintDrawer(); if (ui.bubble) posBubble();
    } catch (e) { console.error(e); }
  }

  // ------------------------------------------------------------------ setup screen
  const LOOKS = { pants: PPL.PANTS, shoes: PPL.SHOES, skin: PPL.SKINS };
  // v0.2: scale the setup to the phone's height so it fills the screen (bigger targets on tall phones, still fits short ones)
  // v0.4: the setup is laid out for a ~400 x 860 phone and zoomed to the real window, so it fills ~95% of the width and the full height
  // whatever the layout viewport is (desktop-site mode, big tablets, landscape). The column's own height = window height / zoom: no dead gap.
  let SZ = 1;
  function fitSetup() {
    const Wn = window.innerWidth, Hn = window.innerHeight, sx = document.querySelector('#setup .sx'); if (!sx) return;
    SZ = Math.max(0.78, Math.min(3.5, Math.min(Wn / 400, Hn / 860)));
    document.documentElement.style.setProperty('--u', '1');
    sx.style.zoom = SZ.toFixed(4);
    sx.style.width = Math.min(Wn * 0.95 / SZ, 560).toFixed(1) + 'px';
    sx.style.minHeight = (Hn / SZ).toFixed(1) + 'px';
    const lh = Hn / SZ; sx.classList.toggle('vtall', lh > 980); sx.classList.toggle('tall', lh >= 900); sx.classList.toggle('short', lh < 720);   // breakpoints in the column's own (zoomed) units
    if (deck.built) layoutDeck();
  }
  window.addEventListener('resize', fitSetup);
  // golden-ratio spiral meter: grows outward from the centre, the gold part = value / 10, the stroke thickens as it grows
  const PHI = (1 + Math.sqrt(5)) / 2;
  function spiralPts(n) { const pts = [], TH = 3 * Math.PI, a = 0.95; for (let i = 0; i <= n; i++) { const th = TH * i / n, r = a * Math.pow(PHI, th / (Math.PI / 2)), an = th + 0.6; pts.push([20 + Math.cos(an) * r - 1.5, 21 + Math.sin(an) * r + 1]); } return pts; }
  const SP = spiralPts(90), SP_VB = (() => { const xs = SP.map((q) => q[0]), ys = SP.map((q) => q[1]), x0 = Math.min.apply(null, xs) - 3.5, y0 = Math.min.apply(null, ys) - 3.5, sz = Math.max(Math.max.apply(null, xs) - x0, Math.max.apply(null, ys) - y0) + 3.5;
    return x0.toFixed(1) + ' ' + y0.toFixed(1) + ' ' + sz.toFixed(1) + ' ' + sz.toFixed(1); })();
  function ribbon(pts, w0, w1) {
    const L = [], R = [], n = pts.length - 1;
    pts.forEach((pt, i) => { const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(n, i + 1)], dx = q1[0] - q0[0], dy = q1[1] - q0[1], d = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * i / Math.max(1, n)) / 2;
      L.push((pt[0] - dy / d * w).toFixed(2) + ',' + (pt[1] + dx / d * w).toFixed(2)); R.push((pt[0] + dy / d * w).toFixed(2) + ',' + (pt[1] - dx / d * w).toFixed(2)); });
    return L.concat(R.reverse()).join(' ');
  }
  const SP_BG = ribbon(SP, 1.1, 2.2), SP_LEN = SP.reduce((a, pt, i) => { a.push(i ? a[i - 1] + Math.hypot(pt[0] - SP[i - 1][0], pt[1] - SP[i - 1][1]) : 0); return a; }, []);
  function spiralSVG(v, uid) {
    const want = Math.max(0, Math.min(10, v)) / 10 * SP_LEN[SP_LEN.length - 1]; let k = 0; while (k < SP.length - 1 && SP_LEN[k + 1] <= want) k++;
    const fg = k >= 2 ? '<polygon points="' + ribbon(SP.slice(0, k + 1), 1.2, 1.2 + 4.2 * k / (SP.length - 1)) + '" fill="url(#sg' + uid + ')"/>' : '';
    return '<svg viewBox="' + SP_VB + '" aria-hidden="true"><defs><linearGradient id="sg' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE7A1"/><stop offset=".55" stop-color="#E2B84A"/><stop offset="1" stop-color="#9c7314"/></linearGradient></defs>' +
      '<polygon points="' + SP_BG + '" fill="#4a4266"/>' + fg + '<circle cx="' + SP[0][0].toFixed(2) + '" cy="' + SP[0][1].toFixed(2) + '" r="1.6" fill="' + (v > 0 ? '#E2B84A' : '#5a5370') + '"/></svg>';
  }
  function statHTML(n, d, v, uid, soon) { return '<div class="stat" title="' + esc(d) + '">' + spiralSVG(v, uid) + '<div class="sl">' + esc(n) + (d || soon ? '<em>' + esc(soon ? d + ' \u00b7 coming soon' : d) + '</em>' : '') + '</div><b class="sv">' + (soon ? '-' : v) + '</b></div>'; }
  const deck = { i: 0, el: [], drag: 0, built: false };
  // ---- v0.4 your name lives on the front card: big bold name + a tiny pencil. No name = your character's name (as in the game).
  const shownName = (ch) => (prefs.name ? prefs.name : ch.name).toUpperCase();
  const roleLine = (ch) => (prefs.name ? 'as ' + ch.full + ' \u00b7 ' : '') + ch.role;
  function profileName() {      // the Zero to Phi profile on this site caches the signed-in display name / initials in localStorage
    const jg = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
    const pr = jg('ztp:profile') || {}, n = jg('ztp:dname') || pr.name || pr.displayName || jg('ztp:initials') || '';
    return String(n).replace(/[<>]/g, '').trim().slice(0, 12);
  }
  // Profile link (per game): off = keep the local name; once = take the profile name one time; always = follow the profile name every visit
  const PLINK_KEY = 'ztp_profileLink_rdr', PLINK_DONE = 'ztp_profileLink_rdr_done';
  const plink = () => { try { const v = localStorage.getItem(PLINK_KEY); return v === 'off' || v === 'once' || v === 'always' ? v : 'once'; } catch (e) { return 'once'; } };
  function signedIn() {   // the account script caches the signed-in name; a profile saved while signed out is marked local
    try { const pr = JSON.parse(localStorage.getItem('ztp:profile') || 'null'); if (pr && pr.local) return false; } catch (e) {}
    return !!profileName();
  }
  function syncProfileName() {
    const m = plink(); if (m === 'off' || !signedIn()) return;
    let done = false; try { done = localStorage.getItem(PLINK_DONE) === '1'; } catch (e) {}
    if (m === 'once' && done) return;
    const n = profileName(); if (n && n !== prefs.name) { prefs.name = n; savePrefs(); }
    if (m === 'once') try { localStorage.setItem(PLINK_DONE, '1'); } catch (e) {}
  }
  function paintPlink() {
    const on = signedIn(), m = plink(), box = $('plink'); if (!box) return;
    box.classList.toggle('off', !on);
    [...box.querySelectorAll('button')].forEach((b) => { b.classList.toggle('on', b.dataset.v === m); b.disabled = !on; });
    $('plinkHint').textContent = on ? 'name from your profile' : 'sign in on the main page';
  }
  $('plink').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    try { localStorage.setItem(PLINK_KEY, b.dataset.v); if (b.dataset.v === 'once') localStorage.removeItem(PLINK_DONE); } catch (er) {}
    syncProfileName(); paintNames(); paintPlink(); sfx('click');
  });
  function paintNames() { deck.el.forEach((el, i) => { const ch = C.characters[i]; const nm = el.querySelector('.nm'); if (nm) nm.textContent = shownName(ch); const rl = el.querySelector('.role'); if (rl) rl.textContent = roleLine(ch); }); }
  function editName() {
    const el = deck.el[deck.i]; if (!el || el.querySelector('.nmIn')) return;
    const ch = C.characters[deck.i], row = el.querySelector('.nmrow'), inp = document.createElement('input');
    inp.className = 'nmIn'; inp.maxLength = 12; inp.value = prefs.name || ''; inp.placeholder = ch.name; inp.autocomplete = 'off'; inp.setAttribute('enterkeyhint', 'done'); inp.setAttribute('aria-label', 'Your name');
    row.innerHTML = ''; row.appendChild(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (save) => { if (done) return; done = true;
      if (save) { const nv = inp.value.replace(/[<>]/g, '').trim().slice(0, 12); if (nv !== prefs.name && plink() === 'always') { try { localStorage.setItem(PLINK_KEY, 'off'); } catch (e) {} paintPlink(); } prefs.name = nv; savePrefs(); sfx('click'); }
      row.innerHTML = '<b class="nm"></b><button class="pen" type="button" aria-label="Edit your name" title="Edit your name">\u270E</button>'; paintNames(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', () => finish(true));
    ['pointerdown', 'pointerup', 'click'].forEach((t) => inp.addEventListener(t, (e) => e.stopPropagation()));
  }
  $('deckIn').addEventListener('pointerdown', (e) => { if (e.target.closest('.pen')) e.stopPropagation(); }, true);
  $('deckIn').addEventListener('click', (e) => { const pen = e.target.closest('.pen'); if (!pen) return; e.stopPropagation(); const card = pen.closest('.ccard'); if (card && +card.dataset.i !== deck.i) { goCard(+card.dataset.i); return; } editName(); });

  function cardHTML(ch, idx) {
    const st = statsOf(ch.id), soon = st.custom.some((c) => c.soon && !c.cos);
    return '<div class="ccard' + (soon ? ' soon' : '') + '" data-i="' + idx + '" style="--cc:' + ch.color + '">' +
      '<div class="ctop"><canvas width="148" height="188"></canvas><div class="cname"><div class="nmrow"><b class="nm">' + esc(shownName(ch)) + '</b><button class="pen" type="button" aria-label="Edit your name" title="Edit your name">\u270E</button></div><span class="role">' + esc(roleLine(ch)) + '</span><i>' + esc(ch.line) + '</i></div></div>' +
      '<div class="stats">' + COMMON.map((c, k) => statHTML(c.n, '', st[c.k], ch.id + k)).join('') + '</div>' +
      '<div class="chd">SPECIAL</div><div class="cust">' + st.custom.map((c, k) => statHTML(c.n + (c.cos ? ' \u2728' : ''), c.d, c.v, ch.id + 'c' + k, c.soon)).join('') + '</div>' +
      '<div class="perk" title="' + esc(ch.perkText) + '"><b>' + esc(ch.perk) + ':</b> ' + esc(ch.perkText) + '</div></div>';
  }
  function buildDeck() {
    $('deckIn').innerHTML = C.characters.map(cardHTML).join('');
    deck.el = [...$('deckIn').children]; deck.built = true;
    $('deckDots').innerHTML = C.characters.map(() => '<i></i>').join('');
  }
  function paintDeckAvatars() {
    deck.el.forEach((el, i) => { const ch = C.characters[i], av = el.querySelector('canvas'), c2 = av.getContext('2d'); c2.clearRect(0, 0, av.width, av.height);
      c2.fillStyle = ch.color; c2.beginPath(); c2.ellipse(74, 170, 42, 11, 0, 0, 7); c2.fill(); c2.strokeStyle = '#E2B84A'; c2.lineWidth = 3; c2.stroke();
      PPL.draw(c2, 74, 170, 156, Object.assign({}, prefs.look, { shirt: ch.color }), { face: 1, badge: ch.ink }); });
  }
  function layoutDeck() {
    const N = deck.el.length, cw = deck.el[0] ? deck.el[0].offsetWidth || 280 : 280;
    deck.el.forEach((el, i) => {
      let d = i - deck.i; if (d > N / 2) d -= N; if (d < -N / 2) d += N;
      const off = d + deck.drag / SZ / cw, ad = Math.abs(off), sc = 1 - 0.16 * Math.min(ad, 1.5);
      el.style.transform = 'translateX(' + (off * 64).toFixed(2) + '%) scale(' + sc.toFixed(3) + ') rotate(' + (off * 3).toFixed(2) + 'deg)';
      el.style.zIndex = String(100 - Math.round(ad * 10)); el.style.opacity = ad > 1.7 ? '0' : '1'; el.style.filter = 'brightness(' + (1 - 0.5 * Math.min(ad, 1)).toFixed(2) + ')';
      el.style.pointerEvents = ad > 1.7 ? 'none' : 'auto';
    });
    [...$('deckDots').children].forEach((dt, i) => dt.classList.toggle('on', i === deck.i));
    $('cardCount').textContent = (deck.i + 1) + ' / ' + N + ' \u00b7 swipe \u00b7 5 = standard';
  }
  function goCard(i) { const N = C.characters.length; deck.i = ((i % N) + N) % N; prefs.charId = C.characters[deck.i].id; savePrefs(); deck.drag = 0; layoutDeck(); sfx('click'); vib(8); }
  (function () {
    const el = $('deck'); let st = null;
    el.addEventListener('pointerdown', (e) => { st = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, h: false }; });
    el.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return; const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.h && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { st.h = true; try { el.setPointerCapture(e.pointerId); } catch (er) {} deck.el.forEach((c) => c.classList.add('drag')); }
      if (st.h) { deck.drag = dx; layoutDeck(); e.preventDefault(); }
    });
    const end = (e) => {
      if (!st) return; const dx = e.clientX - st.x, dt = performance.now() - st.t, h = st.h; st = null; deck.el.forEach((c) => c.classList.remove('drag'));
      if (h) { const v = dx / Math.max(1, dt); if (dx < -45 || v < -0.5) goCard(deck.i + 1); else if (dx > 45 || v > 0.5) goCard(deck.i - 1); else { deck.drag = 0; layoutDeck(); } return; }
      if (dt < 400 && e.type === 'pointerup') { const card = e.target.closest && e.target.closest('.ccard'); if (card && +card.dataset.i !== deck.i) goCard(+card.dataset.i); }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', (e) => { if (st) { st = null; deck.drag = 0; deck.el.forEach((c) => c.classList.remove('drag')); layoutDeck(); } });
    document.addEventListener('keydown', (e) => { if ($('setup').hidden || (document.activeElement && document.activeElement.tagName === 'INPUT')) return; if (e.key === 'ArrowRight') goCard(deck.i + 1); else if (e.key === 'ArrowLeft') goCard(deck.i - 1); });
  })();
  function paintSetup() {
    const ch = charById(prefs.charId) || C.characters[0]; prefs.charId = ch.id;
    if (!deck.built) buildDeck();
    deck.i = C.characters.findIndex((c) => c.id === ch.id); deck.drag = 0;
    syncProfileName(); paintPlink();
    [['oppSeg', 'opp'], ['lvlSeg', 'level'], ['lenSeg', 'len'], ['timSeg', 'timer'], ['puSeg', 'payup'], ['trSeg', 'trade']].forEach((x) => [...$(x[0]).children].forEach((b) => b.classList.toggle('on', String(prefs[x[1]]) === b.dataset.v)));
    paintDeckAvatars(); paintNames(); layoutDeck(); fitSetup();
    const s = loadSave(); $('resumeBox').hidden = !s;
    if (s) { const p = (s.game.players || []).find((q) => q.id === s.meId); $('resumeInfo').textContent = 'Round ' + s.game.round + (p ? ' \u00b7 you have ' + money(p.cash) : '') + ' \u00b7 saved ' + new Date(s.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  }
  document.querySelectorAll('#setup .seg').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = { oppSeg: 'opp', lvlSeg: 'level', lenSeg: 'len', timSeg: 'timer', puSeg: 'payup', trSeg: 'trade' }[seg.id], v = b.dataset.v;
    prefs[k] = /^\d+$/.test(v) ? +v : v; savePrefs(); paintSetup(); sfx('click');
  }));
  document.querySelector('#setup .sw').addEventListener('click', (e) => {
    const b = e.target.closest('[data-look]'); if (!b) return; const k = b.dataset.look; let L = prefs.look = PPL.clean(prefs.look);
    if (k === 'rand') prefs.look = PPL.random();
    else if (k === 'hat') { const opts = []; PPL.HATS.forEach((hs) => (hs === 'none' ? opts.push([hs, L.hat]) : PPL.SHIRTS.slice(0, 5).forEach((c) => opts.push([hs, c])))); const i = opts.findIndex((o) => o[0] === L.hatStyle && (o[0] === 'none' || o[1] === L.hat)); const n = opts[(i + 1) % opts.length]; L.hatStyle = n[0]; L.hat = n[1]; }
    else { const arr = LOOKS[k], i = arr.indexOf(L[k]); L[k] = arr[(i + 1) % arr.length]; }
    savePrefs(); paintSetup(); sfx('click');
  });
  $('startBtn').onclick = () => { try { SFX.unlock(); SFX.setMuted(prefs.mute); } catch (e) {} laUnlock(); newGame(); };
  $('resumeBtn').onclick = () => { try { SFX.unlock(); SFX.setMuted(prefs.mute); } catch (e) {} laUnlock(); if (!resume()) { toast('That save could not be loaded'); paintSetup(); } };

  // ------------------------------------------------------------------ test / future hooks (PiP, replays)
  window.RDRSolo = {
    version: VER, uiz: () => UIZ, setupZoom: () => SZ, editName: editName, passes: () => { const m = me(), w = m && visOf(m).walk; return w && w.passes ? w.passes.map((ps) => ({ pid: ps.pid, inMs: Math.round(ps.tc - g.now), done: ps.done })) : null; }, popK: popK, openInfo: (sp) => { ui.info = { sp: sp }; }, charStats: (id) => statsOf(id), goCard: goCard, smackTap: tapSmack, vis: (pid) => vis[pid], walking: () => g ? g.players.filter((p) => busy(vis[p.id])).map((p) => p.id) : [], game: () => g, meId: () => meId, cam: cam, drawScene: drawScene, replay: () => REC, looks: () => looks, prefs: prefs, savePrefs: savePrefs,
    setCamMode: setCamMode, diceMode: () => (g ? diceMode() : null), diceAct: diceAct, setDrawer: setDrawer, openTrade: openTrade, decideCard: decideCard, autosave: autosave,
    tapPlayer: (pid) => { const p = g.byId(pid); if (p) openBubble(p); }, screenOf: (pid) => { const v = visOf(g.byId(pid)); return toScreen(v.x, v.y - 30); },
    state: () => (g ? { phase: g.phase, round: g.round, turnCount: g.turnCount, turn: g.turn && { pid: g.turn.pid, stage: g.turn.stage, buy: g.turn.buy, auction: !!g.turn.auction, tab: !!g.turn.tab, card: !!g.turn.card }, pop: ui.popKey, drawer: ui.drawer, cam: { mode: cam.mode, whole: cam.whole, manual: cam.manual, s: +cam.s.toFixed(3) }, players: g.players.map((p) => ({ id: p.id, name: p.name, cash: p.cash, pos: p.pos, bust: p.bankrupt, passes: p.passes.length })) } : null)
  };
  if (document.fonts && document.fonts.load) document.fonts.load('600 20px Fredoka').catch(() => {});
  try { SFX.setMuted(prefs.mute); } catch (e) {}
  paintSetup();
  requestAnimationFrame(frame);
})();
