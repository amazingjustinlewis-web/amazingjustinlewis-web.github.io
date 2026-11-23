/* Load BEFORE a game's net.js so we can remember the room Host instance for Invite. */
(function (root) {
  'use strict';
  function hook(N) {
    if (!N || N._ztpW) return;
    N._ztpW = true;
    ['Host', 'LocalHost'].forEach(function (k) {
      var Orig = N[k];
      if (typeof Orig !== 'function') return;
      function Wrapped(o) {
        var inst;
        if (!(this instanceof Wrapped)) {
          inst = new Orig(o);
        } else {
          inst = this;
          Orig.call(inst, o);
        }
        root.__ZTP_NET = inst;
        return inst;
      }
      Wrapped.prototype = Orig.prototype;
      try { Object.setPrototypeOf(Wrapped, Orig); } catch (e) {}
      N[k] = Wrapped;
    });
  }
  function watch(name) {
    var cur = root[name];
    if (cur) { hook(cur); return; }
    try {
      var _v;
      Object.defineProperty(root, name, {
        configurable: true,
        enumerable: true,
        get: function () { return _v; },
        set: function (v) { _v = v; hook(v); }
      });
    } catch (e) {}
  }
  ['LSNet', 'RDRNet', 'LRNet', 'ZTNet', 'MSNet', 'SQNet', 'DDNet', 'MONet', 'DSNet'].forEach(watch);
})(window);
