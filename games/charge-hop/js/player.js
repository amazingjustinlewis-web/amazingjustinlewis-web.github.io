/* =====================================================================
   player.js - the one-button character.
   States:  idle -> charge -> air -> (idle | dizzy | dead) ; win
   Visual (sprite) states: idle, charge, jump, fling, land, dizzy, teeter,
   fall, splat, win  -> see SPRITE_MANIFEST.player in sprites.js
   ===================================================================== */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

class Player {
  constructor(idx) {
    this.idx = idx;
    this.name = CONFIG.player.names[idx];
    this.color = CONFIG.player.colors[idx];
    this.dark = CONFIG.player.darkColors[idx];
    this.palette = FIRE_PALETTES[idx];
    this.joined = false;
    this.reset(0, World.W / 2);
  }

  reset(row, x) {
    this.row = row; this.x = x;
    this.state = 'idle';
    this.chargeT = 0; this.chargeLevel = 0; this.fireAcc = 0;
    this.airT = 0; this.airDur = 0.2; this.fromRow = row; this.toRow = row; this.arc = 0; this.vxAir = 0; this.isFling = false;
    this.airDownAt = null; this.bufferedTapAt = null; this.lastJumpRows = 1;
    this.vx = 0; this.streak = 0;   // ground sideways velocity, tap streak
    this.isBounce = false; this.pendingStun = 0; this.hopParity = false; this.prevX = x;
    this.ride = null; this.rideOffset = 0; this.riderVx = 0; this.teeterT = 0; this.teeterSide = 1;
    this.dizzyT = 0; this.deathT = 0; this.deathCause = null; this.splashed = false; this.splatDir = 1;
    this.power = null;
    this.lastSafe = { row, x };
    this.deaths = 0; this.finished = false;
    this.t = 0; this.vis = 'idle'; this.visT = 0; this.landT = 99; this.blinkT = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.rust = 0; this.debris = null; this.assembleT = 0; this.water = null;
    // v3: open-straight auto-run, continuous-y hops (lava chutes), lava death
    this.runSpeed = 0; this.runTap = false; this.pendingLaunch = 0; this.lipShown = false;
    this.airFromY = null; this.airToY = 0; this.landY = null; this.lava = null; this.heat = 0;
    this.pressedThisRound = false; this.fadeOut = 0; this.satOut = false;
    Sfx.stopHum(this.idx);
  }

  /* ---------------- derived values ---------------- */
  get grounded() { return this.state === 'idle' || this.state === 'charge' || this.state === 'dizzy' || this.state === 'win'; }
  get alive() { return this.state !== 'dead'; }
  get maxLevel() { return this.power ? 2 : 1; }
  get fullTime() { return this.maxLevel === 2 ? CONFIG.charge.level2Time : CONFIG.charge.level1Time; }
  get overloadTime() { return this.fullTime + CONFIG.charge.overloadGrace; }
  levelFor(t) {
    const C = CONFIG.charge;
    if (t >= C.level2Time && this.maxLevel >= 2) return 2;
    if (t >= C.level1Time) return 1;
    return 0;
  }
  /** feet position on the ground plane (world) */
  get groundY() {
    if (this.state === 'air') {
      const u = clamp(this.airT / this.airDur, 0, 1);
      if (this.airFromY !== null) return lerp(this.airFromY, this.airToY, u);   // hops from/within a lava chute
      return lerp(World.feetY(this.fromRow), World.feetY(this.toRow), u);
    }
    if (this.ride && this.ride.isChunk) return this.ride.y + 3;                // riding a rock chunk down the chute
    if (this.state === 'dead' && this.lava) return this.lavaGround();
    return World.feetY(this.row);
  }
  get height() {
    if (this.state !== 'air') return 0;
    const u = clamp(this.airT / this.airDur, 0, 1);
    return this.arc * 4 * u * (1 - u);
  }
  /** how far up the level this player effectively is (target row while airborne) */
  get progressRow() { return this.state === 'air' ? this.toRow : this.row; }
  setVis(v) { if (this.vis !== v) { this.vis = v; this.visT = 0; } }

  /* ---------------- update ---------------- */
  update(dt, game) {
    this.t += dt; this.visT += dt; this.landT += dt; this.blinkT -= dt;
    if (this.state !== 'dead') {
      if (this.rust > 0) this.rust = Math.max(0, this.rust - dt / CONFIG.waterDeath.rustFade);   // rust wears off after a dunk
      if (this.heat > 0 && this.state !== 'dead') {                       // red-hot glow cools off (still smoking)
        this.heat = Math.max(0, this.heat - dt / CONFIG.lavaDeath.heatFade);
        if (this.heat > 0.15 && Math.random() < dt * 14 * this.heat) Effects.spawn('smoke', this.x, this.groundY - 22, 1);
      }
      if (this.assembleT > 0 && (this.assembleT -= dt) <= 0) { this.assembleT = 0; this.debris = null; }
      if (this.state !== 'idle' && this.assembleT > 0) { this.assembleT = 0; this.debris = null; }
    }
    if (this.power) {
      this.power.time -= dt;
      if (this.power.time <= 0) { this.power = null; Effects.text(this.x, this.groundY - 50, 'power faded', '#ccc', 11); }
    }
    if (this.runSpeed > 0) {   // open-straight momentum: settles toward cruise speed (drops fast above it, recovers slowly below)
      const R = CONFIG.run;
      if (this.runSpeed > R.cruise) this.runSpeed = Math.max(R.cruise, this.runSpeed - (this.runSpeed - R.cruise) * Math.min(1, R.decay * dt));
      else this.runSpeed = Math.min(R.cruise, this.runSpeed + R.recover * dt);
    }
    const canControl = game.state === 'play' && !this.finished;
    const events = canControl ? Input.poll(this.idx) : (Input.clear(this.idx), []);
    if (events.includes('down')) this.pressedThisRound = true;   // (idle players get dropped from 2P rounds - main.js)
    if (!canControl && this.state === 'charge') {   // round ended mid-charge: just stand down
      this.state = 'idle'; this.shakeX = this.shakeY = 0; Sfx.stopHum(this.idx);
    }
    for (const ev of events) this.handleEvent(ev, game);

    switch (this.state) {
      case 'idle':
        if (this.runSpeed > 0 && game.level.lanes[this.row].run && !this.ride) {   // (e.g. after dizzy) keep running
          if (game.state === 'play') { this.runHop(game); break; }
          this.runSpeed = 0;
        }
        if (this.streak > 0 && this.landT > CONFIG.streak.window) this.streak = 0;
        this.groundCheck(dt, game);
        if (this.state === 'idle') this.setVis(this.landT < CONFIG.jump.landTime ? 'land' : this.teeterT > 0 ? 'teeter' : 'idle');
        break;
      case 'charge':
        this.chargeT += dt;
        this.updateCharge(dt, game);
        if (this.state === 'charge') this.groundCheck(dt, game);
        break;
      case 'air':
        this.airT += dt;
        this.x += this.vxAir * dt;
        if (this.airT >= this.airDur) this.land(game);
        break;
      case 'dizzy':
        this.dizzyT -= dt;
        this.groundCheck(dt, game);
        if (this.state === 'dizzy' && this.dizzyT <= 0) { this.state = 'idle'; Input.requireFresh(this.idx); }
        break;
      case 'dead':
        this.deathT += dt;
        if (this.isWet) { this.updateWater(dt, game); break; }
        if (this.lava) { this.updateLava(dt, game); break; }
        if (!this.splashed && this.deathCause === 'carried' && this.deathT > 0.22) {
          this.splashed = true; this.splash();
        }
        if (this.debris) Characters.updateDebris(this, dt);
        if (this.deathT >= CONFIG.death.animTime + CONFIG.death.pauseTime) this.respawn(game);
        break;
      case 'win':
        this.groundCheck(dt, game);
        break;
    }
  }

