/* BUBBLE HOCKEY v0.3 track table, traced from Justin's sketch (/workspace/bubble/justin-layout-sketch.png, 1024x512 px).
   EDIT HERE to experiment. Points are SKETCH PIXELS [x, y]: x runs along the rink (left net ~95, red line 514, right net ~935),
   y runs across it (top board 8, bottom board 500). Each track is a Catmull-Rom spline through its control points.
   k: G goalie, D defence, W winger, C centre.  sl: stick length in rink widths (Chexx rods: wingers long, centre medium, D short).
   Sketch colours = teams, Chexx style: each team's goalie + defence guard its own net and its forwards play in the far half.
   green = team 0 (guards the RIGHT net, shown red in game) ; blue = team 1 (guards the LEFT net). */
window.BUBBLE_TRACKS = {
  sketch: { x0: 20, x1: 1010, y0: 8, y1: 500 },   // rink inner edges in the sketch
  green: [
    { k: 'G', sl: .04,  pts: [[930, 218], [922, 254], [930, 290]] },
    { k: 'D', sl: .05,  pts: [[530, 120], [610, 142], [700, 172], [800, 170], [900, 150], [955, 180], [985, 240]] },
    { k: 'D', sl: .05,  pts: [[535, 358], [630, 332], [700, 322], [830, 355], [940, 350], [985, 305], [995, 285]] },
    { k: 'W', sl: .08,  pts: [[55, 165], [72, 110], [130, 75], [250, 60], [400, 60], [500, 62]] },
    { k: 'C', sl: .065, pts: [[135, 251], [300, 250], [470, 250], [510, 275], [545, 300], [600, 287], [660, 265]] },   // curls into blue's half
    { k: 'W', sl: .08,  pts: [[35, 375], [60, 415], [110, 440], [250, 445], [400, 438], [495, 435]] }],
  blue: [
    { k: 'G', sl: .04,  pts: [[92, 220], [100, 255], [92, 290]] },
    { k: 'D', sl: .05,  pts: [[475, 125], [420, 135], [350, 150], [250, 150], [150, 145], [85, 165], [60, 195], [55, 230]] },
    { k: 'D', sl: .05,  pts: [[500, 360], [420, 350], [330, 320], [250, 330], [150, 340], [80, 320], [62, 292], [60, 270]] },
    { k: 'W', sl: .08,  pts: [[522, 58], [650, 55], [800, 60], [900, 90], [960, 130], [995, 185]] },
    { k: 'C', sl: .065, pts: [[880, 242], [700, 248], [545, 252], [522, 230], [500, 202], [450, 195], [410, 210], [370, 226]] },   // curls into green's half
    { k: 'W', sl: .08,  pts: [[530, 435], [700, 435], [850, 430], [930, 405], [970, 375], [985, 355]] }]
};
