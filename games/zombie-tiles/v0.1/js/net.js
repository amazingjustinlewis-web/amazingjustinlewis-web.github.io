/* ZOMBIE TILES - phone <-> TV networking over WebRTC (PeerJS + the free PeerJS cloud broker).
   No server of our own: the TV registers peer id <prefix><ROOM>, phones connect to it.
   The TV is the authority; phones send intents and get their private state back. */
(function (root) {
  'use strict';
  var C = root.ZT_CONFIG;
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  function makeCode() { var s = ''; for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function peerOpts() {
    var dbg = typeof location !== 'undefined' && /[?&]debug=(\d)/.exec(location.search);
    return { debug: dbg ? +dbg[1] : 1, config: { iceServers: C.iceServers } };
  }

  // ---------------------------------------------------------------- TV / host
  function Host(o) {
    this.o = o; this.conns = {}; this.code = o.code || makeCode(); this.status = 'connecting'; this.tries = 0;
    if (typeof root.Peer !== 'function') { this.setStatus('offline', 'PeerJS did not load'); return; }
    this.open();
  }
  Host.prototype.setStatus = function (s, detail) { this.status = s; this.detail = detail || ''; if (this.o.onStatus) this.o.onStatus(s, this.code, detail); };
  Host.prototype.open = function () {
    var self = this;
    if (this.peer) try { this.peer.destroy(); } catch (e) {}
    var peer = this.peer = new root.Peer(C.peerPrefix + this.code, peerOpts());
    peer.on('open', function () { self.tries = 0; self.setStatus('online'); });
    peer.on('connection', function (conn) {
      conn.on('open', function () { self.conns[conn.connectionId] = conn; });
      conn.on('data', function (d) { self.conns[conn.connectionId] = conn; if (self.o.onMessage) self.o.onMessage(conn, d); });
      conn.on('close', function () { delete self.conns[conn.connectionId]; if (self.o.onClose) self.o.onClose(conn); });
      conn.on('error', function () { delete self.conns[conn.connectionId]; if (self.o.onClose) self.o.onClose(conn); });
    });
    peer.on('disconnected', function () {     // lost the broker (wifi blip): keep existing phones, re-register for new ones
      if (peer !== self.peer) return;
      self.setStatus('reconnecting');
      setTimeout(function () { if (peer === self.peer && !peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 1500);
    });
    peer.on('error', function (e) {
      if (peer !== self.peer) return;
      if (e.type === 'unavailable-id') { self.code = makeCode(); self.open(); return; }
      if (e.type === 'peer-unavailable') return;
      self.tries++;
      self.setStatus(self.tries > 3 ? 'offline' : 'reconnecting', e.type);
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed') {
        setTimeout(function () { if (peer === self.peer) { if (peer.destroyed) self.open(); else if (peer.disconnected) try { peer.reconnect(); } catch (x) { self.open(); } } }, Math.min(15000, 2000 * self.tries));
      }
    });
  };
  Host.prototype.send = function (conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) {} };

  // ---------------------------------------------------------------- phone / client
  function Client(o) {
    this.o = o; this.code = o.code; this.status = 'idle'; this.lastHeard = 0; this.tries = 0;
    var self = this;
    this.ping = setInterval(function () {
      if (self.conn && self.conn.open) {
        self.send({ t: 'ping' });
        if (Date.now() - self.lastHeard > 12000) { self.setStatus('reconnecting', 'no answer'); self.reconnect(); }
      }
    }, 4000);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !(self.conn && self.conn.open)) self.reconnect();
      else if (document.visibilityState === 'visible') self.send({ t: 'ping' });
    });
    root.addEventListener && root.addEventListener('online', function () { self.reconnect(); });
    this.start();
  }
  Client.prototype.setStatus = function (s, d) { this.status = s; if (this.o.onStatus) this.o.onStatus(s, d); };
  Client.prototype.start = function () {
    var self = this;
    if (typeof root.Peer !== 'function') { this.setStatus('offline', 'PeerJS did not load'); return; }
    this.setStatus('connecting');
    if (!this.peer || this.peer.destroyed) {
      this.peer = new root.Peer(peerOpts());
      var peer = this.peer;
      peer.on('open', function () { if (peer === self.peer) self.dial(); });
      peer.on('disconnected', function () { if (peer === self.peer && !peer.destroyed) setTimeout(function () { try { peer.reconnect(); } catch (e) {} }, 1000); });
      peer.on('error', function (e) {
        if (peer !== self.peer) return;
        if (e.type === 'peer-unavailable') { self.setStatus('noroom'); self.retry(3000); return; }
        self.setStatus('reconnecting', e.type); self.retry(2500);
      });
    } else if (this.peer.open) this.dial();
    else if (this.peer.disconnected) try { this.peer.reconnect(); } catch (e) { this.peer.destroy(); this.peer = null; this.retry(500); }
  };
  Client.prototype.retry = function (ms) {
    var self = this; clearTimeout(this.rt); this.tries++;
    this.rt = setTimeout(function () { self.start(); }, Math.min(10000, ms + this.tries * 500));
  };
  Client.prototype.dial = function () {
    var self = this;
    if (this.conn) try { this.conn.close(); } catch (e) {}
    var conn = this.conn = this.peer.connect(C.peerPrefix + this.code, { reliable: true });
    var timer = setTimeout(function () { if (conn === self.conn && !conn.open) { self.setStatus('reconnecting', 'timeout'); self.retry(1000); } }, 9000);
    conn.on('open', function () {
      clearTimeout(timer); self.tries = 0; self.lastHeard = Date.now();
      self.setStatus('online');
      if (self.o.onOpen) self.o.onOpen();
    });
    conn.on('data', function (d) { self.lastHeard = Date.now(); if (self.o.onMessage) self.o.onMessage(d); });
    conn.on('close', function () { if (conn === self.conn) { self.setStatus('reconnecting', 'closed'); self.retry(800); } });
    conn.on('error', function () { if (conn === self.conn) { self.setStatus('reconnecting', 'error'); self.retry(800); } });
  };
  Client.prototype.reconnect = function () { clearTimeout(this.rt); if (this.conn) { var c = this.conn; this.conn = null; try { c.close(); } catch (e) {} } this.start(); };
  Client.prototype.send = function (m) { try { if (this.conn && this.conn.open) { this.conn.send(m); return true; } } catch (e) {} return false; };

  root.ZTNet = { Host: Host, Client: Client, makeCode: makeCode };
})(typeof window !== 'undefined' ? window : globalThis);