  handleEvent(ev, game) {
    if (this.runSpeed > 0 && this.state === 'air') {   // open straight: a tap = long jump at the next footfall
      if (ev === 'down') this.runTap = true;
      return;
    }
    if (this.state === 'idle' && ev === 'down') this.beginCharge();
    else if (this.state === 'charge' && ev === 'up') this.release(game);
    else if (this.state === 'air') {
      if (ev === 'down') this.airDownAt = this.airT;
      else if (ev === 'up' && this.airDownAt !== null) { this.bufferedTapAt = this.airT; this.airDownAt = null; }
    }
  }

  groundCheck(dt, game) {
    const lane = game.level.lanes[this.row];
    this.prevX = this.x;
    if (!this.ride && this.vx !== 0) {   // sliding on solid ground: decay by the surface friction
      const hw = CONFIG.player.hitHalfWidth;
      this.x += this.vx * dt;
      this.vx -= this.vx * Math.min(1, lane.friction * dt);
      if (Math.abs(this.vx) < 2) this.vx = 0;
      if (this.x < hw || this.x > World.W - hw) { this.x = clamp(this.x, hw, World.W - hw); this.vx = 0; }
    }
    const res = lane.impl.grounded(lane, this, dt, game);
    if (res && res.die) this.die(res.die, game, res.by);
  }

  /* ---------------- charging ---------------- */
  beginCharge() {
    this.state = 'charge'; this.chargeT = 0; this.chargeLevel = 0; this.fireAcc = 0;
    this.setVis('charge');
  }

  updateCharge(dt, game) {
    const C = CONFIG.charge, I = CONFIG.input;
    const t = this.chargeT, full = this.fullTime;
    const lvl = this.levelFor(t);
    if (lvl > this.chargeLevel) {
      this.chargeLevel = lvl;
      Sfx.play('level');
      Effects.spawn('ring', this.x, this.groundY - 16, 1, { r0: 8, r1: 34 + lvl * 10, color: lvl === 2 ? '#ffffff' : this.color, life: 0.3, add: true });
      Effects.spawn('ember', this.x, this.groundY - 12, 6 + lvl * 4, { palette: this.palette });
    }
    if (t >= this.overloadTime) { this.overload(game); return; }
    // shaking: stronger with charge, violent during the overload warning
    const k = clamp(t / full, 0, 1);
    const ok = t > full ? clamp((t - full) / C.overloadGrace, 0, 1) : 0;
    const visible = t > I.tapThreshold;
    if (visible) this.streak = 0;   // charging breaks the tap rhythm
    const amp = !visible ? 0 : ok > 0 ? lerp(C.shakeFull, C.shakeOverload, ok * ok) : lerp(C.shakeBase, C.shakeFull, k);
    this.shakeX = (Math.random() * 2 - 1) * amp;
    this.shakeY = (Math.random() * 2 - 1) * amp * 0.5;
    if (visible) {
      Sfx.hum(this.idx, k, ok);
      const rate = ok > 0 ? C.fireRateMax * (1 + ok) : lerp(C.fireRateMin, C.fireRateMax, k * k);
      this.fireAcc += rate * dt;
      while (this.fireAcc >= 1) {
        this.fireAcc -= 1;
        Effects.spawn('fire', this.x + this.shakeX, this.groundY - Math.random() * (8 + 26 * k), 1, { palette: this.palette });
      }
    }
  }

  release(game) {
    const lvl = this.levelFor(this.chargeT);
    const rows = CONFIG.charge.rows[lvl];
    Sfx.stopHum(this.idx);
    this.shakeX = this.shakeY = 0;
    if (lvl === 2 && this.power) {
      this.power.uses--;
      if (this.power.uses <= 0) this.power = null;
    }
    const isTap = this.chargeT < CONFIG.input.tapThreshold;
    if (isTap) this.bumpStreak(); else this.streak = 0;
    Sfx.play(lvl === 0 ? 'hop' : lvl === 1 ? 'bigjump' : 'hugejump');
    Effects.spawn('dust', this.x, this.groundY, 3 + lvl * 4);
    if (lvl > 0) {
      Effects.spawn('ember', this.x, this.groundY - 6, 8 * lvl, { palette: this.palette });
      Effects.spawn('ring', this.x, this.groundY, 1, { r0: 6, r1: 26 + 14 * lvl, color: this.color, life: 0.3 });
    }
    this.jump(rows, game, false, isTap && this.streak >= 2);
  }

  /** A quick tap soon after landing grows the streak (shorter, snappier hops). */
  bumpStreak() {
    const S = CONFIG.streak;
    if (this.landT <= S.window) this.streak = Math.min(S.max, this.streak + 1);
    else this.streak = 0;
    if (this.streak >= 2) Effects.text(this.x, this.groundY - 52, 'x' + (this.streak + 1), this.color, 10 + this.streak, 0.5);
  }
  get streakMul() { return Math.max(CONFIG.streak.minAirMul, 1 - CONFIG.streak.perTap * this.streak); }

  overload(game) {
    const O = CONFIG.overload;
    Sfx.stopHum(this.idx);
    Sfx.play('overload');
    this.shakeX = this.shakeY = 0;
    Effects.spawn('ember', this.x, this.groundY - 14, 40, { palette: this.palette });
    Effects.spawn('ring', this.x, this.groundY - 14, 1, { r0: 10, r1: 80, color: '#fff3b0', life: 0.4, lineWidth: 5, add: true });
    Effects.spawn('dust', this.x, this.groundY, 10);
    Effects.text(this.x, this.groundY - 56, 'OVERLOAD!', '#ff5a3a', 15, 1.0);
    Camera.shake(CONFIG.shake.overload);
    game.closeCall(this, 'overload', true);
    Input.requireFresh(this.idx);   // they are still holding: ignore until released
    this.jump(O.flingRows, game, true);
    this.vxAir += (Math.random() * 2 - 1) * O.sideKick;
    game.stats.overloads++;
  }

  /* ---------------- jumping & landing ---------------- */
  jump(rows, game, fling, running = false) {
    const J = CONFIG.jump, O = CONFIG.overload;
    const lane = game.level.lanes[this.row];
    // lava chute: jumping off a rock chunk. In the lip zone it's the BIG LAUNCH; otherwise the flow carries the hop forward
    const chunk = this.ride && this.ride.isChunk ? this.ride : null;
    if (chunk && !fling && chunk.flow.inLip(chunk.y)) { this.chuteLaunch(game, true); return; }
    let chuteFromY = null, chuteToY = null, chuteAir = 0;
    if (chunk) {
      const n = Math.max(1, rows);
      chuteAir = fling ? O.flingAir : (J.airBase + J.airPerRow * n) * this.streakMul;
      chuteFromY = this.groundY;
      chuteToY = chuteFromY - n * World.T - chunk.flow.speedAt(chunk.y) * chuteAir;
    }
    let toRow = chunk ? clamp(World.rowAt(chuteToY), this.row, game.level.goalRow) : Math.min(this.row + rows, game.level.goalRow);
    // lanes can reshape a jump that ends in them (plains: vault over / bonk into fallen dominoes)
    const dest = game.level.lanes[toRow];
    if (dest.impl.planJump && !chunk) {
      const planned = dest.impl.planJump(dest, this, toRow, running && !fling, game);
      if (planned === 'bonk') { this.bonk(game); return; }
      toRow = planned;
    }
    lane.impl.takeoff(lane, this, game);
    this.fromRow = this.row;
    this.toRow = toRow;
    this.isBounce = false;
    this.hopParity = !this.hopParity;
    const n = Math.max(1, this.toRow - this.fromRow);
    const S = CONFIG.streak, sk = fling ? 0 : this.streak / S.max;
    this.airDur = fling ? O.flingAir : (J.airBase + J.airPerRow * n) * (fling ? 1 : this.streakMul);
    this.arc = fling ? O.flingArc : (J.arcBase + J.arcPerRow * n) * lerp(1, S.arcMul, sk);
    // free-runner momentum: keep whatever sideways speed you had (log ride or ground slide)
    this.vxAir = (this.ride ? this.riderVx : this.vx) * J.inheritRideVelocity;
    this.vx = 0;
    this.glanceT = 0;
    if (fling) this.streak = 0;
    this.ride = null; this.teeterT = 0;
    this.state = 'air'; this.airT = 0; this.isFling = fling; this.lastJumpRows = n;
    this.spinDir = Math.random() < 0.5 ? -1 : 1;
    this.airDownAt = null; this.bufferedTapAt = null;
    this.setVis(fling ? 'fling' : this.streak >= 2 ? 'run' : 'jump');
    game.stats.jumps[Math.min(2, n - 1)]++;
    if (chunk) {   // continuous-y hop (the chute keeps flowing under you)
      this.airDur = chuteAir; this.airFromY = chuteFromY;
      this.airToY = dest.flow === chunk.flow ? chuteToY : World.feetY(toRow);
      this.landY = this.airToY;
    } else { this.airFromY = null; this.landY = null; }
  }

