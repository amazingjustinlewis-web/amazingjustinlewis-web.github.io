/* WALKER - shared config: rooms, the six-button pages, moments, settings defaults. */
(function (root) {
  var C = root.WALKER_CONFIG = {
    TITLE: 'WALKER', version: '0.1',
    peerPrefix: 'ztp-walker-v01-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/games/walker/controller.html',
    // Each page = one area. border = page colour. Buttons: id, picture (emoji), colour.
    pages: [
      { id: 'go', name: 'Go', icon: '\uD83E\uDDED', border: '#7ed957', buttons: [
        { id: 'go_bouncy', pic: '\uD83C\uDFF0', color: '#ff8fc7', say: 'bouncy castle' },
        { id: 'go_play', pic: '\uD83D\uDEDD', color: '#ffd23f', say: 'playground' },
        { id: 'go_rocket', pic: '\uD83D\uDE80', color: '#8fb8ff', say: 'rocket' },
        { id: 'go_pond', pic: '\uD83E\uDD86', color: '#6fe3d6', say: 'pond' },
        { id: 'go_bench', pic: '\uD83C\uDF33', color: '#a8e07a', say: 'bench' },
        { id: 'buddy', pic: '\uD83D\uDC3E', color: '#ffb36b', say: 'buddy' } ] },
      { id: 'bouncy', name: 'Bouncy', icon: '\uD83C\uDFF0', border: '#ff8fc7', buttons: [
        { id: 'b_bounce', pic: '\uD83E\uDD38', color: '#ff8fc7' },
        { id: 'b_flip', pic: '\uD83D\uDD04', color: '#c79bff' },
        { id: 'b_ball', pic: '\uD83C\uDFC0', color: '#ffa14f' },
        { id: 'b_slide', pic: '\uD83C\uDF08', color: '#7fd7ff' },
        { id: 'b_cloud', pic: '\u2601\uFE0F', color: '#bfe6ff' },
        { id: 'b_kids', pic: '\uD83D\uDC4B', color: '#ffe066' } ] },
      { id: 'play', name: 'Playground', icon: '\uD83D\uDEDD', border: '#ffd23f', buttons: [
        { id: 'p_slide', pic: '\uD83D\uDEDD', color: '#ff9b6b' },
        { id: 'p_swing', pic: '\uD83C\uDFA0', color: '#7fd7ff' },
        { id: 'p_climb', pic: '\uD83E\uDDD7', color: '#9be36b' },
        { id: 'p_spin', pic: '\uD83C\uDF00', color: '#c79bff' },
        { id: 'p_seesaw', pic: '\u2696\uFE0F', color: '#ffd23f' },
        { id: 'p_sand', pic: '\uD83C\uDFD6\uFE0F', color: '#f5d39b' } ] }
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
