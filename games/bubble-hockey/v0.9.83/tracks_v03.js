/* BUBBLE HOCKEY tracks v03 - fitted from Justin's redraw 002 (Rink_TopDown_v01Redraw_002.ora, 'NewPaths2' layer; goalie kept from v02; centre exactly on x=0.5 (sketch y 254) once on the line, Nov 2 2026).
   Same format as tracks.js (sketch pixels [x along, y across], Catmull-Rom). One wing / defence / centre / goalie was drawn
   (top-right quadrant) and mirrored: across width x->1-x, team point-mirror (x,y)->(1-x,2-y). Swap in by loading this file
   instead of tracks.js. Order + k + sl unchanged from tracks.js; each track keeps the old start end (u=0). */
window.BUBBLE_TRACKS = {
  sketch: { x0: 20, x1: 1010, y0: 8, y1: 500 },
  green: [
    { k: 'G', sl: 0.04, pts: [[940.4, 208.4], [928.5, 223], [920.2, 254], [928.5, 285], [940.4, 299.6]] },
    { k: 'D', sl: 0.05, pts: [[537.8, 134.1], [659.2, 150.9], [888.1, 154.6], [981.9, 214.2]] },
    { k: 'D', sl: 0.05, pts: [[537.8, 373.9], [659.2, 357.1], [888.1, 353.4], [981.9, 293.8]] },
    { k: 'W', sl: 0.08, pts: [[44.1, 129.4], [108.6, 80.3], [283.7, 55.7], [378.5, 56.1], [500.7, 53.9]] },
    { k: 'C', sl: 0.065, pts: [[154.6, 254], [315.9, 254], [405, 254], [504.5, 286.9], [558.4, 286.2]] },
    { k: 'W', sl: 0.08, pts: [[44.1, 378.6], [108.6, 427.7], [283.7, 452.3], [378.5, 451.9], [500.7, 454.1]] }],
  blue: [
    { k: 'G', sl: 0.04, pts: [[89.6, 208.4], [101.5, 223], [109.8, 254], [101.5, 285], [89.6, 299.6]] },
    { k: 'D', sl: 0.05, pts: [[492.2, 134.1], [370.8, 150.9], [141.9, 154.6], [48.1, 214.2]] },
    { k: 'D', sl: 0.05, pts: [[492.2, 373.9], [370.8, 357.1], [141.9, 353.4], [48.1, 293.8]] },
    { k: 'W', sl: 0.08, pts: [[529.3, 53.9], [651.5, 56.1], [746.3, 55.7], [921.4, 80.3], [985.9, 129.4]] },
    { k: 'C', sl: 0.065, pts: [[875.4, 254], [714.1, 254], [625, 254], [525.5, 221.1], [471.6, 221.8]] },
    { k: 'W', sl: 0.08, pts: [[529.3, 454.1], [651.5, 451.9], [746.3, 452.3], [921.4, 427.7], [985.9, 378.6]] }]
};
