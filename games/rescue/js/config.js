/* RED DEER RESCUE - shared config */
(function (root) {
  root.RDR_CONFIG = {
    TITLE: 'RED DEER RESCUE', version: '0.1',
    peerPrefix: 'ztp-rescue-v01-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    heroes: [
      { name: 'Blaze', color: '#ff5a4f', role: 'Firefighter \u00b7 bruiser' },
      { name: 'Pulse', color: '#4fc3ff', role: 'Paramedic \u00b7 healer' },
      { name: 'Siren', color: '#ffd23f', role: 'Dispatcher \u00b7 scout' },
      { name: 'Badge', color: '#7a6bff', role: 'Constable \u00b7 tank' },
      { name: 'Rope', color: '#5fe08a', role: 'Rescue tech \u00b7 jumper' },
      { name: 'Ladder', color: '#ff9b3f', role: 'Truckie \u00b7 climber' },
      { name: 'Flare', color: '#ff7ad9', role: 'Search & rescue \u00b7 flyer' },
      { name: 'Hose', color: '#e8f0ff', role: 'Engineer \u00b7 support' }
    ]
  };
})(window);