  /** end of a lava chute: launched off the lip onto the ledge / into the open straight (big = timed jump in the lip zone) */
  chuteLaunch(game, big) {
    const c = this.ride, C = CONFIG.chute, R = CONFIG.run;
    if (!c || !c.isChunk) return;
    Sfx.stopHum(this.idx); this.shakeX = this.shakeY = 0;
    const fromY = this.groundY, toRow = c.flow.launchTarget(game, big);
    this.fromRow = this.row; this.toRow = toRow; this.isBounce = false; this.hopParity = !this.hopParity;
    this.airFromY = fromY; this.airToY = World.feetY(toRow); this.landY = null;
    this.airDur = C.launchAir + (big ? 0.1 : 0); this.arc = C.launchArc + (big ? 14 : 0);
    this.vxAir = this.riderVx * CONFIG.jump.inheritRideVelocity * C.launchCarry; this.vx = 0;
    this.ride = null; this.teeterT = 0; this.glanceT = 0;
    this.state = 'air'; this.airT = 0; this.isFling = false; this.lastJumpRows = Math.max(1, toRow - this.row);
    this.spinDir = Math.random() < 0.5 ? -1 : 1;
    this.airDownAt = null; this.bufferedTapAt = null; this.runTap = false; this.lipShown = false;
    this.pendingLaunch = R.launchSpeed + (big ? R.launchBonus : 0);
    this.launches = (this.launches || 0) + 1; this.lastLaunchBig = big;
    this.setVis('jump');
    Sfx.play(big ? 'hugejump' : 'launch');
    Effects.spawn('lavapop', this.x, fromY, big ? 18 : 10);
    Effects.spawn('ring', this.x, fromY - 2, 1, { r0: 4, r1: big ? 40 : 28, color: '#ffb02e', life: 0.4 });
    if (!(big && game.closeCall(this, 'big launch!'))) Effects.text(this.x, fromY - 56, big ? 'BIG LAUNCH!' : 'LAUNCH!', big ? '#ffe14d' : '#ffb02e', big ? 15 : 12, 0.9);
    Camera.shake(big ? 2.5 : 1.5);
  }

  /* ---------------- open straights (v3): auto-run with momentum ---------------- */
  enterRun(lane, res, game) {
    const R = CONFIG.run;
    if (game.state !== 'play') { this.stopRun(); return false; }
    if (!(this.runSpeed > 0)) {
      this.runSpeed = this.pendingLaunch || R.entrySpeed;
      this.runEntry = { row: this.row, speed: this.runSpeed, launched: !!this.pendingLaunch, t: game.time };   // (stats / tests)
      Effects.text(this.x, this.groundY - 54, 'RUN!', this.color, 12, 0.6);
    }
    this.pendingLaunch = 0;
    if (res.slow) this.runSlow(game);
    game.checkPickups(this);
    const tapped = this.runTap || this.bufferedTapAt !== null || this.airDownAt !== null;
    this.runTap = false; this.bufferedTapAt = null; this.airDownAt = null;
    if (tapped) this.longJump(game); else this.runHop(game);
    return true;
  }
  /** one stride forward (a quick low hop); runs off the end onto safe ground and stops there */
  runHop(game) {
    const next = game.level.lanes[this.row + 1];
    if (!next || !(next.run || (next.impl.safe && !next.flow))) { this.stopRun(); return; }
    this.jump(1, game, false, false);
    if (this.state !== 'air') return;
    this.airDur = 1 / this.runSpeed; this.arc = CONFIG.run.hopArc; this.setVis('run');
    this.vxAir *= Math.exp(-CONFIG.run.sideDrag * this.airDur);   // sideways momentum fades while running
  }
  /** tap while running: a long, fast jump (clears fallen dominoes / boulders) and a speed boost */
  longJump(game) {
    const R = CONFIG.run, lane = game.level.lanes[this.row], reg = lane.region;
    this.runSpeed = Math.min(R.max, this.runSpeed + R.tapBoost);
    const exit = reg ? reg.startRow + reg.rows : this.row + 1;
    const rows = Math.max(1, Math.min(R.longJumpRows, exit - this.row));
    this.jump(rows, game, false, false);
    if (this.state !== 'air') return;
    this.airDur = clamp(rows / (this.runSpeed * R.longJumpK), R.longAirMin, R.longAirMax);
    this.arc = R.longArc; this.setVis('jump');
    this.vxAir *= Math.exp(-R.sideDrag * this.airDur);
    this.longJumps = (this.longJumps || 0) + 1;
    Sfx.play('bigjump');
    Effects.spawn('dust', this.x, World.feetY(this.fromRow), 6);
  }
  runSlow(game) {
    const R = CONFIG.run;
    this.runSpeed = Math.max(R.min, this.runSpeed * R.slowMul);
    this.slowHits = (this.slowHits || 0) + 1;
    Sfx.play('thud');
    Effects.spawn('dust', this.x, this.groundY - 2, 8);
    Effects.text(this.x, this.groundY - 50, 'slow!', '#ffd0a0', 10, 0.5);
  }
  stopRun() {
    if (this.runSpeed > 0) Effects.spawn('dust', this.x, this.groundY - 2, 6);
    this.runSpeed = 0; this.runTap = false; this.pendingLaunch = 0;
  }

  /** ran straight into something low (a fallen domino): stop dead, lose the streak */
  bonk(game) {
    this.state = 'idle'; this.landT = 0; this.streak = 0;   // (vx may carry a sideways glance from the lane)
    this.setVis('land');
    Sfx.play('thud');
    Effects.spawn('dust', this.x, this.groundY - 4, 5);
    Effects.text(this.x, this.groundY - 52, 'BONK', '#fff', 11, 0.6);
    Camera.shake(1);
  }

  /** landing was blocked: hop back to the row we came from (then a short stun) */
  bounceBack(game, stun) {
    const back = this.fromRow;
    this.fromRow = this.row; this.toRow = back;
    this.airDur = 0.22; this.arc = 10; this.airT = 0; this.vxAir = 0;
    this.state = 'air'; this.isFling = false; this.isBounce = true; this.pendingStun = stun || 0;
    this.streak = 0; this.airDownAt = null; this.bufferedTapAt = null;
    this.setVis('jump');
  }

  /** gentle stun (domino bumps): stars, input ignored briefly */
  stun(t, text) {
    if (!(this.state === 'idle' || this.state === 'charge' || this.state === 'dizzy') || t <= 0) return;
    if (this.state === 'charge') Sfx.stopHum(this.idx);
    this.state = 'dizzy'; this.dizzyT = Math.max(this.dizzyT || 0, t); this.streak = 0; this.shakeX = this.shakeY = 0;
    this.setVis('dizzy');
    if (text) Effects.text(this.x, this.groundY - 54, text, '#ffe14d', 11, 0.7);
  }

