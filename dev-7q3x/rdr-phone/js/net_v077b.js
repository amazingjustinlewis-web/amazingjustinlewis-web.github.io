/* RED DEER RICH v0.7.7b — phone <-> TV networking.
   Same API as js/net.js (Host, Client, LocalHost, LocalClient, makeCode).
   Extra reliability for phones that stall on "Connecting…" (seen on a Pixel
   while an older Samsung joined fine):
     - more STUN servers plus a free TURN (openrelay) so ICE can get through
       Private DNS / strict NATs
     - retry on the official PeerJS broker with a fresh peer
     - after a short stall, an on-screen diagnostic with likely causes and Retry
     - a Firebase Firestore relay fallback (project zero-to-phi) so the
       controller still works when WebRTC / the broker is blocked
   ?local=1 is unchanged (BroadcastChannel, same-browser only).
   ?nethelp=1 shows the diagnostic immediately (for screenshots / review).
   ?forceRelay=1 skips PeerJS and uses the cloud relay only. */
(function (root) {
  'use strict';
  var C = root.RDR_CONFIG;
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  function makeCode() { var s = ''; for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }

  var GOOGLE_STUN = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];
  var EXTRA_STUN = [
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];
  // Public openrelay TURN — TCP/TLS on 443 is the one most likely to get past
  // Private DNS, VPNs and locked-down networks. Rate-limited and not a promise.
  var OPENRELAY = [
    { urls: 'stun:openrelay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ];
  var ICE_SETS = [
    (C && C.iceServers && C.iceServers.length) ? C.iceServers.concat(GOOGLE_STUN.slice(2)) : GOOGLE_STUN,
    GOOGLE_STUN.concat(EXTRA_STUN).concat(OPENRELAY)
  ];
  var PEER_SERVERS = [
    null, // PeerJS default (0.peerjs.com)
    { host: '0.peerjs.com', port: 443, path: '/', secure: true, pingInterval: 5000 }
  ];
  function iceFor(tryNum) {
    return ICE_SETS[tryNum >= 1 ? 1 : 0];
  }
  function peerOpts(tryNum) {
    var dbg = typeof location !== 'undefined' && /[?&]debug=(\d)/.exec(location.search);
    var o = {
      debug: dbg ? +dbg[1] : 1,
      config: { iceServers: iceFor(tryNum), iceTransportPolicy: 'all', iceCandidatePoolSize: 4 }
    };
    var srv = PEER_SERVERS[tryNum % PEER_SERVERS.length];
    if (srv) { o.host = srv.host; o.port = srv.port; o.path = srv.path; o.secure = srv.secure; if (srv.pingInterval) o.pingInterval = srv.pingInterval; }
    return o;
  }
  function qFlag(name) {
    try { return new URLSearchParams(location.search).has(name); } catch (e) { return false; }
  }
  function forceRelay() { return qFlag('forceRelay') || qFlag('relay'); }
  function wantHelp() { return qFlag('nethelp'); }

  // ---------------------------------------------------------------- diagnostic panel
  var HELP_HTML = '<h3>Still connecting\u2026</h3>' +
    '<div class="route" data-route></div>' +
    '<ul>' +
    '<li><b>Private DNS</b> (AdGuard or NextDNS): set it to Automatic in your phone\u2019s network / Private DNS settings.</li>' +
    '<li><b>VPN or ad blocker</b>: turn it off and try again.</li>' +
    '<li>Try switching between <b>Wi-Fi and mobile data</b>.</li>' +
    '</ul>' +
    '<div class="actions"><button type="button" data-retry>Retry</button></div>';
  function ensureHelp(kind) {
    var el = document.getElementById('netHelp');
    if (!el && typeof document !== 'undefined') {
      el = document.createElement('div');
      el.id = 'netHelp';
      el.innerHTML = HELP_HTML;
      var join = document.getElementById('joinStatus');
      if (kind !== 'tv' && join && join.parentNode) join.parentNode.insertBefore(el, join.nextSibling);
      else document.body.appendChild(el);
    }
    if (el && kind === 'tv') el.classList.add('tv');
    return el;
  }
  function showHelp(kind, route, onRetry) {
    if (typeof document === 'undefined') return;
    var el = ensureHelp(kind);
    if (!el) return;
    var r = el.querySelector('[data-route]');
    if (r) r.textContent = route || '';
    var btn = el.querySelector('[data-retry]');
    if (btn) btn.onclick = function () { if (onRetry) onRetry(); };
    el.classList.add('show');
  }
  function hideHelp() {
    var el = typeof document !== 'undefined' && document.getElementById('netHelp');
    if (el) el.classList.remove('show');
  }

  // ---------------------------------------------------------------- Firebase relay (lazy)
  var FB_CFG = {
    apiKey: 'AIzaSyAPNpKNKZalEYWSMdao-jMEjgVtkYqsmnU',
    authDomain: 'zero-to-phi.firebaseapp.com',
    projectId: 'zero-to-phi',
    storageBucket: 'zero-to-phi.firebasestorage.app',
    messagingSenderId: '550444003584',
    appId: '1:550444003584:web:054ad6eb8cbb26315fc3e5'
  };
  var FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var fbHold = null;
  function loadFb() {
    if (fbHold) return fbHold;
    if (root.__RDR_FB) { fbHold = Promise.resolve(root.__RDR_FB); return fbHold; }
    fbHold = Promise.all([
      import(FB_SDK + 'firebase-app.js'),
      import(FB_SDK + 'firebase-auth.js'),
      import(FB_SDK + 'firebase-firestore.js')
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
      var app;
      try { app = appMod.getApp(); } catch (e) { app = appMod.initializeApp(FB_CFG); }
      var auth = authMod.getAuth(app);
      var db = fsMod.getFirestore(app);
      function ensureUser() {
        if (auth.currentUser) return Promise.resolve(auth.currentUser);
        return authMod.signInAnonymously(auth).then(function (c) { return c.user; });
      }
      var api = { app: app, auth: auth, db: db, fs: fsMod, ensureUser: ensureUser };
      root.__RDR_FB = api;
      return api;
    });
    return fbHold;
  }
  function roomRef(api, code) {
    return api.fs.doc(api.db, 'relays', String(code || '').toUpperCase());
  }
  function msgsRef(api, code) {
    return api.fs.collection(api.db, 'relays', String(code || '').toUpperCase(), 'm');
  }
  function pack(d) {
    try { return JSON.stringify(d); } catch (e) { return 'null'; }
  }
  function unpack(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  // A Host-shaped wrapper that fans out to PeerJS + the Firestore relay.
  // Connections from either path look the same: { connectionId, peer, open, send, close }.
  function RelayHost(peerHost, o) {
    this.peerHost = peerHost;
    this.o = o;
    this.code = peerHost.code;
    this.conns = peerHost.conns;
    this.status = peerHost.status;
    this.detail = peerHost.detail || '';
    this._unsub = null;
    this._seen = {};
    this._relayReady = false;
    this._relayErr = '';
    var self = this;
    var prev = o.onStatus;
    // keep status in sync with the PeerJS host unless the relay is the only live path
    o.onStatus = function (s, code, detail) {
      self.status = self._relayReady && s !== 'online' ? 'online' : s;
      self.detail = detail || '';
      self.code = code || self.code;
      if (prev) prev(self.status, self.code, self.detail);
    };
    this.startRelay();
  }
  RelayHost.prototype.setStatus = function (s, detail) {
    this.status = s; this.detail = detail || '';
    if (this.peerHost) { this.peerHost.status = s; this.peerHost.detail = this.detail; }
    if (s === 'online') hideHelp();
    if (this.o.onStatus) this.o.onStatus(s, this.code, detail);
  };
  RelayHost.prototype.startRelay = function () {
    var self = this;
    loadFb().then(function (api) {
      return api.ensureUser().then(function () { return api; });
    }).then(function (api) {
      self._api = api;
      var rref = roomRef(api, self.code);
      return api.fs.setDoc(rref, { kind: 'host', uid: api.auth.currentUser.uid, ts: api.fs.serverTimestamp() }).then(function () {
        self._relayReady = true;
        if (self.status !== 'online') self.setStatus('online', 'relay ready');
        self._beat = setInterval(function () {
          try { api.fs.setDoc(rref, { kind: 'host', uid: api.auth.currentUser.uid, ts: api.fs.serverTimestamp() }); } catch (e) {}
        }, 8000);
        self._unsub = api.fs.onSnapshot(msgsRef(api, self.code), function (snap) {
          snap.docChanges().forEach(function (ch) {
            if (ch.type !== 'added') return;
            var m = ch.doc.data() || {}, id = ch.doc.id;
            if (self._seen[id]) return;
            self._seen[id] = 1;
            if (m.to !== 'H') return;
            var cid = m.from;
            if (!cid) return;
            var c = self.conns[cid];
            var body = unpack(m.d);
            if (body && body.__hello) {
              if (c) { c.open = false; if (self.o.onClose) self.o.onClose(c); }
              c = self.makeConn(cid, api);
              self.conns[cid] = c;
              try { c.send({ __ack: 1 }); } catch (e) {}
              return;
            }
            if (!c) { c = self.makeConn(cid, api); self.conns[cid] = c; }
            var d = unpack(m.d);
            if (d && self.o.onMessage) self.o.onMessage(c, d);
            // tidy our inbox a little
            try { if (m.uid) {/* leave for sender to delete */} } catch (e) {}
          });
        }, function (err) {
          self._relayErr = (err && err.message) || 'relay error';
        });
      });
    }).catch(function (err) {
      self._relayErr = (err && (err.code || err.message)) || 'relay unavailable';
    });
  };
  RelayHost.prototype.makeConn = function (cid, api) {
    var self = this;
    var c = {
      connectionId: cid, peer: cid, open: true, via: 'relay',
      send: function (d) {
        if (!c.open || !api) return;
        api.fs.addDoc(msgsRef(api, self.code), {
          from: 'H', to: cid, d: pack(d), uid: api.auth.currentUser.uid, ts: api.fs.serverTimestamp()
        }).catch(function () {});
      },
      close: function () { c.open = false; }
    };
    return c;
  };
  RelayHost.prototype.send = function (conn, msg) {
    try { if (conn && conn.open) conn.send(msg); } catch (e) {}
  };
  RelayHost.prototype.open = function () { if (this.peerHost && this.peerHost.open) this.peerHost.open(); };
  RelayHost.prototype.destroy = function () {
    try { if (this._unsub) this._unsub(); } catch (e) {}
    clearInterval(this._beat);
    try { if (this.peerHost && this.peerHost.peer) this.peerHost.peer.destroy(); } catch (e) {}
  };

  function RelayClient(o, peerClient) {
    this.o = o; this.code = o.code; this.status = 'connecting'; this.detail = '';
    this.peerClient = peerClient || null;
    this.cid = 'R' + Math.random().toString(36).slice(2, 10);
    this._unsub = null; this._seen = {}; this._online = false;
    this.lastHeard = 0;
  }
  RelayClient.prototype.setStatus = function (s, d) {
    this.status = s; this.detail = d || '';
    if (this.o.onStatus) this.o.onStatus(s, d);
  };
  RelayClient.prototype.start = function () {
    var self = this;
    this.setStatus('connecting', 'cloud relay');
    loadFb().then(function (api) { return api.ensureUser().then(function () { return api; }); })
      .then(function (api) {
        self._api = api;
        var rref = roomRef(api, self.code);
        return api.fs.getDoc(rref).then(function (snap) {
          // A missing host doc usually means the TV has not published relay
          // rules yet, or the room is not open. We still listen + hello, and
          // let the TV pick us up if it is already listening.
          self._listen(api);
          self._hello(api);
          self._helloIv = setInterval(function () {
            if (!self._online) self._hello(api);
            else clearInterval(self._helloIv);
          }, 1200);
        });
      })
      .catch(function (err) {
        var msg = (err && (err.code || err.message)) || 'relay failed';
        self.setStatus('reconnecting', msg);
      });
  };
  RelayClient.prototype._hello = function (api) {
    var self = this;
    api.fs.addDoc(msgsRef(api, self.code), {
      from: self.cid, to: 'H', d: pack({ __hello: 1 }), uid: api.auth.currentUser.uid, ts: api.fs.serverTimestamp()
    }).catch(function (err) {
      var code = err && err.code;
      if (code === 'permission-denied') self._perm = true;
    });
  };
  RelayClient.prototype._listen = function (api) {
    var self = this;
    if (this._unsub) try { this._unsub(); } catch (e) {}
    this._unsub = api.fs.onSnapshot(msgsRef(api, self.code), function (snap) {
      snap.docChanges().forEach(function (ch) {
        if (ch.type !== 'added') return;
        var m = ch.doc.data() || {}, id = ch.doc.id;
        if (self._seen[id]) return;
        self._seen[id] = 1;
        if (m.to !== self.cid) return;
        var d = unpack(m.d);
        if (!self._online) {
          self._online = true; self.lastHeard = Date.now();
          self.setStatus('online', 'relay');
          if (self.o.onOpen) self.o.onOpen();
        }
        if (d && !d.__hello && !d.__ack) {
          self.lastHeard = Date.now();
          if (self.o.onMessage) self.o.onMessage(d);
        }
      });
    }, function (err) {
      self.setStatus('reconnecting', (err && err.message) || 'relay listen');
    });
  };
  RelayClient.prototype.send = function (m) {
    if (!this._api || !this._online) return false;
    var api = this._api, self = this;
    api.fs.addDoc(msgsRef(api, self.code), {
      from: self.cid, to: 'H', d: pack(m), uid: api.auth.currentUser.uid, ts: api.fs.serverTimestamp()
    }).catch(function () {});
    return true;
  };
  RelayClient.prototype.reconnect = function () {
    this._online = false;
    if (this._api) { this._listen(this._api); this._hello(this._api); }
    else this.start();
  };
  RelayClient.prototype.destroy = function () {
    this._online = false;
    clearInterval(this._helloIv);
    try { if (this._unsub) this._unsub(); } catch (e) {}
  };

  // ---------------------------------------------------------------- TV / host (PeerJS, wrapped with relay)
  function ztpWatch(h, kind) {
    var framed = false; try { framed = root.parent && root.parent !== root; } catch (e) { framed = true; }
    if (!framed || typeof setInterval !== 'function') return;
    var last = '';
    function post() { var n = h.conns ? Object.keys(h.conns).length : 0, G = root.RDR || root.ZT || root.LR, m = { ztp: kind, status: h.status, code: h.code, n: n, detail: h.detail || '', phase: root.ZTP_PHASE || (G && G.game && G.game.phase) || '', off: G && G.game && G.game.players ? G.game.players.filter(function (p) { return !p.ai && !p.left && p.connected === false; }).length : 0 }, k = JSON.stringify(m);
      if (k !== last || kind === 'room') { last = k; try { root.parent.postMessage(m, '*'); } catch (e) {} } }
    setTimeout(post, 0); setInterval(post, kind === 'room' ? 1500 : 700);
  }
  function Host(o) {
    ztpWatch(this, 'room');
    this.o = o; this.conns = {}; this.code = o.code || makeCode(); this.status = 'connecting'; this.tries = 0;
    this._helpAt = 0;
    var self = this;
    this._helpTimer = setTimeout(function () {
      if (self.status === 'online' || self.destroyed) return;
      self._helpAt = Date.now();
      showHelp('tv', 'Still opening the room on the phone link\u2026 trying backup routes.', function () { self.open(); });
    }, 6000);
    if (wantHelp()) showHelp('tv', 'Diagnostic preview.', function () {});
    if (forceRelay()) {
      this._relayOnly = true;
      if (typeof root.Peer !== 'function') this.setStatus('connecting', 'relay only');
      else this.setStatus('connecting', 'relay only');
      this._wrap = new RelayHost(this, o);
      return;
    }
    if (typeof root.Peer !== 'function') {
      this.setStatus('connecting', 'PeerJS did not load \u2014 trying cloud relay');
      this._wrap = new RelayHost(this, o);
      return;
    }
    this.open();
    this._wrap = new RelayHost(this, o);
  }
  Host.prototype.setStatus = function (s, detail) {
    if (s !== 'online' && this._wrap && this._wrap._relayReady) {
      this.status = 'online'; this.detail = detail || this.detail || 'relay';
      if (this.o.onStatus) this.o.onStatus('online', this.code, this.detail);
      return;
    }
    this.status = s; this.detail = detail || '';
    if (s === 'online') hideHelp();
    if (this.o.onStatus) this.o.onStatus(s, this.code, detail);
  };
  Host.prototype.open = function () {
    var self = this;
    if (this._relayOnly) return;
    if (this.peer) try { this.peer.destroy(); } catch (e) {}
    var opts = peerOpts(this.tries);
    var peer = this.peer = new root.Peer((this.o.prefix || C.peerPrefix) + this.code, opts);
    peer.on('open', function () { self.tries = 0; self.everOpen = true; self.setStatus('online'); });
    peer.on('connection', function (conn) {
      conn.on('open', function () { self.conns[conn.connectionId] = conn; });
      conn.on('data', function (d) { self.conns[conn.connectionId] = conn; if (self.o.onMessage) self.o.onMessage(conn, d); });
      conn.on('close', function () { delete self.conns[conn.connectionId]; if (self.o.onClose) self.o.onClose(conn); });
      conn.on('error', function () { delete self.conns[conn.connectionId]; if (self.o.onClose) self.o.onClose(conn); });
    });
    peer.on('disconnected', function () {
      if (peer !== self.peer) return;
      self.setStatus('reconnecting');
      setTimeout(function () { if (peer === self.peer && !peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 1500);
    });
    peer.on('error', function (e) {
      if (peer !== self.peer) return;
      if (e.type === 'unavailable-id') { if (self.everOpen) { self.setStatus('reconnecting', 'reclaiming room'); setTimeout(function () { if (peer === self.peer) self.open(); }, 3000); return; } if (self.o.fixedCode) { self.setStatus('offline', 'code taken'); return; } self.code = makeCode(); self.open(); return; }
      if (e.type === 'peer-unavailable') return;
      self.tries++;
      self.setStatus(self.tries > 3 ? 'offline' : 'reconnecting', e.type);
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed') {
        setTimeout(function () { if (peer === self.peer) { if (peer.destroyed) self.open(); else if (peer.disconnected) try { peer.reconnect(); } catch (x) { self.open(); } } }, Math.min(15000, 2000 * self.tries));
      }
    });
  };
  Host.prototype.send = function (conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) {} };

  // ---------------------------------------------------------------- phone / client (PeerJS, then relay fallback)
  function routeLabel(c) {
    if (!c) return 'Connecting\u2026';
    if (c._via === 'relay') return 'Trying a cloud relay (backup route)\u2026';
    if (c.tries >= 1) return 'Trying more connection routes (STUN / TURN)\u2026';
    return 'Connecting through the usual phone link\u2026';
  }
  function Client(o) {
    ztpWatch(this, 'client');
    this.o = o; this.code = o.code; this.status = 'idle'; this.lastHeard = 0; this.tries = 0;
    this._via = 'peer'; this._startedAt = Date.now(); this._relay = null; this._relayStarted = false;
    var self = this;
    this.ping = setInterval(function () {
      if (self.conn && self.conn.open) {
        self.send({ t: 'ping' });
        if (Date.now() - self.lastHeard > 12000) { self.setStatus('reconnecting', 'no answer'); self.reconnect(); }
      } else if (self._via === 'relay' && self._relay && self._relay._online) {
        self._relay.send({ t: 'ping' });
      }
    }, 4000);
    this._helpTimer = setTimeout(function () { self._maybeHelp(); }, 6000);
    this._helpWatch = setInterval(function () { self._maybeHelp(); }, 2000);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () {
      if (self.destroyed) return;
      if (document.visibilityState === 'visible' && !(self.conn && self.conn.open) && !(self._relay && self._relay._online)) self.reconnect();
      else if (document.visibilityState === 'visible') self.send({ t: 'ping' });
    });
    root.addEventListener && root.addEventListener('online', function () { if (!self.destroyed) self.reconnect(); });
    if (wantHelp()) {
      showHelp('phone', 'Diagnostic preview.', function () { self.reconnect(); });
    }
    if (forceRelay()) { this._startRelay('forced'); return; }
    this.start();
    // If PeerJS is still not online after 12s, start the relay in parallel.
    this._fbTimer = setTimeout(function () {
      if (self.destroyed || self.status === 'online' || self.status === 'noroom') return;
      self._startRelay('stall');
    }, 12000);
  }
  Client.prototype._maybeHelp = function () {
    if (this.destroyed || this.status === 'online' || this.status === 'noroom') { if (this.status === 'online') hideHelp(); return; }
    if (Date.now() - this._startedAt < 6000 && !wantHelp()) return;
    var self = this;
    var extra = routeLabel(this);
    if (this._relay && this._relay._perm) extra = 'Cloud relay is not open on this project yet (Firestore rules need a relays collection). ' + extra;
    showHelp('phone', extra, function () { self.reconnect(); });
  };
  Client.prototype._startRelay = function (why) {
    if (this._relayStarted || this.destroyed) return;
    this._relayStarted = true;
    this._via = 'relay';
    var self = this;
    var o = {
      code: this.code,
      onOpen: function () {
        if (self.status === 'online' && self.conn && self.conn.open) return; // PeerJS already won
        self._via = 'relay';
        self.setStatus('online', 'relay');
        if (self.o.onOpen) self.o.onOpen();
      },
      onMessage: function (d) {
        if (self._via !== 'relay' && self.conn && self.conn.open) return;
        self.lastHeard = Date.now();
        if (self.o.onMessage) self.o.onMessage(d);
      },
      onStatus: function (s, d) {
        if (s === 'online') return; // handled in onOpen
        if (self.status === 'online') return;
        self.setStatus(s, d || 'relay');
      }
    };
    this._relay = new RelayClient(o);
    this._relay.start();
  };
  Client.prototype.setStatus = function (s, d) {
    this.status = s; this.detail = d || '';
    if (s === 'online') hideHelp();
    if (this.o.onStatus) this.o.onStatus(s, d);
  };
  Client.prototype.start = function () {
    var self = this;
    if (this.destroyed) return;
    if (forceRelay()) { this._startRelay('forced'); return; }
    if (typeof root.Peer !== 'function') {
      this.setStatus('connecting', 'PeerJS did not load');
      this._startRelay('nopeer');
      return;
    }
    this.setStatus('connecting');
    if (!this.peer || this.peer.destroyed) {
      this.peer = new root.Peer(peerOpts(this.tries));
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
    if (this.tries >= 2 && !this._relayStarted) this._startRelay('retry');
    this.rt = setTimeout(function () { self.start(); }, Math.min(10000, ms + this.tries * 500));
  };
  Client.prototype.dial = function () {
    var self = this;
    if (this.conn) try { this.conn.close(); } catch (e) {}
    var conn = this.conn = this.peer.connect(C.peerPrefix + this.code, { reliable: true });
    var timer = setTimeout(function () { if (conn === self.conn && !conn.open) { self.setStatus('reconnecting', 'timeout'); self.retry(1000); } }, 9000);
    conn.on('open', function () {
      clearTimeout(timer); self.tries = 0; self.lastHeard = Date.now();
      self._via = 'peer';
      self.setStatus('online');
      if (self.o.onOpen) self.o.onOpen();
    });
    conn.on('data', function (d) { self.lastHeard = Date.now(); if (self.o.onMessage) self.o.onMessage(d); });
    conn.on('close', function () { if (conn === self.conn) { self.setStatus('reconnecting', 'closed'); self.retry(800); } });
    conn.on('error', function () { if (conn === self.conn) { self.setStatus('reconnecting', 'error'); self.retry(800); } });
  };
  Client.prototype.reconnect = function () {
    if (this.destroyed) return;
    this._startedAt = Date.now();
    clearTimeout(this.rt);
    if (this.conn) { var c = this.conn; this.conn = null; try { c.close(); } catch (e) {} }
    if (this._relay) { try { this._relay.reconnect(); } catch (e) {} }
    if (this.peer && this.tries >= 1) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.start();
  };
  Client.prototype.destroy = function () {
    this.destroyed = true; clearTimeout(this.rt); clearTimeout(this._fbTimer); clearTimeout(this._helpTimer); clearInterval(this.ping); clearInterval(this._helpWatch);
    try { if (this.conn) this.conn.close(); } catch (e) {}
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    try { if (this._relay) this._relay.destroy(); } catch (e) {}
    this.conn = null; this.peer = null;
    hideHelp();
  };
  Client.prototype.send = function (m) {
    try { if (this.conn && this.conn.open) { this.conn.send(m); return true; } } catch (e) {}
    if (this._relay && this._relay._online) return this._relay.send(m);
    return false;
  };

  // ---------------------------------------------------------------- local transport (tests / same-browser demo): BroadcastChannel
  // ?local=1 on the TV and the phones: no broker, no WebRTC. Only works for tabs of the same browser.
  function LocalHost(o) {
    ztpWatch(this, 'room');
    var self = this; this.o = o; this.code = o.code || makeCode(); this.conns = {}; this.status = 'connecting';
    this.bc = new BroadcastChannel('rdr-local-' + this.code);
    this.bc.onmessage = function (e) {
      var m = e.data || {}, c = self.conns[m.cid];
      if (m.k === 'hello') {
        if (c) { c.open = false; if (self.o.onClose) self.o.onClose(c); }
        c = self.conns[m.cid] = { connectionId: m.cid, peer: m.cid, open: true, send: function (d) { if (c.open) self.bc.postMessage({ k: 'to', cid: m.cid, d: d }); }, close: function () { c.open = false; } };
        self.bc.postMessage({ k: 'ok', cid: m.cid });
      } else if (m.k === 'data' && c) { if (self.o.onMessage) self.o.onMessage(c, m.d); }
      else if (m.k === 'bye' && c) { c.open = false; delete self.conns[m.cid]; if (self.o.onClose) self.o.onClose(c); }
    };
    setTimeout(function () { self.status = 'online'; if (o.onStatus) o.onStatus('online', self.code); }, 30);
  }
  LocalHost.prototype.send = function (conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) {} };
  LocalHost.prototype.open = function () {};
  function LocalClient(o) {
    ztpWatch(this, 'client');
    var self = this; this.o = o; this.code = o.code; this.cid = 'L' + Math.random().toString(36).slice(2, 10); this.status = 'connecting';
    this.bc = new BroadcastChannel('rdr-local-' + this.code);
    this.bc.onmessage = function (e) {
      var m = e.data || {}; if (m.cid !== self.cid) return;
      if (m.k === 'ok') { self.status = 'online'; if (o.onStatus) o.onStatus('online'); if (o.onOpen) o.onOpen(); }
      else if (m.k === 'to') { if (o.onMessage) o.onMessage(m.d); }
    };
    if (o.onStatus) o.onStatus('connecting');
    this.hello = setInterval(function () { if (self.status !== 'online') self.bc.postMessage({ k: 'hello', cid: self.cid }); else clearInterval(self.hello); }, 400);
    this.bc.postMessage({ k: 'hello', cid: this.cid });
    this.ping = setInterval(function () { if (self.status === 'online') self.send({ t: 'ping' }); }, 4000);
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', function () { if (self.status !== 'closed') try { self.bc.postMessage({ k: 'bye', cid: self.cid }); } catch (e) {} });
    if (wantHelp()) showHelp('phone', 'Local test mode \u2014 diagnostic preview.', function () {});
  }
  LocalClient.prototype.send = function (d) { if (this.status !== 'online') return false; this.bc.postMessage({ k: 'data', cid: this.cid, d: d }); return true; };
  LocalClient.prototype.reconnect = function () {};
  LocalClient.prototype.destroy = function () { clearInterval(this.ping); clearInterval(this.hello); this.status = 'closed'; this.bc.postMessage({ k: 'bye', cid: this.cid }); this.bc.close(); hideHelp(); };


  if (typeof document !== 'undefined') {
    function bootHelp() {
      if (!wantHelp()) return;
      var kind = document.getElementById('board') ? 'tv' : 'phone';
      showHelp(kind, 'Diagnostic preview.', function () {});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootHelp);
    else bootHelp();
  }

  root.RDRNet = { Host: Host, Client: Client, makeCode: makeCode, LocalHost: LocalHost, LocalClient: LocalClient };
})(typeof window !== 'undefined' ? window : globalThis);
