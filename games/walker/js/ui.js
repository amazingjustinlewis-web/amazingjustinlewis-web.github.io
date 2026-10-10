/* WALKER - the six-big-buttons pad. Used by the phone controller and by "Play here" mode on the TV/iPad. */
(function (root) {
  var C = root.WALKER_CONFIG;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function loadSet() { var s = {}; for (var k in C.defaults) s[k] = C.defaults[k]; try { var j = JSON.parse(localStorage.getItem('walker-settings') || '{}'); for (k in j) s[k] = j[k]; } catch (e) {} return s; }
  function saveSet(s) { try { localStorage.setItem('walker-settings', JSON.stringify(s)); } catch (e) {} }

  function Pad(box, o) {
    var self = this; this.o = o; this.box = box; this.page = 'go'; this.manualAt = 0; this.s = loadSet(); this.moms = [];
    box.classList.add('wpad'); if (o.compact) box.classList.add('compact');
    this.tabs = el('div', 'wtabs'); box.appendChild(this.tabs);
    C.pages.forEach(function (p) {
      var t = el('button', 'wtab', p.icon); t.style.setProperty('--c', p.border); t.dataset.page = p.id; t.setAttribute('aria-label', p.name);
      t.onclick = function () { self.manualAt = Date.now(); self.show(p.id); };
      self.tabs.appendChild(t);
    });
    this.gear = el('button', 'wtab wgear', '\u2699\uFE0F'); this.gear.setAttribute('aria-label', 'Settings'); this.gear.onclick = function () { self.toggleSettings(); }; this.tabs.appendChild(this.gear);
    this.momBar = el('div', 'wmoms'); box.appendChild(this.momBar);
    this.grid = el('div', 'wgrid'); box.appendChild(this.grid);
    this.backB = el('button', 'wback', '\u2B05\uFE0F'); this.backB.setAttribute('aria-label', 'Back'); box.appendChild(this.backB);
    this.backB.onclick = function () { self.pulse(self.backB); o.send({ t: 'back' }); };
    this.setBox = el('div', 'wset hidden'); box.appendChild(this.setBox);
    this.show('go'); this.buildSettings();
  }
  Pad.prototype.pulse = function (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {} };
  Pad.prototype.show = function (id) {
    var self = this, p = C.pages.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    this.page = id; this.box.style.setProperty('--border', p.border);
    [].forEach.call(this.tabs.children, function (t) { t.classList.toggle('on', t.dataset.page === id); });
    this.grid.innerHTML = '';
    p.buttons.forEach(function (b) {
      var e = el('button', 'wbtn', '<span>' + b.pic + '</span>'); e.style.setProperty('--c', b.color); e.dataset.id = b.id; e.setAttribute('aria-label', b.say || b.id);
      e.addEventListener('pointerdown', function (ev) { ev.preventDefault(); self.pulse(e); self.o.send({ t: 'tap', id: b.id }); });
      self.grid.appendChild(e);
    });
  };
  Pad.prototype.setState = function (st) {
    if (st.area && st.area !== this.area) { this.area = st.area; if (Date.now() - this.manualAt > 4000) this.show(st.area); }
    var key = (st.moments || []).map(function (m) { return m.id; }).join(',');
    if (key !== this.momKey) {
      this.momKey = key; var self = this; this.momBar.innerHTML = '';
      (st.moments || []).forEach(function (m) {
        var e = el('button', 'wmom', m.pic); e.setAttribute('aria-label', m.id);
        e.onclick = function () { self.pulse(e); self.o.send({ t: 'moment', id: m.id }); e.classList.add('gone'); };
        self.momBar.appendChild(e);
      });
    }
    if (st.s && !this.settingsOpen) { this.s = st.s; saveSet(this.s); this.buildSettings(); }
  };
  Pad.prototype.toggleSettings = function () { this.settingsOpen = !this.settingsOpen; this.setBox.classList.toggle('hidden', !this.settingsOpen); };
  Pad.prototype.change = function (k, v) { this.s[k] = v; saveSet(this.s); this.o.send({ t: 'set', s: this.s }); if (this.o.onSetting) this.o.onSetting(k, v, this.s); this.buildSettings(); };
  Pad.prototype.buildSettings = function () {
    var self = this, s = this.s, b = this.setBox; b.innerHTML = '';
    function row(label, inner) { var r = el('div', 'wrow'); r.appendChild(el('div', 'wlab', label)); r.appendChild(inner); b.appendChild(r); return r; }
    function choice(k, opts) { var w = el('div', 'wch'); opts.forEach(function (op) { var x = el('button', s[k] === op.id ? 'on' : '', op.pic || op.label); x.onclick = function () { self.change(k, op.id); }; w.appendChild(x); }); return w; }
    function tog(k) { var x = el('button', 'wtog' + (s[k] ? ' on' : ''), s[k] ? 'On' : 'Off'); x.onclick = function () { self.change(k, !s[k]); }; return x; }
    var close = el('button', 'wclose', '\u2714\uFE0F'); close.onclick = function () { self.toggleSettings(); }; b.appendChild(close);
    row('Buddy', choice('companion', C.companions));
    row('Buddy talks', choice('chat', C.chat));
    row('\uD83D\uDE97 Little car', tog('car'));
    if (!this.o.noAwake) row('\uD83D\uDCA1 Keep screen awake', tog('awake'));
    row('Hue lights (preview)', tog('hue'));
    var sl = el('input'); sl.type = 'range'; sl.min = 2; sl.max = 100; sl.value = s.hueCap; var v = el('span', 'wval', s.hueCap + '%');
    sl.oninput = function () { v.textContent = sl.value + '%'; }; sl.onchange = function () { self.change('hueCap', +sl.value); };
    var w = el('div', 'wch'); w.appendChild(sl); w.appendChild(v); row('Brightness cap', w);
    b.appendChild(el('div', 'wnote', 'Hue: sunny = warm, rain = blue, museum = dark. Saved, not hooked up yet.'));
  };
  root.WalkerPad = Pad; root.walkerLoadSettings = loadSet; root.walkerSaveSettings = saveSet;
})(window);
