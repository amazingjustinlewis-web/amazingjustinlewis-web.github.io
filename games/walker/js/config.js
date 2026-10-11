/* WALKER - shared config: rooms, the six-button pages, moments, settings defaults. */
(function (root) {
  var C = root.WALKER_CONFIG = {
    TITLE: 'WALKER', version: '0.4',
    peerPrefix: 'ztp-walker-v04-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/games/walker/controller.html',
    // Each page = one area. border = page colour. Buttons: id, picture (emoji), colour.
    // v0.2: page 'home' = six categories; each category page = six activities. Same button id may sit on two pages.
    pages: [
      { id: 'home', name: 'Home', icon: '\uD83C\uDFE0', border: '#7ed957', buttons: [
        { id: 'cat_bouncy', pic: '\uD83C\uDFF0', color: '#ff8fc7', say: 'bouncy castle', page: 'bouncy' },
        { id: 'cat_play', pic: '\uD83D\uDEDD', color: '#ffd23f', say: 'playground', page: 'play' },
        { id: 'cat_zoo', pic: '\uD83D\uDC34', color: '#e0b97a', say: 'petting zoo', page: 'zoo' },
        { id: 'cat_water', pic: '\uD83D\uDCA6', color: '#6fd0ff', say: 'water park', page: 'water' },
        { id: 'cat_rides', pic: '\uD83C\uDFA2', color: '#ff9b6b', say: 'rides', page: 'rides' },
        { id: 'cat_quiet', pic: '\uD83C\uDF33', color: '#a8e07a', say: 'quiet places', page: 'quiet' } ] },
      { id: 'bouncy', name: 'Bouncy', icon: '\uD83C\uDFF0', border: '#ff8fc7', buttons: [
        { id: 'b_bounce', pic: '\uD83E\uDD38', color: '#ff8fc7' },
        { id: 'b_flip', pic: '\uD83D\uDD04', color: '#c79bff' },
        { id: 'b_ball', pic: '\uD83C\uDFC0', color: '#ffa14f' },
        { id: 'b_slide', pic: '\uD83D\uDEDD', color: '#7fd7ff' },
        { id: 'b_cloud', pic: '\u2601\uFE0F', color: '#bfe6ff' },
        { id: 'b_kids', pic: '\uD83D\uDC4B', color: '#ffe066' } ] },
      { id: 'play', name: 'Playground', icon: '\uD83D\uDEDD', border: '#ffd23f', buttons: [
        { id: 'p_slide', pic: '\uD83D\uDEDD', color: '#ff9b6b' },
        { id: 'p_swing', pic: '<svg viewBox="0 0 64 64"><path d="M8 58 L20 8 L32 58 M32 58 L44 8 L56 58" fill="none" stroke="#5a6b80" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8 H50" stroke="#5a6b80" stroke-width="6" stroke-linecap="round"/><g transform="rotate(-18 32 9)"><path d="M24 9 V42 M40 9 V42" stroke="#444" stroke-width="2.5"/><rect x="20" y="40" width="24" height="6" rx="3" fill="#e84a4a"/></g></svg>', color: '#7fd7ff' },
        { id: 'p_climb', pic: '\uD83E\uDDD7', color: '#9be36b' },
        { id: 'p_spin', pic: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="44" rx="27" ry="10" fill="#e0a800"/><ellipse cx="32" cy="40" rx="27" ry="10" fill="#ffd23f"/><path d="M32 40 V20 M14 40 V26 H26 M50 40 V26 H38" fill="none" stroke="#e84a4a" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="19" r="4" fill="#7fb8ff"/><path d="M6 24 A28 14 0 0 1 22 12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 5"/><path d="M58 24 A28 14 0 0 0 42 12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 5"/></svg>', color: '#c79bff' },
        { id: 'p_seesaw', pic: '<svg viewBox="0 0 64 64"><path d="M24 58 L32 40 L40 58 Z" fill="#a0683c"/><g transform="rotate(-16 32 40)"><rect x="4" y="36" width="56" height="7" rx="3.5" fill="#2f8fd8"/><circle cx="10" cy="27" r="6" fill="#ffb36b"/><rect x="6" y="31" width="8" height="6" rx="2" fill="#ff6b6b"/><circle cx="54" cy="27" r="6" fill="#f2c9a0"/><rect x="50" y="31" width="8" height="6" rx="2" fill="#7fb8ff"/></g></svg>', color: '#ffd23f' },
        { id: 'p_sand', pic: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="56" rx="30" ry="7" fill="#e8c27a"/><rect x="14" y="30" width="36" height="24" fill="#f0cf8a"/><rect x="10" y="20" width="12" height="34" fill="#e8c27a"/><rect x="42" y="20" width="12" height="34" fill="#e8c27a"/><path d="M10 20 h3v-4h3v4h3v-4h3v4 M42 20 h3v-4h3v4h3v-4h3v4" fill="#e8c27a"/><path d="M28 54 v-10 a4 4 0 0 1 8 0 v10Z" fill="#b8925a"/><path d="M48 16 V4 L58 8 L48 11" fill="#ff6b6b" stroke="#8a6a4a" stroke-width="1.5"/><path d="M2 38 L8 38 L7 50 L3 50Z" fill="#ff7a6b"/></svg>', color: '#f5d39b' } ] },
      { id: 'zoo', name: 'Petting zoo', icon: '\uD83D\uDC34', border: '#e0b97a', buttons: [
        { id: 'z_horse', pic: '\uD83D\uDC0E', color: '#d9a46b', say: 'horse' },
        { id: 'z_pony', pic: '\uD83D\uDC34', color: '#f0c48a', say: 'pony' },
        { id: 'z_goat', pic: '\uD83D\uDC10', color: '#e8e0c8', say: 'goats' },
        { id: 'z_bunny', pic: '\uD83D\uDC07', color: '#f7c6d9', say: 'bunnies' },
        { id: 'z_alpaca', pic: '\uD83E\uDD99', color: '#f3e3c3', say: 'alpaca' },
        { id: 'z_duck', pic: '\uD83D\uDC25', color: '#ffe066', say: 'ducklings' } ] },
      { id: 'water', name: 'Water park', icon: '\uD83D\uDCA6', border: '#6fd0ff', buttons: [
        { id: 'w_slide', pic: '<svg viewBox="0 0 64 64"><rect x="6" y="10" width="5" height="40" fill="#ff8f4f"/><rect x="18" y="10" width="5" height="40" fill="#ff8f4f"/><rect x="3" y="7" width="23" height="5" rx="2" fill="#ff6b6b"/><path d="M14 12 C34 12 22 34 40 38 C50 40 52 46 56 50" fill="none" stroke="#ffd23f" stroke-width="9" stroke-linecap="round"/><path d="M14 12 C34 12 22 34 40 38 C50 40 52 46 56 50" fill="none" stroke="#6fd0ff" stroke-width="3" stroke-linecap="round"/><path d="M2 56 Q10 50 18 56 T34 56 T50 56 T64 56 V64 H2Z" fill="#2f8fd8"/><circle cx="52" cy="48" r="3" fill="#bfe8ff"/><circle cx="58" cy="46" r="2.4" fill="#bfe8ff"/></svg>', color: '#6fd0ff', say: 'water slide' },
        { id: 'w_river', pic: '\uD83D\uDEDF', color: '#8fe3d6', say: 'lazy river' },
        { id: 'w_splash', pic: '\u26F2', color: '#a8dcff', say: 'splash pad' },
        { id: 'w_bucket', pic: '\uD83E\uDEA3', color: '#ffd23f', say: 'big bucket' },
        { id: 'w_float', pic: '\uD83C\uDFCA', color: '#7fb8ff', say: 'float' },
        { id: 'w_boats', pic: '\uD83D\uDEA4', color: '#ff8f8f', say: 'bumper boats' } ] },
      { id: 'rides', name: 'Rides', icon: '\uD83C\uDFA2', border: '#ff9b6b', buttons: [
        { id: 'r_coaster', pic: '\uD83C\uDFA2', color: '#ff9b6b', say: 'roller coaster' },
        { id: 'r_rocket', pic: '\uD83D\uDE80', color: '#8fb8ff', say: 'rocket' },
        { id: 'w_boats', pic: '\uD83D\uDEA4', color: '#ff8f8f', say: 'bumper boats' },
        { id: 'z_horse', pic: '\uD83D\uDC0E', color: '#d9a46b', say: 'horse' },
        { id: 'p_swing', pic: '<svg viewBox="0 0 64 64"><path d="M8 58 L20 8 L32 58 M32 58 L44 8 L56 58" fill="none" stroke="#5a6b80" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8 H50" stroke="#5a6b80" stroke-width="6" stroke-linecap="round"/><g transform="rotate(-18 32 9)"><path d="M24 9 V42 M40 9 V42" stroke="#444" stroke-width="2.5"/><rect x="20" y="40" width="24" height="6" rx="3" fill="#e84a4a"/></g></svg>', color: '#7fd7ff', say: 'swings' },
        { id: 'r_car', pic: '\uD83D\uDE97', color: '#ffd23f', say: 'little car' } ] },
      { id: 'quiet', name: 'Quiet', icon: '\uD83C\uDF33', border: '#a8e07a', buttons: [
        { id: 'q_bench', pic: '\uD83E\uDE91', color: '#c9a77a', say: 'bench' },
        { id: 'q_pond', pic: '\uD83E\uDD86', color: '#6fe3d6', say: 'pond' },
        { id: 'q_sky', pic: '\u2601\uFE0F', color: '#bfe6ff', say: 'watch clouds' },
        { id: 'w_river', pic: '\uD83D\uDEDF', color: '#8fe3d6', say: 'lazy river' },
        { id: 'z_bunny', pic: '\uD83D\uDC07', color: '#f7c6d9', say: 'bunnies' },
        { id: 'buddy', pic: '\uD83D\uDC3E', color: '#ffb36b', say: 'buddy' } ] }
    ],
    moments: {
      busker: { pic: '\uD83C\uDFB8', say: 'Someone is playing music' },
      fish: { pic: '\uD83D\uDC1F', say: 'A fish jumped in the puddle' },
      deer: { pic: '\uD83E\uDD8C', say: 'A deer! It says hello' },
      chip: { pic: '\uD83D\uDC3F\uFE0F', say: 'Chipmunks' },
      laugh: { pic: '\uD83D\uDE02', say: 'They are laughing so much' },
      ducks: { pic: '\uD83E\uDD86', say: 'Ducks' }
    },
    companions: [ { id: 'none', pic: '\u2716\uFE0F' }, { id: 'monkey', pic: '\uD83D\uDC35' }, { id: 'dog', pic: '\uD83D\uDC36' }, { id: 'bear', pic: '\uD83E\uDDF8' } ],
    chat: [ { id: 0, label: 'Off' }, { id: 1, label: 'Once in a while' }, { id: 2, label: 'Often' }, { id: 3, label: 'Everything' } ],
    chatGap: [1e9, 45, 16, 5],               // seconds between companion remarks
    defaults: { companion: 'dog', chat: 1, car: false, awake: true, hue: false, hueCap: 60 },
    quality: { rungs: [1.5, 1.2, 1.0, 0.8, 0.6], downBelowFps: 40, upAboveFps: 57 }
  };
  root.LR_CONFIG = { peerPrefix: C.peerPrefix, iceServers: C.iceServers };
})(window);
