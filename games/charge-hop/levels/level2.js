/* =====================================================================
   levels/level2.js - "The Long Way": the v2 long level (v2 domino rules: standing dominoes block).
   Rows listed BOTTOM to TOP. Same lane fields as level1.js, plus:
     rows: N        expands one entry into N rows (open areas, plains)
     type 'checkpoint'  grass row with flags (respawn point, announces itself)
     type 'plain'   open plain with dominoes; `dominoes` = list of patterns
                    (coords are PLAIN-RELATIVE [col, row]; see js/dominoes.js)
     items on a multi-row entry take a `row` (0 = bottom row of that block)
   ===================================================================== */
(window.LEVELS = window.LEVELS || []).push({
  id: 'long-way',
  name: 'The Long Way',
  blurb: 'roads, rivers & domino plains',
  lanes: [
    // ---------- 1. warm-up ----------
    { type: 'start' },
    { type: 'grass', rows: 2 },
    { type: 'road', dir: 1,  speed: 80,  spawn: { pattern: ['car'], gap: [3, 5.5] } },
    { type: 'road', dir: -1, speed: 110, spawn: { pattern: ['car', 'truck'], gap: [3.5, 6] } },
    { type: 'road', dir: 1,  speed: 60,  spawn: { pattern: ['truck', 'car', 'car'], gap: [3, 5] } },
    { type: 'checkpoint', items: [{ type: 'powerup', col: 2 }] },

    // ---------- 2. Domino Meadow (intro plain) ----------
    { type: 'plain', rows: 8, name: 'Domino Meadow',
      items: [{ type: 'powerup', col: 11, row: 2 }],
      dominoes: [
        { pattern: 'line', from: [0.6, 1], to: [12.4, 1], gaps: [9, 10, 11] },                 // a wall with a door in the middle
        { pattern: 'grid', from: [1.5, 3], cols: 6, rows: 3, dx: 2, dy: 0.6, axis: 'v', gaps: [[2, 1], [4, 2]] },  // picket columns
        { pattern: 'wave', from: [0.6, 5.6], to: [12.4, 5.6], amp: 0.7, waves: 1 }               // an S-curve
      ] },
    { type: 'checkpoint' },

    // ---------- 3. first river + fast road ----------
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 40 }, { len: 2, speed: 60 }, { len: 3, speed: 34 }, { len: 2, speed: 52 }, { len: 3, speed: 46 }] },
    { type: 'river', dir: -1, logs: [{ len: 2, speed: 66 }, { len: 3, speed: 44 }, { len: 3, speed: 56 }, { len: 2, speed: 40 }, { len: 2, speed: 50 }] },
    { type: 'river', dir: 1,  logs: [{ len: 4, speed: 48 }, { len: 2, speed: 80 }, { len: 3, speed: 42 }, { len: 2, speed: 62 }] },
    { type: 'river', dir: -1, logs: [{ len: 3, speed: 36 }, { len: 2, speed: 58 }, { len: 2, speed: 44 }, { len: 3, speed: 66 }, { len: 2, speed: 50 }] },
    { type: 'grass' },
    { type: 'road', dir: -1, speed: 170, spawn: { pattern: ['car', 'car', 'truck'], gap: [5, 8] } },
    { type: 'road', dir: 1,  speed: 140, spawn: { pattern: ['car'], gap: [4, 7] } },
    { type: 'checkpoint' },

    // ---------- 4. big calm open area ----------
    { type: 'grass', rows: 4, items: [{ type: 'powerup', col: 6, row: 2 }] },

    // ---------- 5. Spiral Flats ----------
    { type: 'plain', rows: 10, name: 'Spiral Flats',
      dominoes: [
        { pattern: 'spiral', center: [6.5, 5], r0: 0.9, r1: 3.9, turns: 2.1, start: 90 },
        { pattern: 'zigzag', from: [0.7, 0.6], to: [0.7, 9.4], amp: 0.35, teeth: 5 },
        { pattern: 'zigzag', from: [12.3, 0.6], to: [12.3, 9.4], amp: 0.35, teeth: 5 }
      ] },
    { type: 'checkpoint' },

    // ---------- 6. busy traffic + long river ----------
    { type: 'road', dir: 1,  speed: 95,  spawn: { pattern: ['car', 'car'], gap: [2.8, 5] } },
    { type: 'road', dir: -1, speed: 150, spawn: { pattern: ['car', 'truck', 'car'], gap: [4, 7] } },
    { type: 'road', dir: 1,  speed: 65,  spawn: { pattern: ['truck', 'car'], gap: [3, 5] } },
    { type: 'road', dir: -1, speed: 190, spawn: { pattern: ['car'], gap: [5, 9] } },
    { type: 'grass' },
    { type: 'river', dir: -1, logs: [{ len: 3, speed: 42 }, { len: 2, speed: 70 }, { len: 3, speed: 36 }, { len: 2, speed: 55 }, { len: 2, speed: 48 }] },
    { type: 'river', dir: 1,  logs: [{ len: 2, speed: 75 }, { len: 3, speed: 48 }, { len: 4, speed: 38 }, { len: 2, speed: 60 }] },
    { type: 'river', dir: -1, logs: [{ len: 3, speed: 55 }, { len: 2, speed: 88 }, { len: 3, speed: 46 }, { len: 2, speed: 64 }, { len: 2, speed: 52 }] },
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 34 }, { len: 3, speed: 52 }, { len: 2, speed: 44 }, { len: 2, speed: 70 }, { len: 2, speed: 40 }] },
    { type: 'river', dir: -1, logs: [{ len: 4, speed: 50 }, { len: 2, speed: 78 }, { len: 3, speed: 42 }, { len: 2, speed: 60 }] },
    { type: 'checkpoint', items: [{ type: 'powerup', col: 9 }] },

    // ---------- 7. Chain Gauntlet ----------
    { type: 'plain', rows: 12, name: 'Chain Gauntlet',
      items: [{ type: 'powerup', col: 6, row: 8 }],
      dominoes: [
        { pattern: 'line', from: [0.6, 1], to: [12.4, 1], gaps: [5, 6, 15, 16] },
        { pattern: 'zigzag', from: [0.6, 3.5], to: [12.4, 3.5], amp: 1, teeth: 5 },
        { pattern: 'grid', from: [0.8, 6], cols: 20, rows: 2, dx: 0.583, dy: 1.2, axis: 'h', gaps: [[8, 0], [9, 0], [10, 0], [2, 1], [3, 1], [4, 1], [15, 1], [16, 1], [17, 1]] },
        { pattern: 'arc', center: [3.4, 10], radius: 1.4, from: -90, to: 270 },
        { pattern: 'arc', center: [9.6, 10], radius: 1.4, from: 270, to: -90 }
      ] },
    { type: 'checkpoint' },

    // ---------- 8. calm straight ----------
    { type: 'grass', rows: 3 },

    // ---------- 9. mixed section ----------
    { type: 'road', dir: -1, speed: 120, spawn: { pattern: ['car', 'car', 'truck'], gap: [3, 5.5] } },
    { type: 'road', dir: 1,  speed: 85,  spawn: { pattern: ['truck', 'car'], gap: [3, 5] } },
    { type: 'grass' },
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 44 }, { len: 2, speed: 72 }, { len: 3, speed: 38 }, { len: 2, speed: 58 }, { len: 2, speed: 50 }] },
    { type: 'river', dir: -1, logs: [{ len: 2, speed: 80 }, { len: 3, speed: 50 }, { len: 3, speed: 62 }, { len: 2, speed: 44 }, { len: 2, speed: 56 }] },
    { type: 'river', dir: 1,  logs: [{ len: 4, speed: 46 }, { len: 2, speed: 84 }, { len: 3, speed: 40 }, { len: 2, speed: 66 }] },
    { type: 'checkpoint' },

    // ---------- 10. Big Waves ----------
    { type: 'plain', rows: 8, name: 'Big Waves',
      dominoes: [
        { pattern: 'wave', from: [0.6, 1.2], to: [12.4, 1.2], amp: 0.8, waves: 2 },
        { pattern: 'wave', from: [3.2, 3], to: [3.2, 7.4], amp: 0.8, waves: 1 },
        { pattern: 'wave', from: [9.8, 3], to: [9.8, 7.4], amp: -0.8, waves: 1 },
        { pattern: 'path', smooth: true, points: [[4.6, 3.5], [6.5, 5.2], [8.4, 3.5]] },
        { pattern: 'line', from: [0.6, 7], to: [12.4, 7], gaps: [2, 3, 4, 16, 17, 18] }
      ] },
    { type: 'grass', rows: 2, items: [{ type: 'powerup', col: 4, row: 1 }] },

    // ---------- 11. final gauntlet ----------
    { type: 'road', dir: 1,  speed: 175, spawn: { pattern: ['car', 'car'], gap: [4.5, 8] } },
    { type: 'road', dir: -1, speed: 100, spawn: { pattern: ['truck', 'car', 'car'], gap: [3, 5.5] } },
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 50 }, { len: 2, speed: 76 }, { len: 3, speed: 42 }, { len: 2, speed: 62 }, { len: 2, speed: 54 }] },
    { type: 'river', dir: -1, logs: [{ len: 2, speed: 84 }, { len: 3, speed: 54 }, { len: 3, speed: 64 }, { len: 2, speed: 46 }] },
    { type: 'river', dir: 1,  logs: [{ len: 3, speed: 40 }, { len: 2, speed: 66 }, { len: 3, speed: 48 }, { len: 2, speed: 58 }, { len: 2, speed: 44 }] },
    { type: 'road', dir: -1, speed: 210, spawn: { pattern: ['car', 'car', 'truck'], gap: [5, 9] } },
    { type: 'road', dir: 1,  speed: 130, spawn: { pattern: ['car'], gap: [3.5, 6] } },
    { type: 'goal' }
  ]
});
