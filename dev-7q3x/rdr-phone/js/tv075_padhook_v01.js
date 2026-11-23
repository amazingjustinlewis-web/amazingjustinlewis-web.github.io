/* Wrap phone Client / LocalClient so the v0.7.4s pad sees smack + talk messages. */
(function (w) {
  'use strict';
  function wrapOnMessage(o) {
    if (!o || o._tv075Pad) return;
    o._tv075Pad = true;
    var orig = o.onMessage;
    o.onMessage = function (m) {
      try { if (typeof w.RDR075OnMsg === 'function') w.RDR075OnMsg(m); } catch (e) {}
      try { w.dispatchEvent(new CustomEvent('rdr074s-msg', { detail: m })); } catch (e2) {}
      if (typeof orig === 'function') return orig.apply(this, arguments);
    };
  }
  function wrapCtor(name) {
    var N = w.RDRNet, Ctor = N && N[name];
    if (!Ctor || Ctor._tv075Pad) return;
    function Wrapped(o) {
      wrapOnMessage(o);
      Ctor.apply(this, arguments);
      wrapOnMessage(this.o || o);
      w._rdr075Client = this;
    }
    try { Wrapped.prototype = Object.create(Ctor.prototype); } catch (e) { Wrapped.prototype = Ctor.prototype; }
    Wrapped.prototype.constructor = Wrapped;
    for (var k in Ctor) if (Object.prototype.hasOwnProperty.call(Ctor, k)) Wrapped[k] = Ctor[k];
    Wrapped._tv075Pad = true;
    N[name] = Wrapped;
  }
  wrapCtor('Client');
  wrapCtor('LocalClient');
})(window);
