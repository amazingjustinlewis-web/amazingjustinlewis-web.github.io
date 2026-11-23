/* Central spoken / recap queue: lines and recap shows play one at a time, never overlapping. */
(function (w) {
  'use strict';
  var beatMin = 800, beatMax = 1500;
  var q = [];
  var busy = false;
  var current = null;
  var timer = 0;

  function randBeat() { return beatMin + Math.floor(Math.random() * (beatMax - beatMin + 1)); }

  function next() {
    if (busy) return;
    if (!q.length) { current = null; return; }
    busy = true;
    current = q.shift();
    var item = current;
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      busy = false;
      current = null;
      timer = setTimeout(next, item.beat != null ? item.beat : randBeat());
    }
    try {
      var r = item.fn(finish);
      if (r && typeof r.then === 'function') r.then(finish, finish);
    } catch (e) { if (w.console) console.error(e); finish(); }
  }

  function enqueue(fn, opt) {
    opt = opt || {};
    q.push({ fn: fn, kind: opt.kind || 'talk', beat: opt.beat, pri: opt.pri || 0, label: opt.label || '' });
    if (opt.pri) q.sort(function (a, b) { return (b.pri || 0) - (a.pri || 0); });
    if (!busy && !timer) next();
    else if (!busy) next();
  }

  function wrapRecap() {
    var R = w.RDRRecap;
    if (!R || R._tv075Queued) return;
    if (typeof R.play !== 'function') return;
    R._tv075Queued = true;
    var orig = R.play.bind(R);
    R.play = function () {
      var args = arguments;
      enqueue(function (done) {
        try { orig.apply(R, args); } catch (e) { if (w.console) console.error(e); }
        /* Recap owns the stage until RDRRecap.playing is false. */
        var n = 0;
        var id = setInterval(function () {
          n++;
          var still = R.playing || (R.state && R.state.on);
          if (!still || n > 600) { clearInterval(id); done(); }
        }, 200);
      }, { kind: 'recap', beat: 1000, pri: 1, label: 'recap' });
    };
  }

  w.RDRTalkQueue = {
    enqueue: enqueue,
    wrapRecap: wrapRecap,
    busy: function () { return busy || !!q.length; },
    length: function () { return q.length + (busy ? 1 : 0); },
    clear: function () { q.length = 0; },
    isRecap: function () { return current && current.kind === 'recap'; }
  };
})(window);
