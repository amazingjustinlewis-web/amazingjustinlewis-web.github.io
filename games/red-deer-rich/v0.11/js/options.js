/* RED DEER RICH - v0.2.1+ shared game-options helpers (TV lobby + host phone setup).
   The option list, descriptions, icons and presets live in config.js (C.options, C.presets). */
(function (root) {
  'use strict';
  var C = root.RDR_CONFIG;
  function opt(k) { for (var i = 0; i < C.options.length; i++) if (C.options[i].k === k) return C.options[i]; return null; }
  // which preset the current rules match ('custom' when edited). Camera is a TV preference, never part of a preset.
  function presetOf(rules) {
    for (var id in C.presets) { var r = C.presets[id].rules, same = true; for (var k in r) if (!!rules[k] !== !!r[k]) { same = false; break; } if (same) return id; }
    return 'custom';
  }
  function countOn(rules) { var n = 0; C.options.forEach(function (o) { if (rules[o.k]) n++; }); return n; }
  function activeList(rules) { return C.options.filter(function (o) { return !!rules[o.k]; }); }
  // the rules a preset (or a remembered setup) turns into, in a safe order (jackpot before fees: fees switch the jackpot on)
  // v0.4: a setup remembered before a new option existed (e.g. Heckle) fills the missing switch from the preset the rest of
  // it matches, so a remembered Chill stays Chill instead of turning Custom.
  function ordered(rules) {
    var out = [], keys = C.options.map(function (o) { return o.k; });
    rules = fillMissing(rules);
    keys.sort(function (a, b) { return (a === 'feesToPot') - (b === 'feesToPot'); });
    keys.forEach(function (k) { if (k in rules) out.push([k, !!rules[k]]); });
    return out;
  }
  function fillMissing(rules) {
    var miss = C.options.some(function (o) { return o.k !== 'camera' && !(o.k in rules); });
    if (!miss) return rules;
    var out = {}, k; for (k in rules) out[k] = rules[k];
    for (var id in C.presets) {
      var r = C.presets[id].rules, same = true;
      for (k in r) if ((k in rules) && !!rules[k] !== !!r[k]) { same = false; break; }
      if (same) { for (k in r) if (!(k in out)) out[k] = r[k]; return out; }
    }
    return out;
  }
  // press-and-hold on rows matching `sel` inside `box`: a quick tap calls onTap(row); holding still for `ms` calls
  // onHold(row) instead and the release does NOT toggle. Moving the finger (scrolling) cancels both.
  // Keyboard (Enter / Space -> click with detail 0) still taps.
  function hold(box, sel, onTap, onHold, ms) {
    ms = ms || 480;
    var t = 0, row = null, x0 = 0, y0 = 0, fired = false, lastTouch = 0, heldUp = 0;
    function find(el) { while (el && el !== box) { if (el.matches ? el.matches(sel) : el.webkitMatchesSelector(sel)) return el; el = el.parentNode; } return null; }
    function start(target, x, y) {
      var r = find(target); if (!r || r.disabled) return;
      row = r; x0 = x; y0 = y; fired = false; clearTimeout(t); r.classList.add('holding');
      t = setTimeout(function () { if (!row) return; fired = true; row.classList.remove('holding'); row.classList.add('held'); var rr = row; setTimeout(function () { rr.classList.remove('held'); }, 400); onHold(rr); }, ms);
    }
    function move(x, y) { if (row && !fired && (Math.abs(x - x0) > 12 || Math.abs(y - y0) > 12)) cancel(); }
    function cancel() { clearTimeout(t); if (row) row.classList.remove('holding'); row = null; }
    function end() { var r = row, f = fired; clearTimeout(t); if (r) r.classList.remove('holding'); row = null; if (f) heldUp = Date.now(); if (r && !f) onTap(r); }
    // the release after a hold must not "click" whatever just opened under the finger (the phone turns a lifted touch
    // into a click on the element now under it, e.g. the explanation's backdrop, which would close it straight away)
    document.addEventListener('click', function (e) { if (Date.now() - heldUp < 700) { heldUp = 0; e.preventDefault(); e.stopPropagation(); } }, true);
    if (root.PointerEvent) {
      box.addEventListener('pointerdown', function (e) { if (e.button > 0) return; start(e.target, e.clientX, e.clientY); });
      box.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
      box.addEventListener('pointerup', function () { end(); });
      box.addEventListener('pointercancel', cancel);
      document.addEventListener('pointerup', function () { if (row) cancel(); });       // released somewhere else: nothing
    } else {
      box.addEventListener('touchstart', function (e) { lastTouch = Date.now(); var p = e.touches[0]; start(e.target, p.clientX, p.clientY); }, { passive: true });
      box.addEventListener('touchmove', function (e) { var p = e.touches[0]; move(p.clientX, p.clientY); }, { passive: true });
      box.addEventListener('touchend', function (e) { if (row) e.preventDefault(); end(); });
      box.addEventListener('touchcancel', cancel);
      box.addEventListener('mousedown', function (e) { if (Date.now() - lastTouch > 800 && e.button === 0) start(e.target, e.clientX, e.clientY); });
      box.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
      box.addEventListener('mouseup', function () { if (Date.now() - lastTouch > 800) end(); });
    }
    box.addEventListener('click', function (e) { if (e.detail === 0) { var r = find(e.target); if (r) onTap(r); } });   // keyboard
    box.addEventListener('contextmenu', function (e) { if (find(e.target)) e.preventDefault(); });                   // long-press menu
  }
  root.RDROpts = { opt: opt, presetOf: presetOf, countOn: countOn, activeList: activeList, ordered: ordered, fillMissing: fillMissing, hold: hold };
})(typeof window !== 'undefined' ? window : globalThis);