  /** catch-up teleport for a player left far behind (not a death) */
  pullTo(row, x, game) {
    Sfx.stopHum(this.idx);
    this.row = row; this.x = x; this.state = 'idle'; this.ride = null; this.vx = 0; this.teeterT = 0; this.streak = 0;
    this.lastSafe = { row, x }; this.blinkT = 1.0; this.landT = 99;
    this.stopRun(); this.airFromY = null; this.landY = null; this.lipShown = false;
    this.setVis('idle');
    Sfx.play('catchup');
    Effects.spawn('sparkle', this.x, this.groundY - 16, 16, { color: this.color });
    Effects.text(this.x, this.groundY - 56, 'CATCH UP!', this.color, 13, 1.2);
    Input.requireFresh(this.idx);
  }

  land(game) {
    const R = CONFIG.river, hw = CONFIG.player.hitHalfWidth;
    this.row = this.toRow;
    this.state = 'idle'; this.landT = 0;
    const lane = game.level.lanes[this.row];
    if (lane.type !== 'river') {
      if (this.x < hw || this.x > World.W - hw) { this.x = clamp(this.x, hw, World.W - hw); this.vxAir = 0; }
    }
    const res = lane.impl.land(lane, this, game) || { ok: true };
    this.airFromY = null;
    if (res.die) { this.die(res.die, game, res.by); return; }
    this.landY = null; this.lipShown = false;
    if (res.bounce && !this.isBounce) { this.bounceBack(game, res.stun); return; }
    if (this.isBounce) {   // finished hopping back after a blocked landing
      this.isBounce = false; this.landT = 0; this.setVis('land'); this.vx = 0;
      if (res.ride) { this.ride = res.ride; this.rideOffset = this.x - res.ride.x; this.riderVx = res.ride.vx; } else this.ride = null;
      if (lane.impl.respawn) this.lastSafe = { row: this.row, x: this.x };
      if (this.pendingStun > 0) this.stun(this.pendingStun);
      return;
    }
    if (res.ride) {
      this.ride = res.ride;
      this.rideOffset = this.x - res.ride.x;
      this.riderVx = res.ride.vx + (this.vxAir - res.ride.vx) * R.landingSlide;
      this.vx = 0;
    } else { this.ride = null; this.vx = this.vxAir; }   // slide on with your momentum (decays by lane friction)
    this.vxAir = 0;
    if (lane.impl.respawn) this.lastSafe = { row: this.row, x: this.x };
    const striding = lane.run && this.runSpeed > 0 && this.lastJumpRows === 1;
    if (striding) { if (Math.random() < 0.5) Effects.spawn('dust', this.x, this.groundY, 2); }
    else Effects.spawn(lane.type === 'river' ? 'bumpspark' : lane.type === 'chute' ? 'lavapop' : 'dust', this.x, this.groundY, 4 + this.lastJumpRows * 2 + (this.streak >= 2 ? 3 : 0));
    Sfx.play(striding ? 'patter' : res.ride ? (res.ride.isChunk ? 'rockland' : 'logland') : 'land');
    if (this.lastJumpRows >= 3) Camera.shake(CONFIG.shake.land3);
    this.setVis('land');

    if (lane.impl.goal) { this.stopRun(); game.onGoal(this); return; }
    if (lane.run && !this.isFling) { if (this.enterRun(lane, res, game)) return; }
    else if (!lane.run) this.stopRun();
    if (this.isFling) {
      this.state = 'dizzy'; this.dizzyT = CONFIG.overload.dizzyTime; this.setVis('dizzy');
      return;
    }
    // input buffering: a tap made just before landing hops right away; a held press starts charging
    const bufWin = CONFIG.input.bufferWindow;
    if (this.bufferedTapAt !== null && this.airDur - this.bufferedTapAt <= bufWin) {
      this.bufferedTapAt = null;
      this.bumpStreak();
      Sfx.play('hop');
      this.jump(1, game, false, this.streak >= 2);
    } else if (this.airDownAt !== null && Input.isHeld(this.idx)) {
      this.beginCharge();   // still holding a press made mid-air: charging starts on landing
    }
  }

  /* ---------------- death & respawn ---------------- */
  die(cause, game, by) {
    if (this.state === 'dead') return;
    Sfx.stopHum(this.idx);
    this.state = 'dead'; this.deathCause = cause; this.deathT = 0; this.splashed = false;
    this.deaths++; this.shakeX = this.shakeY = 0; this.streak = 0; this.vx = 0;
    const gy0 = this.landY !== null ? this.landY : this.groundY;   // (before the ride is dropped: chunk / chute positions)
    this.ride = null; this.debris = null; this.assembleT = 0; this.water = null; this.lava = null;
    this.stopRun(); this.airFromY = null; this.landY = null; this.lipShown = false;
    if (cause === 'lava') {     // lava: red-hot & sizzling, then hops out smoking (see updateLava / drawLava)
      this.lava = { x: this.x, y: gy0, hopped: false, near: Math.abs(this.lastSafe.row - World.rowAt(gy0)) <= 12 };
      this.setVis('burn');
      Sfx.play('sizzle');
      Effects.spawn('lavapop', this.x, gy0, 18);
      Effects.spawn('smoke', this.x, gy0 - 12, 6);
      Effects.spawn('ring', this.x, gy0 - 2, 1, { r0: 4, r1: 36, color: '#ffb02e', life: 0.45 });
      Effects.text(this.x, gy0 - 58, 'SIZZLE!', '#ffb02e', 20, 1.0);
      Camera.shake(2);
    } else if (cause === 'splat') {
      this.splatDir = by ? Math.sign(by.vx) || 1 : 1;
      this.setVis('splat');
      Sfx.play('splat');
      if (Characters.robots && !Characters.hasArt(this, 'splat')) {   // robot proxies come apart into parts
        Characters.spawnDebris(this);
        Sfx.play('clank');
        Effects.spawn('splat', this.x, this.groundY - 12, 14, { color: '#ffe9a0' });
        Effects.spawn('decal', this.x, this.groundY - 4, 4, { color: '#3a3a3a' });
      } else {
        Effects.spawn('splat', this.x, this.groundY - 8, 22, { color: this.color });
        Effects.spawn('decal', this.x, this.groundY - 4, 9, { color: this.dark });
      }
      Effects.spawn('ring', this.x, this.groundY - 8, 1, { r0: 6, r1: 44, color: '#fff', life: 0.25 });
      Effects.text(this.x, this.groundY - 50, Characters.robots ? 'KA-CLANK!' : 'SPLAT!', '#ff6060', 14, 0.9);
    } else if (this.isWet) {   // water: big cartoon splash, sink (rusting), swim back up, pop out
      this.setVis('fall');
      this.water = { x: this.x, side: this.teeterSide || 1, stage: 0 };
      if (cause === 'drown') { this.splashed = true; this.bigSplash(); }
    } else {
      this.setVis('fall');
      Effects.text(this.x, this.groundY - 50, 'SPLASH!', '#9fd6ff', 14, 0.9);
    }
    game.onDeath(this, cause);
  }

  splash() {
    Sfx.play('splash');
    Effects.spawn('splash', this.x, this.groundY - 4, 24);
    Effects.spawn('ring', this.x, this.groundY - 2, 1, { r0: 4, r1: 30, color: '#d9f2ff', life: 0.5 });
    Effects.spawn('ring', this.x, this.groundY - 2, 1, { r0: 2, r1: 18, color: '#ffffff', life: 0.35 });
  }

  get isWet() { return this.deathCause === 'drown' || this.deathCause === 'fall'; }

  /** big cartoon splash + the SPLASH! pop-up */
  bigSplash() {
    Sfx.play('bigsplash');
    Effects.spawn('splash', this.x, this.groundY - 4, 34);
    Effects.spawn('spout', this.x, this.groundY - 4, 16);
    Effects.spawn('ring', this.x, this.groundY - 2, 1, { r0: 4, r1: 46, color: '#d9f2ff', life: 0.6 });
    Effects.spawn('ring', this.x, this.groundY - 2, 1, { r0: 2, r1: 28, color: '#ffffff', life: 0.45 });
    Effects.text(this.x, this.groundY - 58, 'SPLASH!', '#bfe8ff', 20, 1.0);
    Camera.shake(2);
  }

