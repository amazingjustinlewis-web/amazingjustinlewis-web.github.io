/* Zero to Phi · 0-Phi Room v0.1 — original local-business ad reel + GyroForge cinematic. */
(function (root) {
  'use strict';

  var ADS = [
    { kicker: 'Open late', title: 'Maple & Main Cafe', line: 'Warm lights, good plates, a wall of games.\nTwo blocks off the river.' },
    { kicker: 'Est. this street', title: 'Riverbend Hardware', line: 'The thing you need is probably here.\nIf it isn\'t, we\'ll find it by noon.' },
    { kicker: 'Walk-ins welcome', title: 'Northside Smile Co.', line: 'A gentler checkup.\nCome in on your lunch, leave grinning.' },
    { kicker: 'We\'ll get you there', title: 'Prairie Auto Care', line: 'Honest work, fair tickets.\nCoffee while you wait.' },
    { kicker: 'Stay awhile', title: 'The Lantern Bookshop', line: 'New shelves on Thursdays.\nSoft chairs, quieter corners.' }
  ];

  function AdReel(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.i = 0; this.t0 = 0; this.dur = 7000; this.running = false;
  }
  AdReel.prototype.resize = function () {
    var r = this.c.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = Math.max(160, r.width | 0), h = Math.max(90, r.height | 0);
    if (this.c.width !== w * dpr) { this.c.width = w * dpr; this.c.height = h * dpr; }
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0); this.w = w; this.h = h;
  };
  AdReel.prototype.start = function () { this.running = true; this.t0 = performance.now(); this.i = 0; this.resize(); };
  AdReel.prototype.stop = function () { this.running = false; };
  AdReel.prototype.tick = function (now) {
    if (!this.running) return;
    this.resize();
    var g = this.g, w = this.w, h = this.h;
    var span = this.dur * ADS.length;
    var t = (now - this.t0) % span;
    if (t < 0) t += span;
    var i = Math.floor(t / this.dur) % ADS.length, u = (t % this.dur) / this.dur;
    if (i < 0) i += ADS.length;
    this.i = i; var ad = ADS[i];
    if (!ad) return;
    g.fillStyle = '#07070c'; g.fillRect(0, 0, w, h);
    // slow gold wash
    var grd = g.createRadialGradient(w * (0.3 + u * 0.4), h * 0.4, 10, w * 0.5, h * 0.5, w * 0.8);
    grd.addColorStop(0, 'rgba(255,210,63,0.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,210,63,0.45)'; g.lineWidth = 2;
    g.strokeRect(10, 10, w - 20, h - 20);
    var fade = u < 0.1 ? u / 0.1 : u > 0.88 ? (1 - u) / 0.12 : 1;
    g.globalAlpha = Math.max(0, fade);
    g.fillStyle = '#ffd23f'; g.font = '600 ' + Math.max(10, h * 0.07) + 'px Fredoka,system-ui,sans-serif';
    g.fillText(ad.kicker.toUpperCase(), 24, h * 0.28);
    g.fillStyle = '#fff'; g.font = '700 ' + Math.max(16, h * 0.16) + 'px Fredoka,system-ui,sans-serif';
    g.fillText(ad.title, 24, h * 0.48);
    g.fillStyle = '#c8cff0'; g.font = '400 ' + Math.max(11, h * 0.08) + 'px Fredoka,system-ui,sans-serif';
    var lines = ad.line.split('\n');
    for (var n = 0; n < lines.length; n++) g.fillText(lines[n], 24, h * 0.64 + n * h * 0.1);
    g.globalAlpha = 1;
    // progress pips
    for (var p = 0; p < ADS.length; p++) {
      g.fillStyle = p === i ? '#ffd23f' : '#ffffff33';
      g.fillRect(24 + p * 16, h - 22, 12, 3);
    }
  };

  function Flight(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.stars = []; this.t = 0; this.roll = 0; this.running = false; this.lit = false;
  }
  Flight.prototype.resize = function () {
    var r = this.c.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = Math.max(80, r.width | 0), h = Math.max(50, r.height | 0);
    if (this.c.width !== w * dpr) {
      this.c.width = w * dpr; this.c.height = h * dpr;
      this.stars = [];
      for (var i = 0; i < 80; i++) this.stars.push({ x: Math.random() * w, y: Math.random() * h, z: 0.3 + Math.random() * 1.7, s: 0.6 + Math.random() * 1.6 });
    }
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0); this.w = w; this.h = h;
  };
  Flight.prototype.start = function () { this.running = true; this.resize(); };
  Flight.prototype.stop = function () { this.running = false; };
  Flight.prototype.setLit = function (on) { this.lit = !!on; };
  Flight.prototype.tick = function (dt) {
    this.resize();
    var g = this.g, w = this.w, h = this.h, speed = this.lit ? 2.4 : 0.6;
    this.t += dt; this.roll += (this.lit ? Math.sin(this.t * 0.9) * 0.4 : 0.05) * dt;
    g.fillStyle = '#03010a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      s.x -= s.z * speed * dt * 60;
      if (s.x < 0) { s.x = w; s.y = Math.random() * h; }
      g.globalAlpha = 0.35 + s.z * 0.4;
      g.fillRect(s.x, s.y, s.s, s.s);
    }
    g.globalAlpha = 1;
    // planet
    g.fillStyle = '#1a2a4a';
    g.beginPath(); g.arc(w * 0.8, h * 0.7, Math.min(w, h) * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd23f22';
    g.beginPath(); g.arc(w * 0.78, h * 0.66, Math.min(w, h) * 0.1, 0, Math.PI * 2); g.fill();
    // ship
    var x = w * 0.38 + Math.sin(this.t * 1.1) * w * 0.06;
    var y = h * 0.48 + Math.cos(this.t * 0.8) * h * 0.08;
    g.save(); g.translate(x, y); g.rotate(this.roll * 0.15);
    g.fillStyle = this.lit ? '#ffd23f' : '#c8cff0';
    g.beginPath(); g.moveTo(18, 0); g.lineTo(-12, 8); g.lineTo(-6, 0); g.lineTo(-12, -8); g.closePath(); g.fill();
    g.fillStyle = '#5ef2c8'; g.fillRect(-4, -2, 8, 4);
    if (this.lit) {
      g.fillStyle = 'rgba(90,240,200,0.7)';
      g.beginPath(); g.moveTo(-12, 0); g.lineTo(-22 - Math.random() * 8, 3); g.lineTo(-22, 0); g.lineTo(-22 - Math.random() * 8, -3); g.fill();
    }
    g.restore();
  };

  function MiniOrbit(canvas) {
    this.f = new Flight(canvas);
  }
  MiniOrbit.prototype.tick = function (dt) { this.f.lit = true; this.f.tick(dt); };

  root.ZTPVenueScreens = { AdReel: AdReel, Flight: Flight, MiniOrbit: MiniOrbit, ADS: ADS };
})(window);
