/* RED DEER RICH - the board (40 spaces, Present Day) and the two card decks (v0.3: Red Deer Randomness + Secret Finds).
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
    { type: 'finds', name: 'SECRET FINDS', short: 'SECRET FINDS' },
    P('Gasoline Alley East', 'Gasoline Alley E', 'brown', 70, [5, 25, 70, 200, 340, 460]),
    { type: 'tax', name: 'Paycheque Deductions', short: 'Paycheque Deductions', amount: 180 },
    W('C&E Line, 1891', 'C&E Line 1891'),
    P('Edgar Industrial Park', 'Edgar Industrial', 'sky', 90, [6, 30, 90, 270, 400, 540]),
    { type: 'random', name: 'RED DEER RANDOMNESS', short: 'RANDOMNESS' },
    P('Riverside Industrial Park', 'Riverside Industrial', 'sky', 90, [6, 30, 90, 270, 400, 540]),
    P('Three Mile Bend', 'Three Mile Bend', 'sky', 110, [8, 40, 110, 310, 450, 600]),
    { type: 'snowbank', name: 'STUCK IN THE SNOWBANK', short: 'SNOWBANK' },
    P('Westerner Park', 'Westerner Park', 'pink', 130, [10, 50, 150, 440, 610, 760]),
    J('City Power', 'City Power'),
    P('Bower Place', 'Bower Place', 'pink', 130, [10, 50, 150, 440, 610, 760]),
    P('Red Deer Polytechnic', 'RD Polytechnic', 'pink', 150, [12, 60, 180, 500, 700, 900]),
    W('CPR Bridge, 1908', 'CPR Bridge 1908'),
    P('Red Deer Regional Hospital', 'Regional Hospital', 'orange', 170, [14, 70, 200, 560, 760, 950]),
    { type: 'finds', name: 'SECRET FINDS', short: 'SECRET FINDS' },
    P('Recreation Centre', 'Recreation Centre', 'orange', 170, [14, 70, 200, 560, 760, 950]),
    P('Red Deer Museum + Art Gallery', 'Museum + Gallery', 'orange', 190, [16, 80, 220, 600, 800, 1000]),
    { type: 'dirtlot', name: 'THE SECRET DIRT LOT', short: 'SECRET DIRT LOT' },
    P('Gaetz Lakes Sanctuary', 'Gaetz Lakes', 'red', 210, [18, 90, 250, 700, 875, 1050]),
    { type: 'random', name: 'RED DEER RANDOMNESS', short: 'RANDOMNESS' },
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
    { type: 'finds', name: 'SECRET FINDS', short: 'SECRET FINDS' },
    P('Ross Street', 'Ross Street', 'green', 310, [28, 150, 450, 1000, 1200, 1400]),
    W('CNR Station, 1920\u20131960', 'CNR Station'),
    { type: 'random', name: 'RED DEER RANDOMNESS', short: 'RANDOMNESS' },
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

  // ---- v0.3 card decks. fx: kind + values; the engine resolves them.
  // era: which era skin a card belongs to (design doc section 13): 'pioneer' | 'punk2000' | 'present' | 'future', or 'any'
  // (timeless). For now every era draws every card; deckCards(deck, era) is how a future era skin filters its stories.
  //
  // RED DEER RANDOMNESS (the Chance-style deck): quirky everyday Red Deer happenings. Playful, kid-friendly.
  var RANDOM = [
    { h: 'Chinook Arch!', t: 'A warm chinook blows in and it\'s +10 in January. Everyone\'s out for a walk. Collect $40.', fx: { k: 'collect', n: 40 }, era: 'any' },
    { h: 'Hail Yeah\u2026 Not.', t: 'A hailstorm dimples every car on the block like a golf ball. Pay $40 per Shop, $120 per Mega-Plex.', fx: { k: 'repairs', shop: 40, mega: 120 }, era: 'any' },
    { h: 'Orange Cones Everywhere', t: 'Road construction on Gaetz Avenue (again). Follow the detour: go back 3 spaces.', fx: { k: 'back', n: 3 }, era: 'any' },
    { h: 'Green Lights on Gaetz!', t: 'Somehow every light on Gaetz Avenue is green. Zoom to THE HALFWAY and collect $250.', fx: { k: 'moveTo', to: 0 }, era: 'any' },
    { h: 'Train on 67th Street', t: 'Stuck behind a really, really long train. You counted 112 cars! Lose a turn.', fx: { k: 'loseTurn' }, era: 'present' },
    { h: 'Westerner Days Midway', t: 'You spent $60 on midway games and won a giant stuffed banana. Pay $60.', fx: { k: 'pay', n: 60 }, era: 'any' },
    { h: 'Westerner Days Parade', t: 'Grab a curb spot for the parade! Move to Westerner Park.', fx: { k: 'moveTo', to: 11 }, era: 'any' },
    { h: 'Skating at Bower Ponds', t: 'The ice is smooth as glass. Skate over to Bower Ponds.', fx: { k: 'moveTo', to: 39 }, era: 'any' },
    { h: 'Geese on the Trail', t: 'A family of Canada geese owns the path today. Wait politely: go back 2 spaces.', fx: { k: 'back', n: 2 }, era: 'any' },
    { h: 'Deer in the Garden', t: 'A deer munched your whole tulip bed overnight. Pay $30 for new bulbs.', fx: { k: 'pay', n: 30 }, era: 'any' },
    { h: 'Forgot to Plug In', t: '\u221235 and the block heater cord is lying in the snow. Pay $40 for a boost.', fx: { k: 'pay', n: 40 }, era: 'any' },
    { h: 'Best Snow Fort Ever', t: 'Your snow fort is the talk of the street. Collect $25.', fx: { k: 'collect', n: 25 }, era: 'any' },
    { h: 'WHITEOUT on Highway 2', t: 'You can\'t see past the hood. Into the ditch you go! Go straight to the Snowbank. No $250.', fx: { k: 'whiteout' }, era: 'any' },
    { h: 'Pothole Season', t: 'You found the big one on 50th Street. Pay $75 for a new tire.', fx: { k: 'pay', n: 75 }, era: 'any' },
    { h: 'Storm Missed You', t: 'The big thunderstorm swung east at the last second. Collect $50.', fx: { k: 'collect', n: 50 }, era: 'any' },
    { h: 'Mosquito Ambush', t: 'The trail mosquitoes found you. Pay $20 for bug spray.', fx: { k: 'pay', n: 20 }, era: 'any' },
    { h: 'Farmers\' Market Saturday', t: 'Your homemade saskatoon jam sold out by 10 a.m. Collect $60.', fx: { k: 'collect', n: 60 }, era: 'any' },
    { h: 'Patio Weather!', t: 'It\'s 22 \u00b0C on the one weekend that matters. Move to Ross Street.', fx: { k: 'moveTo', to: 34 }, era: 'any' },
    { h: 'All Aboard!', t: 'Move to the nearest Whistle Stop. If it\'s owned, the owner can catch you for double rent.', fx: { k: 'nearestWhistle' }, era: 'any' },
    { h: 'Tow Truck Pass', t: 'Your neighbour has a truck and a big heart. Keep this card to get out of the Snowbank. Tradeable.', fx: { k: 'pass' }, era: 'any' }
  ];
  // SECRET FINDS (the Community-Chest-style deck): each card is a short, TRUE story from Red Deer's history with a game
  // effect tied to it. Every story is sourced: data/secret-finds-sources.md lists each card's source URL(s).
  // story = what the TV card shows (1-3 short sentences); more = optional extra for "read more" on the phones.
  var FINDS = [
    { h: 'Why "Red Deer"?', year: 'Long ago', era: 'pioneer',
      story: 'The Cree name for the river means "Elk River." Fur traders, likely from Scotland, seem to have mixed up the elk with the red deer back home, and the name stuck.',
      more: 'The river\'s Cree name is Waskasoo Seepee, and Waskasoo Creek still carries it. Red Deer is on the traditional territory of the Siksikaitsitapi (Blackfoot Confederacy), Tsuut\'ina, Stoney Nakoda, Cree, Saulteaux and M\u00e9tis peoples, and the area is covered by Treaty 6 (1876) and Treaty 7 (1877).',
      t: 'Follow the creek: move to Waskasoo Park Trails.', fx: { k: 'moveTo', to: 29 },
      src: ['https://www.thecanadianencyclopedia.ca/en/article/red-deer', 'https://www.reddeer.ca/media/reddeerca/business-in-red-deer/planning-and-development-of-property/planning/Waskasoo-Community-Plan---Final-February-10-2016.pdf'] },
    { h: 'The Safe Crossing', year: '1884', era: 'pioneer',
      story: 'Indigenous people knew the Red Deer Crossing as the safest place to cross the river for a long way. In 1884 Robert McClellan built a stopping house there, and in 1885 soldiers fortified it.',
      more: 'The fort takes its name from Lt. J.E. B\u00e9dard Normandeau, who commanded the 65th Mount Royal Rifles soldiers there. The North-West Mounted Police used the post until 1893.',
      t: 'Move to Fort Normandeau.', fx: { k: 'moveTo', to: 27 },
      src: ['https://www.waskasoopark.ca/historic-fort-normandeau/about', 'https://www.thecanadianencyclopedia.ca/en/article/red-deer'] },
    { h: 'Leonard Gaetz Makes a Deal', year: '1890', era: 'pioneer',
      story: 'When the railway came through in 1890, Leonard Gaetz offered it a half share of the new townsite if it would build the town on his farm. It did, and the main street became Gaetz Avenue.',
      more: 'The first settlement had grown up at the river crossing. In 1891 the community moved about 7 km downstream to the new railway.',
      t: 'Move to Gaetz Avenue.', fx: { k: 'moveTo', to: 32 },
      src: ['https://reddeeradvocate.com/2022/11/23/dawe-the-naming-of-gaetz-avenue/', 'https://www.thecanadianencyclopedia.ca/en/article/red-deer'] },
    { h: 'The First Fair', year: '1892', era: 'pioneer',
      story: 'On October 11, 1892, when Red Deer had only about 100 people, it held its first fair on Ross Street. That evening the whole community turned out for a big harvest supper.',
      more: 'Livestock was shown on the grounds beside the Wilkins Block, a two-storey building on the north side of Ross Street. The fairs grew into today\'s Westerner Days.',
      t: 'Harvest supper! Collect $10 from every player.', fx: { k: 'collectEach', n: 10 },
      src: ['https://www.reddeer.ca/about-red-deer/history/history-of-red-deer/uniquely-red-deer/westerner/'] },
    { h: '24 Wooden Pails', year: '1904', era: 'pioneer',
      story: 'Red Deer\'s first firefighting gear was 24 wooden pails, three ladders and a hand-operated hose reel. In 1904 a fire broke out on the very night voters said no to a new fire engine.',
      more: 'The town soon formed a 16-man volunteer fire brigade. Red Deer relied on volunteer firefighters until 1969.',
      t: 'Chip in for the fire brigade: pay $50.', fx: { k: 'pay', n: 50 },
      src: ['https://www.reddeer.ca/about-red-deer/history/history-of-red-deer/public-services/fire-department/'] },
    { h: 'Stuck to the Seats', year: '1910', era: 'pioneer',
      story: 'During Prime Minister Wilfrid Laurier\'s 1910 visit, a storm chased a big meeting into the Lyric Theatre. The seats had just been given fresh coats of shellac, and many people left bits of their clothes behind!',
      more: 'On August 10, 1910, Laurier drove the first spike of the Alberta Central Railway on Gaetz Avenue, until a summer thunderstorm cut the ceremony short.',
      t: 'You\'re stuck to your seat. Lose a turn.', fx: { k: 'loseTurn' },
      src: ['https://forthjunction.ca/dawe-laurier.htm', 'https://www.reddeer.ca/about-red-deer/history/history-of-red-deer/getting-around/railroads/'] },
    { h: 'A City, Quietly', year: '1913', era: 'pioneer',
      story: 'Red Deer became a city on March 25, 1913, with very little fanfare. When council agreed to ask for city status, the new mayor, F.W. Galbraith, invited councillors and town staff to an oyster dinner.',
      more: 'Red Deer had about 3,000 people then, usually thought too small to be a city. When it became a town in 1901 it had just 323 residents.',
      t: 'Your treat: pay $25 for the oysters.', fx: { k: 'pay', n: 25 },
      src: ['http://forthjunction.ca/dawe-red-deer-city.htm'] },
    { h: 'Oil Fever!', year: '1914', era: 'pioneer',
      story: 'When oil was struck at Turner Valley in 1914, people rushed to the Red Deer land office to file claims. The newspaper said one barber left a customer sitting in his chair! The local wells came up dry.',
      t: 'Your well came up dry. Pay $50.', fx: { k: 'pay', n: 50 },
      src: ['https://www.reddeer.ca/about-red-deer/history/history-of-red-deer/businesses/oil--gas/'] },
    { h: 'A Home for the Birds', year: '1924', era: 'pioneer',
      story: 'Developers and timber companies wanted J.J. Gaetz\'s land by the lakes, but he chose to keep it for wildlife. In 1924 it became a federal migratory bird sanctuary, the oldest one in Alberta.',
      more: 'Locals call it the Gaetz Lakes Sanctuary. Its two oxbow lakes were once part of the Red Deer River, and many kinds of ducks, plus Canada geese, nest there.',
      t: 'Move to Gaetz Lakes Sanctuary.', fx: { k: 'moveTo', to: 21 },
      src: ['https://www.canada.ca/en/environment-climate-change/services/migratory-bird-sanctuaries/locations/red-deer.html'] },
    { h: 'Hail at the Fair', year: '1927', era: 'pioneer',
      story: 'Late on the second day of the 1927 Red Deer Fair, a huge thunderstorm and hailstorm struck. South and east of the city, almost every crop was wiped out.',
      more: 'Farmers sometimes call hail "the great white combine." Alberta is "next year country," and 1928 brought one of the best harvests in years.',
      t: 'Pay $75 for the hail damage.', fx: { k: 'pay', n: 75 },
      src: ['https://reddeeradvocate.com/2020/07/22/michael-dawe-three-minutes-of-hell-left-extensive-damage-to-region-in-1927/'] },
    { h: 'A Day Too Early', year: '1940', era: 'pioneer',
      story: 'In 1940 the army built a big training camp in Red Deer, a city of about 2,800 people. When it opened that October, 200 men showed up a day earlier than expected, and it was chaos!',
      more: 'After the war one of the camp\'s drill halls became the Memorial Centre, and the old motor pool building is still the Red Deer Armouries.',
      t: 'Surprise guests! Pay $40 for extra supper.', fx: { k: 'pay', n: 40 },
      src: ['https://reddeeradvocate.com/2019/05/28/michael-dawe-military-camp-in-red-deer-offered-training-during-wwii/'] },
    { h: 'The Green Onion', year: '1957', era: 'present',
      story: 'The Horton Water Spheroid, fondly called the "Green Onion," was built in 1957. It held 500,000 gallons, and at the time it was the largest spheroid-shaped water reservoir in the world.',
      more: 'It stands 40.2 metres tall and took 240 tonnes of steel to build.',
      t: 'Move to The Spheroid.', fx: { k: 'moveTo', to: 28 },
      src: ['https://www.reddeer.ca/about-red-deer/history/heritage/community-heritage-planning/red-deers-inventory-of-heritage-sites/mountview-heritage-sites-gallery/cul---horton-water-spheroid.html'] },
    { h: 'College in the Hallways', year: '1964', era: 'present',
      story: 'Red Deer Junior College opened in 1964 with 119 students, in borrowed space at Lindsay Thurber high school. Today it is Red Deer Polytechnic.',
      more: 'The college moved to its own campus by 1976 and took the name Red Deer Polytechnic in 2021.',
      t: 'Scholarship! Collect $75.', fx: { k: 'collect', n: 75 },
      src: ['https://rdpolytech.ca/news/historic-60-year-timeline-rdp'] },
    { h: 'A Fort for a Dollar', year: '1983', era: 'punk2000',
      story: 'In 1983 the City of Red Deer bought Fort Normandeau and nearly nine acres of land around it from the province for just $1.',
      more: 'A new interpretive centre was built beside the 1974 replica fort, and the Fort Normandeau Interpretive Centre opened in 1985.',
      t: 'What a bargain! Collect $100.', fx: { k: 'collect', n: 100 },
      src: ['https://reddeeradvocate.com/2010/05/31/fort-normandeau-celebrates-125-years/', 'https://www.thecanadianencyclopedia.ca/en/article/red-deer'] },
    { h: 'The Kid Who Loved the Woods', year: '1986', era: 'punk2000',
      story: 'Kerry Wood came to Red Deer as a boy in 1918 and grew up to write thousands of stories and newspaper columns. The nature centre that opened in 1986 is named for him.',
      more: 'For many years he was the volunteer warden of the Gaetz Lakes Sanctuary, where the Kerry Wood Nature Centre now stands.',
      t: 'Move to Kerry Wood Nature Centre.', fx: { k: 'moveTo', to: 23 },
      src: ['https://www.waskasoopark.ca/kerry-wood-nature-centre/about', 'https://www.waskasoopark.ca/kerry-wood-nature-centre/places/interpretive-centre'] },
    { h: 'Francis the Pig', year: '1990', era: 'punk2000',
      story: 'In 1990 a pig escaped a Red Deer meat plant by jumping a 1.2 m wall, then hid out along the trails for months while people across Canada followed his adventures. Today "Francis" is a bronze statue.',
      more: 'Schoolchildren wrote letters asking that he be kept safe. His bronze "ghost" was put on Gaetz Avenue in 1998 and moved near the Central Spray & Play in 2013.',
      t: 'Escape artist! Keep this as a Tow Truck Pass. Tradeable.', fx: { k: 'pass' },
      src: ['https://www.reddeer.ca/about-red-deer/history/history-of-red-deer/personalities-of-red-deer/francis-the-pig/'] },
    { h: 'The Official Cookie', year: '1996', era: 'punk2000',
      story: 'Red Deer has an official cookie! In 1996 judges tasted 30 entries and picked the Caramel Surprise: a chocolate cookie with a caramel hidden inside.',
      more: 'The winning baker said biting into it is like visiting Red Deer: "You\'ll get a pleasant surprise."',
      t: 'Bake sale! Collect $40.', fx: { k: 'collect', n: 40 },
      src: ['https://www.reddeer.ca/about-red-deer/history/history-of-red-deer/uniquely-red-deer/emblems--symbols/red-deers-official-cookie/'] },
    { h: 'The Cup Comes Home', year: '2001', era: 'punk2000',
      story: 'The Red Deer Rebels hockey team was created in 1992 to play in the new Centrium. In May 2001 they won the Memorial Cup and brought it home to Red Deer for the first time.',
      t: 'Victory party! Collect $50.', fx: { k: 'collect', n: 50 },
      src: ['https://www.reddeer.ca/about-red-deer/history/history-of-red-deer/uniquely-red-deer/hockey/'] },
    { h: 'Canada Winter Games', year: '2019', era: 'present',
      story: 'From February 15 to March 3, 2019, Red Deer hosted the Canada Winter Games, with athletes in 19 sports. It was only the third Alberta city to host them.',
      more: 'Organizers planned for more than 5,000 volunteers. Lethbridge (1975) and Grande Prairie (1995) were the first two Alberta hosts.',
      t: 'You volunteered! Collect $20 from every player.', fx: { k: 'collectEach', n: 20 },
      src: ['https://www.canada.ca/en/canadian-heritage/campaigns/winter-games-2019/facts-statistics.html'] },
    { h: 'The Bridge They Saved', year: '1908', era: 'present',
      story: 'The CPR built its steel bridge over the Red Deer River in 1908, and trains used it until 1990. Residents saved it, and after major repairs it reopened as a pedestrian bridge in September 2026.',
      more: 'City Council made it a Municipal Historic Resource in 1991.',
      t: 'Move to CPR Bridge, 1908.', fx: { k: 'moveTo', to: 15 },
      src: ['https://reddeer.ca/whats-happening/news-room/historic-cpr-pedestrian-bridge-officially-reopens-to-the-community.html'] }
  ];
  // deck metadata (display names live in config: C.decks)
  var DECKS = { random: RANDOM, finds: FINDS };
  // indexes of a deck's cards for an era skin; null/'all' = every card. Falls back to the whole deck if an era has too few.
  function deckCards(deck, era) {
    var src = DECKS[deck] || [], all = src.map(function (_, i) { return i; });
    if (!era || era === 'all') return all;
    var pick = all.filter(function (i) { return src[i].era === era || src[i].era === 'any'; });
    return pick.length >= 6 ? pick : all;
  }

  root.RDR_BOARD = { SPACES: SPACES, GROUPS: GROUPS, GROUP_MEMBERS: GROUP_MEMBERS, WHISTLES: WHISTLES, WHISTLE_RENT: WHISTLE_RENT, JUICE_MULT: JUICE_MULT,
    STORIES: STORIES, RANDOM: RANDOM, FINDS: FINDS, DECKS: DECKS, deckCards: deckCards };
})(typeof window !== 'undefined' ? window : globalThis);