  /** water death timeline: [tip] -> sink (rusting, bubbles) -> swim back up -> pop out & shake off -> respawn */
  waterPhase() {
    const W = CONFIG.waterDeath, t0 = this.deathCause === 'fall' ? W.tip : 0, d = this.deathT - t0;
    if (d < 0) return { ph: 'tip', k: this.deathT / W.tip, d };
    if (d < W.sink) return { ph: 'sink', k: d / W.sink, d };
    if (d < W.sink + W.rise) return { ph: 'rise', k: (d - W.sink) / W.rise, d };
    return { ph: 'pop', k: Math.min(1, (d - W.sink - W.rise) / W.pop), d };
  }
  updateWater(dt, game) {
    const W = CONFIG.waterDeath, w = this.water, P = this.waterPhase(), gy = this.groundY;
    if (!this.splashed && P.ph !== 'tip') { this.splashed = true; this.bigSplash(); }
    if (P.ph !== 'tip') this.rust = Math.max(this.rust || 0, Math.min(1, P.d / (W.sink * 0.9)));
    if ((P.ph === 'sink' || P.ph === 'rise') && Math.random() < dt * (P.ph === 'sink' ? 16 : 10)) Effects.spawn('bubble', w.x, gy - 6, 1);
    if (P.ph === 'rise' && w.stage < 1) { w.stage = 1; this.setVis('swim'); Sfx.play('bloop'); }
    if (P.ph === 'pop' && w.stage < 2) {
      w.stage = 2; this.setVis('jump'); Sfx.play('popout');
      Effects.spawn('splash', w.x, gy - 4, 16);
      Effects.spawn('ring', w.x, gy - 2, 1, { r0: 3, r1: 26, color: '#ffffff', life: 0.35 });
    }
    if (P.ph === 'pop' && P.k > 0.25 && Math.random() < dt * 40) {     // shaking off: droplets fly
      const pos = this.popPos(P.k);
      Effects.spawn('droplet', pos.x, pos.y - 20, 2);
    }
    if (P.ph === 'pop' && P.k >= 1) this.respawn(game);
  }
  /** where the character is during the pop-out hop: from the water back to the last safe spot (if close) */
  popPos(k) {
    const w = this.water, near = Math.abs(this.lastSafe.row - this.row) <= 5;
    const x1 = near ? this.lastSafe.x : w.x, y0 = this.groundY, y1 = near ? World.feetY(this.lastSafe.row) : y0;
    const e = k * k * (3 - 2 * k);
    return { x: w.x + (x1 - w.x) * e, y: y0 + (y1 - y0) * e - Math.sin(Math.PI * k) * 26 };
  }

  /** lava death timeline: scorch (sink a little, heat to red-hot, sizzle) -> hop out smoking toward the last checkpoint */
  lavaPhase() {
    const L = CONFIG.lavaDeath, d = this.deathT;
    return d < L.scorch ? { ph: 'scorch', k: d / L.scorch } : { ph: 'hop', k: Math.min(1, (d - L.scorch) / L.hop) };
  }
  lavaTarget() {
    const lv = this.lava;
    return lv.near ? { x: this.lastSafe.x, y: World.feetY(this.lastSafe.row) } : { x: lv.x, y: lv.y };
  }
  lavaGround() {
    const P = this.lavaPhase(), lv = this.lava;
    if (P.ph === 'scorch') return lv.y;
    const T = this.lavaTarget(), e = P.k * P.k * (3 - 2 * P.k);
    return lv.y + (T.y - lv.y) * e;
  }
  updateLava(dt, game) {
    const L = CONFIG.lavaDeath, lv = this.lava, P = this.lavaPhase();
    this.heat = Math.max(this.heat, Math.min(1, this.deathT / (L.scorch * 0.7)));
    if (P.ph === 'scorch') {
      if (Math.random() < dt * 26) Effects.spawn('smoke', lv.x + (Math.random() - 0.5) * 12, lv.y - 14 - Math.random() * 16, 1);
      if (Math.random() < dt * 18) Effects.spawn('lavapop', lv.x, lv.y - 2, 1);
    } else {
      if (!lv.hopped) {
        lv.hopped = true; this.setVis('jump'); Sfx.play('popout');
        Effects.spawn('lavapop', lv.x, lv.y, 12);
        Effects.spawn('ring', lv.x, lv.y - 2, 1, { r0: 3, r1: 26, color: '#ff8a2a', life: 0.35 });
      }
      const T = this.lavaTarget(), e = P.k * P.k * (3 - 2 * P.k);
      const x = lv.x + (T.x - lv.x) * e, y = this.lavaGround() - Math.sin(Math.PI * P.k) * 40;
      if (Math.random() < dt * 40) Effects.spawn('smoke', x, y - 18, 1);   // smoke trail
      if (P.k >= 1) this.respawn(game);
    }
  }

  respawn(game) {
    this.lava = null; this.stopRun(); this.airFromY = null; this.landY = null; this.lipShown = false;
    if (this.debris) { this.assembleT = CONFIG.characters.reassembleTime; Sfx.play('reassemble'); }
    this.water = null;
    this.row = this.lastSafe.row; this.x = this.lastSafe.x;
    this.state = 'idle'; this.ride = null; this.teeterT = 0; this.vxAir = 0;
    this.blinkT = CONFIG.player.respawnBlink; this.landT = 99;
    this.setVis('idle');
    Sfx.play('respawn');
    Effects.spawn('sparkle', this.x, this.groundY - 16, 12, { color: this.color });
    Input.requireFresh(this.idx);
  }

  grantPower() {
    this.power = { time: CONFIG.powerup.duration, uses: CONFIG.powerup.uses, max: CONFIG.powerup.duration };
    Sfx.play('powerup');
    Effects.spawn('sparkle', this.x, this.groundY - 16, 20, { color: '#ffe14d' });
    Effects.spawn('ring', this.x, this.groundY - 16, 1, { r0: 8, r1: 50, color: '#ffe14d', life: 0.4, add: true });
    Effects.text(this.x, this.groundY - 54, 'TRIPLE JUMP!', '#ffe14d', 14, 1.3);
  }

  win() {
    this.state = 'win'; this.finished = true;
    Sfx.stopHum(this.idx);
    this.setVis('win');
  }

