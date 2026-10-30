/* Zero to Phi: original synthesized sub-bass throb v02 (one sustained swell per logo cycle) (WebAudio, no samples). ZTPThrob.level(L) each frame, L = logo QR/button envelope 0..~1 */
(function(){
  var KEY='ztp-sound',on=localStorage.getItem(KEY)!=='0',ctx=null,master,bus,lfoG,started=false,VOL=0.16; // quiet by default
  function build(){ if(ctx) return; var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; ctx=new AC();
    master=ctx.createGain(); master.gain.value=on?VOL:0;
    var lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=140; lp.Q.value=0.7;
    bus=ctx.createGain(); bus.gain.value=0;
    var am=ctx.createGain(); am.gain.value=0.92; // v02: one sustained swell, only a very slow subtle body
    var lfo=ctx.createOscillator(); lfo.frequency.value=0.18; lfoG=ctx.createGain(); lfoG.gain.value=0.06; lfo.connect(lfoG); lfoG.connect(am.gain);
    [[41.2,1],[82.4,0.28],[61.7,0.12]].forEach(function(f){ var o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=f[0]; g.gain.value=f[1]; o.connect(g); g.connect(am); o.start(); });
    am.connect(bus); bus.connect(lp); lp.connect(master); master.connect(ctx.destination); lfo.start();
  }
  function start(){ build(); if(ctx&&ctx.state!=='running') ctx.resume(); started=true; }
  try{ build(); if(ctx) ctx.resume(); }catch(e){}           // plays straight away if the browser allows
  ['pointerdown','keydown','touchstart'].forEach(function(ev){ addEventListener(ev,start,{once:true,capture:true}); });
  var last=0;
  window.ZTPThrob={
    level:function(L){ if(!ctx||ctx.state!=='running') return; var now=ctx.currentTime; if(now-last<0.03) return; last=now;
      var x=Math.max(0,Math.min(1,L)), v=x*x*(3-2*x);       // v02: silence -> single smooth peak when fully out -> silence
      bus.gain.setTargetAtTime(v,now,0.25); },
    toggle:function(){ on=!on; localStorage.setItem(KEY,on?'1':'0'); start(); if(master) master.gain.setTargetAtTime(on?VOL:0,ctx.currentTime,0.05); return on; },
    on:function(){ return on; }
  };
})();
