/* RTS v0.2 'Shapes' - shared tables (TV + phone): unit types, buildings, factions, wheel menu, share-line rules. */
(function (root) {
  'use strict';
  // 12 unit shapes. icon: phone glyph (ci circle / tri triangle / sq square). role: fight | gather | heal | scout
  var U = [
    { n: 'Brick', g: 'cube', icon: 'sq', s: 1.6, hp: 60, dmg: 7, rng: 2.2, spd: 6, rate: .8, role: 'fight' },
    { n: 'Spike', g: 'tetra', icon: 'tri', s: 1.7, hp: 35, dmg: 6, rng: 2, spd: 10, rate: .5, role: 'fight' },
    { n: 'Orb', g: 'sphere', icon: 'ci', s: 1.4, hp: 40, dmg: 6, rng: 11, spd: 6.5, rate: 1, role: 'fight' },
    { n: 'Drum', g: 'cyl', icon: 'sq', s: 1.9, hp: 120, dmg: 9, rng: 2.4, spd: 4, rate: 1.2, role: 'fight' },
    { n: 'Dart', g: 'cone', icon: 'tri', s: 1.8, hp: 30, dmg: 10, rng: 16, spd: 6, rate: 1.6, role: 'fight' },
    { n: 'Prism', g: 'octa', icon: 'tri', s: 1.6, hp: 30, dmg: 3, rng: 6, spd: 12, rate: .7, role: 'scout' },
    { n: 'Gem', g: 'dodeca', icon: 'ci', s: 1.5, hp: 45, dmg: 2, rng: 5, spd: 6, rate: 1, role: 'heal' },
    { n: 'Boulder', g: 'icosa', icon: 'ci', s: 2.2, hp: 160, dmg: 12, rng: 2.6, spd: 3.5, rate: 1.5, role: 'fight' },
    { n: 'Ring', g: 'torus', icon: 'ci', s: 1.5, hp: 35, dmg: 2, rng: 2, spd: 7, rate: 1, role: 'gather' },
    { n: 'Pill', g: 'capsule', icon: 'sq', s: 1.5, hp: 50, dmg: 4, rng: 7, spd: 6, rate: .9, role: 'fight' },
    { n: 'Pillar', g: 'pillar', icon: 'sq', s: 2, hp: 70, dmg: 14, rng: 20, spd: 3.5, rate: 2.4, role: 'fight' },
    { n: 'Knot', g: 'knot', icon: 'ci', s: 1.8, hp: 90, dmg: 11, rng: 8, spd: 7, rate: .9, role: 'fight' }];
  var B = {   // buildings: big shapes. ico: phone glyph
    hq: { n: 'Core', hp: 600, r: 5, ico: 'sq' }, barracks: { n: 'Barracks', hp: 300, r: 3.5, ico: 'ci', cost: 60 }, tower: { n: 'Tower', hp: 250, r: 2.5, ico: 'tri', cost: 50, dmg: 6, rng: 15 },
    workshop: { n: 'Workshop (wheels)', hp: 280, r: 3.5, ico: 'hex', cost: 80 }, camp: { n: 'Camp', hp: 400, r: 4.5, ico: 'sq' } };
  var FAC = [ { n: 'Humans', col: '#3a78ff' }, { n: 'Monsters', col: '#8a5a32' }, { n: 'Crystal', col: '#8ff0ff' }, { n: 'Steampunk', col: '#d0803e' } ];
  var BIAS = { aggressive: { aggro: 20, spd: 1, chase: 1 }, balanced: { aggro: 14, spd: 1, chase: 0 }, greedy: { aggro: 6, spd: 1.05, chase: 0, greedy: 1 }, protective: { aggro: 12, spd: .95, chase: 0, guard: 1 }, bold: { aggro: 26, spd: 1.1, chase: 1 }, careful: { aggro: 9, spd: .95, chase: 0, retreat: .6 }, strict: { aggro: 10, spd: 1, chase: 0, leash: 8, strict: 1 }, recon: { aggro: 5, spd: 1.35, chase: 0 }, defensive: { aggro: 10, spd: .9, chase: 0, leash: 12 }, protect: { aggro: 13, spd: 1, chase: 0, guard: 1 } };
  var COST = { train: 20, upgrade: 100, gather: 10 };
  // hold-wheel tree: 4 top items (TL, TR, BR, BL), each with 4 leaves. a = action id the phone sends / handles
  // v0.4 hold-wheel tree. Top level = 4 quadrants (TL, TR, BR, BL), each with its own colour (QCOL). Items with c = branch, a = leaf action.
  // Play-style biases sit at branch ends as opposite pairs (greedy vs protective, bold vs careful). Deeper = subtler tuning.
  var QCOL = ['#ff7a45', '#ffd34a', '#45d8ff', '#c27bff'];
  var WHEEL = [
    { n: 'Move / Attack', i: '\u2694', c: [
      { n: 'Attack-move', i: '\u27b6', a: 'mode:amove' },
      { n: 'Move only', i: '\u2192', c: [
        { n: 'Resource', i: '\u25c6', c: [ { n: 'Greedy', i: '$', a: 'mv:greedy' }, { n: 'Protective', i: '\u26e8', a: 'mv:protective' }, { n: 'Gather here', i: '\u25c7', a: 'mv:gather' }, { n: 'Balanced', i: '\u2261', a: 'mv:balanced' } ] },
        { n: 'Scout', i: '\u25ce', c: [ { n: 'Wide sweep', i: '\u25cc', a: 'mv:recon' }, { n: 'Close look', i: '\u25c9', a: 'mv:careful' }, { n: 'Bold probe', i: '\u2191', a: 'mv:bold' }, { n: 'Balanced', i: '\u2261', a: 'mv:balanced' } ] },
        { n: 'Aggression', i: '\u2620', c: [ { n: 'Bold', i: '\u2191', a: 'mv:bold' }, { n: 'Careful', i: '\u2193', a: 'mv:careful' }, { n: 'Aggressive', i: '\u2620', a: 'mv:aggressive' }, { n: 'Balanced', i: '\u2261', a: 'mv:balanced' } ] },
        { n: 'Plain move', i: '\u2192', a: 'mode:move' } ] },
      { n: 'Targets', i: '\u25ce', c: [ { n: 'Attack T1', i: '1', a: 'tgt:attack:1' }, { n: 'Attack T2', i: '2', a: 'tgt:attack:2' }, { n: 'Defend T1', i: '1', a: 'tgt:defend:1' }, { n: 'Defend T2', i: '2', a: 'tgt:defend:2' } ] },
      { n: 'Hold / Stop', i: '\u25a0', c: [ { n: 'Hold', i: '\u25a0', a: 'hold' }, { n: 'Stop', i: '\u2716', a: 'stop' }, { n: 'Auto stack', i: '\u25a6', a: 'stack' }, { n: 'Share res', i: '\u25c6', a: 'share' } ] } ] },
    { n: 'Build', i: '\u2302', c: [ { n: 'Barracks', i: '\u25cf', a: 'build:barracks' }, { n: 'Tower', i: '\u25b2', a: 'build:tower' }, { n: 'Workshop', i: '\u2b22', a: 'build:workshop' },
      { n: 'Worker priority', i: '\u2692', c: [ { n: 'Rush', i: '\u00bb', a: 'prio:rush' }, { n: 'Normal', i: '\u2261', a: 'prio:normal' }, { n: 'Strict', i: '\u25a3', a: 'bias:strict' }, { n: 'Wall', i: '\u2550', a: 'stub:wall' } ] } ] },
    { n: 'Units', i: '\u25b3', c: [ { n: 'Train Brick', i: '\u25a0', a: 'train:0' }, { n: 'Train Orb', i: '\u25cf', a: 'train:2' }, { n: 'Train Ring', i: '\u25ef', a: 'train:8' }, { n: 'Select army', i: '\u2726', a: 'selall' } ] },
    { n: 'Bias', i: '\u2691', c: [
      { n: 'Economy', i: '\u25c6', c: [ { n: 'Greedy', i: '$', a: 'bias:greedy' }, { n: 'Protective', i: '\u26e8', a: 'bias:protective' }, { n: 'Balanced', i: '\u2261', a: 'bias:balanced' }, { n: 'Strict', i: '\u25a3', a: 'bias:strict' } ] },
      { n: 'Risk', i: '\u2696', c: [ { n: 'Bold', i: '\u2191', a: 'bias:bold' }, { n: 'Careful', i: '\u2193', a: 'bias:careful' }, { n: 'Balanced', i: '\u2261', a: 'bias:balanced' }, { n: 'Strict', i: '\u25a3', a: 'bias:strict' } ] },
      { n: 'Posture', i: '\u2691', c: [ { n: 'Aggressive', i: '\u2620', a: 'bias:aggressive' }, { n: 'Recon', i: '\u25ce', a: 'bias:recon' }, { n: 'Defensive', i: '\u26e8', a: 'bias:defensive' }, { n: 'Protect', i: '\u2665', a: 'bias:protect' } ] },
      { n: 'Upgrade', i: '\u2b06', a: 'upgrade' } ] } ];
  // share lines between overlapping selected things. one colour per type
  var SHARE = { r: 6, health: '#47ff7a', repair: '#3fd8ff', resource: '#ffcc33', power: '#ff5cf0' };
  function shareKind(a, b) {   // a, b: {ty|kind, hpf, carry, lvl, isB}
    if (!a.isB && !b.isB) { if (U[a.ty].role === 'heal' && b.hpf < 1) return 'health'; if (U[b.ty].role === 'heal' && a.hpf < 1) return 'health'; if (a.carry || b.carry) return 'resource'; return null; }
    if (a.isB && b.isB) return null; var bd = a.isB ? a : b, un = a.isB ? b : a;
    if (U[un.ty].role === 'gather' && bd.hpf < 1) return 'repair'; if (un.carry) return 'resource'; if (bd.lvl > 1) return 'power'; return null; }
  root.Shapes = { QCOL: QCOL, U: U, B: B, FAC: FAC, BIAS: BIAS, COST: COST, WHEEL: WHEEL, SHARE: SHARE, shareKind: shareKind };
})(typeof window !== 'undefined' ? window : global);