  /* ---------------- drawing ---------------- */
  draw(ctx, game) {
    const J = CONFIG.jump, C = CONFIG.charge;
    if (this.state === 'dead' && this.debris) { Characters.drawDebris(ctx, this); return; }   // robot in pieces
    if (this.state === 'dead' && this.isWet && this.water) { this.drawWater(ctx); return; }
    if (this.state === 'dead' && this.lava) { this.drawLavaDeath(ctx); return; }
    if (this.state === 'dead' && this.deathT > CONFIG.death.animTime) return;
    if (this.assembleT > 0 && this.debris) {                                                  // parts snapping back together
      const k = 1 - this.assembleT / CONFIG.characters.reassembleTime;
      if (k < 0.85) { Characters.drawAssemble(ctx, this, k / 0.85); return; }
    }
    let alpha = 1;
    if (this.blinkT > 0 && Math.floor(this.t * 18) % 2) alpha = 0.35;
    const gx = this.x, gy = this.groundY;
    let h = this.height, sx = 1, sy = 1, rot = 0, ox = this.shakeX, oy = this.shakeY;
    const pose = { crouch: 0.05, armL: 0.35, armR: 0.35, legSpread: 5, knee: 0, lean: 0, face: 'normal', bob: 0 };

    // ----- per-state pose & squash/stretch -----
    if (this.state === 'air') {
      const u = clamp(this.airT / this.airDur, 0, 1);
      const s = 1 + J.apexScale * 4 * u * (1 - u) * Math.min(1, this.lastJumpRows / 2 + 0.3);
      sx = sy = s;
      if (u < 0.3) { const k = 1 - u / 0.3; sy *= 1 + J.takeoffStretch * k; sx *= 1 - J.takeoffStretch * 0.45 * k; }
      else if (u > 0.82) { sy *= 1.06; sx *= 0.96; }
      pose.armL = pose.armR = lerp(2.7, 2.0, u);
      pose.knee = Math.sin(u * Math.PI) * 1; pose.legSpread = 4; pose.crouch = 0.15 * Math.sin(u * Math.PI);
      pose.face = 'happy';
      if ((this.streak >= 2 || (this.runSpeed > 0 && this.vis === 'run')) && !this.isFling) {   // pitter-patter run: alternating stride, pumping arms
        const st = (this.hopParity ? 1 : -1) * Math.sin(u * Math.PI);
        pose.stride = st; pose.knee = 0.5; pose.crouch = 0.12; pose.legSpread = 4;
        pose.armL = 0.5 + st * 0.7; pose.armR = 0.5 - st * 0.7;
        pose.face = 'grit';
      }
      if (this.isFling) {
        rot = this.spinDir * CONFIG.overload.spins * Math.PI * 2 * u;
        pose.armL = 1.6 + Math.sin(this.t * 30) * 0.8; pose.armR = 1.6 - Math.sin(this.t * 30) * 0.8;
        pose.legSpread = 9; pose.face = 'shock';
      }
    } else if (this.state === 'charge') {
      const t = this.chargeT, full = this.fullTime;
      const vis = clamp((t - CONFIG.input.tapThreshold * 0.5) / 0.12, 0, 1);  // crouch eases in after a tap would have fired
      const k = clamp(t / full, 0, 1);
      const ok = t > full ? clamp((t - full) / C.overloadGrace, 0, 1) : 0;
      pose.crouch = lerp(0.05, 0.25 + C.crouchMax * k, vis);
      pose.armL = pose.armR = lerp(0.35, 0.9 + 0.5 * k + ok * Math.sin(this.t * 50) * 0.3, vis);
      pose.legSpread = 5 + 4 * k * vis; pose.knee = 0.6 * k * vis;
      pose.face = ok > 0 ? 'strain' : k > 0.4 ? 'grit' : 'normal';
      sx = 1 + 0.08 * k * vis; sy = 1 - 0.06 * k * vis;
      if (this.teeterT > 0) rot = this.teeterSide * (0.15 + Math.sin(this.t * 26) * 0.08);
    } else if (this.state === 'dizzy') {
      rot = Math.sin(this.t * 9) * 0.2;
      pose.armL = 0.6 + Math.sin(this.t * 7) * 0.4; pose.armR = 0.6 - Math.sin(this.t * 7) * 0.4;
      pose.face = 'dizzy'; pose.crouch = 0.12;
    } else if (this.state === 'dead') {
      const d = this.deathT;
      if (this.deathCause === 'splat') {
        pose.face = 'dead'; pose.armL = pose.armR = 1.7; pose.legSpread = 11;
        const k = Math.min(1, d / 0.08);
        sy = lerp(1.2, 0.32, k); sx = lerp(0.8, 1.45, k);
        alpha *= d > 0.5 ? Math.max(0, 1 - (d - 0.5) / 0.3) : 1;
      } else {
        const side = this.teeterSide || 1;
        const tip = Math.min(1, d / 0.22);
        rot = side * tip * 1.3;
        pose.face = 'shock'; pose.armL = pose.armR = 2.6 + Math.sin(this.t * 30) * 0.3;
        oy += Math.max(0, d - 0.15) * 30;
        const sink = clamp((d - 0.2) / 0.4, 0, 1);
        sx = sy = 1 - sink * 0.75; alpha *= 1 - sink;
        if (this.deathCause === 'drown') { rot = 0; sx = sy = 1 - clamp(d / 0.4, 0, 1) * 0.8; alpha = 1 - clamp(d / 0.4, 0, 1); }
      }
    } else if (this.state === 'win') {
      h = Math.abs(Math.sin(this.t * 7)) * 10;
      pose.armL = 2.7 + Math.sin(this.t * 14) * 0.25; pose.armR = 2.7 - Math.sin(this.t * 14) * 0.25;
      pose.face = 'happy';
    } else { // idle (+ land / teeter)
      pose.crouch = 0.04 + Math.sin(this.t * 3 + this.idx) * 0.03;
      pose.armL = 0.32 + Math.sin(this.t * 2.2) * 0.06; pose.armR = 0.32 - Math.sin(this.t * 2.2) * 0.06;
      if (this.landT < J.landTime) {
        const k = this.landT / J.landTime, q = (1 - k) * (1 - k);
        sy = 1 - J.landSquash * q; sx = 1 + J.landSquash * 0.7 * q;
        pose.crouch = 0.4 * q; pose.armL = pose.armR = 0.9 * q + 0.3;
      }
      if (this.teeterT > 0) {
        rot = this.teeterSide * (0.3 + Math.sin(this.t * 28) * 0.12);
        pose.armL = 1.6 + Math.sin(this.t * 22) * 1.3; pose.armR = 1.6 + Math.cos(this.t * 22) * 1.3;
        pose.face = 'shock';
      }
    }

    // ----- shadow -----
    if (!(this.state === 'dead' && this.deathCause !== 'splat')) {
      const k = clamp(1 - h / 70, 0.35, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.3 * k * alpha})`;
      ctx.beginPath(); ctx.ellipse(gx, gy, 11 * k, 4 * k, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ----- charge glow -----
    if (this.state === 'charge' && this.chargeT > CONFIG.input.tapThreshold) {
      const k = clamp(this.chargeT / this.fullTime, 0, 1);
      const r = C.glowRadius * (0.5 + 0.5 * k) * (1 + Math.sin(this.t * 30) * 0.05);
      const g = ctx.createRadialGradient(gx, gy - 16, 2, gx, gy - 16, r);
      g.addColorStop(0, this.idx === 0 ? 'rgba(255,200,80,0.75)' : 'rgba(120,240,255,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.35 * k;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy - 16, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (this.power && this.alive) { // power aura
      ctx.strokeStyle = `rgba(255,225,77,${0.35 + Math.sin(this.t * 8) * 0.2})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(gx, gy, 16, 6, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const spriteKeys = ['p' + (this.idx + 1), 'player'];
    // ----- streak afterimages: the faster the rhythm, the more ghosts -----
    const fast = this.runSpeed > CONFIG.run.cruise * 1.25;
    if (this.state === 'air' && (this.streak >= 2 || fast) && !this.isFling) {
      const n = Math.min(4, Math.max(this.streak, fast ? Math.round(this.runSpeed / 2.2) : 0));
      for (let k = n; k >= 1; k--) {
        const at = this.airT - k * 0.022;
        if (at < 0) continue;
        const u = at / this.airDur;
        const yy = (this.airFromY !== null ? lerp(this.airFromY, this.airToY, u) : lerp(World.feetY(this.fromRow), World.feetY(this.toRow), u)) - this.arc * 4 * u * (1 - u);
        Sprites.draw(ctx, spriteKeys, this.vis, this.visT, gx - this.vxAir * k * 0.022, yy, {
          sx, sy, alpha: alpha * 0.35 * (1 - k / (n + 1)), pose, color: this.color, dark: this.dark, player: this });
      }
    }
    if (this.state === 'air' && (this.streak >= 3 || fast) && !this.isFling) {  // speed lines trailing behind (down the screen)
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        const lx = gx + i * 7 + Math.sin(this.t * 40 + i) * 1.5, ly = gy - h + 2 + Math.abs(i) * 4;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 8 + Math.max(this.streak * 2, this.runSpeed * 2)); ctx.stroke();
      }
    }
    if (this.streak >= 2 && this.grounded && this.state !== 'win') { // bouncing on its toes
      pose.crouch += Math.abs(Math.sin(this.t * 18)) * 0.12;
    }

