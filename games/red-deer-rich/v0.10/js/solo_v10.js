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
  const VER = 'solo v0.10', SAVE_KEY = 'rdr_solo_save_v01', PREF_KEY = 'rdr_solo_prefs_v01';   // same save + prefs keys as v0.1 on purpose: a v0.1 game resumes here
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
    { k: 'reach', n: 'Catch Time', d: 'PAY UP catch time (race on)' }
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
    covertN: 3, mute: false, fastAI: true, shake: true, camMode: 'mild', camView: 'pip', pace: 50, moods: ['default', 'default', 'default'] };
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
    logSmack(p, q, ps, w);
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
    const e = endSpotFor(p, 10), k = BASE_SPEED * paceMul() * (prefs.fastAI && g.isBot(p) ? 1.6 : 1);
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
  window.addEventListener('resize', () => { if (tt) ttRender(); });
  const cam = { x: BW / 2, y: BW / 2, s: 0.3, mode: prefs.camMode === 'close' ? 'close' : 'mild', whole: false, manual: false, manualAt: 0, touching: false };
  function lbBottom() { const el = $('lb'); if (!el || el.hidden) return 50 * UIZ; const r = el.getBoundingClientRect(); return r.bottom; }
  // ---- v0.8 portrait scoreboard: rank, shirt colour, name, cash, net worth (the top of the screen, above the board)
  function paintLb() {
    let el = $('lb');
    const on = !!(g && H > W && (g.phase === 'play' || g.phase === 'over') && !tt);
    if (!el) { if (!on) return; el = document.createElement('div'); el.id = 'lb'; document.body.appendChild(el); }
    if (el.hidden === on) el.hidden = !on;
    if (!on) return;
    const rows = g.players.map((p) => ({ p: p, w: p.bankrupt ? -1 : g.worthOf(p) })).sort((a, b) => b.w - a.w);
    const key = rows.map((r) => r.p.id + ':' + r.p.cash + ':' + r.w + ':' + (g.turn && g.turn.pid === r.p.id ? 1 : 0)).join('|');
    if (el.dataset.k === key) return; el.dataset.k = key;
    const shirt = (col, ring) => '<svg viewBox="0 0 24 22" width="22" height="20"><path d="M7 1 L1 5 L3.5 10 L6 9 L6 21 L18 21 L18 9 L20.5 10 L23 5 L17 1 Q12 5 7 1 Z" fill="' + col + '" stroke="rgba(255,255,255,.75)" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="13" r="2.4" fill="' + ring + '"/></svg>';
    el.innerHTML = '<div class="lbh"><span>#</span><span></span><span>Player</span><span>Cash</span><span>Worth</span></div>' + rows.map((r, i) => {
      const p = r.p, cur = g.turn && g.turn.pid === p.id;
      return '<div class="lbr' + (p.id === meId ? ' me' : '') + (cur ? ' cur' : '') + (p.bankrupt ? ' out' : '') + '"><span class="rk">' + (p.bankrupt ? '\u2013' : i + 1) + '</span><span class="sh">' + shirt(lookOf(p).shirt || p.color, p.color) + '</span><span class="nm">' + esc(p.id === meId ? (prefs.name || 'You') : p.name) + (p.id !== meId && p.mood && p.mood !== 'default' ? ' <i>' + moodTag(p) + '</i>' : '') + '</span><span class="cs">' + money(p.cash) + '</span><span class="wt">' + (p.bankrupt ? 'out' : money(r.w)) + '</span></div>';
    }).join('');
  }
  // v0.9: the board fills the screen width and sits just under the scoreboard (which grows with the player count).
  // The leftover strip between the board and the drawer is the dice pad. In short landscape, the pad sits on the right.
  function drawerH() {
    const d = $('drawer');
    if (d && !d.hidden) { const r = d.getBoundingClientRect(); if (r.height > 8) return Math.max(40, H - r.top); }
    return 56 * UIZ + (typeof safeBottom === 'function' ? safeBottom() : 0);
  }
  function boardLayout() {
    const land = W > H, gap = 6, minPad = land ? 72 * UIZ : Math.max(96 * UIZ, Math.min(150 * UIZ, H * 0.14));
    const dH = ui.drawer ? Math.max(56 * UIZ, H - drawerTop()) : drawerH();
    const top = land ? 8 : Math.max(lbBottom() + gap, 8);
    const bot = H - dH - (land ? 4 : gap);
    const availH = Math.max(140, bot - top), availW = W - (land ? 8 : 4);
    let side = 'bottom', size, boardLeft, boardTop, pad;
    const sizeBottom = Math.max(140, Math.min(availW, availH - (land ? 72 * UIZ : minPad)));
    const sizeRight = Math.max(140, Math.min(availH, availW - minPad - 8));
    if (land && sizeRight > sizeBottom + 24) {
      side = 'right';
      size = sizeRight;
      boardTop = Math.max(top, (H - dH - size) / 2);
      const padW = Math.max(minPad, Math.min(240 * UIZ, W - size - 16));
      const total = size + 8 + padW;
      boardLeft = Math.max(6, (W - total) / 2);
      pad = { left: boardLeft + size + 8, top: boardTop, w: padW, h: size };
    } else {
      size = sizeBottom;
      boardLeft = (W - size) / 2;
      boardTop = top;
      const padTop = boardTop + size, padH = Math.max(72, bot - padTop);
      pad = { left: 0, top: padTop, w: W, h: padH };
    }
    document.documentElement.style.setProperty('--lbh', Math.round(Math.max(0, top - 6)) + 'px');
    return { s: size / BW, size: size, boardLeft: boardLeft, boardTop: boardTop, pad: pad, side: side, dH: dH, land: land };
  }
  function fitWhole() { return boardLayout().s; }
  function focusPoint() {
    if (!g || !g.turn) return { x: BW / 2, y: BW / 2 };
    const t = g.turn;
    if (t.auction && !(t.pid === meId && t.stage === 'act' && t.buy != null)) { const r = RECTS[t.auction.sp]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    const p = g.cur(); if (!p) return { x: BW / 2, y: BW / 2 };
    const v = visOf(p); return { x: v.x, y: v.y - 35 };
  }
  // keep the action in the upper-middle of the screen (the dice + drawer live at the bottom)
  function frameOn(f, s) {
    const L = boardLayout(), land = W > H && H < 600 * UIZ, padT = Math.max(56 * UIZ, L.boardTop) / s, padB = ui.drawer ? (H - drawerTop() + 12) / s : (L.pad.h + 8) / s, M = 40;
    let x = f.x, y = f.y + (H * 0.5 - H * 0.42) / s;
    const hw = W / 2 / s, hh = H / 2 / s;
    x = hw * 2 >= BW + M * 2 ? BW / 2 : Math.max(hw - M, Math.min(BW - hw + M, x));
    y = hh * 2 >= BW + padT + padB ? BW / 2 + (padB - padT) / 2 : Math.max(hh - padT, Math.min(BW - hh + padB, y));
    return { x: x, y: y, s: s };
  }
  function camTarget() {
    if (cam.whole || prefs.camView !== 'zoom') {
      const L = boardLayout();
      return { x: BW / 2 - (W / 2 - (L.boardLeft + L.size / 2)) / L.s, y: (H / 2 - L.boardTop) / L.s, s: L.s };
    }   // v0.9: default camera is the max-zoom whole board; the centre close-up does the follow
    const f = focusPoint(), m = Math.min(W, H);
    if (cam.mode === 'close') return frameOn(f, m / (CELL * 3.6));
    const s = Math.max(fitWhole() * 1.15, m / (BW * 0.5));
    return frameOn(f, s);
  }
  function stepCam(dtS) {
    // v0.7 idle follow: 3 s after the last touch, keep the zoom you chose and glide to the action (or stay put if nothing's happening)
    if (cam.goto && !cam.touching) {
      const G2 = cam.goto, k2 = 1 - Math.exp(-dtS * 6);
      cam.x += (G2.x - cam.x) * k2; cam.y += (G2.y - cam.y) * k2; cam.s = Math.exp(Math.log(cam.s) + (Math.log(G2.s) - Math.log(cam.s)) * k2);
      cam.manualAt = performance.now();
      if (Math.abs(G2.x - cam.x) + Math.abs(G2.y - cam.y) < 1.5 && Math.abs(G2.s / cam.s - 1) < 0.01) cam.goto = null;
      return;
    }
    if (cam.touching) cam.goto = null;
    if (cam.framed && ui.drawer) return;          // framed for a card action: hold it while the drawer is up
    if (cam.manual && !cam.touching && !cam.whole && performance.now() - cam.manualAt > IDLE_MS) { cam.manual = false; cam.keepS = cam.s; }
    if (cam.manual) return;
    const k = 1 - Math.exp(-dtS * 3.2 * paceMul());
    if (cam.keepS && !cam.whole) {
      let f = null; const fp2 = cam.follow != null ? g && g.byId(cam.follow) : null;
      if (fp2 && !fp2.bankrupt) { const v = visOf(fp2); f = { x: v.x, y: v.y - 35 }; } else f = actionFocus();
      if (!f) return;
      const t2 = frameOn(f, cam.keepS); cam.x += (t2.x - cam.x) * k; cam.y += (t2.y - cam.y) * k; cam.s = Math.exp(Math.log(cam.s) + (Math.log(t2.s) - Math.log(cam.s)) * k);
      return;
    }
    const t = camTarget();
    cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k; cam.s = Math.exp(Math.log(cam.s) + (Math.log(t.s) - Math.log(cam.s)) * k);
  }
  const toWorld = (sx, sy, c) => { c = c || cam; return { x: (sx - W / 2) / c.s + c.x, y: (sy - H / 2) / c.s + c.y }; };
  const toScreen = (wx, wy, c) => { c = c || cam; return { x: (wx - c.x) * c.s + W / 2, y: (wy - c.y) * c.s + H / 2 }; };
  function setCamMode(m) { cam.follow = null; cam.mode = m; cam.whole = false; cam.manual = false; cam.keepS = null; prefs.camMode = m; savePrefs(); camTag(m === 'close' ? 'Close follow' : 'Wide follow'); syncZoomBtn(); }
  function camTag(txt) { const el = $('camTag'); el.textContent = txt; el.hidden = false; clearTimeout(camTag.t); camTag.t = setTimeout(() => { el.hidden = true; }, 1300); }
  function syncZoomBtn() { $('zoomOut').classList.toggle('on', cam.whole); }
  $('zoomOut').onclick = () => { if (prefs.camView !== 'zoom') { doubleTap(); return; } cam.whole = !cam.whole; cam.manual = false; cam.keepS = null; syncZoomBtn(); camTag(cam.whole ? 'Whole board' : (cam.mode === 'close' ? 'Close follow' : 'Wide follow')); };

  // ---- touch: pinch / pan / tap / double-tap on the map
  const ptrs = new Map(); let gest = null, lastTap = { t: 0, x: 0, y: 0 }, tapTimer = 0;
  cv.addEventListener('pointerdown', (e) => {
    if (tileCardHit(e.clientX, e.clientY)) {
      if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      gest = { card: true, moved: false, y0: e.clientY };
      return;
    }
    if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    cam.touching = true;
    if (!cam.whole) { cam.manual = true; cam.manualAt = performance.now(); }    // v0.7: any touch hands the camera back to you (idle follow restarts after 3 s)
    if (ptrs.size === 1 && g && g.phase === 'play' && tapSmack()) { gest = { pinch: false, moved: true, smack: true }; return; }
    if (ptrs.size === 2) { const a = [...ptrs.values()]; gest = { pinch: true, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), s: cam.s, moved: true }; }
    else if (ptrs.size === 1) gest = { pinch: false, moved: false };
  });
  cv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p || !gest || gest.smack) return;
    if (gest.card) { p.x = e.clientX; p.y = e.clientY; TC.dragY = e.clientY - gest.y0; if (Math.abs(TC.dragY) > 8) gest.moved = true; return; }
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
    if (gest.card) {
      const dy = (p.y - gest.y0), dt = performance.now() - p.t0; TC.dragY = 0;
      if (dy < -70) decideCard(-1);
      else if (dy > 70) decideCard(1);
      else if (Math.abs(dy) < 10 && dt < 450) decideCard(-1);
      gest = null; return;
    }
    if (gest.pinch) { if (!ptrs.size) gest = null; return; }
    if (!gest.moved && performance.now() - p.t0 < 400) {
      const t = performance.now();
      if (t - lastTap.t < 300 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) { clearTimeout(tapTimer); lastTap.t = 0; doubleTap(p.x, p.y); }
      else { lastTap = { t: t, x: p.x, y: p.y }; const x = p.x, y = p.y; tapTimer = setTimeout(() => singleTap(x, y), 260); }
    }
    gest = null;
  }
  cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const wb = toWorld(e.clientX, e.clientY); cam.s = Math.max(fitWhole() * 0.7, Math.min(4, cam.s * Math.exp(-e.deltaY * 0.0015))); const wa = toWorld(e.clientX, e.clientY); cam.x += wb.x - wa.x; cam.y += wb.y - wa.y; cam.manual = true; cam.manualAt = performance.now(); }, { passive: false });
  ['gesturestart', 'gesturechange', 'dblclick'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  function doubleTap(sx, sy) {     // v0.8: zoomed in at all = whole board; on the whole board = zoom into where you tapped (near a runner = follow them)
    closeBubble();
    const zoomed = cam.s > fitWhole() * 1.35;
    cam.follow = null;
    if (zoomed) { cam.whole = true; cam.keepS = null; cam.goto = null; cam.manual = false; camTag('Whole board'); }
    else {
      const s2 = Math.min(W, H) / (CELL * 3.6); let f, who = null;
      if (sx == null) who = me();
      else { let bd = 64 * Math.max(1, UIZ); g.players.forEach((q) => { if (q.bankrupt) return; const v = visOf(q), sp = toScreen(v.x, v.y - 30); const d = Math.hypot(sx - sp.x, sy - sp.y); if (d < bd) { bd = d; who = q; } }); }
      if (who) { const v = visOf(who); f = { x: v.x, y: v.y - 35 }; cam.follow = who.id; } else f = toWorld(sx, sy);
      cam.whole = false; cam.goto = frameOn(f, s2); cam.keepS = s2; cam.manual = true; cam.manualAt = performance.now();
      camTag(who ? (who.id === meId ? 'Close on you' : 'Following ' + who.name) : 'Zoomed in');
    }
    syncZoomBtn(); sfx('click');
  }
  function personAt(sx, sy) {
    let best = null, bd = 1e9; const h = 62 * cam.s;
    g.players.forEach((p) => { if (p.bankrupt) return; const v = visOf(p), s = toScreen(v.x, v.y); const d = Math.hypot(sx - s.x, sy - (s.y - h * 0.5)); const r = Math.max(26, h * 0.6); if (d < r && d < bd) { bd = d; best = p; } });
    return best;
  }
  function spaceAt(wx, wy) { for (let i = 0; i < 40; i++) { const r = RECTS[i]; if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return i; } return -1; }
  function singleTap(sx, sy) {
    if (!g || g.phase === 'lobby') return;
    if (rpHit(sx, sy)) return;
    if (ui.deedFull != null) { closeDeedFull(); return; }
    if (ui.drawer) { setDrawer(false); return; }
    if (ui.bubble) { closeBubble(); return; }
    const p = personAt(sx, sy); if (p) { openBubble(p); return; }
    const w = toWorld(sx, sy), sp = spaceAt(w.x, w.y); if (sp >= 0) { ui.info = { sp: sp }; sfx('click'); } else if (ui.info) ui.info = null;
  }

  // ------------------------------------------------------------------ drawing
  let rrC = null;
  function rr(x, y, w, h, r) { const g = rrC || ctx; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function wrap(text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  const SPACE_LABEL = { halfway: 'THE HALFWAY', finds: 'SECRET FINDS', random: 'RANDOM- NESS', snowbank: 'SNOW- BANK', dirtlot: 'SECRET DIRT LOT', whiteout: 'WHITE- OUT!' };
  const BAND_COL = { whistle: '#3b3b46', juice: '#7a8a99', tax: '#c9a227', random: '#ffcf3f', finds: '#59b4e8' };
  const CORNER_FILL = { halfway: '#ffe9a8', snowbank: '#e1f1ff', dirtlot: '#e8d6b8', whiteout: '#f0f4ff' };
  // v0.7 highlight: still thick, but the solid part hugs the tile edge (and spills outside); the feather fades out within ~7 px inside,
  // so it no longer sits on the property name
  function hlTile(c, r, rgb, a) {
    for (let k = 0; k < 4; k++) { c.strokeStyle = 'rgba(' + rgb + ',' + (a * (0.5 - k * 0.11)).toFixed(3) + ')'; c.lineWidth = 3; const o = 2.5 + k * 3; c.strokeRect(r.x - o, r.y - o, r.w + o * 2, r.h + o * 2); }
    c.strokeStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')'; c.lineWidth = 4; c.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    for (let k = 0; k < 3; k++) { c.strokeStyle = 'rgba(' + rgb + ',' + (a * (0.55 - k * 0.18)).toFixed(3) + ')'; c.lineWidth = 2; const o = 4 + k * 2; c.strokeRect(r.x + o, r.y + o, r.w - o * 2, r.h - o * 2); }
  }
  function drawScene(c, view, w, h, opt) {
    opt = opt || {};
    const prevRR = rrC; rrC = c;
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
      if (t && ((t.auction && t.auction.sp === i) || t.buy === i)) hlTile(c, r, '255,210,63', 0.55 + 0.45 * Math.sin(T * 6));
      if (ui.info && ui.info.sp === i) hlTile(c, r, '63,167,255', 1);
      if (ui.flash && performance.now() < ui.flash.until && ui.flash.set.indexOf(i) >= 0) hlTile(c, r, i === ui.flash.sp ? '255,210,63' : '255,236,170', (i === ui.flash.sp ? 1 : 0.55) * (0.6 + 0.4 * Math.sin(T * 9)));
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
        if (active) {   // v0.7: soft throbbing underlight in the runner's colour (thinner than the property highlight)
          const th = 0.5 + 0.5 * Math.sin(tP / 260), ug = c.createRadialGradient(v.x, v.y, 4, v.x, v.y, 46 + 6 * th);
          ug.addColorStop(0, hexA(p.color, 0.55 + 0.25 * th)); ug.addColorStop(0.55, hexA(p.color, 0.22 + 0.12 * th)); ug.addColorStop(1, hexA(p.color, 0));
          c.fillStyle = ug; c.beginPath(); c.ellipse(v.x, v.y, 52 + 6 * th, 21 + 3 * th, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = hexA(p.color, 0.5 + 0.4 * th); c.lineWidth = 2; c.beginPath(); c.ellipse(v.x, v.y, 30 + 4 * th, 12 + 1.5 * th, 0, 0, Math.PI * 2); c.stroke();
        }
        c.fillStyle = p.color; c.beginPath(); c.ellipse(v.x, v.y, 22 * shrink, 9 * shrink, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = active ? '#ffd23f' : '#fff'; c.lineWidth = active ? 4 : 2.5; c.stroke();
        if (sw >= 0 && v.swing.blur) PPL.draw(c, v.x + ox, v.y - lift, active ? 76 : 68, lookOf(p), { walk: v.phase, face: v.face, badge: p.ink, squash: sq, swing: (sw + 0.45) % 1, alpha: 0.35 });   // the flurry blur
        const po = personOpts(p, v, tP);      // v0.7: idle glances, angry fist, dice toss, selfie head
        PPL.draw(c, v.x + ox, v.y - lift, active ? 76 : 68, lookOf(p), { walk: v.phase, face: po.faceTo || v.face, badge: p.ink, squash: sq, swing: sw, head: head, tilt: b ? 0.32 * stg * b.dir * (v.face || 1) : 0,
          look: po.look, mood: po.mood, fist: po.fist, toss: po.toss, selfie: po.selfie });
        if (active && !busy(v)) { c.fillStyle = '#ffd23f'; c.beginPath(); const ay = v.y - 82 - Math.abs(Math.sin(T * 4)) * 6; c.moveTo(v.x - 9, ay - 12); c.lineTo(v.x + 9, ay - 12); c.lineTo(v.x, ay); c.fill(); }
      });
      const tD = performance.now();
      for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i], a = (tD - d.born) / d.life; if (a >= 1) { dust.splice(i, 1); continue; } const e = 1 - Math.pow(1 - a, 2), dt = a * d.life / 1000;
        c.globalAlpha = 0.55 * (1 - a); c.fillStyle = '#d9c9a3'; c.beginPath(); c.arc(d.x + d.vx * dt * (1 - a * 0.5), d.y + d.vy * dt, d.r * (0.6 + e), 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
      drawBoardDice(c);
      drawDiceArcs(c);
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
    rrC = prevRR;
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
    try { v07Event(type, d); } catch (e) { console.error(e); }
    try { ttEvent(type, d); } catch (e) { console.error(e); }
    recEvent(type, d);
    const p = d.pid != null ? g.byId(d.pid) : null, mine = d.pid === meId;
    switch (type) {
      case 'turn': if (mine) { sfx('turn'); vib(30); toast('Your turn', p.color, 1400); } autosave(); break;
      case 'roll': sfx('dice'); ui.lastDice = performance.now(); break;
      case 'move': {
        const v = visOf(p), t = g.turn, durs = d.durs ? d.durs.slice() : d.path.map(() => t.moving.step);
        durs[durs.length - 1] += g.ms(C.timing.afterMove) * 0.45 + (d.dread ? 0 : t.moving.step * 0.35);   // the final hop hangs a touch longer, still lands before the engine moves on
        const aiSmack = {}; if (g.isBot(p)) g.players.forEach((q) => { if (q.id !== p.id) aiSmack[q.id] = Math.random() < (q.id === meId ? 0.22 : 0.14) * MO(p).smack; });
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
    g = new Game({ seed: seed, speed: BASE_SPEED * paceMul() }); aucPatch(g);
    g.rules.payupRace = !!+prefs.payup; g.rules.heckle = false; g.rules.auctions = true;
    g.setMode(prefs.len); g.setTimer(+prefs.timer || 0);
    const meP = g.addPlayer({ name: (prefs.name || 'You').slice(0, 12), charId: prefs.charId });      // v0.7: your own name (not the character's); no name = You
    meId = meP.id; looks = {};
    looks[meId] = PPL.clean(Object.assign({}, prefs.look, { shirt: meP.color }));      // your shirt = your token colour
    const pool = shuffle(C.characters.map((c) => c.id).filter((id) => id !== meP.charId));
    for (let k = 0; k < Math.max(1, Math.min(3, +prefs.opp || 2)); k++) { const p = g.addPlayer({ ai: prefs.level, charId: pool[k] }); p.mood = MOODS[(prefs.moods || [])[k]] ? prefs.moods[k] : 'default'; looks[p.id] = PPL.random(g.rand, p.color); }
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
    g = new Game({ seed: s.game.seed, speed: BASE_SPEED * paceMul() }); aucPatch(g);
    Object.keys(s.game).forEach((k) => { g[k] = s.game[k]; });
    g.listeners = []; g.speed = BASE_SPEED * paceMul();
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
    if (tt) ttClose(false);
    g = null; ['top', 'zoomOut', 'drawer', 'dice', 'dicePad', 'pop', 'cardPop', 'panel', 'bubbleMenu', 'scrim'].forEach((id) => { $(id).hidden = true; });
    ui.panel = false; ui.drawer = false; frozen = false;
    $('setup').hidden = false; paintSetup();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { autosave(); if (g) freeze(true); } else if (g && !ui.panel && !tt) freeze(false); });
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
        url: function (c) { return rdrDir() + 'controller.html?room=' + c + loc + '&auto=1'; },
        tvUrl: function (c) { return rdrDir() + 'index.html?room=' + c + loc; }
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
    $('turnName').textContent = g.phase === 'over' ? 'Game over' : cur ? (cur.id === meId ? 'Your turn' : cur.name + moodTag(cur)) : '';
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
      return '<div class="rank' + (p.bankrupt ? ' bust' : '') + '"><span class="pl">' + (p.bankrupt ? '\u2715' : k + 1) + '</span><div class="who"><b style="color:' + inkOn(p.color) + '">' + esc(p.id === meId ? (p.name === 'You' ? 'You' : p.name + ' (you)') : moodTag(p).trim() + ' ' + p.name) + (p.ai ? ' <small>AI</small>' : '') + '</b>' +
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
      '<div class="set pace"><span>Pace<small id="paceLbl">' + paceWord() + ' \u00b7 slower \u2190 \u2192 faster</small></span><input type="range" id="paceIn" min="0" max="100" step="5" value="' + (prefs.pace == null ? 50 : prefs.pace) + '" aria-label="Pace"></div>' +
      setRow('Fast computer turns', 'Speeds up the AI\'s walking and thinking', 'fastAI', prefs.fastAI ? 'On' : 'Off', prefs.fastAI) +
      setRow('Shake to roll / pass', 'Uses the motion sensor (asks once on iPhone)', 'shake', prefs.shake ? 'On' : 'Off', prefs.shake) +
      setRow('Game timer', g.endsAt ? 'Richest player wins when it runs out' : (g.timerLeft ? 'Paused with time left' : 'No timer: last one standing'), 'timer', g.endsAt ? 'On' : 'Off', !!g.endsAt) +
      setRow('Camera', prefs.camView !== 'zoom' ? 'Picture-in-picture: whole board + a close-up bubble of whoever is moving. Double-tap for close on you' : 'Zoom follow: the camera zooms in to follow the action (' + (cam.mode === 'close' ? 'close' : 'wide') + ')', 'cam', prefs.camView !== 'zoom' ? 'Picture-in-picture' : cam.mode === 'close' ? 'Zoom close' : 'Zoom wide', true) +
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
    return '<ul class="rules"><li>Roll: tap, swipe or shake the dice pad under the board. Collect ' + money(C.halfwayPay) + ' each time you pass The Halfway.</li>' +
      '<li>Land on an unowned deed: buy it or pass. Passed deeds go to a quick auction everyone can bid on.</li>' +
      '<li>Land on someone\'s deed: pay rent. Own a whole colour set to double the rent and build Shops (then a Mega-Plex).</li>' +
      '<li>Doubles roll again. Three doubles in a row, or the WHITEOUT corner, puts you in the Snowbank: roll doubles, pay the ' + money(C.towFee) + ' tow, or use a Tow Truck Pass.</li>' +
      '<li>Land on RANDOMNESS or SECRET FINDS and the card rises right out of that space on the board. Tap or swipe it up to play. Keeper cards (Tow Truck Pass) can be swiped down into your stash.</li>' +
      '<li>Short on cash? Lift the bottom edge to sell Shops or mortgage deeds. Can\'t pay at all and you\'re out.</li>' +
      '<li>Tap any player for a deal or a quick chat. Last one standing wins, or the richest when the timer runs out.</li>' +
      '<li>When nothing is left to do on your turn, the dice pass themselves.</li></ul>';
  }
  function setPanel(on) {
    ui.panel = on; $('panel').hidden = !on; freeze(on || document.visibilityState === 'hidden' || !!tt);
    if (on) { closeBubble(); paintPanel(true); }
  }
  $('pull').onclick = () => setPanel(!ui.panel);
  $('bar').onclick = () => setPanel(true);
  $('strip').onclick = () => setPanel(true);
  $('panelGrip').onclick = () => setPanel(false);
  (function () { let y0 = null; const pg = $('panel'); pg.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true }); pg.addEventListener('touchend', (e) => { if (y0 != null && y0 - e.changedTouches[0].clientY > 70 && $('panelIn').scrollTop <= 0) setPanel(false); y0 = null; }, { passive: true }); })();
  $('panelIn').addEventListener('input', (e) => {
    if (e.target.id !== 'paceIn') return;
    prefs.pace = +e.target.value; savePrefs();
    const l = $('paceLbl'); if (l) l.textContent = paceWord() + ' \u00b7 slower \u2190 \u2192 faster';
  });
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
    if (k === 'cam') {   // v0.8: PiP -> Zoom wide -> Zoom close -> PiP
      if (prefs.camView !== 'zoom') { prefs.camView = 'zoom'; cam.mode = 'mild'; }
      else if (cam.mode !== 'close') cam.mode = 'close';
      else { prefs.camView = 'pip'; cam.mode = 'mild'; }
      prefs.camMode = cam.mode; cam.whole = false; cam.keepS = null; cam.manual = false; cam.goto = null; syncZoomBtn();
    }
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
    if (t.pid !== meId || m.bankrupt) return null;      // v0.7: other players' dice live only on the board
    if (t.stage === 'rolling') return null;              // yours are rolling on the board
    if (t.tab || t.auction || t.buy != null) return null;
    if (t.stage === 'roll') return m.snow && ui.snowAsked !== g.turnCount ? null : 'roll';
    if (t.stage === 'act') return t.canRollAgain ? 'again' : 'pass';
    return null;
  }
  function layoutDicePad() {
    const el = $('dicePad'); if (!el) return;
    const hardPop = !$('pop').hidden && !$('pop').classList.contains('soft');
    const on = !!(g && (g.phase === 'play' || g.phase === 'over') && !ui.drawer && !ui.panel && !tt && $('cardPop').hidden && !hardPop);
    if (el.hidden === on) el.hidden = !on;
    if (!on) return;
    const L = boardLayout(), P = L.pad, z = UIZ || 1;
    el.classList.toggle('side', L.side === 'right');
    el.style.left = (P.left / z).toFixed(1) + 'px';
    el.style.top = (P.top / z).toFixed(1) + 'px';
    el.style.width = (P.w / z).toFixed(1) + 'px';
    el.style.height = (P.h / z).toFixed(1) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
    const die = Math.max(52, Math.min(110, P.h / z - 44, P.w / z * 0.28));
    el.style.setProperty('--diesz', die.toFixed(1) + 'px');
  }
  function paintPadStats() {
    const el = $('padStats'); if (!el || !g) return;
    const cur = g.cur(), m = me(), turn = g.turn;
    const last = turn && turn.roll ? (turn.roll.d[0] + '+' + turn.roll.d[1]) : '';
    const name = cur ? (cur.id === meId ? (prefs.name || 'You') : cur.name) : '';
    const cash = m ? money(m.cash) : '';
    const col = cur ? cur.color : '#888';
    const html = (cur ? '<i class="dot" style="background:' + col + '"></i><span class="who">' + esc(name) + '</span>' : '') +
      (cash ? '<span class="cash">' + cash + '</span>' : '') +
      (last ? '<span class="last">last ' + last + '</span>' : '');
    if (el.dataset.k !== html) { el.dataset.k = html; el.innerHTML = html; }
  }
  function paintDice() {
    layoutDicePad(); paintPadStats();
    const d = $('dice'), pad = $('dicePad');
    const blocked = ui.drawer || ui.panel || !$('cardPop').hidden || (!$('pop').hidden && !$('pop').classList.contains('soft'));
    const mode = blocked ? null : diceMode(), t = g.turn;
    if (pad) pad.classList.toggle('mine', mode === 'roll' || mode === 'again');
    if (!mode) {
      d.hidden = false; d.className = 'idle';
      if (t && t.roll) faces(t.roll.d[0], t.roll.d[1], t.roll.dbl); else faces(5, 2, false);
      const who = t && t.pid && t.pid !== meId ? (g.byId(t.pid) || {}).name : '';
      const lbl = who ? 'Waiting for ' + who : '';
      if ($('diceLbl').textContent !== lbl) $('diceLbl').textContent = lbl;
      return;
    }
    const wasHidden = d.hidden; d.hidden = false;
    if ((mode === 'roll' || mode === 'again') && (wasHidden || ui.diceIn !== g.turnCount + mode)) { ui.diceIn = g.turnCount + mode; requestAnimationFrame(() => requestAnimationFrame(diceArrive)); }
    else if (mode === 'pass' && (wasHidden || ui.diceIn !== g.turnCount + mode)) { ui.diceIn = g.turnCount + mode; d.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out' }); }
    const cls = mode === 'roll' || mode === 'again' ? 'mine bubble' : mode === 'pass' ? 'mine pass' : '';
    if (d.className !== cls) d.className = cls;
    if (d.style.left) { d.style.left = ''; d.style.top = ''; d.style.removeProperty('--dsc'); }
    if (mode === 'tumble') { if (Math.random() < 0.3) faces(1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), false); }
    else if (t.roll) faces(t.roll.d[0], t.roll.d[1], t.roll.dbl); else faces(5, 2, false);
    const wait = t && t.graceUntil && g.now < t.graceUntil ? Math.ceil((t.graceUntil - g.now) / 1000) : 0;
    const lbl = mode === 'roll' ? (me().snow ? 'Roll for doubles' : 'Tap or swipe' + (shk.on ? ' or shake' : '') + ' to roll') : mode === 'again' ? 'Doubles! Roll again' :
      mode === 'pass' ? (wait ? 'Pass in ' + wait + '\u2026' : 'Pass dice \u279C') : mode === 'tumble' ? '' : t.roll ? (t.pid === meId ? 'You' : (g.byId(t.pid) || {}).name) + ' rolled ' + t.roll.total : '';
    if ($('diceLbl').textContent !== lbl) $('diceLbl').textContent = lbl;
  }
  function diceAct(force) {
    const mode = diceMode(); if (!mode || ui.drawer) return '';
    let r = '';
    if (mode === 'roll' || mode === 'again') { const rc = $('dice').getBoundingClientRect(); ui.rollFrom = { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, at: performance.now() }; r = g.intent(meId, { t: 'roll', f: force != null ? force : 0.6 }); vib(20); }
    else if (mode === 'pass') { r = g.intent(meId, { t: 'pass' }); if (!r) { sfx('whistle'); toast('Dice passed', '#ffd23f', 1200); } }
    if (r === 'wait') toast('Hang on: they can still catch you for rent'); else if (r) toast(r);
    shk.last = Date.now();
    return r;
  }
  (function () {
    const d = $('dicePad') || $('dice'); let st = null;
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
  function drawerTop() { const r = drawer.getBoundingClientRect(); return ui.drawer ? Math.min(r.top, H * 0.72) : H; }
  function setDrawer(on) { if (!on) { closeDeedFull(); if (cam.framed) { cam.framed = false; cam.manual = false; cam.goto = null; } } ui.drawer = on; drawer.classList.toggle('open', on); drawer.style.height = ''; $('scrim').hidden = !on; if (on) { closeBubble(); ui.drawerKey = ''; paintDrawer(); sfx('pop'); } }
  (function () {
    const grip = $('grip'); let st = null;
    grip.addEventListener('pointerdown', (e) => { st = { y: e.clientY, h: drawer.getBoundingClientRect().height, moved: false, tab: e.target.closest('.stab') }; if (grip.setPointerCapture) try { grip.setPointerCapture(e.pointerId); } catch (er) {} });
    grip.addEventListener('pointermove', (e) => { if (!st) return; const dy = e.clientY - st.y; if (Math.abs(dy) > 8) st.moved = true; if (st.moved) { drawer.classList.add('drag'); drawer.style.height = (Math.max(56 * UIZ, Math.min(H * 0.5, st.h - dy)) / H * 100).toFixed(2) + '%'; } });
    grip.addEventListener('pointerup', (e) => { if (!st) return; const dy = e.clientY - st.y, moved = st.moved, tab = st.tab; st = null; drawer.classList.remove('drag'); if (!moved && tab) { jumpToSet(tab.dataset.set); return; } if (!moved) setDrawer(!ui.drawer); else setDrawer(ui.drawer ? dy < 60 : dy < -40); });
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
    const tr = ui.trade, key = ui.tab + '|' + g.version + '|' + !!selfieImg + '|' + !!ui.stuffGrouped + '|' + JSON.stringify(tr) + (ui.tab === 'trade' ? '|' + myTurn() : '');
    if (!force && key === ui.drawerKey) return; ui.drawerKey = key;
    [...$('dTabs').children].forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
    const body = $('dBody'), wheel = body.querySelector('.wheel'), sl = wheel ? wheel.scrollLeft : 0, st = body.scrollTop;
    let h = '';
    if (ui.tab === 'deeds') {
      const ds = myDeeds();
      h = ds.length ? '<div class="note dHelp">' + money(m.cash) + ' cash \u00b7 swipe sideways \u00b7 tap a card for details \u00b7 pinch to stack sets</div>' + stuffHtml(ds) : '<div class="empty">No deeds yet. Land on one and buy it, win an auction, or make a deal.</div>';
      if (g.turn && g.turn.tab && g.turn.pid === meId) h = '<div class="gcard"><b>You owe ' + money(g.turn.tab.amount) + '</b>Sell Shops or mortgage below; it pays itself the moment you have enough.</div>' + h;
    } else if (ui.tab === 'cards') {
      const selfieCard = '<div class="gcard selfieCard"><b>\uD83D\uDCF8 Selfie head</b>' + (selfieImg ? 'Your runner wears your face. Just for this game, on this phone.' : 'Snap a quick front-camera photo: your runner gets a big round head with your face. Stays on this phone, this game only.') +
        '<div class="btnrow"><button class="btn go" data-a="selfie">' + (selfieImg ? 'Retake' : 'Take a selfie') + '</button>' + (selfieImg ? '<button class="btn ghost" data-a="selfieOff">Remove</button>' : '') + '</div></div>';
      h = m.passes.length ? m.passes.map(() => '<div class="gcard"><b>Tow Truck Pass</b>Gets you out of the Snowbank for free. Tradeable.' +
        (m.snow && myTurn() && g.turn.stage === 'roll' ? '<div class="btnrow"><button class="btn go" data-a="usePass">Use it now</button></div>' : '') + '</div>').join('') : '<div class="empty">Your stash is empty. Keeper cards you swipe down land here.</div>';
      const seen = g.cardsDrawn.filter((c) => c[2] === meId).slice(-5).reverse();
      if (seen.length) h += '<div class="sect">Cards you drew</div>' + seen.map((c) => '<div class="note">\u2022 ' + esc(B.DECKS[c[0]][c[1]].h) + ' (round ' + c[3] + ')</div>').join('');
    } else h = tradeHtml();
    if (ui.tab === 'cards') h = selfieCard + h;
    body.innerHTML = h;
    const w2 = body.querySelector('.wheel'); if (w2) w2.scrollLeft = sl; body.scrollTop = st;
    coverFlow(); requestAnimationFrame(coverFlow);
  }
  $('dBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (b && g) return deedAction(b);
    const mini = e.target.closest('.deed.mini'); if (mini && g) openDeedFull(+mini.dataset.sp);
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
    h += '<div class="btnrow"><button class="btn go" data-a="tt">Open the trade table with ' + esc(o.name) + '</button></div>';
    h += '<div class="msg">' + esc(tr.msg || gate) + '</div><div class="btnrow"><button class="btn go" data-a="send" ' + (gate ? 'disabled' : '') + '>Offer the deal</button><button class="btn ghost" data-a="clear">Clear</button></div>';
    if (mine.length) h += '<div class="sect">Waiting on</div>' + mine.map((t) => '<div class="note">' + esc(nm(t.b)) + ' is thinking\u2026 <button class="tog" data-a="cancel" data-id="' + t.id + '">Cancel</button></div>').join('');
    return h;
  }
  function tradeClick(a, b) {
    const tr = ui.trade, m = me(), o = g.byId(tr.to);
    if (a === 'tt') { ttOpenWith(tr.to); return; }
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
  function openTradeList(pid, getSp) { ui.trade = { to: pid, give: [], get: getSp != null ? [getSp] : [], gCash: 0, tCash: 0, msg: '' }; ui.tab = 'trade'; ui.info = null; setDrawer(true); }
  function openTrade(pid, getSp) { ui.info = null; ttOpenWith(pid, getSp); }   // v0.6: the full-screen trade table

  // ------------------------------------------------------------------ tap a player: options pop out of them
  const CHAT_LINES = ['Nice roll!', 'Wanna make a deal?', 'That rent hurts \uD83D\uDE05', 'I\'m coming for that set.', 'Good game!', 'Ha! Good one.'];
  function openBubble(p) { ui.bubble = { pid: p.id }; ui.chatMode = false; paintBubble(); sfx('pop'); }
  function closeBubble() { ui.bubble = null; $('bubbleMenu').hidden = true; }
  function paintBubble() {
    const el = $('bubbleMenu'), b = ui.bubble; if (!b) return; const p = g.byId(b.pid); if (!p || p.bankrupt) return closeBubble();
    let h;
    if (ui.chatMode) h = CHAT_LINES.map((l, k) => '<button data-b="say" data-k="' + k + '">' + esc(l) + '</button>').join('') + '<button class="x" data-b="x">\u2715</button>';
    else if (p.id === meId) h = '<button data-b="stuff">\uD83D\uDCBC ' + money(p.cash) + '</button><button data-b="selfie">\uD83D\uDCF8 Selfie</button><button data-b="chat">\uD83D\uDCAC Say\u2026</button><button class="x" data-b="x">\u2715</button>';
    else h = '<button data-b="deal">\uD83E\uDD1D Make an offer</button><button data-b="chat">\uD83D\uDCAC Chat</button><button class="x" data-b="x">\u2715</button>';
    el.innerHTML = '<div style="width:100%;text-align:center;font-weight:700;text-shadow:0 1px 4px #000">' + esc(p.id === meId ? 'You' : p.name + moodTag(p)) + '</div>' + h; el.hidden = false; posBubble();
  }
  function posBubble() { const b = ui.bubble; if (!b || !g) return; const p = g.byId(b.pid); if (!p) return; const v = visOf(p), s = toScreen(v.x, v.y - 74), el = $('bubbleMenu'); el.style.left = Math.max(150 * UIZ, Math.min(W - 150 * UIZ, s.x)) + 'px'; el.style.top = Math.max(el.offsetHeight * UIZ + 50 * UIZ, Math.min(H - 80 * UIZ, s.y)) + 'px'; }
  $('bubbleMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-b]'); if (!b || !ui.bubble) return; const a = b.dataset.b, pid = ui.bubble.pid; sfx('click');
    if (a === 'x') return closeBubble();
    if (a === 'chat') { ui.chatMode = true; return paintBubble(); }
    if (a === 'say') { g.chat(meId, pid === meId ? 'all' : pid, CHAT_LINES[+b.dataset.k]); return closeBubble(); }
    if (a === 'deal') { closeBubble(); return openTrade(pid); }
    if (a === 'stuff') { closeBubble(); ui.tab = 'deeds'; return setDrawer(true); }
    if (a === 'selfie') { closeBubble(); return openSelfie(); }
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
        '<div class="btnrow"><button class="btn go" data-x="accept" data-id="' + offer.id + '">Accept</button><button class="btn" data-x="decline" data-id="' + offer.id + '">No thanks</button></div><div class="btnrow"><button class="btn" data-x="ttOpen" data-id="' + offer.id + '">Open the trade table</button></div>' };
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
    if (!P) { if (!pop.hidden) { if (!hold && !/^info/.test(ui.popKey || '')) popLeave(); pop.hidden = true; ui.popKey = ''; } return; }
    if (P.key !== ui.popKey) { ui.popKey = P.key; $('popCard').innerHTML = P.html; pop.classList.toggle('soft', !!P.soft); pop.hidden = false; }
    const a = g.turn && g.turn.auction, bar = $('cdBar'); if (a && bar) { const f = aucLeft(a); bar.style.width = (f * 100).toFixed(1) + '%'; aucTick(a, f, bar); }
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
      case 'ttOpen': { const tr0 = g.tradeById(+b.dataset.id); if (tr0) ttOpenTrade(tr0); break; }
      case 'manage': { const sp = +b.dataset.sp; ui.info = null; ui.tab = 'deeds'; setDrawer(true); setTimeout(() => { const el = document.querySelector('.deed[data-sp="' + sp + '"]'); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 60); break; }
      case 'closeInfo': ui.info = null; break;
      case 'again': quitToSetup(false); return;
      case 'seeBoard': ui.overSeen = true; cam.whole = true; syncZoomBtn(); break;
    }
    if (r) toast(r);
    ui.popKey = '';
  });

  // ------------------------------------------------------------------ v0.10 drawn cards: they rise, flip and grow out of the board space
  // (RANDOMNESS / SECRET FINDS), show their text over the tile, then tuck back in. Same for you and the AI.
  // You can still swipe a keeper down to stash it, or tap / swipe up to play. Immediate cards auto-play after a short read.
  const TC = { on: false, key: '', sp: -1, deck: '', idx: -1, pid: 0, phase: 'rise', t0: 0, mine: false, decided: false, dragY: 0, box: null, sparks: [] };
  function tcKeeper() { if (!TC.on) return false; const cd = B.DECKS[TC.deck] && B.DECKS[TC.deck][TC.idx]; return !!(cd && cd.fx && cd.fx.k === 'pass'); }
  function tcTile() {
    const p = g && g.byId(TC.pid), sp = (p && p.pos != null) ? p.pos : TC.sp;
    if (sp >= 0 && S[sp] && (S[sp].type === 'random' || S[sp].type === 'finds')) return sp;
    return TC.sp;
  }
  function startTileCard(t) {
    const p = g.cur(), card = t.card, sp = p ? p.pos : -1;
    TC.on = true; TC.key = g.turnCount + ':' + t.rollSeq + ':' + card.deck + ':' + card.idx;
    TC.sp = sp; TC.deck = card.deck; TC.idx = card.idx; TC.pid = t.pid;
    TC.phase = 'rise'; TC.t0 = performance.now(); TC.mine = t.pid === meId; TC.decided = false; TC.dragY = 0; TC.box = null;
    TC.sparks = [];
    const now = TC.t0;
    for (let i = 0; i < 18; i++) TC.sparks.push({ a: Math.random() * Math.PI * 2, v: 40 + Math.random() * 80, born: now, life: 700 + Math.random() * 600, r: 2 + Math.random() * 3, delay: Math.random() * 280 });
    closeBubble(); if (ui.drawer) setDrawer(false);
    if ($('cardPop') && !$('cardPop').hidden) $('cardPop').hidden = true;
    sfx('card'); if (TC.mine) vib(20);
  }
  function startTileTuck(applyIn) {
    if (!TC.on || TC.phase === 'tuck') return;
    TC.phase = 'tuck'; TC.t0 = performance.now(); TC.dragY = 0;
    const t = g && g.turn;
    if (t && t.card && applyIn != null) t.card.until = Math.min(t.card.until || g.now + 800, g.now + applyIn);
  }
  function paintCard() {
    const t = g && g.turn, live = !!(t && g.phase === 'play' && t.stage === 'card' && t.card);
    if (live) {
      const key = g.turnCount + ':' + t.rollSeq + ':' + t.card.deck + ':' + t.card.idx;
      if (!TC.on || TC.key !== key) startTileCard(t);
      const now = performance.now();
      if (TC.phase === 'rise') {
        t.card.until = g.now + 600000;
        if (now - TC.t0 >= 920) { TC.phase = 'hold'; TC.t0 = now; }
      } else if (TC.phase === 'hold') {
        if (TC.decided) startTileTuck(280);
        else if (!TC.mine && now - TC.t0 >= 2100) { TC.decided = true; startTileTuck(360); }
        else if (TC.mine && !tcKeeper() && now - TC.t0 >= 2800) decideCard(-1);
        else t.card.until = g.now + 600000;
      }
    } else if (TC.on && TC.phase !== 'tuck' && !TC.decided) {
      startTileTuck(0);
    }
    if ($('cardPop') && !$('cardPop').hidden) $('cardPop').hidden = true;
  }
  function decideCard(dir) {
    const t = g && g.turn; if (!t || t.stage !== 'card' || !t.card || TC.decided) return false;
    if (dir > 0 && !tcKeeper()) { toast('This card plays right away: swipe it up or tap it'); return false; }
    TC.decided = true; ui.cardDecided = TC.key;
    if (tcKeeper()) toast('\uD83D\uDE9A Tow Truck Pass stashed in your stuff', '#ffd23f');
    startTileTuck(dir < 0 ? 280 : 280);
    return true;
  }
  function tileCardHit(sx, sy) {
    if (!TC.on || !TC.mine || TC.phase !== 'hold' || TC.decided || !TC.box) return false;
    const B = TC.box, pad = 12;
    return sx >= B.x - pad && sx <= B.x + B.w + pad && sy >= B.y - pad && sy <= B.y + B.h + pad;
  }
  function tcRest(origin) {
    const ic = toScreen(BW / 2, BW / 2), ddx = ic.x - origin.x, ddy = ic.y - origin.y, L = Math.hypot(ddx, ddy) || 1;
    const dist = Math.min(96 * (UIZ || 1), L * 0.26);
    let x = origin.x + ddx / L * dist, y = origin.y + ddy / L * dist;
    const lay = (typeof boardLayout === 'function') ? boardLayout() : null;
    const halfW = Math.min(120, W * 0.30), halfH = Math.min(155, H * 0.24);
    const top = lay ? lay.boardTop + halfH + 8 : halfH + 8;
    const bot = lay ? lay.pad.top - 10 - halfH : H - 80 - halfH;
    x = Math.max(halfW + 8, Math.min(W - halfW - 8, x));
    y = Math.max(top, Math.min(bot, y));
    return { x: x, y: y };
  }
  function drawTileCard(c) {
    if (!TC.on || !g) { TC.box = null; return; }
    const now = performance.now(), sp = tcTile(), r0 = sp >= 0 ? RECTS[sp] : null;
    if (!r0) { TC.box = null; return; }
    const origin = toScreen(r0.x + r0.w / 2, r0.y + r0.h / 2), rest = tcRest(origin);
    const finds = TC.deck === 'finds';
    let ease = 1, flip = 0, rise = 1;   // flip 0 = face, 1 = back; rise 0 = in the tile, 1 = at rest
    if (TC.phase === 'rise') {
      const u = Math.max(0, Math.min(1, (now - TC.t0) / 900));
      ease = 1 - Math.pow(1 - u, 3);
      rise = ease;
      flip = 1 - Math.max(0, Math.min(1, (u - 0.32) / 0.4));
    } else if (TC.phase === 'hold') {
      rise = 1; flip = 0;
    } else if (TC.phase === 'tuck') {
      const u = Math.max(0, Math.min(1, (now - TC.t0) / 560));
      ease = u * u;
      rise = 1 - ease;
      flip = Math.max(0, Math.min(1, (u - 0.08) / 0.45));
      if (u >= 1) { TC.on = false; TC.box = null; return; }
    }
    const bob = TC.phase === 'hold' ? Math.sin(now / 280) * 3 : 0;
    const cx = origin.x + (rest.x - origin.x) * rise, cy = origin.y + (rest.y - origin.y) * rise + bob + (TC.dragY || 0);
    const natW = Math.min(236 * (UIZ || 1), W * 0.64), natH = Math.min(304 * (UIZ || 1), H * 0.38);
    const sc = 0.12 + 0.88 * rise, ang = flip * Math.PI, squash = Math.max(0.07, Math.abs(Math.cos(ang)));
    const showBack = Math.cos(ang) < 0;
    const cw = natW * sc, ch = natH * sc, dw = cw * squash, dh = ch;
    TC.box = { x: cx - dw / 2, y: cy - dh / 2, w: dw, h: dh };
    const faceCol = finds ? '#9bd3f5' : '#ffe07a', ink = finds ? '#0c2a3e' : '#2e2200', deep = finds ? '#1a4a6a' : '#7A560C';
    // light beam from the tile up to the card — a digital trick a table can't do
    c.save();
    const beam = c.createLinearGradient(origin.x, origin.y, cx, cy);
    beam.addColorStop(0, finds ? 'rgba(89,180,232,' + (0.55 * rise).toFixed(3) + ')' : 'rgba(255,210,63,' + (0.55 * rise).toFixed(3) + ')');
    beam.addColorStop(1, finds ? 'rgba(89,180,232,0)' : 'rgba(255,210,63,0)');
    c.fillStyle = beam; c.beginPath();
    const tw = Math.max(10, (r0.w * cam.s) * 0.45), bw = dw * 0.55;
    const px = -(cy - origin.y), py = (cx - origin.x), plen = Math.hypot(px, py) || 1;
    const nx = px / plen, ny = py / plen;
    c.moveTo(origin.x - nx * tw, origin.y - ny * tw); c.lineTo(origin.x + nx * tw, origin.y + ny * tw);
    c.lineTo(cx + nx * bw, cy + ny * bw); c.lineTo(cx - nx * bw, cy - ny * bw); c.closePath(); c.fill();
    // sparks
    TC.sparks.forEach((s) => {
      const age = now - s.born - s.delay; if (age < 0 || age > s.life) return;
      const k = age / s.life, a = (1 - k) * rise;
      c.globalAlpha = a; c.fillStyle = finds ? '#dff6ff' : '#fff4b0';
      c.beginPath(); c.arc(origin.x + Math.cos(s.a) * s.v * k, origin.y + Math.sin(s.a) * s.v * k - k * 30, s.r * (1 - k * 0.4), 0, 7); c.fill();
    });
    c.globalAlpha = 1;
    // glow on the source tile
    c.save(); c.translate(origin.x, origin.y);
    const tg = c.createRadialGradient(0, 0, 2, 0, 0, 28 + 10 * rise);
    tg.addColorStop(0, finds ? 'rgba(157,211,245,.85)' : 'rgba(255,210,63,.85)'); tg.addColorStop(1, 'rgba(255,210,63,0)');
    c.fillStyle = tg; c.beginPath(); c.arc(0, 0, 32 + 12 * rise, 0, 7); c.fill(); c.restore();
    // the card itself
    c.save(); c.translate(cx, cy);
    c.shadowColor = finds ? 'rgba(89,180,232,.55)' : 'rgba(255,210,63,.55)'; c.shadowBlur = 18 + 10 * rise;
    const rad = 16 * sc;
    c.beginPath(); if (c.roundRect) c.roundRect(-dw / 2, -dh / 2, dw, dh, rad); else c.rect(-dw / 2, -dh / 2, dw, dh);
    if (showBack || squash < 0.4) {
      const g2 = c.createLinearGradient(-dw / 2, -dh / 2, dw / 2, dh / 2);
      g2.addColorStop(0, finds ? '#c8ecff' : '#fff3c4'); g2.addColorStop(1, finds ? '#4ea3d4' : '#e2b84a');
      c.fillStyle = g2; c.fill(); c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.stroke();
      if (squash > 0.28) {
        c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '700 ' + Math.max(9, 13 * sc) + 'px Fredoka, sans-serif';
        const dn = (C.decks[TC.deck] || {}).name || (finds ? 'SECRET FINDS' : 'RED DEER RANDOMNESS');
        const lines = String(dn).split(' ');
        lines.forEach((ln, i) => c.fillText(ln, 0, (i - (lines.length - 1) / 2) * 18 * sc));
        c.strokeStyle = ink; c.globalAlpha = 0.35; c.lineWidth = 1.5;
        c.strokeRect(-dw * 0.32, -dh * 0.28, dw * 0.64, dh * 0.56);
        c.globalAlpha = 1;
      }
    } else {
      const g2 = c.createLinearGradient(0, -dh / 2, 0, dh / 2);
      g2.addColorStop(0, finds ? '#e2f5ff' : '#fff7d8'); g2.addColorStop(1, finds ? '#9bd3f5' : '#ffe07a');
      c.fillStyle = g2; c.fill(); c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; c.stroke();
      const cd = B.DECKS[TC.deck][TC.idx], pad = 14 * sc, maxW = dw - pad * 2;
      c.save();
      c.beginPath(); if (c.roundRect) c.roundRect(-dw / 2, -dh / 2, dw, dh, rad); else c.rect(-dw / 2, -dh / 2, dw, dh);
      c.clip();
      c.fillStyle = ink; c.textAlign = 'left'; c.textBaseline = 'top';
      const dk = (C.decks[TC.deck] || {}).name + (cd.year ? '  ·  ' + cd.year : '');
      c.font = '700 ' + Math.max(9, 12 * sc) + 'px Fredoka, sans-serif'; c.globalAlpha = 0.75;
      c.fillText(dk, -dw / 2 + pad, -dh / 2 + pad, maxW);
      c.globalAlpha = 1;
      c.font = '700 ' + Math.max(13, 22 * sc) + 'px Fredoka, sans-serif';
      const titles = wrap(cd.h, maxW).slice(0, 3);
      let y = -dh / 2 + pad + 22 * sc;
      titles.forEach((ln) => { c.fillText(ln, -dw / 2 + pad, y, maxW); y += 24 * sc; });
      if (cd.story) {
        c.font = '600 ' + Math.max(10, 13.5 * sc) + 'px Fredoka, sans-serif'; c.globalAlpha = 0.9;
        const story = wrap(cd.story, maxW).slice(0, 7);
        story.forEach((ln) => { c.fillText(ln, -dw / 2 + pad, y, maxW); y += 15.5 * sc; });
        c.globalAlpha = 1; y += 4 * sc;
      }
      y += 6 * sc;
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-dw / 2 + pad, y); c.lineTo(dw / 2 - pad, y); c.stroke();
      y += 8 * sc;
      c.font = '700 ' + Math.max(11, 15 * sc) + 'px Fredoka, sans-serif';
      wrap(cd.t, maxW).slice(0, 4).forEach((ln) => { c.fillText(ln, -dw / 2 + pad, y, maxW); y += 18 * sc; });
      if (TC.phase === 'hold' && TC.mine && !TC.decided) {
        c.textAlign = 'center'; c.font = '600 ' + Math.max(10, 13 * sc) + 'px Fredoka, sans-serif';
        c.fillStyle = deep;
        const hint = tcKeeper() ? 'Swipe up to keep  ·  down to stash' : 'Tap or swipe up to play';
        c.fillText(hint, 0, dh / 2 - pad - 4, maxW);
      }
      c.restore();
    }
    c.restore();
    c.restore();
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
  function hexA(hex, a) { const h = String(hex).replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function drawBoarded(c, e, mine) {     // small arrow toward the deed with two planks nailed across it
    const sz = 7 * Math.min(UIZ, 2);
    c.save(); c.globalAlpha = 0.8; c.translate(e.x, e.y); c.rotate(e.a);
    c.beginPath(); c.moveTo(sz, 0); c.lineTo(-sz * 0.8, -sz * 0.8); c.lineTo(-sz * 0.8, sz * 0.8); c.closePath();
    c.fillStyle = mine ? '#6f8f6f' : '#8a7f72'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#b07a3c'; c.strokeStyle = '#5a3a14'; c.lineWidth = 0.8;
    [[-0.5, 0.5], [0.45, -0.45]].forEach((q) => { c.save(); c.rotate(q[0]); c.fillRect(-sz * 0.95, -sz * 0.16 + q[1] * sz * 0.5, sz * 1.9, sz * 0.32); c.strokeRect(-sz * 0.95, -sz * 0.16 + q[1] * sz * 0.5, sz * 1.9, sz * 0.32); c.restore(); });
    c.fillStyle = '#222'; c.beginPath(); c.arc(-sz * 0.6, -sz * 0.05, 0.8, 0, 7); c.arc(sz * 0.6, sz * 0.05, 0.8, 0, 7); c.fill();
    c.restore();
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
      if (pr.hocked) { drawBoarded(c, e, pr.owner === myO); continue; }     // v0.7: mortgaged = a little boarded-up shop arrow
      if (pr.owner === myO) { c.globalAlpha = pr.hocked ? 0.25 : 0.55; c.fillStyle = '#3ddc84'; c.beginPath(); c.arc(e.x, e.y, 2.4, 0, Math.PI * 2); c.fill(); }
      else {
        const ow = g.byId(pr.owner); if (!ow || ow.bankrupt || pr.hocked) continue;
        // v0.7: danger = what landing there would cost you, against your cash (and a bit against your whole worth)
        const rent = g.rentFor(i, 7, false), dz = Math.max(0, Math.min(1, Math.max(rent / Math.max(1, m.cash), 2.2 * rent / Math.max(1, g.worthOf(m))) * 1.6));
        const tS = performance.now() / 1000, osc = Math.sin(tS * (2 + 22 * dz) + i) * (0.4 + 3.2 * dz) + (dz > 0.6 ? Math.sin(tS * 61 + i * 3) * 1.1 * (dz - 0.6) : 0);
        const len = 4 + 3 * dz, ox2 = e.side === 'l' || e.side === 'r' ? osc : 0, oy2 = e.side === 'l' || e.side === 'r' ? 0 : osc;
        c.globalAlpha = 0.4 + 0.5 * dz; c.strokeStyle = dz > 0.6 ? '#ff2a2a' : '#ff4a4a'; c.lineWidth = 1.4 + 1.6 * dz; c.beginPath();
        if (e.side === 'l' || e.side === 'r') { c.moveTo(e.x + ox2, e.y - len); c.lineTo(e.x + ox2, e.y + len); } else { c.moveTo(e.x - len, e.y + oy2); c.lineTo(e.x + len, e.y + oy2); }
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


  // ------------------------------------------------------------------ v0.7: pace, moods, living runners, dice hand-off, selfie heads
  // Pace: neutral is 15% slower than v0.6; the dial (settings) goes from half speed to double speed around that.
  const paceMul = () => 0.85 * Math.pow(2, ((prefs.pace == null ? 50 : +prefs.pace) - 50) / 50);
  const paceWord = () => { const v = prefs.pace == null ? 50 : +prefs.pace; return v === 50 ? 'Neutral' : v < 50 ? (v <= 15 ? 'Much slower' : 'Slower') : (v >= 85 ? 'Much faster' : 'Faster'); };
  // Moods for the computer players (picked on the setup screen): trade generosity, smack and reaction frequency, quips.
  const MOOD_ORDER = ['default', 'good', 'friendly', 'hostile'];
  const MOODS = {
    default:  { n: 'Default',  e: '',               need: 0,   gap: 520, idea: 0.16, smack: 1,   react: 0.75 },
    good:     { n: 'Good day', e: '\uD83C\uDF1E',   need: -25, gap: 620, idea: 0.2,  smack: 0.6, react: 0.3 },
    friendly: { n: 'Friendly', e: '\uD83E\uDD1D',   need: -15, gap: 700, idea: 0.24, smack: 0.5, react: 0.4 },
    hostile:  { n: 'Hostile',  e: '\uD83D\uDE20',   need: 45,  gap: 280, idea: 0.1,  smack: 2.2, react: 1 }
  };
  const MOOD_LINES = {
    good: { accepted: ['What a day! Deal!', 'Sure, why not, the sun is out!', 'Love it. Shake!'], declined: ['Ha, not even on a day like this.', 'Nice try, still smiling though.'], counter: ['Great mood, still need a bit more.', 'Today I\'m feeling this instead!'], angry: ['Hey now!', 'Oh come on!'] },
    friendly: { accepted: ['For you? Done.', 'Neighbours help neighbours.', 'Deal, friend!'], declined: ['Sorry pal, can\'t do that one.', 'I like you, but no.'], counter: ['Let\'s meet in the middle, buddy.', 'How about this, friend?'], angry: ['Hey, buddy...', 'Not cool, pal.'] },
    hostile: { accepted: ['Fine. Take it.', 'Ugh. Deal.'], declined: ['Get lost.', 'No. Never.', 'Over my dead body.'], counter: ['This or nothing.', 'Pay up or walk.'], angry: ['Off my lawn!', 'Get OFF my street!', 'You again?!', 'Beat it!'] }
  };
  const moodOf = (p) => (p && MOODS[p.mood] ? p.mood : 'default');
  const MO = (p) => MOODS[moodOf(p)];
  const moodTag = (p) => (p && p.id !== meId && MO(p).e ? ' ' + MO(p).e : '');
  function moodLine(p, kind, fallback) { const L = MOOD_LINES[moodOf(p)]; return L && L[kind] && Math.random() < 0.65 ? ttPick(L[kind]) : fallback; }

  // ---- living runners: idle glances, angry owners shaking a fist
  function lookFor(p, v, nowP) {
    if (busy(v) || v.hold) { v.lk = null; return null; }
    const L = v.lk || (v.lk = { x: 0, y: 0, tx: 0, ty: 0, next: nowP + 800 + Math.random() * 3000 });
    if (nowP > L.next) {
      const r = Math.random();
      if (r < 0.3) { L.tx = 0; L.ty = 0; } else if (r < 0.55) { L.tx = (Math.random() - 0.5) * 1.6; L.ty = -1; }   // look up
      else { L.tx = Math.random() < 0.5 ? -1 : 1; L.ty = (Math.random() - 0.5) * 0.6; }                       // look around
      L.next = nowP + 900 + Math.random() * 3200;
    }
    L.x += (L.tx - L.x) * 0.12; L.y += (L.ty - L.y) * 0.12;
    return { x: L.x, y: L.y };
  }
  function getAngry(owner, at, strong) {
    if (!owner || owner.bankrupt) return;
    const mo = MO(owner); if (owner.id !== meId && Math.random() > mo.react * (strong ? 1 : 0.7)) return;
    const v = visOf(owner), va = visOf(at), now = performance.now();
    v.angry = { at: now, until: now + (strong ? 2300 : 1600) * (moodOf(owner) === 'hostile' ? 1.3 : 1), dir: va.x >= v.x ? 1 : -1 };
    if (owner.id !== meId && (moodOf(owner) === 'hostile' || Math.random() < 0.25)) say(owner.id, moodLine(owner, 'angry', ttPick(['Hey!', 'My street!', 'Grr!', 'Keep walking!'])), 1800);
  }
  function landReact(d) {
    const p = g.byId(d.pid); if (!p) return;
    const sp = d.sp, pr = g.props[sp];
    setTimeout(() => {
      if (!g) return;
      const seen = {};
      if (pr && pr.owner >= 0 && pr.owner !== g.oid(p)) { const o = g.byId(pr.owner); if (o) { seen[o.id] = 1; getAngry(o, p, true); } }
      [sp - 1, sp + 1].map((i) => (i + 40) % 40).forEach((i) => {
        const q = g.props[i]; if (!q || q.owner < 0 || q.owner === g.oid(p)) return;
        const o = g.byId(q.owner); if (o && !seen[o.id] && Math.abs(visOf(o).x - visOf(p).x) + Math.abs(visOf(o).y - visOf(p).y) < 99999) { seen[o.id] = 1; getAngry(o, p, false); }
      });
    }, 380);
  }
  function personOpts(p, v, nowP) {
    const o = {}, a = v.angry;
    if (a && nowP < a.until) { o.mood = 'angry'; if (!busy(v)) { o.fist = (nowP - a.at) / 1000; o.faceTo = a.dir; } }
    else { v.angry = null; const lk = lookFor(p, v, nowP); if (lk) o.look = lk; }
    if (v.toss && nowP - v.toss < 750) o.toss = (nowP - v.toss) / 750;
    else if (catching(p, nowP)) o.toss = 0.58;
    const sf = selfieFor(p); if (sf) o.selfie = sf;
    return o;
  }

  // ---- dice hand-off (seen from your phone): your arm tosses, the dice fly off and fade; on your turn they fade in and come to you
  function diceAway() {
    const d = $('dice'); if (!d || d.hidden) return;
    const m = me(); if (m) visOf(m).toss = performance.now();
    const close = cam.mode === 'close' && !cam.whole, v = m ? visOf(m) : null, s = v ? toScreen(v.x, v.y - 40) : { x: W / 2, y: H / 3 };
    [...d.querySelectorAll('.die')].forEach((die, k) => {
      const r = die.getBoundingClientRect(), gh = die.cloneNode(true);
      gh.className = 'die ghostDie'; Object.assign(gh.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0, zIndex: 13, pointerEvents: 'none' });
      document.body.appendChild(gh);
      const tx = close ? (k ? 40 : -40) : s.x - r.left - r.width / 2 + (k ? 18 : -18), ty = close ? -H * 0.45 : s.y - r.top - r.height / 2 - 60;
      gh.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' },
        { transform: 'translate(' + tx * 0.55 + 'px,' + (ty * 0.55 - 50) + 'px) rotate(' + (k ? 260 : -240) + 'deg) scale(' + (close ? 0.55 : 0.7) + ')', opacity: 0.9, offset: 0.55 },
        { transform: 'translate(' + tx + 'px,' + ty + 'px) rotate(' + (k ? 520 : -470) + 'deg) scale(' + (close ? 0.12 : 0.3) + ')', opacity: 0, filter: 'blur(2px)' }],
        { duration: 1100, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }).onfinish = () => gh.remove();
    });
  }
  function diceArrive() {
    const d = $('dice'), m = me(); if (!d || d.hidden) return;
    const close = cam.mode === 'close' && !cam.whole, v = m ? visOf(m) : null;
    [...d.querySelectorAll('.die')].forEach((die, k) => {
      const r = die.getBoundingClientRect();
      let fx, fy;
      if (close || !v) { fx = (k ? 50 : -50); fy = -H * 0.42; }                       // from far away, straight at you
      else { const s = toScreen(v.x, v.y - 60); fx = s.x - r.left - r.width / 2 + (k ? 30 : -30); fy = s.y - r.top - r.height / 2 - 90; }   // from across the table
      die.animate([{ transform: 'translate(' + fx + 'px,' + fy + 'px) rotate(' + (k ? -400 : 380) + 'deg) scale(' + (close ? 0.12 : 0.3) + ')', opacity: 0, filter: 'blur(3px)' },
        { opacity: 0.85, offset: 0.35, filter: 'blur(1px)' },
        { transform: 'translate(0,-14px) rotate(0) scale(1.12)', opacity: 1, offset: 0.82, filter: 'blur(0)' },
        { transform: 'none', opacity: 1 }], { duration: 1050, delay: k * 90, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' });
    });
    vib(12);
  }

  // ---- selfie head: a quick front-camera photo becomes your runner's big round head (local to this browser, this game)
  const SELFIE_KEY = 'rdr_solo_selfie_v07';      // same key as v0.7 (v0.8 adds the marked eye/mouth points)
  const SF_PTS = { le: { x: 0.37, y: 0.43 }, re: { x: 0.63, y: 0.43 }, mo: { x: 0.5, y: 0.72 } };
  const SF = { img: null, pts: null, skin: null, lid: null, blink: 0, bAt: -1e9, nb: 0, gx: 0, gy: 0, tgx: 0, tgy: 0, ng: 0, expr: null, until: 0, k: 0, wob: 0, kick: 0, kickAt: -1e9 };
  let selfieImg = null, selfieSeed = null;
  function selfieFor(p) {
    if (!p || p.id !== meId || !g) return null;
    if (selfieSeed !== g.seed) {      // load once per game
      selfieSeed = g.seed; selfieImg = null; SF.img = null;
      try { const s = JSON.parse(localStorage.getItem(SELFIE_KEY) || 'null'); if (s && s.seed === g.seed && s.data) loadSelfie(s.data, s.pts); } catch (e) {}
    }
    return SF.img ? SF : null;
  }
  function loadSelfie(data, pts) {
    const im = new Image();
    im.onload = () => { selfieImg = im; SF.img = im; SF.pts = pts || SF_PTS; sampleSkin(im); SF.nb = performance.now() + 1200; };
    im.src = data;
  }
  function sampleSkin(im) {      // skin from the cheeks (for the mouth patch) and just above the eyes (for the eyelids)
    try {
      const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 64; const c2 = cv2.getContext('2d'); c2.drawImage(im, 0, 0, 64, 64);
      const px = (u, v) => { const d = c2.getImageData(Math.max(0, Math.min(61, Math.round(u * 64) - 1)), Math.max(0, Math.min(61, Math.round(v * 64) - 1)), 3, 3).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } return [r / 9, gg / 9, b / 9]; };
      const P = SF.pts, a = px(P.le.x - 0.02, P.le.y + 0.15), b = px(P.re.x + 0.02, P.re.y + 0.15), l1 = px(P.le.x, P.le.y - 0.075), l2 = px(P.re.x, P.re.y - 0.075);
      const hex = (c, m) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * m))).toString(16).padStart(2, '0')).join('');
      SF.skin = hex([0, 1, 2].map((i) => (a[i] + b[i]) / 2), 1); void l1; void l2; SF.lid = hex([0, 1, 2].map((i) => (a[i] + b[i]) / 2), 0.9);   // eyelids = cheek skin, a shade darker (above the eye is often brow)
    } catch (e) { SF.skin = SF.lid = null; }
  }
  function sfExpr(e, ms) { if (!SF.img) return; const n = performance.now(); SF.expr = e; SF.until = n + (ms || 2000); SF.kickAt = n; SF.kick = e === 'shock' ? 0.5 : 0.32; }
  function sfTick(nowP, dt) {
    if (!SF.img || !g) return;
    if (nowP > SF.nb) { SF.bAt = nowP; SF.nb = nowP + (Math.random() < 0.18 ? 260 : 2200 + Math.random() * 3200); }
    const bt = nowP - SF.bAt; SF.blink = bt < 190 ? Math.sin(bt / 190 * Math.PI) : 0;
    const m = me(), v = m ? visOf(m) : null, walking = v && busy(v);
    if (nowP > SF.ng) { const fwd = Math.random() < 0.4; SF.tgx = fwd ? 0 : Math.random() * 2 - 1; SF.tgy = fwd ? 0 : Math.random() * 1.2 - 0.6; SF.ng = nowP + 700 + Math.random() * 2000; }
    if (walking) { SF.tgx = 0.8; SF.tgy = 0; }
    const kg = 1 - Math.exp(-dt * 14); SF.gx += (SF.tgx - SF.gx) * kg; SF.gy += (SF.tgy - SF.gy) * kg;
    const want = nowP < SF.until ? 1 : 0; SF.k += (want - SF.k) * (1 - Math.exp(-dt * (want ? 12 : 6))); if (!want && SF.k < 0.02) { SF.k = 0; SF.expr = null; }
    const kt = (nowP - SF.kickAt) / 1000;
    SF.wob = 0.05 * Math.sin(nowP / 430) + (walking ? 0.11 * Math.sin((v.phase || 0) * Math.PI * 4) : 0) + SF.kick * Math.sin(kt * 15) * Math.exp(-kt * 3.2) + (v && v.bonk ? 0.25 * Math.sin(nowP / 60) * Math.max(0, 1 - (nowP - v.bonk.at) / 1500) : 0);
  }
  function setSelfieData(data, pts) {
    if (!g) return;
    try { localStorage.setItem(SELFIE_KEY, JSON.stringify({ seed: g.seed, data: data, pts: pts || SF_PTS, at: Date.now() })); } catch (e) {}
    selfieSeed = g.seed; loadSelfie(data, pts);
    setTimeout(() => { const m = me(); if (m) { visOf(m).impact = performance.now(); visOf(m).impactAmp = 0.2; } sfExpr('smile', 2200); }, 120);
    toast('\uD83D\uDCF8 Bobblehead on!', '#ffd23f'); sfx('pop');
  }
  function clearSelfie() { try { localStorage.removeItem(SELFIE_KEY); } catch (e) {} selfieImg = null; SF.img = null; toast('Selfie removed'); sfx('click'); if (ui.drawer) paintDrawer(true); }
  function cropTo(src, sw, sh) {       // centre-square crop to 256 px, JPEG
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c2 = cv.getContext('2d'), k = Math.min(sw, sh);
    c2.drawImage(src, (sw - k) / 2, (sh - k) / 2, k, k, 0, 0, 256, 256);
    return cv.toDataURL('image/jpeg', 0.82);
  }
  function selfieFromFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { startAlign(cropTo(im, im.naturalWidth, im.naturalHeight)); URL.revokeObjectURL(url); };
    im.onerror = () => { toast('That photo could not be read'); URL.revokeObjectURL(url); };
    im.src = url;
  }
  let selfieStream = null;
  function selfieDom() {
    let el = $('selfie'); if (el) return el;
    el = document.createElement('div'); el.id = 'selfie'; el.hidden = true;
    el.innerHTML = '<div class="sf-in"><b class="sf-t">SELFIE BOBBLEHEAD</b>' +
      '<div class="sf-align" id="sfAlign" hidden><div class="sf-stage" id="sfStage"><img id="sfAImg" alt=""><i class="sf-egg"></i>' +
      '<i class="mk" data-k="le"><s></s><em>eye</em></i><i class="mk" data-k="re"><s></s><em>eye</em></i><i class="mk mo" data-k="mo"><s></s><em>mouth</em></i></div>' +
      '<p class="sf-msg">Drag the markers onto your eyes and mouth</p><div class="sf-btns"><button class="btn ghost" id="sfAgain">Retake</button><button class="btn go" id="sfOk">Confirm</button></div></div>' +
      '<div class="sf-cap" id="sfCap"><div class="sf-ring"><video id="sfVid" playsinline muted autoplay></video><img id="sfPrev" alt=""></div>' +
      '<p class="sf-msg" id="sfMsg">Line your face up in the circle.</p><div class="sf-btns"><button class="btn go" id="sfSnap">\uD83D\uDCF8 Snap</button>' +
      '<label class="btn" id="sfFileL">Use a photo<input type="file" id="sfFile" accept="image/*" capture="user" hidden></label></div>' +
      '<div class="sf-btns"><button class="btn ghost" id="sfRemove">Remove selfie</button><button class="btn ghost" id="sfX">Cancel</button></div></div></div>';
    document.body.appendChild(el);
    $('sfX').onclick = closeSelfie;
    $('sfRemove').onclick = () => { clearSelfie(); closeSelfie(); };
    $('sfFile').onchange = (e) => selfieFromFile(e.target.files && e.target.files[0]);
    $('sfSnap').onclick = () => {
      const v = $('sfVid');
      if (selfieStream && v.videoWidth) startAlign(cropTo(v, v.videoWidth, v.videoHeight));
      else $('sfFile').click();
    };
    // alignment markers
    const stage = $('sfStage'); let drag = null;
    const place = () => { stage.querySelectorAll('.mk').forEach((m) => { const q = ui.sfPts[m.dataset.k]; m.style.left = (q.x * 100) + '%'; m.style.top = (q.y * 100) + '%'; }); };
    const at = (e) => { const r = stage.getBoundingClientRect(); return { x: Math.max(0.03, Math.min(0.97, (e.clientX - r.left) / r.width)), y: Math.max(0.03, Math.min(0.97, (e.clientY - r.top) / r.height)) }; };
    stage.addEventListener('pointerdown', (e) => {
      const m = e.target.closest('.mk'), q = at(e);
      drag = m ? m.dataset.k : Object.keys(ui.sfPts).sort((a, b) => Math.hypot(ui.sfPts[a].x - q.x, ui.sfPts[a].y - q.y) - Math.hypot(ui.sfPts[b].x - q.x, ui.sfPts[b].y - q.y))[0];
      if (!m) { ui.sfPts[drag] = q; place(); }
      try { stage.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => { if (!drag) return; ui.sfPts[drag] = at(e); place(); });
    const up = () => { drag = null; }; stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    selfieDom.place = place;
    $('sfOk').onclick = () => { setSelfieData(ui.sfData, JSON.parse(JSON.stringify(ui.sfPts))); closeSelfie(); };
    $('sfAgain').onclick = () => { $('sfAlign').hidden = true; $('sfCap').hidden = false; openSelfie(); };
    return el;
  }
  function startAlign(data) {
    selfieDom(); ui.sfData = data; ui.sfPts = JSON.parse(JSON.stringify(SF_PTS));
    if (selfieStream) { selfieStream.getTracks().forEach((t) => t.stop()); selfieStream = null; }
    $('sfAImg').src = data; $('sfCap').hidden = true; $('sfAlign').hidden = false; selfieDom.place(); sfx('pop');
  }
  function openSelfie() {
    if (!g) return;
    const el = selfieDom(); closeBubble(); setDrawer(false); $('sfAlign').hidden = true; $('sfCap').hidden = false;
    el.hidden = false; freeze(true);
    $('sfPrev').src = selfieImg ? selfieImg.src : ''; $('sfPrev').hidden = !selfieImg; $('sfRemove').hidden = !selfieImg;
    $('sfSnap').textContent = selfieImg ? '\uD83D\uDCF8 Retake' : '\uD83D\uDCF8 Snap';
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      $('sfMsg').textContent = 'Line your face up in the circle.';
      md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false }).then((st) => {
        if ($('selfie').hidden) { st.getTracks().forEach((t) => t.stop()); return; }
        selfieStream = st; const v = $('sfVid'); v.srcObject = st; v.play().catch(() => {}); $('sfPrev').hidden = true;
      }).catch(() => { $('sfMsg').textContent = 'No camera here: tap \u201cUse a photo\u201d (or Snap) to pick one.'; });
    } else $('sfMsg').textContent = 'Tap Snap or \u201cUse a photo\u201d to take one.';
  }
  function closeSelfie() {
    const el = $('selfie'); if (el) el.hidden = true;
    if (selfieStream) { selfieStream.getTracks().forEach((t) => t.stop()); selfieStream = null; }
    if (g && !ui.panel && !tt && document.visibilityState !== 'hidden') freeze(false);
  }

  // ---- buy pop / card leave: the card comes apart in strips and fades (about twice as slow as before, so it reads)
  function popLeave() {
    const pc = $('popCard'); if (!pc || !pc.innerHTML) return;
    const r = pc.getBoundingClientRect(); if (r.width < 10) return;
    const N = 5, h = r.height / N, z = popK.pop || 1;
    for (let k = 0; k < N; k++) {
      const strip = document.createElement('div'); strip.className = 'popStrip';
      Object.assign(strip.style, { left: r.left + 'px', top: (r.top + k * h) + 'px', width: r.width + 'px', height: Math.ceil(h + 1) + 'px' });
      const inner = pc.cloneNode(true); inner.removeAttribute('id'); inner.className = 'popClone'; inner.style.cssText = 'position:absolute;left:0;top:' + (-k * h) + 'px;width:' + (r.width / z) + 'px;margin:0;animation:none;transform:scale(' + z + ');transform-origin:0 0';
      strip.appendChild(inner); document.body.appendChild(strip);
      const dx = (k % 2 ? 1 : -1) * (30 + k * 8), rot = (k % 2 ? 1 : -1) * (3 + k);
      strip.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dx * 0.3 + 'px,' + (6 + k * 3) + 'px) rotate(' + rot * 0.4 + 'deg)', opacity: 0.85, offset: 0.4 },
        { transform: 'translate(' + dx + 'px,' + (40 + k * 14) + 'px) rotate(' + rot + 'deg) scale(.92)', opacity: 0 }],
        { duration: 900, delay: k * 45, easing: 'ease-in', fill: 'forwards' }).onfinish = () => strip.remove();
    }
  }

  // ---- v0.7 event hook (runs before the stock handler)
  function v07Event(type, d) {
    if (!g) return;
    const pv = (pid) => { const q = g.byId(pid); if (!q) return null; const v = visOf(q); return { x: v.x, y: v.y - 35 }; };
    if (type === 'roll') startBoardDice(d);
    {                    // v0.8 highlights for the centre replays
      const nm = (pid) => (pid === meId ? 'You' : ((g.byId(pid) || {}).name || '?')), pv2 = (pid) => { const q = g.byId(pid); return q ? visOf(q) : { x: BW / 2, y: BW / 2 }; };
      if (type === 'buy') addHL({ kind: 'moment', sp: d.sp, word: 'SOLD!', col: '#3ddc84', txt: nm(d.pid) + ' bought ' + S[d.sp].name + ' · ' + money(d.price) });
      else if (type === 'pay' && typeof d.to === 'number' && d.amount >= 60) { const q = g.byId(d.from); addHL({ kind: 'moment', sp: q ? q.pos : null, word: d.amount >= 200 ? 'OUCH!' : 'RENT!', col: '#ff5d73', txt: nm(d.from) + ' paid ' + nm(d.to) + ' ' + money(d.amount) }); }
      else if (type === 'roll' && d.dbl) { const v2 = pv2(d.pid); addHL({ kind: 'moment', x: v2.x, y: v2.y - 30, word: 'DOUBLES!', col: '#ffd23f', txt: nm(d.pid) + ' rolled doubles' }); }
      else if (type === 'caught') addHL({ kind: 'moment', sp: d.sp, word: 'CAUGHT!', col: '#ff9f1c', txt: nm(d.owner) + ' caught ' + nm(d.pid) + ' · ' + money(d.amount) });
      else if (type === 'auctionWon') addHL({ kind: 'moment', sp: d.sp, word: 'HAMMER!', col: '#59b4e8', txt: nm(d.pid) + ' won ' + S[d.sp].name + ' at auction' });
    }
    if (SF.img) {        // v0.8 bobblehead feelings
      if (type === 'buy' && d.pid === meId) sfExpr('smile', 2400);
      else if (type === 'pay' && d.to === meId) sfExpr('smile', 2200);
      else if (type === 'pay' && d.from === meId && d.amount >= 200) sfExpr('shock', 1900);
      else if (type === 'pay' && d.from === meId && typeof d.to === 'number') sfExpr('frown', 2300);
      else if (type === 'tax' && d.pid === meId) sfExpr('frown', 2000);
      else if (type === 'caught' && d.pid === meId) sfExpr('frown', 2800);
      else if (type === 'caught' && d.owner === meId) sfExpr('smile', 2200);
      else if (type === 'roll' && d.pid === meId && d.dbl) sfExpr('shock', 1500);
      else if (type === 'auctionWon' && d.pid === meId) sfExpr('smile', 2000);
    }
    if (type === 'land') { landReact(d); const f = pv(d.pid); if (f) markHot(f.x, f.y, 2500); }
    else if (type === 'passDice') { poofBoardDice(d.pid); dicePass(d.pid); }
    else if (type === 'buy') { const r = RECTS[d.sp]; markHot(r.x + r.w / 2, r.y + r.h / 2, 3000); }
    else if (type === 'pay' && typeof d.to === 'number') { const f = pv(d.from); if (f) markHot(f.x, f.y, 3000); }
    else if (type === 'tradeDone') { const f = pv(d.a); if (f) markHot(f.x, f.y, 2500); }
    else if (type === 'turn' && d.pid === meId) setTimeout(() => { if (g && g.turn && g.turn.pid === meId && g.turn.stage === 'roll') maybeRecap(); }, 700);
  }

  // ---- idle follow camera: after 3 s without a touch the camera keeps YOUR zoom and glides to the most important action
  const IDLE_MS = 3000;
  const hot = { x: 0, y: 0, until: 0 };
  function markHot(x, y, ms) { hot.x = x; hot.y = y; hot.until = performance.now() + (ms || 3000); }
  function actionFocus() {
    if (!g || !g.turn || g.phase !== 'play') return null;
    const t = g.turn, nowP = performance.now();
    if (t.auction) { const r = RECTS[t.auction.sp]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    const walker = g.players.find((p) => !p.bankrupt && busy(visOf(p)));
    if (walker) { const v = visOf(walker); return { x: v.x, y: v.y - 35 }; }
    if (nowP < hot.until) return { x: hot.x, y: hot.y };
    if (t.buy != null || t.stage === 'card' || (t.payup && !t.payup.done) || t.stage === 'moving') { const p = g.cur(); if (p) { const v = visOf(p); return { x: v.x, y: v.y - 35 }; } }
    return null;    // nothing important: stay put
  }

  // ---- smack-combo replay: every few rounds, a soft ghostly half-speed replay of the best smack run
  const smackLog = [];
  function logSmack(p, q, ps, w) {
    const v = visOf(p), vq = visOf(q);
    if (SF.img) { if (p.id === meId) sfExpr('smile', ps.perfect ? 2600 : 1800); else if (q.id === meId) sfExpr('shock', 1700); }
    let rec = smackLog.length ? smackLog[smackLog.length - 1] : null;
    if (!rec || rec.w !== w) { rec = { w: w, from: p.id, round: g.round, shown: false, hits: [] }; smackLog.push(rec); if (smackLog.length > 20) smackLog.shift(); addHL({ kind: 'smack', rec: rec }); }
    rec.hits.push({ pid: q.id, x: vq.x, y: vq.y, sx: v.x, sy: v.y, face: v.face || 1, perfect: !!ps.perfect });
  }
  // ---- v0.9 replays: a new highlight plays once in the big centre screen. Everything else fades dark so the
  // replay takes centre stage, then fades back. The game keeps running underneath. Tap the replay to skip.
  const HL = [];
  function addHL(h) { h.at = performance.now(); h.seen = false; HL.push(h); if (HL.length > 8) HL.shift(); }
  const RP = { cur: null, idx: 0, t: 0, tau: 0, a: 0, gapUntil: 0, skip: false, box: null };
  function maybeRecap() { return false; }      // v0.7's every-few-rounds full-screen replay is replaced by the cycling centre replays
  function showRecap(rec) { startRP({ kind: 'smack', rec: rec }); }
  function startRP(h) { RP.cur = h; RP.t = 0; RP.tau = 0; RP.skip = false; RP.end = null; RP.fired = {}; RP.pows = []; RP.dur = h.kind === 'smack' ? 900 + Math.min(5, h.rec.hits.length) * 1100 + 1100 : 4200; }
  function rpHit(sx, sy) {
    const B = RP.box; if (!RP.cur || !B || RP.a < 0.3) return false;
    if (sx < B.x || sx > B.x + B.w || sy < B.y || sy > B.y + B.h) return false;
    RP.skip = true; sfx('click'); return true;
  }
  function syncReplayDim(a) { void a; document.body.classList.remove('rp-dim'); document.body.style.removeProperty('--rpd'); }
  function drawReplays(c, dtS) {
    const G = sqGeom(), nowP = performance.now();
    RP.box = G ? G.pip : null;
    if (!G || !g || g.phase !== 'play') { RP.a = 0; return; }
    if (!RP.cur) {
      const nxt = HL.find((h) => !h.seen);
      if (nxt && nowP > RP.gapUntil) startRP(nxt);
      else { RP.a = Math.max(0, RP.a - dtS * 1.5); return; }
    }
    if (RP.cur) {
      let rate = 1;
      if (RP.cur.kind === 'smack' && RP.spots) RP.spots.forEach((sp2) => { rate = Math.min(rate, 1 - 0.5 * Math.exp(-Math.pow((RP.tau - sp2.t) / 420, 2))); });   // speed ramp: half speed around each smack
      RP.t += dtS * 1000; RP.tau += dtS * 1000 * rate;
      const ending = RP.skip || RP.tau > RP.dur;
      if (ending && RP.end == null) RP.end = nowP;
      if (RP.end != null) { RP.a = Math.max(0, 1 - (nowP - RP.end) / (RP.skip ? 350 : 900)); if (RP.a <= 0) { RP.cur.seen = true; RP.cur = null; RP.spots = null; RP.gapUntil = nowP + 800; return; } }
      else RP.a = Math.min(1, RP.a + dtS / 0.7);
    }
    if (!RP.cur || RP.a <= 0) return;
    const B = G.pip, rad = Math.min(28, Math.min(B.w, B.h) * 0.08), h = RP.cur;
    // v0.10: the replay stays in the centre screen; the rest of the board and chrome stay fully visible
    c.save(); c.globalAlpha = RP.a;
    c.shadowColor = 'rgba(255,210,63,.55)'; c.shadowBlur = 14; c.fillStyle = 'rgba(14,10,24,.92)'; rr(B.x, B.y, B.w, B.h, rad); c.fill(); c.shadowBlur = 0;
    c.save(); rr(B.x, B.y, B.w, B.h, rad); c.clip();
    if (h.kind === 'smack') drawSmackRP(c, B, h, nowP); else drawMomentRP(c, B, h);
    c.restore();
    c.strokeStyle = 'rgba(255,210,63,.75)'; c.lineWidth = 2; rr(B.x, B.y, B.w, B.h, rad); c.stroke();
    const fs = Math.max(13, Math.min(20, B.h * 0.06));
    c.font = '700 ' + fs + 'px Fredoka, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#ffd23f';
    c.fillText(h.kind === 'smack' ? '\u25B6 SMACK REPLAY' : '\u25B6 REPLAY', B.x + rad * 0.6, B.y + 8);
    c.restore();
  }
  function drawSmackRP(c, B, h, nowP) {
    const rec = h.rec, from = g.byId(rec.from); if (!from) return;
    const hs = rec.hits.slice(0, 5), n = hs.length, dir = hs[0].face || 1, ph = B.h * 0.6, tau = RP.tau;
    if (!RP.spots || RP.spots.n !== n || RP.spots.B !== B.w + ':' + B.h) {
      RP.spots = hs.map((q, i) => ({ h: q, i: i, t: 900 + i * 1100, u: n === 1 ? 0.6 : 0.34 + 0.5 * i / (n - 1), bonk: null }));
      if (dir < 0) RP.spots.forEach((sp2) => { sp2.u = 1 - sp2.u; });
      RP.spots.n = n; RP.spots.B = B.w + ':' + B.h;
    }
    const sp = RP.spots, fy = B.y + B.h * 0.94, X = (u) => B.x + B.w * u;
    const keys = [{ t: 0, x: X(dir > 0 ? -0.1 : 1.1) }].concat(sp.map((q) => ({ t: q.t, x: X(q.u) - dir * ph * 0.42 }))).concat([{ t: RP.dur, x: X(dir > 0 ? 1.15 : -0.15) }]);
    let k = 0; while (k < keys.length - 2 && tau > keys[k + 1].t) k++;
    const k0 = keys[k], k1 = keys[k + 1], f = Math.max(0, Math.min(1, (tau - k0.t) / Math.max(1, k1.t - k0.t))), e = f * f * (3 - 2 * f), sx = k0.x + (k1.x - k0.x) * e;
    sp.forEach((q) => {
      if (tau >= q.t && !RP.fired[q.i]) {
        RP.fired[q.i] = 1; q.bonk = tau;
        if (!h.seen && RP.a > 0.5) { lsfx('smack'); setTimeout(() => lsfx(q.h.perfect ? 'ding' : 'boing'), 90); }
        RP.pows.push({ u: q.u, born: tau, txt: q.h.perfect ? 'PERFECT!' : 'BONK!' });
      }
      let head = 0;
      if (q.bonk != null) { const bt = (tau - q.bonk) / 1000; head = (q.h.perfect ? 0.75 : 0.55) * Math.exp(-bt * 1.6) * Math.sin(bt * Math.PI * 2 * 2.6 + 0.25) * dir; }
      const who = g.byId(q.h.pid); if (!who) return;
      c.save(); c.globalAlpha = RP.a * 0.8; c.shadowColor = who.color; c.shadowBlur = 14;
      PPL.draw(c, X(q.u), fy, ph, lookOf(who), { face: -dir, badge: who.ink, head: head, mood: q.bonk != null ? 'angry' : undefined, selfie: selfieFor(who) || undefined });
      c.restore();
    });
    let sw = -1; sp.forEach((q) => { const d = tau - (q.t - 300); if (d >= 0 && d < 760) sw = d / 760; });
    c.save(); c.globalAlpha = RP.a * 0.95; c.shadowColor = '#ffd23f'; c.shadowBlur = 18;
    PPL.draw(c, sx, fy, ph * 1.08, lookOf(from), { face: dir, badge: from.ink, walk: (tau / 520) % 1, swing: sw, selfie: selfieFor(from) || undefined });
    c.restore();
    RP.pows = RP.pows.filter((pw) => tau - pw.born < 1100);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    RP.pows.forEach((pw) => { const e2 = (tau - pw.born) / 1100; c.globalAlpha = RP.a * (1 - e2); c.fillStyle = pw.txt === 'PERFECT!' ? '#ffd23f' : '#ff5d73'; c.font = '800 ' + (B.h * 0.2 * (1 + e2 * 0.3)) + 'px Fredoka, sans-serif'; c.fillText(pw.txt, X(pw.u), B.y + B.h * 0.32 - e2 * 10); });
    c.globalAlpha = RP.a;
  }
  function drawMomentRP(c, B, h) {      // a slow push-in on the spot where it happened, with a caption and a pop word
    const prog = Math.min(1, RP.t / RP.dur), r0 = h.sp != null ? RECTS[h.sp] : null;
    const fx = r0 ? r0.x + r0.w / 2 : h.x, fy = r0 ? r0.y + r0.h / 2 : h.y;
    const sc = B.h / (CELL * 1.9) * (1 + 0.18 * prog);
    c.save(); c.translate(B.x + B.w / 2 - W / 2, B.y + B.h / 2 - H / 2);
    drawScene(c, { x: fx, y: fy, s: sc }, W, H, { noBubbles: true });
    c.restore();
    if (r0) { c.save(); c.translate(B.x + B.w / 2, B.y + B.h / 2); c.scale(sc, sc); c.translate(-fx, -fy); hlTile(c, r0, '255,210,63', 0.6 + 0.4 * Math.sin(performance.now() / 160)); c.restore(); }
    const g2 = c.createLinearGradient(0, B.y + B.h * 0.55, 0, B.y + B.h); g2.addColorStop(0, 'rgba(8,6,14,0)'); g2.addColorStop(1, 'rgba(8,6,14,.85)'); c.fillStyle = g2; c.fillRect(B.x, B.y + B.h * 0.55, B.w, B.h * 0.45);
    const fs = Math.max(9, Math.min(14, B.h * 0.14));
    c.font = '600 ' + fs + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillStyle = '#fff';
    c.fillText(h.txt, B.x + B.w / 2, B.y + B.h - 5, B.w - 12);
    const pk = Math.min(1, RP.t / 380), wob = pk < 1 ? 1.35 - 0.35 * pk : 1 + 0.03 * Math.sin(RP.t / 120);
    c.save(); c.translate(B.x + B.w / 2, B.y + B.h * 0.34); c.rotate(-0.08); c.scale(wob, wob);
    c.font = '800 ' + (B.h * 0.22) + 'px Fredoka, sans-serif'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = '#1d1a26'; c.strokeText(h.word, 0, 0); c.fillStyle = h.col || '#ffd23f'; c.fillText(h.word, 0, 0);
    c.restore();
  }

  // ------------------------------------------------------------------ v0.7b: drawer, deed cards, dice arc, double-tap camera
  // ---- drawer top row: coloured set tabs (tap = jump to that set) + your cash (shakes and drops money on the way out)
  const setOrder = (ds) => { const seen = []; ds.forEach((i) => { const k = S[i].group || S[i].type; if (seen.indexOf(k) < 0) seen.push(k); }); return seen; };
  const setColor = (k) => (B.GROUPS[k] ? B.GROUPS[k].color : BAND_COL[k] || '#888');
  let lastCash = null;
  function setRing(s) {     // v0.8: a ring of segments like the colour disc under the runners: one per deed, gold = bare, green = shops, red = Mega-Plex, dim = mortgaged
    const mem = B.GROUP_MEMBERS[s] || [], n = mem.length, seg = 360 / n, gapD = 10, stops = [];
    let shops = 0;
    mem.forEach((i, j) => {
      const pr = g.props[i], sh = pr.shops || 0; shops += sh === 5 ? 5 : sh;
      const col = pr.hocked ? '#6d6880' : sh === 5 ? '#ff4d57' : sh ? ['#9be7b0', '#5fd384', '#2fbf63', '#1e9c4c'][sh - 1] : '#ffd23f';
      const a0 = j * seg + gapD / 2, a1 = (j + 1) * seg - gapD / 2;
      stops.push('transparent ' + (j * seg) + 'deg ' + a0 + 'deg', col + ' ' + a0 + 'deg ' + a1 + 'deg', 'transparent ' + a1 + 'deg ' + ((j + 1) * seg) + 'deg');
    });
    return '<u class="ring" style="background:conic-gradient(from -90deg,' + stops.join(',') + ')"></u>' + (shops ? '<em class="bld">' + (shops >= 5 && mem.every((i) => g.props[i].shops === 5) ? '\u2605' : '\u2302' + shops) + '</em>' : '');
  }
  function paintGripRow() {
    const m = me(); if (!m) return;
    const ds = myDeeds(), sets = setOrder(ds), k = ds.map((i) => i + (g.props[i].hocked ? 'h' : '') + g.props[i].shops).join(',') + '|' + W;
    if (paintGripRow.k !== k) {
      paintGripRow.k = k;
      $('peekL').innerHTML = sets.length ? sets.map((s) => { const n = ds.filter((i) => (S[i].group || S[i].type) === s).length, full = B.GROUP_MEMBERS[s] && B.GROUP_MEMBERS[s].length === n;
        return '<i class="stab' + (full ? ' full' : '') + '" data-set="' + s + '" style="background:' + setColor(s) + '">' + n + (full ? setRing(s) : '') + '</i>'; }).join('') : '<span class="more">no deeds yet</span>';
    }
    const ck = m.cash + '|' + m.color;
    if (paintGripRow.c !== ck) {
      paintGripRow.c = ck;
      let pill = $('cashPill');
      if (!pill) { $('peekR').innerHTML = '<span class="cashPill" id="cashPill"><i></i><b></b></span>'; pill = $('cashPill'); }
      pill.querySelector('i').style.background = m.color; pill.querySelector('b').textContent = money(m.cash);
      if (lastCash != null && m.cash !== lastCash) {
        const diff = m.cash - lastCash, fl = document.createElement('span');
        fl.className = 'cashFly ' + (diff < 0 ? 'out' : 'in'); fl.textContent = (diff < 0 ? '\u2212' : '+') + money(Math.abs(diff)); pill.appendChild(fl);
        setTimeout(() => fl.remove(), 1500);
        if (diff < 0) { pill.classList.remove('shake'); void pill.offsetWidth; pill.classList.add('shake'); }
      }
      lastCash = m.cash;
    }
  }
  function jumpToSet(s) {
    if (!ui.drawer) { ui.tab = 'deeds'; setDrawer(true); } else if (ui.tab !== 'deeds') { ui.tab = 'deeds'; paintDrawer(true); }
    ui.stuffGrouped = false; paintDrawer(true);
    requestAnimationFrame(() => {
      const wh = $('dBody').querySelector('.wheel'), c = wh && [...wh.querySelectorAll('.deed')].find((el) => (S[+el.dataset.sp].group || S[+el.dataset.sp].type) === s);
      if (c) { wh.scrollTo({ left: c.offsetLeft - (wh.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' }); c.classList.remove('ping'); void c.offsetWidth; c.classList.add('ping'); }
    });
    sfx('click');
  }

  // ---- compact deed cards (tap for full details, tap outside to close), Cover Flow wheel, pinch = stacked sets
  function deedMini(i) {
    const pr = g.props[i], sp = S[i], rent = pr.hocked ? 'mortgaged' : money(g.rentFor(i, 7, false));
    return '<div class="deed mini' + (pr.hocked ? ' hocked' : '') + '" data-sp="' + i + '"><div class="hd" style="background:' + groupColor(i) + '">' + esc(sp.name) + '</div><div class="bd">' +
      '<div class="r cur"><span>Rent now</span><b>' + rent + '</b></div>' + (sp.type === 'prop' ? '<div class="r"><span>Built</span><b>' + (pr.shops === 5 ? 'Mega-Plex' : pr.shops ? pr.shops + ' Shop' + (pr.shops > 1 ? 's' : '') : 'none') + '</b></div>' : '') +
      (pr.dmg ? '<div class="r"><span>Repairs</span><b>' + pr.dmg.left + ' turns</b></div>' : '') + '<div class="tapmore">tap for details</div></div></div>';
  }
  function stuffHtml(ds) {
    if (!ui.stuffGrouped) return '<div class="wheel cf">' + ds.map(deedMini).join('') + '</div>';
    return '<div class="wheel cf grouped">' + setOrder(ds).map((s) => { const L = ds.filter((i) => (S[i].group || S[i].type) === s);
      return '<div class="pile" data-set="' + s + '" style="--n:' + L.length + '">' + L.map((i, k) => '<div class="pc" style="--k:' + k + '">' + deedMini(i) + '</div>').join('') + '</div>'; }).join('') + '</div>';
  }
  function coverFlow() {
    const wh = $('dBody') && $('dBody').querySelector('.wheel.cf'); if (!wh) return;
    const mid = wh.scrollLeft + wh.clientWidth / 2, items = [...wh.children], grp = wh.classList.contains('grouped');
    items.forEach((el) => {
      const c = el.offsetLeft + el.offsetWidth / 2, d = (c - mid) / Math.max(1, el.offsetWidth), ad = Math.min(2.2, Math.abs(d));
      const rot = Math.max(-1, Math.min(1, d)) * -(grp ? 52 : 26), sc = 1 - (grp ? 0.16 : 0.09) * ad, z = -ad * (grp ? 90 : 50);
      el.style.transform = 'perspective(900px) translateZ(' + z.toFixed(1) + 'px) rotateY(' + rot.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
      el.style.zIndex = String(100 - Math.round(ad * 10)); el.style.opacity = String(1 - Math.max(0, ad - 1.4) * 0.6);
    });
  }
  function openDeedFull(sp) {
    let el = $('deedFull');
    if (!el) {
      el = document.createElement('div'); el.id = 'deedFull'; el.hidden = true; el.innerHTML = '<div class="df-in"></div>'; document.body.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target === el) { closeDeedFull(); return; } const b = e.target.closest('[data-a]'); if (b) { deedAction(b); if (b.dataset.a !== 'find' && ui.deedFull != null && g.props[ui.deedFull] && g.props[ui.deedFull].owner === g.oid(me())) el.querySelector('.df-in').innerHTML = deedCard(ui.deedFull); else closeDeedFull(); } });
    }
    ui.deedFull = sp; el.querySelector('.df-in').innerHTML = deedCard(sp); el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); sfx('pop');
  }
  function closeDeedFull() { const el = $('deedFull'); if (el) el.hidden = true; ui.deedFull = null; }
  (function () {   // pinch in on the wheel = stack the sets; pinch out = back to the big slide
    const body = $('dBody'), P = new Map(); let d0 = 0, done = false;
    body.addEventListener('pointerdown', (e) => { if (!e.target.closest('.wheel')) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (P.size === 2) { const a = [...P.values()]; d0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); done = false; } });
    body.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (P.size !== 2 || done || !d0) return; const a = [...P.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      void d; done = true;    // v0.8: pinch-to-stack removed; the wheel is a plain Cover Flow scroll
    });
    const up = (e) => { P.delete(e.pointerId); if (P.size < 2) d0 = 0; };
    body.addEventListener('pointerup', up); body.addEventListener('pointercancel', up);
    body.addEventListener('scroll', coverFlow, true);
  })();
  function setStuffGrouped(on) { ui.stuffGrouped = false; void on; sfx(on ? 'pop' : 'click'); vib(10); paintDrawer(true); }

  // ---- dice pass: arm toss, the dice arc across the map to the next runner (shrinking, gone), who catches them as they fade in
  const diceArcs = [], catches = [];
  function nextAfter(pid) { const ord = g.order.filter((id) => { const q = g.byId(id); return q && !q.bankrupt; }), i = ord.indexOf(pid); return ord.length ? g.byId(ord[(i + 1) % ord.length]) : null; }
  function dicePass(pid) {
    const p = g.byId(pid), nx = nextAfter(pid); if (!p || !nx) return;
    const v = visOf(p), vn = visOf(nx), now = performance.now();
    v.toss = now;
    const dur = 1150;
    if (pid === meId && !$('dice').hidden) {
      // the big dice leave your tray and fly across the map (in screen space) to where the next runner stands right now
      const s = toScreen(vn.x, vn.y - 60), d = $('dice');
      [...d.querySelectorAll('.die')].forEach((die, k) => {
        const r = die.getBoundingClientRect(), gh = die.cloneNode(true);
        gh.className = 'die ghostDie'; Object.assign(gh.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0, zIndex: 13, pointerEvents: 'none' });
        document.body.appendChild(gh);
        const tx = s.x - r.left - r.width / 2 + (k ? 10 : -10), ty = s.y - r.top - r.height / 2, peak = Math.min(ty, 0) - H * 0.22;
        gh.animate([{ transform: 'none', opacity: 1 },
          { transform: 'translate(' + tx * 0.5 + 'px,' + peak + 'px) rotate(' + (k ? 300 : -280) + 'deg) scale(.62)', opacity: 1, offset: 0.5 },
          { transform: 'translate(' + tx + 'px,' + ty + 'px) rotate(' + (k ? 600 : -560) + 'deg) scale(.16)', opacity: 0 }],
          { duration: dur, easing: 'cubic-bezier(.35,.55,.45,1)', fill: 'forwards' }).onfinish = () => gh.remove();
      });
    } else diceArcs.push({ x0: v.x + (v.face || 1) * 20, y0: v.y - 60, to: nx.id, start: now, dur: dur });
    setTimeout(() => catches.push({ pid: nx.id, start: performance.now(), dur: 900 }), dur * 0.85);
    sfx('whistle');
  }
  function drawDiceArcs(c) {
    const now = performance.now();
    const die = (x, y, sz, rot, a) => { c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate(rot); c.fillStyle = '#fff'; rr(-sz / 2, -sz / 2, sz, sz, sz * 0.22); c.fill(); c.strokeStyle = '#cfc8de'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#1d1a26'; c.beginPath(); c.arc(0, 0, sz * 0.12, 0, 7); c.fill(); c.restore(); };
    for (let i = diceArcs.length - 1; i >= 0; i--) {
      const A = diceArcs[i], f = (now - A.start) / A.dur; if (f >= 1) { diceArcs.splice(i, 1); continue; }
      const q = g.byId(A.to); if (!q) continue; const vn = visOf(q), x1 = vn.x, y1 = vn.y - 60;
      const x = A.x0 + (x1 - A.x0) * f, y = A.y0 + (y1 - A.y0) * f - Math.sin(f * Math.PI) * Math.max(120, Math.hypot(x1 - A.x0, y1 - A.y0) * 0.35), sz = 26 * (1 - 0.7 * f);
      die(x - 8, y, sz, f * 14, 1 - f * f); die(x + 10, y + 6, sz, -f * 12, 1 - f * f);
    }
    for (let i = catches.length - 1; i >= 0; i--) {
      const C2 = catches[i], f = (now - C2.start) / C2.dur; if (f >= 1) { catches.splice(i, 1); continue; }
      const q = g.byId(C2.pid); if (!q) continue; const vn = visOf(q), a = f < 0.5 ? f / 0.5 : 1 - (f - 0.5) / 0.5, hand = (vn.face || 1) * 26;
      die(vn.x + hand - 7, vn.y - 72 + (1 - a) * 10, 12, f * 3, a); die(vn.x + hand + 7, vn.y - 68 + (1 - a) * 10, 12, -f * 3, a);
    }
  }
  const catching = (p, nowP) => catches.some((C2) => C2.pid === p.id && nowP - C2.start < C2.dur);

  // ---- card actions frame the board: with the drawer up (2/3 of the screen) the top third stays the live board,
  // and Build / Sell / Mortgage / Unmortgage / Repair / picking a deal item glides the camera onto that property's set
  function frameSet(sp, flash) {
    const gr = S[sp].group, mem = gr && B.GROUP_MEMBERS[gr] ? B.GROUP_MEMBERS[gr] : [sp];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; mem.forEach((i) => { const r = RECTS[i]; x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); });
    const top = 50 * UIZ, visH = (ui.drawer ? drawerTop() : H - 250 * UIZ) - top, pad = 30;
    const s2 = Math.max(fitWhole() * 0.9, Math.min(3, W / (x1 - x0 + pad * 2), visH / (y1 - y0 + pad * 2)));
    const cy = top + visH / 2;
    cam.goto = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + (H / 2 - cy) / s2, s: s2 };
    cam.whole = false; cam.manual = true; cam.manualAt = performance.now(); cam.keepS = s2; cam.framed = !!ui.drawer; syncZoomBtn();
    if (flash !== false) ui.flash = { sp: sp, set: mem, until: performance.now() + 1800 };
  }
  function deedAction(b) {
    if (!g) return;
    const a = b.dataset.a, card = b.closest('.deed'), sp = card ? +card.dataset.sp : -1, pr = sp >= 0 ? g.props[sp] : null; let r = '';
    sfx('click');
    if (a === 'build') r = g.intent(meId, { t: 'build', sp: sp });
    else if (a === 'sell') r = g.intent(meId, { t: 'sell', sp: sp });
    else if (a === 'hock') r = g.intent(meId, { t: pr.hocked ? 'unhock' : 'hock', sp: sp });
    else if (a === 'rush') r = g.intent(meId, { t: 'rush', sp: sp });
    else if (a === 'find') { closeDeedFull(); setDrawer(false); frameSet(sp); ui.info = { sp: sp }; return; }
    else if (a === 'selfie') { setDrawer(false); openSelfie(); return; }
    else if (a === 'selfieOff') { clearSelfie(); return; }
    else if (a === 'usePass') { r = g.intent(meId, { t: 'usePass' }); if (!r) setDrawer(false); }
    else { tradeClick(a, b); if ((a === 'give' || a === 'get') && b.dataset.sp != null) frameSet(+b.dataset.sp); return; }
    if (sp >= 0 && /^(build|sell|hock|rush)$/.test(a)) frameSet(sp);
    if (r) toast(r);
    paintDrawer(true);
  }


  // ---- v0.7 dice on the board: thrown from the hand (or dropped from your bubble), they land and roll near the runner,
  // then sit showing the roll until the dice are passed (poof). Other players' dice exist ONLY as these board dice.
  const boardDice = [];
  const PIPW = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  function startBoardDice(d) {
    const p = g.byId(d.pid); if (!p) return;
    for (let i = boardDice.length - 1; i >= 0; i--) if (boardDice[i].pid === p.id) boardDice.splice(i, 1);
    const v = visOf(p), face = v.face || 1, nowP = performance.now();
    let from;
    if (p.id === meId && ui.rollFrom && nowP - ui.rollFrom.at < 1500) from = toWorld(ui.rollFrom.x, ui.rollFrom.y);
    else { from = { x: v.x + face * 22, y: v.y - 62 }; v.toss = nowP; }
    const toward = { x: BW / 2 - v.x, y: BW / 2 - v.y }, tl = Math.max(1, Math.hypot(toward.x, toward.y));
    const land = { x: v.x + toward.x / tl * 70 + face * 18, y: v.y + toward.y / tl * 70 + 8 };
    const dur = Math.max(700, g.turn && g.turn.rollEnd ? (g.turn.rollEnd - g.now) : 900);
    boardDice.push({ pid: p.id, faces: d.d.slice(), dbl: d.dbl, from: from, land: land, start: nowP, dur: dur, big: p.id === meId && !!(ui.rollFrom && nowP - ui.rollFrom.at < 1500), spin: [Math.random() * 6, Math.random() * 6] });
    ui.rollFrom = null;
  }
  function poofBoardDice(pid) { boardDice.forEach((b) => { if (b.pid === pid && !b.poof) b.poof = performance.now(); }); }
  function drawBoardDice(c) {
    const nowP = performance.now();
    for (let i = boardDice.length - 1; i >= 0; i--) {
      const b = boardDice[i], t = nowP - b.start;
      if (b.poof && nowP - b.poof > 450) { boardDice.splice(i, 1); continue; }
      const fl = Math.min(1, t / (b.dur * 0.45)), roll = Math.max(0, Math.min(1, (t - b.dur * 0.45) / (b.dur * 0.55)));
      const pa = b.poof ? Math.max(0, 1 - (nowP - b.poof) / 450) : 1;
      [0, 1].forEach((k) => {
        const off = k ? 16 : -16, lx = b.land.x + off + (k ? 6 : -4) * (1 - roll), ly = b.land.y + (k ? 6 : -4);
        let x, y, sz, rot;
        if (fl < 1) { const e = fl; x = b.from.x + (lx - b.from.x) * e; y = b.from.y + (ly - b.from.y) * e - Math.sin(e * Math.PI) * 50; sz = (b.big ? 46 : 22) + (24 - (b.big ? 46 : 22)) * e; rot = b.spin[k] + e * 9; }
        else { const bounce = Math.abs(Math.sin(roll * Math.PI * 3)) * (1 - roll) * 14; x = lx + (1 - roll) * (k ? 10 : -10); y = ly - bounce; sz = 24; rot = b.spin[k] + 9 + roll * 5 * (1 - roll * 0.6); }
        const fv = roll >= 1 ? b.faces[k] : 1 + Math.floor((nowP / 70 + k * 3) % 6);
        c.save(); c.globalAlpha = pa; c.translate(x, y); c.rotate(roll >= 1 ? (k ? 0.12 : -0.08) : rot); if (b.poof) c.scale(1 + (1 - pa) * 0.6, 1 + (1 - pa) * 0.6);
        c.fillStyle = 'rgba(0,0,0,.25)'; rr(-sz / 2 + 2, -sz / 2 + 4, sz, sz, sz * 0.2); c.fill();
        c.fillStyle = '#fff'; rr(-sz / 2, -sz / 2, sz, sz, sz * 0.2); c.fill(); c.strokeStyle = b.dbl && roll >= 1 ? '#ffd23f' : '#cfc8de'; c.lineWidth = b.dbl && roll >= 1 ? 2.5 : 1.5; c.stroke();
        c.fillStyle = '#1d1a26'; (PIPW[fv] || []).forEach((q) => { c.beginPath(); c.arc(q[0] * sz * 0.26, q[1] * sz * 0.26, sz * 0.085, 0, 7); c.fill(); });
        c.restore();
      });
    }
  }


  // ---- v0.9 centre close-up: almost the full inner square, feathered at the edges so it
  // stays off the outer spaces. A border in the followed player's colour grows a little point
  // that slides around the frame to aim at where they actually are on the board.
  function sqGeom() {
    if (!g || prefs.camView === 'zoom' || ui.drawer) return null;
    const tl = toScreen(CORNER, CORNER), br = toScreen(BW - CORNER, BW - CORNER);
    const size = Math.min(br.x - tl.x, br.y - tl.y);
    if (size < 120 || tl.x < -24 || tl.x + size > W + 24 || tl.y < -24 || tl.y + size > H + 24) return null;
    const inset = Math.max(6, size * 0.028);
    return { x: tl.x, y: tl.y, size: size, pip: { x: tl.x + inset, y: tl.y + inset, w: size - inset * 2, h: size - inset * 2 } };
  }
  function hitRoundRect(cx, cy, ang, x, y, w, h, r) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    r = Math.max(0, Math.min(r, w / 2 - 0.5, h / 2 - 0.5));
    let best = null, bestT = Infinity;
    const consider = (tt, px, py, nx, ny) => { if (tt > 1e-4 && tt < bestT) { bestT = tt; best = { x: px, y: py, nx: nx, ny: ny }; } };
    if (Math.abs(dy) > 1e-8) {
      let tt = (y - cy) / dy, px = cx + tt * dx; if (px >= x + r && px <= x + w - r) consider(tt, px, y, 0, -1);
      tt = (y + h - cy) / dy; px = cx + tt * dx; if (px >= x + r && px <= x + w - r) consider(tt, px, y + h, 0, 1);
    }
    if (Math.abs(dx) > 1e-8) {
      let tt = (x - cx) / dx, py = cy + tt * dy; if (py >= y + r && py <= y + h - r) consider(tt, x, py, -1, 0);
      tt = (x + w - cx) / dx; py = cy + tt * dy; if (py >= y + r && py <= y + h - r) consider(tt, x + w, py, 1, 0);
    }
    [[x + r, y + r], [x + w - r, y + r], [x + w - r, y + h - r], [x + r, y + h - r]].forEach((q, i) => {
      const ox = cx - q[0], oy = cy - q[1], a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), c2 = ox * ox + oy * oy - r * r, disc = b * b - 4 * a * c2;
      if (disc < 0) return;
      const rt = Math.sqrt(disc);
      [(-b - rt) / (2 * a), (-b + rt) / (2 * a)].forEach((tt) => {
        const px = cx + tt * dx, py = cy + tt * dy, nx = (px - q[0]) / r, ny = (py - q[1]) / r;
        // only the outward quarter of each corner circle
        const ok = (i === 0 && nx <= 0.05 && ny <= 0.05) || (i === 1 && nx >= -0.05 && ny <= 0.05) || (i === 2 && nx >= -0.05 && ny >= -0.05) || (i === 3 && nx <= 0.05 && ny >= -0.05);
        if (ok) consider(tt, px, py, nx, ny);
      });
    });
    return best || { x: cx + dx * (Math.min(w, h) / 2), y: cy + dy * (Math.min(w, h) / 2), nx: dx, ny: dy };
  }
  const pip = { pid: null, a: 0, x: 0, y: 0, last: 0, seen: false, ang: 0, hasAng: false };
  let pipCV = null, pipCX = null;
  function pipFocus() {
    if (!g || g.phase !== 'play') return null;
    const walker = g.players.find((p) => !p.bankrupt && busy(visOf(p)));
    if (walker) return walker;
    const cur = g.cur();
    return cur && !cur.bankrupt ? cur : null;
  }
  function drawSpike(c, hx, hy, nx, ny, len, width) {
    const tx = -ny, ty = nx, tipX = hx + nx * len, tipY = hy + ny * len;
    const b1x = hx - tx * width, b1y = hy - ty * width, b2x = hx + tx * width, b2y = hy + ty * width;
    c.beginPath();
    c.moveTo(b1x, b1y);
    c.bezierCurveTo(b1x + tx * width * 0.15 + nx * len * 0.22, b1y + ty * width * 0.15 + ny * len * 0.22,
      tipX - nx * len * 0.38 - tx * 3, tipY - ny * len * 0.38 - ty * 3, tipX, tipY);
    c.bezierCurveTo(tipX - nx * len * 0.38 + tx * 3, tipY - ny * len * 0.38 + ty * 3,
      b2x - tx * width * 0.15 + nx * len * 0.22, b2y - ty * width * 0.15 + ny * len * 0.22, b2x, b2y);
    c.quadraticCurveTo(hx - nx * 5, hy - ny * 5, b1x, b1y);
    c.closePath();
  }
  function drawPip(c, dtS) {
    const nowP = performance.now(), G = sqGeom();
    const focus = pipFocus();
    if (focus && G) {
      const v = visOf(focus);
      if (pip.pid !== focus.id || pip.a < 0.05) { pip.x = v.x; pip.y = v.y - 30; pip.hasAng = false; }
      pip.pid = focus.id; pip.last = nowP;
    }
    const replayOn = RP.a > 0.12 && RP.cur;
    const cardUp = TC.on && TC.phase !== 'tuck';
    const want = !replayOn && !cardUp && G && pip.pid != null && nowP - pip.last < 800 ? 1 : 0;
    pip.a += (want - pip.a) * (1 - Math.exp(-dtS * (want ? 7 : 4)));
    if (pip.a < 0.02 || !G || pip.pid == null) { if (!want && pip.a < 0.02) pip.pid = null; return; }
    const p = g.byId(pip.pid); if (!p) return;
    const v = visOf(p), k = 1 - Math.exp(-dtS * 9);
    pip.x += (v.x - pip.x) * k; pip.y += (v.y - 30 - pip.y) * k; pip.seen = true;
    const R = G.pip, cx = R.x + R.w / 2, cy = R.y + R.h / 2, rad = Math.min(28, Math.min(R.w, R.h) * 0.08);
    const rs = toScreen(v.x, v.y - (v.lift || 0) - 34);
    const tang = Math.atan2(rs.y - cy, rs.x - cx);
    if (!pip.hasAng) { pip.ang = tang; pip.hasAng = true; }
    else { let d = tang - pip.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; pip.ang += d * (1 - Math.exp(-dtS * 8)); }
    const hit = hitRoundRect(cx, cy, pip.ang, R.x, R.y, R.w, R.h, rad);
    const spikeLen = Math.max(14, Math.min(28, Math.min(R.w, R.h) * 0.075)), spikeW = spikeLen * 0.75;
    c.save(); c.globalAlpha = pip.a;
    const pw = Math.max(2, Math.ceil(R.w)), ph = Math.max(2, Math.ceil(R.h));
    if (!pipCV) { pipCV = document.createElement('canvas'); pipCX = pipCV.getContext('2d'); }
    if (pipCV.width !== pw || pipCV.height !== ph) { pipCV.width = pw; pipCV.height = ph; }
    const pc = pipCX, prevRR = rrC; rrC = pc;
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, pw, ph);
    pc.save(); pc.translate(R.w / 2 - W / 2, R.h / 2 - H / 2);
    drawScene(pc, { x: pip.x, y: pip.y, s: Math.max(0.35, Math.min(R.w, R.h) / (CELL * 2.0)) }, W, H, { noBubbles: true });
    pc.restore();
    pc.globalCompositeOperation = 'destination-in';
    const feather = Math.max(16, Math.min(R.w, R.h) * 0.12);
    pc.shadowColor = '#000'; pc.shadowBlur = feather; pc.fillStyle = '#000';
    pc.beginPath();
    if (pc.roundRect) pc.roundRect(feather * 0.35, feather * 0.35, pw - feather * 0.7, ph - feather * 0.7, Math.max(2, rad));
    else pc.rect(feather * 0.35, feather * 0.35, pw - feather * 0.7, ph - feather * 0.7);
    pc.fill();
    pc.shadowBlur = 0; pc.globalCompositeOperation = 'source-over';
    rrC = prevRR;
    c.drawImage(pipCV, R.x, R.y, R.w, R.h);
    // colour border + organic point aimed at the runner on the board
    const th = 0.5 + 0.5 * Math.sin(nowP / 300);
    c.strokeStyle = p.color; c.lineWidth = 4 + 1.2 * th; c.shadowColor = hexA(p.color, 0.9); c.shadowBlur = 12 + 6 * th;
    rr(R.x, R.y, R.w, R.h, rad); c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.25 * th).toFixed(2) + ')'; c.lineWidth = 1.2;
    rr(R.x + 3.5, R.y + 3.5, R.w - 7, R.h - 7, Math.max(2, rad - 3)); c.stroke();
    c.fillStyle = p.color; c.shadowColor = hexA(p.color, 0.95); c.shadowBlur = 10;
    drawSpike(c, hit.x, hit.y, hit.nx, hit.ny, spikeLen, spikeW); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4; drawSpike(c, hit.x, hit.y, hit.nx, hit.ny, spikeLen, spikeW); c.stroke();
    c.restore();
  }


  // ---- v0.8 auction clock: starts draining at the old speed, eases in to ~2.5x through the bottom third; ~4.7 s total instead of 8 s.
  // Every bid restarts the curve from slow. (Solo-only: wraps this game's startAuction/bid; the shared engine is untouched.)
  const AUC_K = 3.4, AUC_SQ = Math.sqrt(AUC_K), AUC_AT = Math.atan(AUC_SQ), AUC_T = C.auction.ms * AUC_AT / AUC_SQ;   // drain rate = 1 + K x^2 (x = drained part)
  function aucCurve(gm) { const a = gm.turn && gm.turn.auction; if (!a) return; a.t0 = gm.now; a.T = gm.ms(AUC_T); a.endsAt = a.t0 + a.T; }
  function aucPatch(gm) {
    const sa = gm.startAuction, bd = gm.bid;
    gm.startAuction = function (sp) { const r = sa.apply(this, arguments); aucCurve(this); return r; };
    gm.bid = function () { const r = bd.apply(this, arguments); if (!r) aucCurve(this); return r; };
  }
  function aucLeft(a) {
    if (a.t0 == null) return Math.max(0, Math.min(1, (a.endsAt - g.now) / (C.auction.ms / g.speed)));
    const tau = Math.max(0, Math.min(1, (g.now - a.t0) / a.T)), x = Math.tan(tau * AUC_AT) / AUC_SQ;
    return Math.max(0, 1 - x);
  }
  function aucTick(a, f, bar) {      // a soft tick every 1/12 of the bar: they come faster as the clock speeds up
    const key = a.seq + ':' + a.t0, n = Math.floor((1 - f) * 12);
    if (ui.aucKey !== key) { ui.aucKey = key; ui.aucN = n; return; }
    if (n > ui.aucN && f > 0.01) { ui.aucN = n; sfx('click'); vib(n > 8 ? 12 : 6); bar.animate([{ filter: 'brightness(1.9)', transform: 'scaleY(1.6)' }, { filter: 'none', transform: 'none' }], { duration: 160 }); }
  }

  // ------------------------------------------------------------------ main loop
  let lastT = performance.now();

  // ------------------------------------------------------------------ v0.6 TRADE TABLE (Justin's design)
  // Full-screen table. Portrait: their character upper-left, yours lower-right, each with a row of stuff beside them; swipe an item
  // in toward the centre line to put it on the pile on its owner's side, swipe it back out to take it off. Landscape: the two stand
  // left and right facing each other, piles in front of them, the stuff they keep behind them. Propose / Accept / Reject / Amend.
  // The game clock is paused while the table is open; the AI answers in real time (value + set completion + personality).
  const TT_PERS = { grace: -30, doug: -20, cody: -15, dez: -10, drew: -5, justin: 0, walt: 0, lenore: 10, mike: 15, minh: 25, priya: 50 };
  const TT_LINES = {
    counter: ['Close. Make it this and we shake.', 'Counter-offer. Your move.', 'I can do this instead.', 'Tweak it like so and it\'s yours.', 'Meet me here.'],
    counterC: { walt: ['Fair is fair. Here\'s fair.'], priya: ['I ran the numbers. This works.'], grace: ['Oh honey, how about this instead?'], dez: ['Remix: this version slaps.'], minh: ['Adjusted for risk.'], doug: ['Buddy. Buddy. This one.'] },
    far: ['Not even close.', 'Ha! No.', 'You\'re dreaming, friend.', 'That\'s a robbery with extra steps.'],
    jilted: ['Your loss.', 'Fine. Keep it.', 'Ouch. Okay then.', 'I\'ll remember that.']
  };
  const ttPick = (a) => a[(Math.random() * a.length) | 0];
  let tt = null, ttRaf = 0, ttIdea = {};
  const ttCopy = (s) => ({ cash: (s && s.cash) || 0, props: ((s && s.props) || []).map(Number), passes: (s && s.passes) || 0 });
  const ttEmpty = (s) => !s.cash && !s.props.length && !s.passes;
  const ttFree = (p) => Math.max(0, p.cash - g.lockedCash(p));
  const ttOther = () => g && tt && g.byId(tt.pid);
  const ttOwned = (p) => g.props.map((pr, i) => (pr && pr.owner === g.oid(p) ? i : -1)).filter((i) => i >= 0);
  const ttBlock = (sp) => (S[sp].group && g.groupHasShops(S[sp].group) ? 'has Shops' : g.locked(sp) ? 'locked' : '');
  const ttEditable = () => tt && (tt.mode === 'propose' || tt.mode === 'amend');
  const ttLand = () => innerWidth > innerHeight;

  function ttDom() {
    let el = $('tt'); if (el) return el;
    el = document.createElement('div'); el.id = 'tt'; el.hidden = true;
    const pile = (s) => '<div class="tt-pile ' + s + '" id="ttPile' + s + '" data-side="' + s + '"><div class="tt-lab"></div><div class="tt-cards"></div>' +
      '<div class="tt-cash" data-side="' + s + '"><div class="tt-stack" data-side="' + s + '"></div><div class="tt-cv"><b>$0</b><input type="range" min="0" max="0" step="10" value="0" data-side="' + s + '" aria-label="cash"></div></div></div>';
    const av = (s) => '<div class="tt-av ' + s + '" id="ttAv' + s + '"><canvas width="200" height="270"></canvas><div class="tt-who"></div><div class="tt-q"></div></div>';
    el.innerHTML = '<div class="tt-in"><div class="tt-top"><b class="tt-title">TRADE TABLE</b><span class="tt-stat" id="ttStat"></span><button class="tt-x" id="ttX" aria-label="Close">\u2715</button></div>' +
      '<div class="tt-board" id="ttBoard">' + av('them') + '<div class="tt-row them" id="ttRowthem" data-side="them"></div>' + pile('them') +
      '<div class="tt-line"><span>\u21C4</span></div>' + pile('me') + '<div class="tt-row me" id="ttRowme" data-side="me"></div>' + av('me') + '</div>' +
      '<div class="tt-msg" id="ttMsg"></div><div class="tt-btns" id="ttBtns"></div></div>';
    document.body.appendChild(el);
    $('ttX').onclick = () => ttClose(true);
    $('ttBtns').onclick = (e) => { const b = e.target.closest('button[data-t]'); if (b && !b.disabled) ttAct(b.dataset.t); };
    el.addEventListener('input', (e) => { const r = e.target; if (!r.matches('input[type=range]') || !ttEditable()) return; tt.d[r.dataset.side].cash = +r.value; tt.msg = ''; ttCashPaint(); ttButtons(); });
    el.addEventListener('change', (e) => { if (e.target.matches('input[type=range]') && ttEditable()) { ttGesture(e.target.dataset.side); sfx('click'); } });
    ttWireDrag(el);
    return el;
  }

  // ---- open / close
  function ttOpenWith(pid, getSp) {
    if (!g || pid === meId) return;
    const o = g.byId(pid); if (!o || o.bankrupt) return;
    const open = g.trades.filter((x) => x.status === 'open' && x.waiting === meId && (x.a === pid || x.b === pid))[0];
    if (open) return ttOpenTrade(open);
    tt = { pid: pid, mode: 'propose', id: 0, d: { me: ttCopy(), them: ttCopy() }, prev: null, msg: '', sw: {}, fx: {}, q: {} };
    if (getSp != null && g.props[getSp] && g.props[getSp].owner === g.oid(o) && !ttBlock(getSp)) tt.d.them.props.push(+getSp);
    ttShow();
  }
  function ttOpenTrade(tr) {
    const pid = tr.a === meId ? tr.b : tr.a;
    tt = { pid: pid, mode: 'review', id: tr.id, d: null, prev: null, msg: '', sw: {}, fx: {}, q: {} };
    ttLoad(tr, false);
    const last = g.chats.slice().reverse().find((c) => c.from === pid && c.to === meId && g.now - c.ts < 30000);
    if (last) ttQuip('them', last.text);
    ttShow();
  }
  function ttLoad(tr, counter) {
    const mineA = tr.a === meId;
    tt.prev = tt.d ? { me: ttCopy(tt.d.me), them: ttCopy(tt.d.them) } : null;
    tt.d = { me: ttCopy(mineA ? tr.aGives : tr.bGives), them: ttCopy(mineA ? tr.bGives : tr.aGives) };
    tt.id = tr.id; tt.mode = tr.waiting === meId ? 'review' : 'wait';
    tt.msg = tr.waiting === meId ? (counter ? nm(tt.pid) + ' countered. Glowing items changed.' : nm(tt.pid) + ' offers you this deal.') : '';
  }
  function ttShow() {
    const el = ttDom(); setDrawer(false); closeBubble();
    el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('on');
    document.body.classList.add('tt-open');
    el.querySelectorAll('.tt-stack').forEach((x) => x.getAnimations().forEach((an) => an.cancel()));
    freeze(true); sfx('pop');
    ttRender(true);
    if (!ttRaf) ttRaf = requestAnimationFrame(ttLoop);
  }
  function ttClose(byUser) {
    if (!tt) return;
    const t0 = tt; tt = null;
    if (byUser && t0.mode === 'wait' && t0.id) { const tr = g && g.tradeById(t0.id); if (tr && tr.status === 'open' && tr.by === meId) g.declineTrade(meId, t0.id); }
    const el = $('tt'); el.classList.remove('on'); el.classList.add('out'); document.body.classList.remove('tt-open');
    setTimeout(() => { if (!tt) { el.hidden = true; el.classList.remove('out'); } }, 260);
    if (g && !ui.panel && document.visibilityState !== 'hidden') freeze(false);
    ui.popKey = ''; 
  }

  // ---- render
  function ttDeed(sp, owner, inPile, side) {
    const s = S[sp], pr = g.props[sp], blk = ttBlock(sp);
    const recv = side === 'me' ? ttOther() : me();
    let note = '';
    if (s.group && B.GROUP_MEMBERS[s.group]) {
      const mem = B.GROUP_MEMBERS[s.group], have = mem.filter((i) => g.props[i].owner === g.oid(owner)).length;
      note = '<span class="pips">' + mem.map((i) => '<u class="' + (g.props[i].owner === g.oid(owner) ? 'on' : g.props[i].owner >= 0 ? 'oth' : '') + '"></u>').join('') + '</span>';
      if (inPile && recv) { const pileSame = tt.d[side].props.filter((i) => S[i].group === s.group).length, rh = mem.filter((i) => g.props[i].owner === g.oid(recv)).length; if (rh + pileSame === mem.length && s.type === 'prop') note += '<em class="set">\u2605 SET</em>'; }
      void have;
    }
    const changed = inPile && tt.prev && tt.prev[side].props.indexOf(sp) < 0 ? ' new' : '';
    return '<div class="tt-c deed' + (pr.hocked ? ' hocked' : '') + (blk && !inPile ? ' off' : '') + changed + '" data-k="d' + sp + '" data-sp="' + sp + '" data-side="' + side + '">' +
      '<i style="background:' + groupColor(sp) + '"></i><b' + (Math.max(...s.name.split(/\s+/).map((x) => x.length)) >= 9 ? ' class="lw"' : '') + '>' + esc(s.name) + '</b><small>' + money(s.price) + (pr.hocked ? ' \u00b7 M' : '') + '</small>' + note + (blk && !inPile ? '<em class="lk">' + blk + '</em>' : '') + '</div>';
  }
  const ttPass = (side, k, inPile) => '<div class="tt-c pass' + (inPile && tt.prev && k >= tt.prev[side].passes ? ' new' : '') + '" data-k="p' + side + k + '" data-pass="1" data-side="' + side + '"><i></i><b>Tow Truck Pass</b><small>free tow</small></div>';
  function ttRender(first) {
    if (!tt || !g) return;
    const o = ttOther(), m = me(); if (!o || !m) return ttClose(false);
    const el = $('tt'), land = ttLand();
    el.classList.toggle('land', land); el.classList.toggle('por', !land);
    el.classList.toggle('edit', ttEditable()); el.dataset.mode = tt.mode;
    // FLIP: remember where every item was
    const before = {}; if (!first) el.querySelectorAll('.tt-c[data-k]').forEach((c) => { before[c.dataset.k] = c.getBoundingClientRect(); });
    [['them', o], ['me', m]].forEach(([side, p]) => {
      const d = tt.d[side], owned = ttOwned(p).filter((i) => d.props.indexOf(i) < 0), np = p.passes.length;
      let row = owned.map((i) => ttDeed(i, p, false, side)).join('');
      for (let k = d.passes; k < np; k++) row += ttPass(side, k, false);
      if (!row) row = '<div class="tt-none">' + (side === 'me' ? 'Nothing left to offer' : 'Nothing else') + '</div>';
      $('ttRow' + side).innerHTML = row;
      let pile = d.props.map((i) => ttDeed(i, p, true, side)).join('');
      for (let k = 0; k < d.passes; k++) pile += ttPass(side, k, true);
      const pe = $('ttPile' + side);
      pe.querySelector('.tt-cards').innerHTML = pile || '<div class="tt-hint">' + (ttEditable() ? (side === 'me' ? (land ? '\u2190 swipe your stuff in here' : '\u2191 swipe your stuff up here') : (land ? 'swipe theirs in here \u2192' : '\u2193 swipe theirs down here to ask for it')) : 'nothing') + '</div>';
      pe.querySelector('.tt-lab').textContent = side === 'me' ? 'YOU GIVE' : (p.name.toUpperCase() + ' GIVES');
      const av = $('ttAv' + side);
      av.querySelector('.tt-who').innerHTML = '<b style="border-color:' + p.color + '">' + esc(side === 'me' ? p.name + ' (you)' : p.name + moodTag(p)) + '</b><span>' + money(p.cash) + '</span>';
    });
    ttCashPaint();
    $('ttStat').textContent = { propose: 'Your offer to ' + o.name, review: o.name + '\u2019s offer', amend: 'Amending: your counter', wait: o.name + ' is thinking\u2026', done: 'Deal!' }[tt.mode] || '';
    ttButtons();
    // FLIP: slide everything from where it was
    if (!first) el.querySelectorAll('.tt-c[data-k]').forEach((c) => {
      const a = before[c.dataset.k]; if (!a) { c.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); return; }
      const b = c.getBoundingClientRect(), dx = (a.left - b.left) / UIZ, dy = (a.top - b.top) / UIZ;
      if (Math.abs(dx) + Math.abs(dy) > 1) c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.06)' }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.9,.25,1.15)' });
    });
  }
  function ttCashPaint() {
    if (!tt) return;
    const o = ttOther(), m = me();
    [['them', o], ['me', m]].forEach(([side, p]) => {
      const box = $('ttPile' + side).querySelector('.tt-cash'), r = box.querySelector('input'), v = tt.d[side].cash, mx = ttFree(p);
      r.max = String(Math.max(v, Math.floor(mx / 10) * 10)); if (document.activeElement !== r) r.value = String(v);
      r.disabled = !ttEditable() || mx <= 0;
      box.querySelector('b').textContent = money(v);
      box.classList.toggle('zero', !v); box.classList.toggle('new', !!(tt.prev && tt.prev[side].cash !== v));
      const n = Math.min(14, Math.ceil(v / 50)), st = box.querySelector('.tt-stack');
      if (+st.dataset.n !== n) { st.dataset.n = n; let h = ''; for (let i = 0; i < Math.max(n, 1); i++) h += '<u class="' + (i < n ? '' : 'ghost') + '" style="bottom:' + (i * 5) + 'px"></u>'; st.innerHTML = h; }
    });
  }
  function ttButtons() {
    const B2 = (t, label, cls, dis) => '<button class="btn ' + (cls || '') + '" data-t="' + t + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
    const o = ttOther(), d = tt.d, empty = ttEmpty(d.me) && ttEmpty(d.them);
    let h = '', msg = tt.msg;
    if (tt.mode === 'propose') {
      const gate = canDealWith(tt.pid);
      if (!msg) msg = gate || (empty ? 'Swipe items toward the line to build the deal. Slide the chips for cash.' : '');
      h = B2('clear', 'Clear', 'ghost', empty) + B2('propose', 'Propose \u25B8', 'go', !!gate || empty);
    } else if (tt.mode === 'review') h = B2('reject', 'Reject', 'no') + B2('amend', 'Amend') + B2('accept', 'Accept \u2714', 'go');
    else if (tt.mode === 'amend') h = B2('back', 'Back') + B2('counter', 'Counter-propose \u25B8', 'go', empty);
    else if (tt.mode === 'wait') { h = B2('withdraw', 'Withdraw', 'ghost'); if (!msg) msg = 'Offer on the table. ' + o.name + ' is weighing it up\u2026'; }
    $('ttBtns').innerHTML = h; $('ttMsg').textContent = msg || '';
  }

  // ---- actions
  function ttAct(t) {
    if (!tt || !g) return;
    const o = ttOther(), side = (s) => ({ cash: s.cash, props: s.props.slice(), passes: s.passes });
    if (t === 'clear') { tt.d = { me: ttCopy(), them: ttCopy() }; tt.prev = null; tt.msg = ''; sfx('click'); }
    else if (t === 'propose') {
      const r = g.proposeTrade(meId, tt.pid, side(tt.d.me), side(tt.d.them));
      if (r) { tt.msg = r; sfx('buzz'); }
      else { const tr = g.trades[g.trades.length - 1]; tt.id = tr.id; tt.mode = 'wait'; tt.prev = null; tt.msg = ''; sfx('deal'); ttGesture('me'); ttPush('me'); }
    } else if (t === 'accept') {
      const r = g.acceptTrade(meId, tt.id); if (r) { tt.msg = r; tt.mode = 'propose'; tt.id = 0; }
      return;   // tradeDone event animates it
    } else if (t === 'reject') {
      g.declineTrade(meId, tt.id); ttShake('me'); sfx('click');
      const tr = g.tradeById(tt.id);
      if (o && g.isBot(o) && tr) setTimeout(() => { if (tt && tt.pid === o.id) ttQuip('them', ttPick(TT_LINES.jilted)); }, 350);
      tt.mode = 'propose'; tt.id = 0; tt.prev = null; tt.d = { me: ttCopy(), them: ttCopy() }; tt.msg = 'Rejected. Build your own offer, or close the table.';
    } else if (t === 'amend') { tt.mode = 'amend'; tt.prev = null; tt.msg = 'Move things in or out, then counter-propose.'; sfx('click'); }
    else if (t === 'back') { const tr = g.tradeById(tt.id); if (tr) ttLoad(tr, false); tt.prev = null; }
    else if (t === 'counter') {
      const r = g.counterTrade(meId, tt.id, side(tt.d.me), side(tt.d.them));
      if (r) { tt.msg = r; sfx('buzz'); } else { tt.mode = 'wait'; tt.prev = null; tt.msg = ''; sfx('deal'); ttGesture('me'); ttPush('me'); }
    } else if (t === 'withdraw') {
      g.declineTrade(meId, tt.id); tt.mode = 'propose'; tt.id = 0; tt.msg = 'Offer withdrawn. Change it, or close.';
    }
    ttRender();
  }
  function ttToggle(side, k, toPile) {
    if (!ttEditable()) return;
    const d = tt.d[side], p = side === 'me' ? me() : ttOther();
    if (k.charAt(0) === 'd') {
      const sp = +k.slice(1), i = d.props.indexOf(sp);
      if (toPile && i < 0) { if (ttBlock(sp)) { tt.msg = S[sp].name + ': ' + (ttBlock(sp) === 'locked' ? 'locked by the turn in progress' : 'sell the Shops on that set first'); sfx('buzz'); return ttRender(); } d.props.push(sp); }
      else if (!toPile && i >= 0) d.props.splice(i, 1); else return;
    } else {
      if (toPile && d.passes < p.passes.length) d.passes++; else if (!toPile && d.passes > 0) d.passes--; else return;
    }
    tt.msg = ''; ttGesture(side); sfx(toPile ? 'click' : 'pop'); vib(12);
    ttRender();
  }
  // swipe: row items move toward the line, pile items move away from it. A tap toggles too.
  function ttWireDrag(el) {
    let st = null;
    const towardLine = (side, dx, dy) => (ttLand() ? (side === 'them' ? dx : -dx) : (side === 'them' ? dy : -dy));
    el.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.tt-c'); if (!c || !ttEditable() || !tt) return;
      st = { c: c, x: e.clientX, y: e.clientY, inPile: !!c.closest('.tt-pile'), side: c.dataset.side, k: c.dataset.k, drag: false, id: e.pointerId };
    });
    el.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.drag) {
        if (Math.hypot(dx, dy) < 9) return;
        const along = ttLand() ? Math.abs(dx) > Math.abs(dy) * 0.8 : Math.abs(dy) > Math.abs(dx) * 0.8;   // across the row = a swipe, along it = scrolling
        if (!along && (!st.inPile || !ttLand())) { st = null; return; }   // v0.8: sideways = scroll the row / the offer strip; up/down = move the card
        st.drag = true; st.c.classList.add('drag'); try { st.c.setPointerCapture(e.pointerId); } catch (er) {}
      }
      st.c.style.transform = 'translate(' + dx / UIZ + 'px,' + dy / UIZ + 'px) scale(1.1) rotate(' + Math.max(-8, Math.min(8, dx / 20)) + 'deg)';
      e.preventDefault();
    });
    const end = (e) => {
      if (!st || e.pointerId !== st.id) return;
      const s = st; st = null;
      const dx = e.clientX - s.x, dy = e.clientY - s.y, tw = towardLine(s.side, dx, dy) / UIZ;
      s.c.classList.remove('drag');
      if (!s.drag) { if (e.type === 'pointerup') ttToggle(s.side, s.k, !s.inPile); return; }
      const go = s.inPile ? tw < -32 : tw > 32;
      if (go) { ttToggle(s.side, s.k, !s.inPile); return; }
      const from = s.c.style.transform; s.c.style.transform = '';
      s.c.animate([{ transform: from }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    // chip stack: drag up (portrait) / toward the line (landscape) for more cash
    let cs = null;
    el.addEventListener('pointerdown', (e) => { const s = e.target.closest('.tt-stack'); if (!s || !ttEditable()) return; cs = { side: s.dataset.side, x: e.clientX, y: e.clientY, v0: tt.d[s.dataset.side].cash, id: e.pointerId }; try { s.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); });
    el.addEventListener('pointermove', (e) => {
      if (!cs || e.pointerId !== cs.id || !tt) return;
      const p = cs.side === 'me' ? me() : ttOther(), d = ((cs.y - e.clientY) + (e.clientX - cs.x) * (cs.side === 'me' ? -0.5 : 0.5)) / UIZ;
      const v = Math.max(0, Math.min(Math.floor(ttFree(p) / 10) * 10, Math.round((cs.v0 + d * 5) / 10) * 10));
      if (v !== tt.d[cs.side].cash) { tt.d[cs.side].cash = v; if (v % 50 === 0) sfx('click'); ttCashPaint(); ttButtons(); }
    });
    const cend = (e) => { if (cs && e.pointerId === cs.id) { if (tt && tt.d[cs.side].cash !== cs.v0) ttGesture(cs.side); cs = null; } };
    el.addEventListener('pointerup', cend); el.addEventListener('pointercancel', cend);
  }

  // ---- characters at the table
  const ttGesture = (side) => { if (tt) tt.sw[side] = performance.now(); };
  const ttShake = (side) => { if (tt) tt.fx[side] = { k: 'shake', at: performance.now() }; };
  const ttHop = (side) => { if (tt) tt.fx[side] = { k: 'hop', at: performance.now() }; };
  function ttPush(side) {   // the pile slides toward the other player for a beat when an offer goes across
    const pe = $('ttPile' + side); if (!pe) return;
    const land = ttLand(), v = side === 'me' ? -1 : 1, tf = land ? 'translateX(' + (14 * v) + 'px)' : 'translateY(' + (14 * v) + 'px)';
    pe.querySelector('.tt-cards').animate([{ transform: 'none' }, { transform: tf }, { transform: 'none' }], { duration: 420, easing: 'ease-in-out' });
  }
  function ttQuip(side, txt) {
    if (!tt) return; const q = $('ttAv' + side).querySelector('.tt-q');
    q.textContent = txt; q.classList.remove('on'); void q.offsetWidth; q.classList.add('on');
    clearTimeout(q._t); q._t = setTimeout(() => q.classList.remove('on'), 3600);
  }
  function ttLoop() {
    ttRaf = 0; if (!tt || !g) return;
    ttRaf = requestAnimationFrame(ttLoop);
    const now = performance.now();
    [['them', ttOther(), 1], ['me', me(), -1]].forEach(([side, p, face]) => {
      if (!p) return;
      const cv = $('ttAv' + side).querySelector('canvas'), c = cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const gl = c.createRadialGradient(100, 252, 4, 100, 252, 90); gl.addColorStop(0, 'rgba(255,210,63,.35)'); gl.addColorStop(1, 'rgba(255,210,63,0)');
      c.fillStyle = gl; c.fillRect(0, 160, 200, 110);
      const sw = tt.sw[side] ? (now - tt.sw[side]) / 560 : -1, fx = tt.fx[side], ft = fx ? (now - fx.at) / 1000 : 9;
      let lift = 0, head = Math.sin(now / 700 + (side === 'me' ? 1 : 0)) * 0.04, tilt = 0, sq = 1;
      if (fx && fx.k === 'shake' && ft < 1) head = Math.sin(ft * 34) * 0.45 * (1 - ft);
      if (fx && fx.k === 'hop' && ft < 1.3) { const h = Math.abs(Math.sin(ft * Math.PI * 3)) * (1.3 - ft); lift = h * 34; sq = 1 + h * 0.06; }
      if (sw >= 0 && sw < 1) tilt = Math.sin(sw * Math.PI) * 0.12 * face;
      PPL.draw(c, 100, 254 - lift, 236, lookOf(p), { selfie: selfieFor(p) || undefined, face: face, badge: p.ink, swing: sw >= 0 && sw < 1 ? sw : -1, head: head, tilt: tilt, squash: sq, bob: Math.sin(now / 420) * 1.5 });
    });
  }

  // ---- deal done: the piles fly across to their new owners
  function ttDone() {
    if (!tt) return;
    tt.mode = 'done'; tt.msg = '\uD83E\uDD1D Deal done!'; ttButtons(); $('ttStat').textContent = 'Deal!';
    ttHop('me'); ttHop('them'); sfx('deal'); vib([30, 40, 60]);
    const avT = $('ttAvthem').getBoundingClientRect(), avM = $('ttAvme').getBoundingClientRect();
    [['them', avM], ['me', avT]].forEach(([side, to]) => {
      $('ttPile' + side).querySelectorAll('.tt-c, .tt-cash:not(.zero) .tt-stack').forEach((c, i) => {
        const r = c.getBoundingClientRect(), dx = (to.left + to.width / 2 - r.left - r.width / 2) / UIZ, dy = (to.top + to.height / 2 - r.top - r.height / 2) / UIZ;
        c.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 30) + 'px) scale(1.1)', opacity: 1, offset: 0.5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3)', opacity: 0 }],
          { duration: 760, delay: i * 70, easing: 'ease-in-out', fill: 'forwards' });
      });
    });
    setTimeout(() => { if (tt && tt.mode === 'done') ttRender(); }, 1250);
    setTimeout(() => { if (tt && tt.mode === 'done') ttClose(false); }, 2300);
  }

  // ---- engine events
  function ttEvent(type, d) {
    if (!g) return;
    if (type === 'tradeOffer') {
      const tr = g.tradeById(d.id); if (!tr) return;
      const to = g.byId(d.to);
      if (d.from === meId && to && g.isBot(to)) ttAiSchedule(tr);
      if (d.to === meId) {
        if (tt && tt.pid === d.from && (tt.id === tr.id || !tt.id)) { ttLoad(tr, !!d.counter); ttGesture('them'); ttRender(); }
        else if (!tt && !ui.panel && $('setup').hidden) setTimeout(() => { const t2 = g && g.tradeById(d.id); if (!tt && t2 && t2.status === 'open' && t2.waiting === meId) ttOpenTrade(t2); }, 450);
      }
    } else if (type === 'tradeDone') { if (tt && tt.id === d.id) ttDone(); }
    else if (type === 'tradeClosed') {
      if (tt && tt.id === d.id && d.by !== meId) { tt.mode = 'propose'; tt.id = 0; tt.prev = null; tt.msg = nm(d.by) + ' said no. Sweeten it and propose again?'; ttShake('them'); ttRender(); }
    } else if (type === 'tradeStale') {
      if (tt && tt.id === d.id) { const tr = g.tradeById(d.id); tt.mode = 'propose'; tt.id = 0; tt.msg = 'That deal went stale: ' + ((tr && tr.why) || 'something changed'); ttRender(); }
    } else if (type === 'turn') {
      const p = g.byId(d.pid); if (p && g.isBot(p)) setTimeout(() => ttBotIdea(p, false), 1400);
    }
  }

  // ---- AI at the table: accept / counter / reject with a quip (replaces the stock accept-or-decline for deals with you)
  function ttNeed(p) {
    const lv = (p.ai && p.ai.level) || 'normal';
    return ({ easy: -40, normal: 15, ruthless: 60 }[lv] || 15) + (TT_PERS[p.charId] || 0) + MO(p).need;
  }
  function ttAiSchedule(tr) {
    const bot = g.byId(tr.waiting); if (!bot) return;
    g.aiMem = g.aiMem || {}; const m = g.aiMem[bot.id] || (g.aiMem[bot.id] = { next: 0, payup: {}, trade: {}, lastPropose: -99, chatSeen: 0, said: {} });
    m.trade[tr.id + ':' + tr.v] = 9e15;     // the stock AI loop leaves this one to us
    const id = tr.id, v = tr.v;
    setTimeout(() => ttAiRespond(id, v), 1100 + Math.random() * 900);
  }
  function ttCounterFor(p, tr, need) {
    const pIsA = tr.a === p.id, pg = ttCopy(pIsA ? tr.aGives : tr.bGives), hg = ttCopy(pIsA ? tr.bGives : tr.aGives), h = g.byId(pIsA ? tr.b : tr.a);
    const val = () => AI.evalTrade(g, p, { a: p.id, b: h.id, aGives: pg, bGives: hg }), r10 = (x) => Math.ceil(x / 10) * 10;
    const askCash = () => { const gap = need - val(); if (gap <= 0) return; const k = r10(gap + 10), room = ttFree(h) - hg.cash; if (k <= room && k <= 600) hg.cash += k; };
    if (need - val() > 0 && pg.cash > 0) pg.cash = Math.max(0, pg.cash - r10(need - val()));
    askCash();
    if (need - val() > 0 && pg.props.length) {
      let bi = 0, bv = -1e9; pg.props.forEach((sp, i) => { const w = AI.worthTo(g, p.id, sp, 'lose'); if (w > bv) { bv = w; bi = i; } });
      pg.props.splice(bi, 1); askCash();
    }
    if (need - val() > 0 || (ttEmpty(pg) && ttEmpty(hg))) return null;
    const same = (a, b) => a.cash === b.cash && a.passes === b.passes && a.props.join() === b.props.join();
    if (same(pg, ttCopy(pIsA ? tr.aGives : tr.bGives)) && same(hg, ttCopy(pIsA ? tr.bGives : tr.aGives))) return null;
    return { give: pg, get: hg };
  }
  function ttAiRespond(id, v) {
    const tr = g && g.tradeById(id); if (!tr || tr.status !== 'open' || tr.v !== v) return;
    const p = g.byId(tr.waiting); if (!p || !g.isBot(p) || p.bankrupt) return;
    const hid = tr.waiting === tr.a ? tr.b : tr.a, val = AI.evalTrade(g, p, tr), need = ttNeed(p) + (Math.random() * 20 - 10), gap = need - val;
    const quip = (txt) => { g.chat(p.id, hid, txt); if (tt && tt.pid === p.id) ttQuip('them', txt); };
    if (gap <= 0) {
      quip(moodLine(p, 'accepted', AI.line(g, p, 'accepted')));
      const err = g.acceptTrade(p.id, id); if (err) g.declineTrade(p.id, id);
      return;
    }
    const GAP = MO(p).gap, ct = gap <= GAP && tr.v < 6 ? ttCounterFor(p, tr, need + 5) : null;
    if (ct && !g.counterTrade(p.id, id, ct.give, ct.get)) { const own = TT_LINES.counterC[p.charId]; quip(moodLine(p, 'counter', own && Math.random() < 0.6 ? ttPick(own) : ttPick(TT_LINES.counter))); return; }
    quip(moodLine(p, 'declined', gap > GAP ? ttPick(TT_LINES.far) : AI.line(g, p, 'declined')));
    g.declineTrade(p.id, id);
  }
  // now and then a bot wants one of your deeds that would help its own set, and makes you a cash offer on its turn
  function ttBotIdea(p, force) {
    if (!g || g.phase !== 'play' || !g.turn || g.turn.pid !== p.id || p.bankrupt || !me() || me().bankrupt) return false;
    if (!force && (Math.random() > MO(p).idea || g.turnCount - (ttIdea[p.id] || -99) < 4)) return false;
    if (g.trades.some((x) => x.status === 'open' && ((x.a === p.id && x.b === meId) || (x.b === p.id && x.a === meId)))) return false;
    let best = -1, bw = 0;
    ttOwned(me()).forEach((sp) => {
      const s = S[sp]; if (!s.group || ttBlock(sp) || g.props[sp].hocked || g.ownsGroup(g.oid(me()), s.group)) return;
      if (!B.GROUP_MEMBERS[s.group].some((i) => g.props[i].owner === g.oid(p))) return;
      const w = AI.worthTo(g, p.id, sp, 'get'); if (w > bw) { bw = w; best = sp; }
    });
    if (best < 0) return false;
    const cash = Math.round(S[best].price * (1.3 + Math.random() * 0.5) / 10) * 10;
    if (ttFree(p) - cash < 120) return false;
    ttIdea[p.id] = g.turnCount;
    const r = g.proposeTrade(p.id, meId, { cash: cash, props: [], passes: 0 }, { cash: 0, props: [best], passes: 0 });
    if (!r) AI.say(g, p, meId, 'offer', true);
    return !r;
  }

  function frame() {
    requestAnimationFrame(frame);
    const nowP = performance.now(), dtS = Math.min(0.1, (nowP - lastT) / 1000); lastT = nowP;
    if (!g) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#14121b'; ctx.fillRect(0, 0, W, H); return; }
    try {
      if (!frozen) {
        const cur = g.cur(); g.speed = BASE_SPEED * paceMul() * (prefs.fastAI && cur && g.isBot(cur) && !(g.turn && g.turn.auction) ? 2.2 : 1);
        if (g.phase === 'play') paintCard();          // holds a drawn card for your swipe before the engine applies it
        g.tick(nowMs());
        if (g.phase === 'play') AI.tick(g);
        updatePeople(dtS);
      }
      paintLb();
      stepCam(dtS);
      sfTick(nowP, dtS);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const sa = shake.amp * Math.max(0, 1 - (performance.now() - shake.at) / 260), view = sa > 0.2 ? { x: cam.x + (Math.random() - 0.5) * sa / cam.s, y: cam.y + (Math.random() * 0.6 + 0.2) * sa / cam.s, s: cam.s } : cam;
      drawScene(ctx, view, W, H);
      drawRadar(ctx, view);
      drawReplays(ctx, dtS);
      drawPip(ctx, dtS);
      drawTileCard(ctx);
      paintTop(); paintDice(); paintPop(); layoutPops(); paintGripRow(); if (ui.drawer) paintDrawer(); if (ui.bubble) posBubble();
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
  // v0.7: the card shows YOUR name big; the character is who you're channeling (name + their main radio role)
  const shownName = (ch) => (prefs.name ? prefs.name : 'You').toUpperCase();
  const roleShort = (ch) => String(ch.role || '').split(/[,\/(\u00b7;]/)[0].trim();
  const roleLine = (ch) => 'channeling ' + ch.full + (roleShort(ch) ? ' ' + roleShort(ch) : '');
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
    paintMoods();
    [['oppSeg', 'opp'], ['lvlSeg', 'level'], ['lenSeg', 'len'], ['timSeg', 'timer'], ['puSeg', 'payup'], ['trSeg', 'trade']].forEach((x) => [...$(x[0]).children].forEach((b) => b.classList.toggle('on', String(prefs[x[1]]) === b.dataset.v)));
    paintDeckAvatars(); paintNames(); layoutDeck(); fitSetup();
    const s = loadSave(); $('resumeBox').hidden = !s;
    if (s) { const p = (s.game.players || []).find((q) => q.id === s.meId); $('resumeInfo').textContent = 'Round ' + s.game.round + (p ? ' \u00b7 you have ' + money(p.cash) : '') + ' \u00b7 saved ' + new Date(s.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  }
  // v0.7 moods: one button per computer opponent; tap to cycle Default / Good day / Friendly / Hostile
  function paintMoods() {
    const box = $('moodSeg'); if (!box) return;
    if (!Array.isArray(prefs.moods)) prefs.moods = ['default', 'default', 'default'];
    const n = Math.max(1, Math.min(3, +prefs.opp || 2));
    box.innerHTML = Array.from({ length: n }, (_, k) => { const m = MOODS[prefs.moods[k]] ? prefs.moods[k] : 'default', M = MOODS[m];
      return '<button data-k="' + k + '" class="' + (m !== 'default' ? 'on md-' + m : '') + '"><small>Opp ' + (k + 1) + '</small>' + (M.e ? M.e + ' ' : '') + M.n + '</button>'; }).join('');
  }
  $('moodSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b) return; const k = +b.dataset.k;
    if (!Array.isArray(prefs.moods)) prefs.moods = ['default', 'default', 'default'];
    const cur = MOOD_ORDER.indexOf(prefs.moods[k]); prefs.moods[k] = MOOD_ORDER[(cur + 1) % MOOD_ORDER.length];
    savePrefs(); paintMoods(); sfx('click');
  });
  document.querySelectorAll('#setup .seg:not(#moodSeg)').forEach((seg) => seg.addEventListener('click', (e) => {
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
    pace: () => ({ v: prefs.pace, mul: paceMul(), speed: g ? g.speed : null }), setPace: (v) => { prefs.pace = v; savePrefs(); }, openSelfie: openSelfie, closeSelfie: closeSelfie, selfieFile: selfieFromFile, hasSelfie: () => !!selfieImg,
    camInfo: () => ({ x: cam.x, y: cam.y, s: cam.s, manual: !!cam.manual, keepS: cam.keepS || null, mode: cam.mode }), actionFocus: () => actionFocus(), recapNow: () => { const r = smackLog[smackLog.length - 1]; if (!r) return false; showRecap(r); return true; }, rpInfo: () => ({ on: !!RP.cur, kind: RP.cur && RP.cur.kind, a: +RP.a.toFixed(2), n: HL.length, tau: Math.round(RP.tau), t: Math.round(RP.t) }), smackLog: () => smackLog.map((r) => ({ from: r.from, hits: r.hits.length })), recapOn: () => !!RP.cur && !RP.skip,
    sfExpr: (e, ms) => { sfExpr(e, ms || 4000); return SF.expr; }, sfBlink: () => { SF.nb = 0; }, sfInfo: () => ({ on: !!SF.img, pts: SF.pts, skin: SF.skin, lid: SF.lid, expr: SF.expr, k: +SF.k.toFixed(2) }), sfAlignPts: (k, x, y) => { if (k) { ui.sfPts[k] = { x: x, y: y }; selfieDom.place(); } return ui.sfPts; }, aucLeft: () => (g && g.turn && g.turn.auction ? aucLeft(g.turn.auction) : null), aucT: AUC_T,
    stuffGrouped: (on) => { setStuffGrouped(on); return ui.stuffGrouped; }, sqGeom: () => sqGeom(), boardLayout: () => boardLayout(), pipInfo: () => ({ pid: pip.pid, a: +pip.a.toFixed(2), seen: pip.seen, ang: +pip.ang.toFixed(3) }), camView: (v) => { if (v) { prefs.camView = v; savePrefs(); cam.whole = false; cam.keepS = null; cam.manual = false; } return prefs.camView; }, drawerTop: () => drawerTop(), jumpToSet: jumpToSet, dicePass: (pid) => dicePass(pid), doubleTap: () => doubleTap(), frameSet: (sp) => frameSet(sp), openDeedFull: openDeedFull,
    angry: (pid, at) => getAngry(g.byId(pid), g.byId(at), true), fakeSmack: (from, pids, perfect) => { const w = {}; pids.forEach((q) => logSmack(g.byId(from), g.byId(q), { perfect: !!perfect }, w)); }, quietReplays: () => { HL.forEach((h) => { h.seen = true; }); if (RP.cur) RP.skip = true; }, setPanel: (on) => setPanel(on), paceMul: () => paceMul(), moods: () => g.players.map((p) => [p.name, moodOf(p)]),
    game: () => g, meId: () => meId, tradeTable: () => (tt ? { pid: tt.pid, mode: tt.mode, id: tt.id, msg: tt.msg, d: JSON.parse(JSON.stringify(tt.d)) } : null),
    ttOpen: (pid, sp) => ttOpenWith(pid, sp), ttToggle: ttToggle, ttAct: ttAct, ttBotIdea: (pid) => ttBotIdea(g.byId(pid), true), ttClose: () => ttClose(true), frozen: () => frozen, setFrozen: freeze,
    version: VER, uiz: () => UIZ, setupZoom: () => SZ, editName: editName, passes: () => { const m = me(), w = m && visOf(m).walk; return w && w.passes ? w.passes.map((ps) => ({ pid: ps.pid, inMs: Math.round(ps.tc - g.now), done: ps.done })) : null; }, popK: popK, openInfo: (sp) => { ui.info = { sp: sp }; }, charStats: (id) => statsOf(id), goCard: goCard, smackTap: tapSmack, vis: (pid) => vis[pid], walking: () => g ? g.players.filter((p) => busy(vis[p.id])).map((p) => p.id) : [], game: () => g, meId: () => meId, cam: cam, drawScene: drawScene, replay: () => REC, looks: () => looks, prefs: prefs, savePrefs: savePrefs,
    setCamMode: setCamMode, diceMode: () => (g ? diceMode() : null), diceAct: diceAct, setDrawer: setDrawer, openTrade: openTrade, decideCard: decideCard, autosave: autosave,
    tileCardInfo: () => (TC.on ? { on: TC.on, phase: TC.phase, deck: TC.deck, idx: TC.idx, sp: tcTile(), mine: TC.mine, decided: TC.decided, age: Math.round(performance.now() - TC.t0), box: TC.box && { x: +TC.box.x.toFixed(1), y: +TC.box.y.toFixed(1), w: +TC.box.w.toFixed(1), h: +TC.box.h.toFixed(1) } } : { on: false }),
    forceCard: (deck, pid) => {
      if (!g || g.phase !== 'play') return false;
      const p = g.byId(pid != null ? pid : (g.cur() && g.cur().id)); if (!p || !g.turn) return false;
      const typ = deck === 'finds' ? 'finds' : 'random';
      const sp = S.findIndex((s) => s.type === typ);
      if (sp >= 0) { p.pos = sp; const v = visOf(p), r = RECTS[sp]; v.walk = null; v.march = null; v.x = r.x + r.w / 2; v.y = r.y + r.h / 2 + (r.side === 'b' || !r.side ? -8 : 0); }
      g.turn.pid = p.id; g.drawCard(p, typ); return { sp: p.pos, deck: typ, idx: g.turn.card && g.turn.card.idx };
    },
    tapPlayer: (pid) => { const p = g.byId(pid); if (p) openBubble(p); }, screenOf: (pid) => { const v = visOf(g.byId(pid)); return toScreen(v.x, v.y - 30); },
    state: () => (g ? { phase: g.phase, round: g.round, turnCount: g.turnCount, turn: g.turn && { pid: g.turn.pid, stage: g.turn.stage, buy: g.turn.buy, auction: !!g.turn.auction, tab: !!g.turn.tab, card: !!g.turn.card }, pop: ui.popKey, drawer: ui.drawer, cam: { mode: cam.mode, whole: cam.whole, manual: cam.manual, s: +cam.s.toFixed(3) }, players: g.players.map((p) => ({ id: p.id, name: p.name, cash: p.cash, pos: p.pos, bust: p.bankrupt, passes: p.passes.length })) } : null)
  };
  if (document.fonts && document.fonts.load) document.fonts.load('600 20px Fredoka').catch(() => {});
  try { SFX.setMuted(prefs.mute); } catch (e) {}
  paintSetup();
  requestAnimationFrame(frame);
})();
