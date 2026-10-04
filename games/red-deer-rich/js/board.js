/* RED DEER RICH - the board (40 spaces, Present Day) and the two card decks.
   Prices and rent ladders: design doc section 6. Rent ladder = unimproved / 1 / 2 / 3 / 4 Shops / Mega-Plex. */
(function (root) {
  'use strict';
  var GROUPS = {
    brown:  { name: 'Brown',    color: '#8b5a2b', shop: 60 },
    sky:    { name: 'Sky Blue', color: '#7ec8f0', shop: 60 },
    pink:   { name: 'Pink',     color: '#e05aa8', shop: 110 },
    orange: { name: 'Orange',   color: '#f28c28', shop: 110 },
    red:    { name: 'Red',      color: '#d8262f', shop: 160 },
    yellow: { name: 'Yellow',   color: '#f2d22e', shop: 160 },
    green:  { name: 'Green',    color: '#2e9e4f', shop: 210 },
    navy:   { name: 'Navy',     color: '#24418f', shop: 210 },
    whistle:{ name: 'Whistle Stops', color: '#3b3b46' },
    juice:  { name: 'City Juice', color: '#7a8a99' }
  };
  function P(name, short, group, price, rents) { return { type: 'prop', name: name, short: short, group: group, price: price, rents: rents }; }
  function W(name, short) { return { type: 'whistle', name: name, short: short, group: 'whistle', price: 210 }; }
  function J(name, short) { return { type: 'juice', name: name, short: short, group: 'juice', price: 160 }; }
  var SPACES = [
    { type: 'halfway', name: 'THE HALFWAY', short: 'THE HALFWAY' },
    P('Gasoline Alley West', 'Gasoline Alley W', 'brown', 50, [3, 15, 45, 130, 230, 320]),
    { type: 'potluck', name: 'POTLUCK', short: 'POTLUCK' },
    P('Gasoline Alley East', 'Gasoline Alley E', 'brown', 70, [5, 25, 70, 200, 340, 460]),
    { type: 'tax', name: 'Paycheque Deductions', short: 'Paycheque Deductions', amount: 180 },
    W('C&E Line, 1891', 'C&E Line 1891'),
    P('Edgar Industrial Park', 'Edgar Industrial', 'sky', 90, [6, 30, 90, 270, 400, 540]),
    { type: 'hail', name: 'HAILSTONE', short: 'HAILSTONE' },
    P('Riverside Industrial Park', 'Riverside Industrial', 'sky', 90, [6, 30, 90, 270, 400, 540]),
    P('Three Mile Bend', 'Three Mile Bend', 'sky', 110, [8, 40, 110, 310, 450, 600]),
    { type: 'snowbank', name: 'STUCK IN THE SNOWBANK', short: 'SNOWBANK' },
    P('Westerner Park', 'Westerner Park', 'pink', 130, [10, 50, 150, 440, 610, 760]),
    J('City Power', 'City Power'),
    P('Bower Place', 'Bower Place', 'pink', 130, [10, 50, 150, 440, 610, 760]),
    P('Red Deer Polytechnic', 'RD Polytechnic', 'pink', 150, [12, 60, 180, 500, 700, 900]),
    W('CPR Bridge, 1908', 'CPR Bridge 1908'),
    P('Red Deer Regional Hospital', 'Regional Hospital', 'orange', 170, [14, 70, 200, 560, 760, 950]),
    { type: 'potluck', name: 'POTLUCK', short: 'POTLUCK' },
    P('Recreation Centre', 'Recreation Centre', 'orange', 170, [14, 70, 200, 560, 760, 950]),
    P('Red Deer Museum + Art Gallery', 'Museum + Gallery', 'orange', 190, [16, 80, 220, 600, 800, 1000]),
    { type: 'dirtlot', name: 'THE SECRET DIRT LOT', short: 'SECRET DIRT LOT' },
    P('Gaetz Lakes Sanctuary', 'Gaetz Lakes', 'red', 210, [18, 90, 250, 700, 875, 1050]),
    { type: 'hail', name: 'HAILSTONE', short: 'HAILSTONE' },
    P('Kerry Wood Nature Centre', 'Kerry Wood Centre', 'red', 210, [18, 90, 250, 700, 875, 1050]),
    P('Collicutt Centre', 'Collicutt Centre', 'red', 230, [20, 100, 300, 750, 925, 1100]),
    W('CPR Station, 1910', 'CPR Station 1910'),
    P('Heritage Ranch', 'Heritage Ranch', 'yellow', 250, [22, 110, 330, 800, 975, 1150]),
    P('Fort Normandeau', 'Fort Normandeau', 'yellow', 250, [22, 110, 330, 800, 975, 1150]),
    J('The Spheroid', 'The Spheroid'),
    P('Waskasoo Park Trails', 'Waskasoo Trails', 'yellow', 270, [24, 120, 360, 850, 1025, 1200]),
    { type: 'whiteout', name: 'WHITEOUT! HIT THE DITCH', short: 'WHITEOUT!' },
    P('Downtown Market', 'Downtown Market', 'green', 290, [26, 130, 390, 900, 1100, 1275]),
    P('Gaetz Avenue', 'Gaetz Avenue', 'green', 290, [26, 130, 390, 900, 1100, 1275]),
    { type: 'potluck', name: 'POTLUCK', short: 'POTLUCK' },
    P('Ross Street', 'Ross Street', 'green', 310, [28, 150, 450, 1000, 1200, 1400]),
    W('CNR Station, 1920\u20131960', 'CNR Station'),
    { type: 'hail', name: 'HAILSTONE', short: 'HAILSTONE' },
    P('Capstone at Riverlands', 'Capstone', 'navy', 340, [35, 175, 500, 1100, 1300, 1500]),
    { type: 'tax', name: 'Digital Meter Fine', short: 'Digital Meter Fine', amount: 90 },
    P('Bower Ponds', 'Bower Ponds', 'navy', 390, [50, 200, 600, 1400, 1700, 2000])
  ];
  SPACES.forEach(function (s, i) { s.i = i; if (s.price) s.hock = Math.floor(s.price / 2); });
  var WHISTLE_RENT = [0, 30, 60, 120, 240];
  var JUICE_MULT = [0, 5, 12];
  var GROUP_MEMBERS = {};
  SPACES.forEach(function (s) { if (s.group) (GROUP_MEMBERS[s.group] = GROUP_MEMBERS[s.group] || []).push(s.i); });
  var WHISTLES = GROUP_MEMBERS.whistle;

  // Rail history blurbs (design doc section 7) shown on the deed popups
  var STORIES = {
    5: 'Rail first reached Red Deer in 1891 on the Calgary and Edmonton Railway. Leonard Gaetz gave the railway a half-interest in his farm so the townsite would be built there.',
    15: 'The steel truss bridge carried trains until 1990 and reopened as a pedestrian bridge in 1992. It is part of the Trans Canada Trail.',
    25: 'The red-brick divisional station at the foot of Ross Street replaced the 1891 wooden station. Soldiers left from here in both World Wars.',
    35: 'The Canadian Northern line reached the city in 1920. Its downtown station stood where the Plaza shopping centre is now, until 1960.'
  };

  // ---- cards. fx: kind + values; the engine resolves them. fact = real Red Deer history, shown small at the bottom ----
  var HAIL = [
    { h: 'TRAIN!', t: 'Stuck behind a train on 67th Street. Counting cars, you hit 112 and lose the will to live. Lose a turn.', fx: { k: 'loseTurn' }, fact: 'After the downtown tracks closed in 1990, CP\'s rail yards moved out near Edgar Industrial Park and 67 Street.' },
    { h: 'Hail Yeah\u2026 Not.', t: 'A hailstorm shreds your vinyl siding and dimples your car like a golf ball. Pay $40 per Shop, $120 per Mega-Plex.', fx: { k: 'repairs', shop: 40, mega: 120 }, fact: 'In late July 1927 a hailstorm hit during the Red Deer Fair; crop losses south and east of the city were close to 100%.' },
    { h: 'Gaetz Avenue: Under Construction (Again).', t: 'Orange cones as far as the eye can see. Detour: go back 3 spaces.', fx: { k: 'back', n: 3 }, fact: 'Gaetz Avenue is named for Rev. Leonard Gaetz, whose farm became the Red Deer townsite in 1890.' },
    { h: 'The App Says Expired.', t: 'Your digital parking session ran out 2 minutes ago. The ticket is already on your windshield. Pay $25.', fx: { k: 'pay', n: 25 }, fact: 'In 2023 the City sold about 1,100 old coin parking meters for $20 each as it switched to digital pay stations and an app.' },
    { h: 'WHITEOUT on Hwy 2.', t: 'You can\'t see the hood ornament. Into the ditch you go. Go straight to the Snowbank. No $250.', fx: { k: 'whiteout' }, fact: 'Red Deer\'s coldest recorded temperature was \u221250.6 \u00b0C on December 17, 1924.' },
    { h: 'Friday Afternoon on Gasoline Alley.', t: 'Everybody heading to the lake stops for gas at once. Move to Gasoline Alley West. Collect $250 if you pass The Halfway.', fx: { k: 'moveTo', to: 1 }, fact: 'Gasoline Alley grew from a cluster of highway gas stations; Red Deer County made it an official hamlet in 2018.' },
    { h: 'Westerner Days Midway.', t: 'You spent $60 trying to win a stuffed banana. You won a keychain. Pay $60.', fx: { k: 'pay', n: 60 }, fact: 'Red Deer\'s first fair was held on Ross Street on October 11, 1892, when the hamlet had about 100 residents.' },
    { h: 'All Aboard!', t: 'Move to the nearest Whistle Stop. If it\'s owned, the owner can catch you for double rent.', fx: { k: 'nearestWhistle' }, fact: 'Rail first reached Red Deer in 1891 on the Calgary and Edmonton Railway.' },
    { h: 'Postcard Weather.', t: 'Go skate on Bower Ponds. Move to Bower Ponds.', fx: { k: 'moveTo', to: 39 }, fact: 'In March 1976 the 70-tonne Cronquist House was hauled across the Red Deer River to its new home at Bower Ponds.' },
    { h: 'Forgot to Plug In.', t: '\u221235 and the block heater cord is lying in the snow. Pay $30 for a boost.', fx: { k: 'pay', n: 30 }, fact: 'During the Great Depression, Red Deer was virtually debt-free and profited from owning its own public utilities.' },
    { h: 'Bridge Walk.', t: 'Take the scenic route across the old rail bridge. Move to CPR Bridge, 1908.', fx: { k: 'moveTo', to: 15 }, fact: 'The CPR bridge carried trains until 1990 and is now part of the Trans Canada Trail.' },
    { h: 'Snow Route Shame.', t: 'You didn\'t move your car for the plow. Pay $50.', fx: { k: 'pay', n: 50 }, fact: 'Red Deer officially became a city on March 25, 1913.' },
    { h: 'Deer on the Road!', t: 'Classic Red Deer. Swerve! Go back 2 spaces.', fx: { k: 'back', n: 2 }, fact: 'The Cree called the river Waskasoo Seepee, "Elk River"; settlers called elk "red deer," and the name stuck.' },
    { h: 'Patio Season!', t: 'It\'s 22 \u00b0C for the one weekend that matters. Move to Ross Street.', fx: { k: 'moveTo', to: 34 }, fact: 'A bronze statue of Leonard Gaetz stands at the corner of Gaetz Avenue and Ross Street.' },
    { h: 'Storm Missed You.', t: 'The big cell veered east at the last second. Collect $50.', fx: { k: 'collect', n: 50 }, fact: 'The Alberta Hail Suppression Project was centred at the Penhold airport.' },
    { h: 'Pothole Season.', t: 'You found the big one on 50th. Pay $75 for an alignment.', fx: { k: 'pay', n: 75 }, fact: 'Red Deer had just 323 people in 1901; the 2021 census counted 100,844.' },
    { h: 'Tow Truck Pass.', t: 'Keep this card. Use it to get out of the Snowbank. Tradeable.', fx: { k: 'pass' }, fact: 'Red Deer sits midway between Calgary and Edmonton, which is why the railway made it a stopping place.' },
    { h: 'Green Lights All the Way.', t: 'A miracle on Gaetz. Move to THE HALFWAY and collect $250.', fx: { k: 'moveTo', to: 0 }, fact: 'Prime Minister Wilfrid Laurier drove the first spike of the Alberta Central Railway in Red Deer on August 10, 1910.' }
  ];
  var POT = [
    { h: 'Rolled Up a Winner!', t: 'You peeled back the rim of your coffee cup and actually won something for once. Collect $100.', fx: { k: 'collect', n: 100 }, fact: 'Waskasoo Park\'s 80+ km of trails are a big reason Red Deer is nicknamed "Park City."' },
    { h: 'You Can\'t End a Conversation.', t: 'A friendly street regular is telling you a great story, and you\'ve said "well, I\'ll let you go" four times without actually going. Miss a turn.', fx: { k: 'loseTurn' }, fact: 'Naturalist Elsie Cassels helped plan the Gaetz Lakes Sanctuary.' },
    { h: 'Church Potluck.', t: 'Seventeen casseroles, zero leftovers. Collect $20 from every player.', fx: { k: 'collectEach', n: 20 }, fact: 'Gaetz Memorial United Church is named after Leonard Gaetz, a Methodist minister.' },
    { h: 'Garage Sale Gold.', t: 'Someone paid real money for your old band shirts. Collect $50.', fx: { k: 'collect', n: 50 }, fact: 'Cronquist House became Alberta\'s first designated Municipal Historic Resource in 1983.' },
    { h: 'Minor Hockey Fundraiser.', t: 'Bought 40 chocolate bars. Ate 12. Pay $50.', fx: { k: 'pay', n: 50 }, fact: 'The Centrium at Westerner Park opened in 1991 and is home to the WHL\'s Red Deer Rebels.' },
    { h: 'Collicutt Bake Sale.', t: 'Your Nanaimo bars sold out in four minutes. Collect $40.', fx: { k: 'collect', n: 40 }, fact: 'The Collicutt Centre opened on June 15, 2001, named for Steve and Lorna Collicutt\'s donation of more than $1 million.' },
    { h: 'The Tax Folks Owe YOU.', t: 'A surprise refund cheque in the mailbox. Collect $60.', fx: { k: 'collect', n: 60 }, fact: 'Raymond Gaetz, Leonard\'s eldest son, was elected the town\'s first mayor in 1901.' },
    { h: 'Grandpa\'s Quonset.', t: 'You inherited his shop full of "valuable" tools. Collect $100.', fx: { k: 'collect', n: 100 }, fact: 'The village of North Red Deer was amalgamated with the city in 1948.' },
    { h: 'Six Hours in Emerg.', t: 'Hockey-puck-to-the-face. Plus hospital parking. Pay $40.', fx: { k: 'pay', n: 40 }, fact: 'Red Deer Memorial Hospital opened in 1904, honouring local men killed in the South African War.' },
    { h: 'Nature Centre Volunteer.', t: 'You taught 30 kids what a grebe is. Collect $25.', fx: { k: 'collect', n: 25 }, fact: 'The Kerry Wood Nature Centre opened in August 1986, named for local naturalist and author Kerry Wood.' },
    { h: 'Basement Flood.', t: 'Spring melt found the crack in your foundation. Pay $80.', fx: { k: 'pay', n: 80 }, fact: 'Red Deer\'s summer fair was cancelled in 1910 and 1911 over money troubles, and not again until 2020.' },
    { h: 'Pancake Breakfast.', t: 'Free flapjacks downtown during Westerner Days. Collect $15.', fx: { k: 'collect', n: 15 }, fact: 'The first Westerner fair on today\'s south-end grounds was held in 1983.' },
    { h: 'Snow Angel.', t: 'Your neighbour snowblowed your whole driveway. Collect $20 and pass the kindness on.', fx: { k: 'collect', n: 20 }, fact: 'Red Deer\'s hottest days on record hit 37.2 \u00b0C, in 1906, 1924 and 1937.' },
    { h: 'Property Assessment.', t: 'The city says your Shops are worth more. Congrats? Pay $25 per Shop, $100 per Mega-Plex.', fx: { k: 'repairs', shop: 25, mega: 100 }, fact: 'The City has owned and run Red Deer\'s electric system since buying out Western General Electric in 1926.' },
    { h: 'Night Class Pays Off.', t: 'That course at the Polytech landed you a raise. Collect $100.', fx: { k: 'collect', n: 100 }, fact: 'Red Deer Polytechnic was founded in 1964 as a junior college and took its current name in 2021.' },
    { h: 'Retro Jacket Sold.', t: 'Your Canada Winter Games volunteer jacket fetched a tidy sum online. Collect $45.', fx: { k: 'collect', n: 45 }, fact: 'Red Deer hosted the 2019 Canada Winter Games.' },
    { h: 'Tow Truck Pass.', t: 'Your brother-in-law owes you one. Keep this card. Tradeable.', fx: { k: 'pass' }, fact: 'In WWII a large army training camp stood where the Memorial Centre and Lindsay Thurber High School are now.' },
    { h: 'Fort Day Trip.', t: 'Take the kids to Fort Normandeau. Move to Fort Normandeau. Collect $250 if you pass The Halfway.', fx: { k: 'moveTo', to: 27 }, fact: 'Fort Normandeau began as a stopping house at the Red Deer Crossing, fortified in 1885 and rebuilt as a replica in 1974.' }
  ];

  root.RDR_BOARD = { SPACES: SPACES, GROUPS: GROUPS, GROUP_MEMBERS: GROUP_MEMBERS, WHISTLES: WHISTLES, WHISTLE_RENT: WHISTLE_RENT, JUICE_MULT: JUICE_MULT,
    STORIES: STORIES, HAIL: HAIL, POT: POT };
})(typeof window !== 'undefined' ? window : globalThis);