    // ----- the character (image if present, stickman placeholder otherwise) -----
    let px = gx + ox, py = gy - h + oy;
    if (this.state === 'air' && this.isFling) { // tumble around the body centre, not the feet
      const r = 20 * sy;
      px += -r * Math.sin(rot); py += -r + r * Math.cos(rot);
    }
    this.drawFigure(ctx, px, py, {
      sx, sy, rot, alpha, pose, color: this.color, dark: this.dark, player: this,
      glow: this.state === 'charge' ? clamp(this.chargeT / this.fullTime, 0, 1) : 0
    });

    const headY = gy - h - 46 * sy;
    if (this.state === 'dizzy') drawDizzyStars(ctx, gx, gy - h - 40, this.t);
    if (this.state === 'charge' && this.chargeT > CONFIG.input.tapThreshold * 0.5) this.drawChargeMeter(ctx, gx, headY - 8);
    else if (game.players.filter((p) => p.joined).length > 1 && this.alive) {
      ctx.fillStyle = this.color; ctx.font = '900 10px "Trebuchet MS", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(this.name, gx, headY + 2); ctx.fillText(this.name, gx, headY + 2);
    }
    if (this.runSpeed > 0 && this.alive) {   // open straight: speed bar under the feet
      const R = CONFIG.run, k = clamp((this.runSpeed - R.min) / (R.max - R.min), 0, 1), w = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(gx - w / 2 - 1, gy + 5, w + 2, 5);
      ctx.fillStyle = k > 0.6 ? '#ffe14d' : k > 0.3 ? '#8fe36b' : '#ff9b5a'; ctx.fillRect(gx - w / 2, gy + 6, w * k, 3);
    }
    if (this.teeterT > 0 && this.state !== 'dead') {
      ctx.fillStyle = '#ff4040'; ctx.font = '900 16px "Trebuchet MS", Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', gx + this.teeterSide * 16, gy - 40 + Math.sin(this.t * 30) * 2);
    }
  }

  /** the character itself (art if present, else the placeholder), with rust tint after a dunk */
  drawFigure(ctx, x, y, opts) {
    const hh = this.heat || 0, r = hh > 0.02 ? 0 : (this.rust || 0);
    if (hh > 0.02) {   // red-hot glow behind (additive)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 34);
      g.addColorStop(0, `rgba(255,140,40,${0.55 * hh})`); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 36, y - 56, 72, 72); ctx.restore();
    }
    const art = (r > 0.02 || hh > 0.02) && Characters.hasArt(this, this.vis);
    if (art && hh > 0.02) ctx.filter = `sepia(${hh}) saturate(${1 + hh * 3}) hue-rotate(${-25 * hh}deg) brightness(${1 + 0.25 * hh})`;
    else if (art) ctx.filter = `sepia(${r}) saturate(${1 + r * 1.4}) hue-rotate(${-12 * r}deg) brightness(${1 - 0.28 * r})`;
    Sprites.draw(ctx, ['p' + (this.idx + 1), 'player'], this.vis, this.visT, x, y, { ...opts, rust: r, heat: hh });
    if (art) ctx.filter = 'none';
  }

  /** lava death: scorch (sinking a bit, red-hot, flailing) -> hop out smoking back toward the checkpoint */
  drawLavaDeath(ctx) {
    const P = this.lavaPhase(), lv = this.lava, t = this.t, k = P.k;
    const pose = { crouch: 0.05, armL: 0.35, armR: 0.35, legSpread: 5, knee: 0, lean: 0, face: 'shock', bob: 0 };
    const base = { pose, color: this.color, dark: this.dark, player: this };
    if (P.ph === 'scorch') {
      const depth = 3 + 7 * Math.min(1, k * 1.6);
      pose.armL = 2.4 + Math.sin(t * 34) * 0.5; pose.armR = 2.4 - Math.sin(t * 34) * 0.5; pose.legSpread = 3; pose.face = 'grit';
      ctx.save();
      ctx.beginPath(); ctx.rect(lv.x - 40, lv.y - 90, 80, 90 - 2 + 0.01); ctx.clip();   // feet sunk into the lava
      this.drawFigure(ctx, lv.x + Math.sin(t * 50) * 1.5, lv.y + depth, { ...base, rot: Math.sin(t * 22) * 0.08 });
      ctx.restore();
      ctx.fillStyle = 'rgba(255,190,60,0.85)';   // molten ring around the feet
      ctx.beginPath(); ctx.ellipse(lv.x, lv.y - 1, 15 + Math.sin(t * 20) * 1.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,245,180,0.9)'; ctx.beginPath(); ctx.ellipse(lv.x, lv.y - 1, 8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // hop out: a springy smoking leap back toward the last checkpoint, shaking the heat off
    const T = this.lavaTarget(), e = k * k * (3 - 2 * k);
    const x = lv.x + (T.x - lv.x) * e, gy = this.lavaGround(), y = gy - Math.sin(Math.PI * k) * 40;
    pose.armL = 1.4 + Math.sin(t * 40) * 0.7; pose.armR = 1.4 - Math.sin(t * 40) * 0.7; pose.legSpread = 6;
    pose.face = k > 0.5 ? 'dizzy' : 'shock';
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, gy, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    this.drawFigure(ctx, x, y, { ...base, rot: Math.sin(t * 36) * 0.3 * (1 - k), sx: k < 0.12 ? 0.88 : 1, sy: k < 0.12 ? 1.18 : 1 });
  }

  /** draw a figure under water: rendered offscreen, tinted water-blue, faded with depth */
  drawSubmerged(ctx, x, y, depthK, opts) {
    const m = ctx.getTransform(), s = Math.max(0.5, Math.hypot(m.a, m.b));
    const W = 90, H = 90, pw = Math.ceil(W * s), ph = Math.ceil(H * s);
    const oc = Player._oc || (Player._oc = document.createElement('canvas'));
    if (oc.width !== pw || oc.height !== ph) { oc.width = pw; oc.height = ph; }
    const og = oc.getContext('2d');
    og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, pw, ph);
    og.setTransform(s, 0, 0, s, pw / 2, ph * 0.85);
    this.drawFigure(og, 0, 0, opts);
    og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = 'source-atop';
    og.fillStyle = `rgba(18,78,160,${0.3 + 0.4 * depthK})`; og.fillRect(0, 0, pw, ph);
    og.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha *= 0.9 - 0.35 * depthK; ctx.drawImage(oc, x - W / 2, y - H * 0.85, W, H); ctx.restore();
  }

  /** water death: tip in -> sink & rust -> flail back up -> pop out shaking off (hops back toward safety) */
  drawWater(ctx) {
    const P = this.waterPhase(), w = this.water, gy = this.groundY, t = this.t, k = P.k;
    const pose = { crouch: 0.05, armL: 0.35, armR: 0.35, legSpread: 5, knee: 0, lean: 0, face: 'shock', bob: 0 };
    const base = { pose, color: this.color, dark: this.dark, player: this };
    if (P.ph === 'tip') {
      pose.armL = pose.armR = 2.6 + Math.sin(t * 30) * 0.3;
      this.drawFigure(ctx, w.x, gy + k * 6, { ...base, rot: w.side * k * 1.1 });
      return;
    }
    // surface ripples
    ctx.strokeStyle = 'rgba(230,248,255,0.55)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const rr = 8 + ((t * 18 + i * 9) % 18);
      ctx.globalAlpha = 1 - ((t * 18 + i * 9) % 18) / 18;
      ctx.beginPath(); ctx.ellipse(w.x, gy - 2, rr, rr * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (P.ph === 'sink' || P.ph === 'rise') {
      const e = P.ph === 'sink' ? 1 - (1 - k) * (1 - k) : k * k;
      const depth = P.ph === 'sink' ? 4 + 20 * e : 24 - 22 * e, dk = (depth - 4) / 20;
      if (P.ph === 'sink') { pose.armL = pose.armR = 2.5 + Math.sin(t * 14) * 0.25; pose.legSpread = 3; }
      else {                                  // frantic swim back up
        pose.armL = 1.7 + Math.sin(t * 30) * 1.1; pose.armR = 1.7 - Math.sin(t * 30) * 1.1;
        pose.stride = Math.sin(t * 26); pose.face = 'grit';
      }
      const sc = 1 - 0.18 * dk;
      this.drawSubmerged(ctx, w.x + Math.sin(t * 9) * 1.5, gy + depth, dk, { ...base, sx: sc, sy: sc, rot: Math.sin(t * 7) * 0.12 });
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(w.x, gy - 3, 13, 3.5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      return;
    }
    // pop out: a springy hop out of the water, shaking off
    const pos = this.popPos(k), shake = k > 0.2 ? Math.sin(t * 46) * 0.32 * (1 - k) : 0;
    pose.armL = 1.2 + Math.sin(t * 46) * 0.6; pose.armR = 1.2 - Math.sin(t * 46) * 0.6;
    pose.face = k > 0.45 ? 'happy' : 'shock'; pose.legSpread = 6;
    const sy = k < 0.15 ? 1.18 : 1, sx = k < 0.15 ? 0.88 : 1;
    const shY = this.water && Math.abs(this.lastSafe.row - this.row) <= 5 ? gy + (World.feetY(this.lastSafe.row) - gy) * (k * k * (3 - 2 * k)) : gy;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(pos.x, shY, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    this.drawFigure(ctx, pos.x, pos.y, { ...base, rot: shake, sx, sy });
  }

  drawChargeMeter(ctx, x, y) {
    const C = CONFIG.charge;
    const w = 36, h = 6, full = this.fullTime, t = this.chargeT;
    const ok = t > full ? clamp((t - full) / C.overloadGrace, 0, 1) : 0;
    const lvl = this.levelFor(t);
    ctx.save();
    ctx.translate(x - w / 2, y);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(-2, -2, w + 4, h + 4);
    const fill = clamp(t / full, 0, 1);
    let col = lvl === 0 ? this.color : lvl === 1 ? '#ffe14d' : '#ffffff';
    if (ok > 0 && Math.floor(this.t * (10 + ok * 20)) % 2) col = '#ff3030';
    ctx.fillStyle = col; ctx.fillRect(0, 0, w * fill, h);
    // level ticks
    ctx.fillStyle = '#000';
    ctx.fillRect(w * (C.level1Time / full) - 1, 0, 2, h);
    if (this.maxLevel === 2) ctx.fillRect(w * (C.level2Time / full) - 1, 0, 2, h);
    // overload countdown bar
    if (ok > 0) { ctx.fillStyle = '#ff3030'; ctx.fillRect(0, h + 3, w * (1 - ok), 2); }
    // chevrons = rows this release would jump
    const rows = C.rows[lvl];
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    for (let i = 0; i < rows; i++) {
      const cy = -5 - i * 5;
      ctx.beginPath(); ctx.moveTo(w / 2 - 5, cy + 3); ctx.lineTo(w / 2, cy - 1); ctx.lineTo(w / 2 + 5, cy + 3); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDizzyStars(ctx, x, y, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 7 + (i * Math.PI * 2) / 3;
    const sx = x + Math.cos(a) * 13, sy = y + Math.sin(a) * 4;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 1.6 : 4, aa = (k / 10) * Math.PI * 2 + t * 4;
      ctx.lineTo(sx + Math.cos(aa) * r, sy + Math.sin(aa) * r);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, 13, 4, 0, 0, Math.PI * 2); ctx.stroke();
}

/* ---------------- stickman placeholder ----------------
   Local space: origin = feet, up = -y. Pose fields:
   crouch 0..1, armL/armR (radians from straight down, outward),
   legSpread (px), knee (0..1 outward bend), face. */
function drawStickman(ctx, state, t, o) {
  const pose = o.pose || {}, dark = o.dark || '#000';
  const color = o.heat ? Characters.mix(o.color || '#fff', '#ff5a1f', o.heat) : o.rust ? Characters.mix(o.color || '#fff', Characters.RUST, o.rust) : (o.color || '#fff');
  ctx.scale(0.88, 0.88);   // overall placeholder size (feet stay planted)
  const legLen = 15, torso = 15, headR = 7, armLen = 12;
  const crouch = pose.crouch || 0;
  const hipY = -legLen * (1 - crouch * 0.55);
  const shY = hipY - torso * (1 - crouch * 0.15);
  const headY = shY - headR - 1.5;
  const spread = pose.legSpread || 5, knee = pose.knee || 0;

  const limbs = [];
  // legs (hip -> knee -> foot)
  const stride = pose.stride || 0;   // -1..1 running stride: one foot forward (up), one back
  for (const s of [-1, 1]) {
    const fy = -s * stride * 6;
    const kx = s * (spread * 0.55 + knee * 5 + crouch * 6), ky = hipY * 0.5 + fy * 0.6 - Math.abs(stride) * 2;
    limbs.push([[0, hipY], [kx, ky], [s * spread, fy]]);
  }
  // torso
  limbs.push([[0, hipY], [0, shY]]);
  // arms (shoulder -> elbow -> hand)
  const arm = (s, a) => {
    const ex = s * Math.sin(a) * armLen * 0.55, ey = shY + 2 + Math.cos(a) * armLen * 0.55;
    const hx = s * Math.sin(a) * armLen, hy = shY + 2 + Math.cos(a) * armLen;
    return [[0, shY + 2], [ex + s * 1.5, ey], [hx, hy]];
  };
  limbs.push(arm(-1, pose.armL || 0.3), arm(1, pose.armR || 0.3));

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stroke = (lw, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    for (const l of limbs) { ctx.beginPath(); ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); ctx.stroke(); }
  };
  stroke(6, dark);
  stroke(3.2, color);
  if (o.glow > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= o.glow * 0.6;
    stroke(2, '#fff6c0'); ctx.restore();
  }

  // head
  ctx.fillStyle = color; ctx.strokeStyle = dark; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // face
  ctx.fillStyle = dark; ctx.strokeStyle = dark; ctx.lineWidth = 1.4;
  const f = pose.face;
  if (f === 'dizzy') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 2.6, headY - 1, 1.6, t * 10, t * 10 + 5); ctx.stroke(); }
  } else if (f === 'dead') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 2.6 - 1.5, headY - 2.5); ctx.lineTo(s * 2.6 + 1.5, headY + 0.5); ctx.moveTo(s * 2.6 + 1.5, headY - 2.5); ctx.lineTo(s * 2.6 - 1.5, headY + 0.5); ctx.stroke(); }
  } else {
    const eyeY = headY - 1.5;
    if (f === 'strain') { for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 1.2, eyeY - 1.5); ctx.lineTo(s * 3.8, eyeY); ctx.lineTo(s * 1.2, eyeY + 1.2); ctx.stroke(); } }
    else { ctx.beginPath(); ctx.arc(-2.6, eyeY, 1.3, 0, Math.PI * 2); ctx.arc(2.6, eyeY, 1.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath();
    if (f === 'happy') ctx.arc(0, headY + 1.5, 2.6, 0.2, Math.PI - 0.2);
    else if (f === 'shock') { ctx.arc(0, headY + 3, 1.8, 0, Math.PI * 2); }
    else if (f === 'grit' || f === 'strain') { ctx.moveTo(-2.8, headY + 3); ctx.lineTo(2.8, headY + 3); }
    else { ctx.moveTo(-1.8, headY + 3); ctx.lineTo(1.8, headY + 3); }
    ctx.stroke();
  }
}
Sprites.registerPlaceholder('player', drawStickman);   // characters.js wraps this with the robot proxies
