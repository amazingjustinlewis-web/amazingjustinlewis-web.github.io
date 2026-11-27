/* Zero to Phi sponsor slots v01.
   Config: ../sponsors_v01.json (sibling of /js/).
   API: ZTPSponsors.get(game, slotType) — array of slots with .filled.
        ZTPSponsors.ready() — promise, resolved after the JSON loads (or fails to defaults).
        ZTPSponsors.paint(canvas, slot) — logo, name, or gold-on-black "Your business here".
        ZTPSponsors.onUpdate(fn) — fired when the config (or a logo) is ready.
   Red Deer Rich: do not edit RDR sources in this drop. A later build should call
   ZTPSponsors.get('red-deer-rich', 'board-property') and paint the matching propertyId.
*/
(function (root) {
  'use strict';
  var slots = [];
  var loaded = false;
  var waiters = [];
  var listeners = [];

  function today() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function inDate(s) {
    var t = today();
    if (s.start && t < String(s.start).slice(0, 10)) return false;
    if (s.end && t > String(s.end).slice(0, 10)) return false;
    return true;
  }
  function filled(s) {
    if (!s || s.active === false) return false;
    if (!inDate(s)) return false;
    var name = (s.name || '').trim();
    var logo = (s.logo || '').trim();
    return !!(name || logo);
  }
  function tag(s) {
    var o = {};
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) o[k] = s[k];
    o.filled = filled(s);
    return o;
  }
  function get(game, slotType) {
    var out = [];
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (game && s.game !== game) continue;
      if (slotType && s.slotType !== slotType) continue;
      out.push(tag(s));
    }
    return out;
  }
  function paintPlaceholder(ctx, w, h) {
    ctx.fillStyle = '#0a0906';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(226,184,74,.55)';
    ctx.lineWidth = Math.max(2, Math.round(h * 0.045));
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    var ruleY = h * 0.38;
    ctx.strokeStyle = 'rgba(192,138,34,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, ruleY);
    ctx.lineTo(w * 0.82, ruleY);
    ctx.stroke();
    ctx.fillStyle = '#e2b84a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var fs = Math.max(14, Math.round(h * 0.38));
    ctx.font = '400 ' + fs + 'px Georgia,"Times New Roman",serif';
    ctx.letterSpacing = '0.18em';
    try { ctx.letterSpacing = '0.18em'; } catch (e) {}
    ctx.fillText('YOUR BUSINESS HERE', w / 2, h * 0.62);
  }
  function paintName(ctx, w, h, name) {
    ctx.fillStyle = '#0a0906';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(226,184,74,.45)';
    ctx.lineWidth = Math.max(2, Math.round(h * 0.04));
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    ctx.fillStyle = '#f3dc95';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var fs = Math.max(14, Math.round(h * 0.42));
    ctx.font = '400 ' + fs + 'px Georgia,"Times New Roman",serif';
    var text = String(name || '').trim().toUpperCase();
    while (fs > 12 && ctx.measureText(text).width > w * 0.88) {
      fs -= 1;
      ctx.font = '400 ' + fs + 'px Georgia,"Times New Roman",serif';
    }
    ctx.fillText(text, w / 2, h / 2);
  }
  function paint(canvas, slot) {
    var w = canvas.width || 640, h = canvas.height || 56;
    var ctx = canvas.getContext('2d');
    if (!slot || !slot.filled) {
      paintPlaceholder(ctx, w, h);
      return Promise.resolve(canvas);
    }
    var logo = (slot.logo || '').trim();
    if (!logo) {
      paintName(ctx, w, h, slot.name);
      return Promise.resolve(canvas);
    }
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        ctx.fillStyle = '#0a0906';
        ctx.fillRect(0, 0, w, h);
        var pad = Math.round(h * 0.08);
        var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        var sc = Math.min((w - pad * 2) / iw, (h - pad * 2) / ih);
        var dw = iw * sc, dh = ih * sc;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        resolve(canvas);
      };
      img.onerror = function () {
        if ((slot.name || '').trim()) paintName(ctx, w, h, slot.name);
        else paintPlaceholder(ctx, w, h);
        resolve(canvas);
      };
      img.src = logo;
    });
  }
  function fire() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) {}
    }
  }
  function applyData(data) {
    if (data && Array.isArray(data.slots)) slots = data.slots;
    loaded = true;
    while (waiters.length) waiters.pop()();
    fire();
  }
  function configUrl() {
    var src = '';
    try {
      var s = document.currentScript;
      if (s && s.src) src = s.src;
      else {
        var tags = document.getElementsByTagName('script');
        for (var i = tags.length - 1; i >= 0; i--) {
          if (/ztp-sponsors_v01\.js/.test(tags[i].src || '')) { src = tags[i].src; break; }
        }
      }
    } catch (e) {}
    if (src) {
      try { return new URL('../sponsors_v01.json', src).href; } catch (e2) {}
    }
    return '../sponsors_v01.json';
  }
  function load() {
    var url = configUrl();
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'b=983', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('sponsors ' + r.status);
      return r.json();
    }).then(applyData).catch(function () {
      if (!slots.length) {
        slots = [
          { id: 'bh-board-long-near', game: 'bubble-hockey', slotType: 'rink-board', place: 'long-near', name: '', logo: '', link: '', active: true },
          { id: 'bh-board-long-far', game: 'bubble-hockey', slotType: 'rink-board', place: 'long-far', name: '', logo: '', link: '', active: true },
          { id: 'bh-board-end-south', game: 'bubble-hockey', slotType: 'rink-board', place: 'end-south', name: '', logo: '', link: '', active: true },
          { id: 'bh-board-end-north', game: 'bubble-hockey', slotType: 'rink-board', place: 'end-north', name: '', logo: '', link: '', active: true }
        ];
      }
      loaded = true;
      while (waiters.length) waiters.pop()();
      fire();
    });
  }
  function ready() {
    return loaded ? Promise.resolve() : new Promise(function (res) { waiters.push(res); });
  }
  function onUpdate(fn) { if (typeof fn === 'function') listeners.push(fn); }

  var api = {
    get: get,
    ready: ready,
    paint: paint,
    paintPlaceholder: function (canvas) {
      var ctx = canvas.getContext('2d');
      paintPlaceholder(ctx, canvas.width || 640, canvas.height || 56);
      return canvas;
    },
    onUpdate: onUpdate,
    filled: filled
  };
  root.ZTPSponsors = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})(window);
