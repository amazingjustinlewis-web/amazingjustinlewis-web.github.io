/* =====================================================================
   levels/level3.js - "The Lava Run" (v3, default level).
   Rows listed BOTTOM to TOP. Same lane fields as level2.js, plus:
     type 'chute'   LAVA CHUTE transition, several rows long (see js/chutes.js):
                    { type: 'chute', rows: 7, name: 'Lava Chute', v0: 55, v1: 210, chunks: 3 }
                    rock chunks drift side to side while the flow carries them forward, faster and
                    spreading apart along the chute. At the end it launches you onto the next ledge,
                    or straight into the open straight after it at high speed.
     plain + run: true   OPEN STRAIGHT (v3 rules): you auto-run forward with momentum; tap = long jump.
                    Dominoes never block - passing them topples them (and their chains); fallen ones
                    and boulders just slow you down. `boulders: [[col, row], ...]` (plain-relative).
                    (A plain WITHOUT run: true keeps the v2 domino rules - see level 2.)
   ===================================================================== */
(window.LEVELS = window.LEVELS || []).push({
  id: 'lava-run',
  name: 'The Lava Run',
  blurb: 'lava chutes, fast straights & domino chains',
  default: true,
  lanes: [
    // ---------- 1. warm-up ----------
    { type: 'start' },
    { type: 'grass', rows: 2 },
    { type: 'road', dir: 1,  speed: 80,  spawn: { pattern: ['car'], gap: [3, 5.5] } },
    { type: 'road', dir: -1, speed: 110, spawn: { pattern: ['car', 'truck'], gap: [3.5, 6] } },
    { type: 'road', dir: 1,  speed: 60,  spawn: { pattern: ['truck', 'car', 'car'], gap: [3, 5] } },
    { type: 'checkpoint', items: [{ type: 'powerup', col: 2 }] },

    // ---------- 2. first chute -> Domino Dash ----------
    { type: 'chute', rows: 7, name: 'Lava Chute' },
    { type: 'plain', run: true, rows: 16, name: 'Domino Dash',
      items: [{ type: 'powerup', col: 6, row: 9 }],
      boulders: [[3, 6], [10, 6], [6, 12]],
      dominoes: [
        { pattern: 'line', from: [0.6, 3.6], to: [12.4, 3.6] },                                  // a wall: you burst through it
        { pattern: 'wave', from: [0.6, 8], to: [12.4, 8], amp: 0.9, waves: 2 },
        { pattern: 'grid', from: [1.2, 10.5], cols: 8, rows: 2, dx: 1.5, dy: 1.3, axis: 'v' },
        { pattern: 'zigzag', from: [0.6, 14], to: [12.4, 14], amp: 0.6, teeth: 4 }
      ] },
    { type: 'checkpoint' },

    // ---------- 3. chute -> river & road ----------
    { type: 'chute', rows: 6, name: 'Hot Slide', v1: 170 },
    { type: 'checkpoint' },
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 40 }, { len: 2, speed: 60 }, { len: 3, speed: 34 }, { len: 2, speed: 52 }, { len: 3, speed: 46 }] },
    { type: 'river', dir: -1, logs: [{ len: 2, speed: 66 }, { len: 3, speed: 44 }, { len: 3, speed: 56 }, { len: 2, speed: 40 }, { len: 2, speed: 50 }] },
    { type: 'river', dir: 1,  logs: [{ len: 4, speed: 48 }, { len: 2, speed: 80 }, { len: 3, speed: 42 }, { len: 2, speed: 62 }] },
    { type: 'river', dir: -1, logs: [{ len: 3, speed: 36 }, { len: 2, speed: 58 }, { len: 2, speed: 44 }, { len: 3, speed: 66 }, { len: 2, speed: 50 }] },
    { type: 'grass' },
    { type: 'road', dir: -1, speed: 150, spawn: { pattern: ['car', 'car', 'truck'], gap: [5, 8] } },
    { type: 'road', dir: 1,  speed: 120, spawn: { pattern: ['car'], gap: [4, 7] } },
    { type: 'checkpoint', items: [{ type: 'powerup', col: 10 }] },

    // ---------- 4. long chute -> Boulder Run ----------
    { type: 'chute', rows: 8, name: 'Magma Run', v1: 230 },
    { type: 'plain', run: true, rows: 18, name: 'Boulder Run',
      items: [{ type: 'powerup', col: 3, row: 11 }],
      boulders: [[2, 4], [6, 4], [10, 4], [4, 9], [8, 9], [1, 15], [6, 15], [11, 15]],
      dominoes: [
        { pattern: 'spiral', center: [6.5, 6.5], r0: 0.8, r1: 2.6, turns: 1.6, start: 90 },
        { pattern: 'path', smooth: true, points: [[0.6, 11], [4, 12.5], [9, 11], [12.4, 12.5]] },
        { pattern: 'line', from: [0.6, 13.6], to: [12.4, 13.6], gaps: [8, 9, 10] },
        { pattern: 'arc', center: [6.5, 16.2], radius: 1.3, from: -90, to: 270 }
      ] },
    { type: 'checkpoint' },

    // ---------- 5. chute -> road & river ----------
    { type: 'chute', rows: 6, name: 'Hot Slide', v1: 180 },
    { type: 'checkpoint' },
    { type: 'road', dir: 1,  speed: 95,  spawn: { pattern: ['car', 'car'], gap: [2.8, 5] } },
    { type: 'road', dir: -1, speed: 150, spawn: { pattern: ['car', 'truck', 'car'], gap: [4, 7] } },
    { type: 'road', dir: 1,  speed: 65,  spawn: { pattern: ['truck', 'car'], gap: [3, 5] } },
    { type: 'road', dir: -1, speed: 180, spawn: { pattern: ['car'], gap: [5, 9] } },
    { type: 'grass' },
    { type: 'river', dir: -1, logs: [{ len: 3, speed: 42 }, { len: 2, speed: 70 }, { len: 3, speed: 36 }, { len: 2, speed: 55 }, { len: 2, speed: 48 }] },
    { type: 'river', dir: 1,  logs: [{ len: 2, speed: 75 }, { len: 3, speed: 48 }, { len: 4, speed: 38 }, { len: 2, speed: 60 }] },
    { type: 'river', dir: -1, logs: [{ len: 3, speed: 55 }, { len: 2, speed: 88 }, { len: 3, speed: 46 }, { len: 2, speed: 64 }, { len: 2, speed: 52 }] },
    { type: 'checkpoint' },

    // ---------- 6. longest chute -> Chain Sprint ----------
    { type: 'chute', rows: 9, name: 'The Big Flow', v1: 250, side1: 70 },
    { type: 'plain', run: true, rows: 16, name: 'Chain Sprint',
      items: [{ type: 'powerup', col: 9, row: 7 }],
      boulders: [[6, 5], [2, 11], [11, 11]],
      dominoes: [
        { pattern: 'zigzag', from: [0.6, 3], to: [12.4, 3], amp: 0.8, teeth: 5 },
        { pattern: 'grid', from: [0.8, 6.5], cols: 20, rows: 2, dx: 0.583, dy: 1.4, axis: 'h', gaps: [[9, 0], [10, 0], [3, 1], [16, 1]] },
        { pattern: 'wave', from: [3.2, 9.5], to: [3.2, 14.5], amp: 0.8, waves: 1 },
        { pattern: 'wave', from: [9.8, 9.5], to: [9.8, 14.5], amp: -0.8, waves: 1 },
        { pattern: 'path', smooth: true, points: [[4.6, 10], [6.5, 12], [8.4, 10]] }
      ] },
    { type: 'checkpoint' },

    // ---------- 7. last chute -> final gauntlet ----------
    { type: 'chute', rows: 6, name: 'Last Slide', v1: 190 },
    { type: 'checkpoint' },
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 50 }, { len: 2, speed: 76 }, { len: 3, speed: 42 }, { len: 2, speed: 62 }, { len: 2, speed: 54 }] },
    { type: 'river', dir: -1, logs: [{ len: 2, speed: 84 }, { len: 3, speed: 54 }, { len: 3, speed: 64 }, { len: 2, speed: 46 }] },
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 40 }, { len: 2, speed: 66 }, { len: 3, speed: 48 }, { len: 2, speed: 58 }, { len: 2, speed: 44 }] },
    { type: 'road', dir: -1, speed: 200, spawn: { pattern: ['car', 'car', 'truck'], gap: [5, 9] } },
    { type: 'road', dir: 1,  speed: 130, spawn: { pattern: ['car'], gap: [3.5, 6] } },
    { type: 'checkpoint' },
    { type: 'grass', rows: 2 },
    { type: 'goal' }
  ]
});
