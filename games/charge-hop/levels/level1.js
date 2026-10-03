/* =====================================================================
   levels/level1.js - Level 1 layout. Rows listed BOTTOM (row 0) to TOP.
   Lane fields:
     type   'start' | 'grass' | 'road' | 'river' | 'goal' (see lanes.js)
     dir    1 = moves right, -1 = moves left
     speed  px per second (1 tile = 48 px)
     spawn  road only: { pattern: [vehicle types, cycled], gap: [min, max] tiles between vehicles }
     logs   river only: each log { len: tiles, speed: px/s } (their speeds differ -> they bump)
     items  any lane: [{ type: 'powerup', col: 0..12 }]
   ===================================================================== */
(window.LEVELS = window.LEVELS || []).push({
  id: 'level1',
  name: 'Rush Hour Creek',
  lanes: [
    /*  0 */ { type: 'start' },
    /*  1 */ { type: 'road', dir: -1, speed: 70,  spawn: { pattern: ['car'], gap: [2.6, 5] } },
    /*  2 */ { type: 'road', dir: 1,  speed: 120, spawn: { pattern: ['car', 'car', 'car'], gap: [3, 5.5] } },
    /*  3 */ { type: 'road', dir: -1, speed: 55,  spawn: { pattern: ['truck', 'car'], gap: [3, 5] } },
    /*  4 */ { type: 'road', dir: 1,  speed: 165, spawn: { pattern: ['car', 'truck', 'car', 'car'], gap: [4.5, 8] } },
    /*  5 */ { type: 'grass', items: [{ type: 'powerup', col: 10 }] },
    /*  6 */ { type: 'river', dir: 1,  logs: [{ len: 3, speed: 38 }, { len: 2, speed: 66 }, { len: 3, speed: 30 }, { len: 2, speed: 55 }, { len: 2, speed: 45 }] },
    /*  7 */ { type: 'river', dir: -1, logs: [{ len: 2, speed: 72 }, { len: 3, speed: 46 }, { len: 3, speed: 60 }, { len: 2, speed: 40 }, { len: 2, speed: 52 }] },
    /*  8 */ { type: 'river', dir: 1,  logs: [{ len: 4, speed: 52 }, { len: 2, speed: 85 }, { len: 3, speed: 45 }, { len: 2, speed: 64 }] },
    /*  9 */ { type: 'river', dir: -1, logs: [{ len: 3, speed: 34 }, { len: 2, speed: 58 }, { len: 2, speed: 44 }, { len: 3, speed: 70 }, { len: 2, speed: 50 }] },
    /* 10 */ { type: 'grass' },
    /* 11 */ { type: 'road', dir: -1, speed: 200, spawn: { pattern: ['car', 'car', 'truck'], gap: [5, 9] } },
    /* 12 */ { type: 'goal' }
  ]
});
