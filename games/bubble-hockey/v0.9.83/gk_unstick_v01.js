/* gk_unstick_v01.js
   Fix for the v0.9.80 claw / smother / dig-out pose getting stuck.

   Root cause:
   - sim_v0982 sets this.dig on a successful dig-out and only clears it in faceoff().
     After a rare (~4%) dig-out the puck is back in play, but st.dig stays set, so
     v0980 clawStep treats the goalie as "digging" for the rest of the play and
     keeps calling blendTo(G_clawL/R) / G_smother while he slides around.
   - clawStep also forces near=true whenever the puck is loose in his net box
     (inHisNet && loose), with no max duration.
   - On exit it only clears C.on — it never blendTo's G_ready. goalie_v0977 then
     keeps applying g.bhSlot every frame, so the crouch never ends, including
     through the next faceoff.

   This hook (does not edit those files):
   - expires this.dig ~0.7 s after it is set, and on pause / goal / faceoff
   - caps claw/smother at 1.2 s, then blends back to G_ready and clears bhSlot
     so GM2 can drive the stance again
   - hard-resets dig, gsm, _claw and bhSlot on every faceoff and after a goal
   ?gkunstick=0 disables.
*/
(function (root) {
  'use strict';
  if (/[?&]gkunstick=0(?:&|$)/.test(location.search || '')) return;
  var CLAW = { G_clawL: 1, G_clawR: 1, G_smother: 1 };
  var DIG_HOLD = 0.7;
  var CLAW_MAX = 1.2;
  var READY = 'G_ready';

  function hookSim() {
    var B = root.Bubble; if (!B || !B.Sim) return;
    var S = B.Sim.prototype;
    if (S._gkUnstick) return;
    S._gkUnstick = 1;
    function clearDig(sim) {
      sim.dig = null;
      sim._digHold = 0;
      if (sim.gsm) sim.gsm[0] = sim.gsm[1] = 0;
    }
    var oStep = S.step;
    S.step = function (dt) {
      var r = oStep.apply(this, arguments);
      if (this.dig) {
        this._digHold = (this._digHold || 0) + (dt || 0);
        if (this._digHold > DIG_HOLD || this.pause > 0 || this.pg || this.msg === 'FACE OFF' || this.msg === 'GOAL!') clearDig(this);
      } else this._digHold = 0;
      if (this.msg === 'FACE OFF' || this.msg === 'GOAL!' || this.pg) {
        if (this.gsm) this.gsm[0] = this.gsm[1] = 0;
      }
      return r;
    };
    var oFo = S.faceoff;
    S.faceoff = function () {
      var r = oFo.apply(this, arguments);
      clearDig(this);
      return r;
    };
    var oGoal = S.goal;
    S.goal = function () {
      var r = oGoal.apply(this, arguments);
      clearDig(this);
      return r;
    };
  }

  function teamOf(i) { return i < 6 ? 0 : 1; }

  function hardResetGoalie(view, i) {
    var k = view.pl && view.pl[i] && view.pl[i].userData.sk;
    if (!k || !k.gk) return;
    var g = k.gk;
    if (view._claw && view._claw[teamOf(i)]) {
      view._claw[teamOf(i)].on = 0;
      view._claw[teamOf(i)].t = 0;
    }
    g.bhSlot = null;
    g.bhT = 0;
    g.bhFrom = {};
    if (g.lab && CLAW[g.lab]) g.lab = READY;
  }

  function toReady(view, i, api) {
    var k = view.pl && view.pl[i] && view.pl[i].userData.sk;
    if (!k || !k.gk) return;
    if (api && api.blendTo) {
      try { api.blendTo(view, i, READY, 6); } catch (e) {}
    } else {
      k.gk.bhSlot = READY;
      k.gk.bhT = 0;
      k.gk.bhDur = 6 / 30;
    }
  }

  function hookView(R) {
    if (!R || !R.prototype || R.prototype._gkUnstick) return;
    R.prototype._gkUnstick = 1;
    var oGk = R.prototype.gkPose;
    R.prototype.gkPose = function (st, dt) {
      this._gkHold = this._gkHold || [{ t: 0, lock: 0, exiting: 0 }, { t: 0, lock: 0, exiting: 0 }];
      var reset = !!(st && (st.msg === 'FACE OFF' || st.msg === 'GOAL!' || st.pg));
      // Expire a stale dig on the snapshot *before* v0.9.80 clawStep reads it.
      if (st && st.dig) {
        var n = st.dig[0];
        this._digSeenN = this._digSeenN == null ? n : this._digSeenN;
        if (this._digSeenN !== n) { this._digSeenN = n; this._digSeenT = 0; }
        this._digSeenT = (this._digSeenT || 0) + (dt || 0);
        if (this._digSeenT > DIG_HOLD || reset) st.dig = null;
      } else this._digSeenT = 0;
      if (reset) {
        this._gkLock = [1, 1];
        if (st) st.dig = null;
      }
      if (oGk) oGk.call(this, st, dt);
      var api = root.BH_GOALIE;
      for (var t = 0; t < 2; t++) {
        var i = t * 6, k = this.pl && this.pl[i] && this.pl[i].userData.sk;
        if (!k || !k.gk) continue;
        var g = k.gk, H = this._gkHold[t], slot = g.bhSlot;
        if (reset) {
          hardResetGoalie(this, i);
          H.t = 0; H.exiting = 0;
          continue;
        }
        // Play is live again — drop the post-goal / faceoff lock unless a cap-exit is in progress.
        if (this._gkLock && !H.exiting) this._gkLock[t] = 0;
        if (CLAW[slot]) {
          H.t += dt || 0;
          if (H.t > CLAW_MAX) {
            this._gkLock = this._gkLock || [0, 0];
            this._gkLock[t] = 1;
            toReady(this, i, api);
            H.exiting = 1;
            H.t = 0;
          }
        } else {
          if (H.exiting && (!slot || slot === READY) && g.bhT >= (g.bhDur || 0)) {
            g.bhSlot = null;
            g.bhT = 0;
            H.exiting = 0;
            if (this._gkLock) this._gkLock[t] = 0;
          }
          if (!CLAW[slot]) H.t = 0;
        }
      }
    };
    // While a side is locked (capped or reset), ignore further claw/smother blendTo.
    var wrapBlend = function () {
      var api = root.BH_GOALIE; if (!api || api._gkUnstickBlend) return;
      var oBlend = api.blendTo;
      if (!oBlend) return;
      api._gkUnstickBlend = 1;
      api.blendTo = function (view, i, name, frames) {
        if (view && view._gkLock && CLAW[name] && view._gkLock[teamOf(i)]) return;
        return oBlend.call(this, view, i, name, frames);
      };
    };
    wrapBlend();
    var oRen = R.prototype.render;
    R.prototype.render = function () {
      wrapBlend();
      return oRen.apply(this, arguments);
    };
  }

  function boot() {
    hookSim();
    if (root.Bubble3D) hookView(root.Bubble3D);
    if (root.BHT && root.BHT.R3) hookView(root.BHT.R3.constructor);
  }
  boot();
  root.BH_GK_UNSTICK = { hook: boot, DIG_HOLD: DIG_HOLD, CLAW_MAX: CLAW_MAX };
})(window);
