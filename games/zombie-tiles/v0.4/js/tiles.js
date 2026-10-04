/* =====================================================================
   ZOMBIE TILES - tile templates (8x8 squares each)
   ---------------------------------------------------------------------
   Square legend
     .  street (soft grey)          ,  grass (soft green)
     ~  water (walkable)            %  broken glass (walkable)
     _  building floor              D  door
     b  bush      (cover)           w  concrete wall (cover)
     v  vehicle   (cover)           #  building wall
     X  helipad fence               G  helipad guard gate
     H  helipad pad
   Cover, walls and fences are impassable.

   A side is OPEN (an exit) when its two middle squares (index 3 and 4)
   are walkable, so any two open sides line up when tiles meet.
   zombies / pickups = [min, max] sprinkled at random when the tile is drawn.
   ===================================================================== */
(function (root) {
  var WALK = { '.': 1, ',': 1, '~': 1, '%': 1, '_': 1, 'D': 1 };

  var T = [
    { id: 'spawn', name: 'Crossroads (spawn)', zombies: [0, 0], pickups: [1, 2], grid: [
      ',,b..b,,',
      ',,,..,,,',
      'b,,..,,b',
      '........',
      '........',
      'w,,..,,w',
      ',,,..,,,',
      ',,b..b,,' ] },
    { id: 'main', name: 'Main Street', zombies: [1, 2], pickups: [1, 2], grid: [
      ',b,..,b,',
      ',,,..,,,',
      'vv,..,,,',
      '........',
      '...%....',
      ',,,..,vv',
      ',b,..,,,',
      ',,,..,b,' ] },
    { id: 'parking', name: 'Parking Lot', zombies: [1, 3], pickups: [1, 3], grid: [
      'w,,..,,w',
      'wvv..vvw',
      'w,,..,,,',
      'w,,.....',
      'w,,.....',
      'wvv..vvw',
      'w,,..,,w',
      'w,,..,,w' ] },
    { id: 'pond', name: 'Park Pond', zombies: [1, 2], pickups: [0, 2], grid: [
      ',,,,,,,,',
      ',b,~~,b,',
      ',,~~~~,,',
      ',,~~~~,,',
      ',,~~~~,,',
      ',b,~~,b,',
      ',,,,,,,,',
      ',,b,,b,,' ] },
    { id: 'courtyard', name: 'Courtyard', zombies: [1, 3], pickups: [1, 2], grid: [
      ',,,..,,,',
      ',bb..ww,',
      ',b....w,',
      '.....v..',
      '..w..v..',
      ',b....b,',
      ',ww..bb,',
      ',,,..,,,' ] },
    { id: 'store', name: 'Corner Store (no back exit)', zombies: [1, 2], pickups: [2, 3], grid: [
      '########',
      '#_%__%_#',
      '###DD###',
      '........',
      '........',
      ',,,..,,,',
      ',b,..,b,',
      ',,,..,,,' ] },
    { id: 'apartment', name: 'Apartments (back exit)', zombies: [1, 2], pickups: [2, 3], grid: [
      '####,,,,',
      '#__#,b,,',
      '#__#,,,,',
      'D__D....',
      'D__D....',
      '#__#,,,,',
      '#%_#,b,,',
      '####,,,,' ] },
    { id: 'garage', name: 'Garage (back exit)', zombies: [1, 2], pickups: [1, 3], grid: [
      '###DD###',
      '#_%____#',
      '#______#',
      '###DD###',
      ',,,..,,,',
      ',b,..,v,',
      ',,,..,v,',
      ',b,..,,,' ] },
    { id: 'glass', name: 'Glass Alley', zombies: [1, 2], pickups: [1, 2], grid: [
      'ww,..,ww',
      'w,,.%,,w',
      'w,%..,,,',
      'w,..%...',
      'w,%.....',
      'w,,%.,,w',
      'w,,..%,w',
      'ww,..,ww' ] },
    { id: 'canal', name: 'Canal', zombies: [1, 2], pickups: [0, 2], grid: [
      ',,,..,,,',
      ',b,..,b,',
      '~~~~~~~~',
      '~~~~~~~~',
      '~~~~~~~~',
      ',,,..,,,',
      ',v,..,b,',
      ',v,..,,,' ] },
    { id: 'pileup', name: 'Car Pile-up', zombies: [2, 3], pickups: [1, 2], grid: [
      ',,,..,,,',
      ',vv..,b,',
      ',,,..vv,',
      '...%....',
      '....%...',
      ',vv..,,,',
      ',,,..vv,',
      ',b,..,,,' ] },
    { id: 'barricade', name: 'Barricade', zombies: [1, 2], pickups: [1, 2], grid: [
      'www..www',
      'w,,..,,w',
      'w,b..,,,',
      'w,,.....',
      'w,,.....',
      'w,,,,b,w',
      'w,b,,,,w',
      'wwwwwwww' ] },
    { id: 'helipad', name: 'HELIPAD', helipad: true, zombies: [5, 7], pickups: [0, 0], grid: [
      ',,,..,,,',
      ',XXGGXX,',
      ',XHHHHX,',
      '.GHHHHG.',
      '.GHHHHG.',
      ',XHHHHX,',
      ',XXGGXX,',
      ',,,..,,,' ] }
  ];

  // how many copies of each go in the pool the deck is drawn from (spawn + helipad handled separately)
  var POOL = [['main', 2], ['parking', 2], ['pond', 1], ['courtyard', 2], ['store', 2], ['apartment', 1],
              ['garage', 1], ['glass', 1], ['canal', 1], ['pileup', 2], ['barricade', 1]];

  function rotate(grid, rot) {           // rot = number of 90-degree clockwise turns
    var g = grid.map(function (r) { return r.split(''); });
    for (var k = 0; k < ((rot % 4) + 4) % 4; k++) {
      var n = g.length, m = g[0].length, out = [];
      for (var y = 0; y < m; y++) { out.push([]); for (var x = 0; x < n; x++) out[y].push(g[n - 1 - x][y]); }
      g = out;
    }
    return g.map(function (r) { return r.join(''); });
  }
  // open sides [N, E, S, W]
  function openSides(grid) {
    var n = grid.length, m = grid[0].length, a = (m >> 1) - 1, b = m >> 1, c = (n >> 1) - 1, d = n >> 1;
    return [
      !!(WALK[grid[0][a]] && WALK[grid[0][b]]),
      !!(WALK[grid[c][m - 1]] && WALK[grid[d][m - 1]]),
      !!(WALK[grid[n - 1][a]] && WALK[grid[n - 1][b]]),
      !!(WALK[grid[c][0]] && WALK[grid[d][0]])
    ];
  }
  var byId = {};
  T.forEach(function (t) { byId[t.id] = t; });

  root.ZT_TILES = { list: T, byId: byId, pool: POOL, rotate: rotate, openSides: openSides, WALK: WALK };
})(typeof window !== 'undefined' ? window : globalThis);
