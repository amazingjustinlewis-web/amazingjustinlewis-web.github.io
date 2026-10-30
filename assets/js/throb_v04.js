/* Zero to Phi: synthesized throb v04. Fixes v03 syntax error (a // comment swallowed the closing brace of level(), so ZTPThrob was never defined = silence).
   Adds a soft 82/98 Hz upper body so it is audible on desktop/laptop speakers that cannot reproduce 41 Hz. ZTPThrob.level(L) each frame, L 0..~1 */
(function(){
  var KEY='ztp-sound',on=localStorage.getItem(KEY)!=='0',ctx=null,master,bus,started=false,VOL=0.16;
  function build(){ if(ctx) return; var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; ctx=new AC();
    master=ctx.createGain(); master.gain.value=on?VOL:0;
    var lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=180; lp.Q.value=0.7;
    bus=ctx.createGain(); bus.gain.value=0;
    var am=ctx.createGain(); am.gain.value=0.92;
    var lfo=ctx.createOscillator(); lfo.frequency.value=0.18; var lfoG=ctx.createGain(); lfoG.gain.value=0.06; lfo.connect(lfoG); lfoG.connect(am.gain);
    [[41.2,1],[61.7,0.12],[82.4,0.38],[98.0,0.14]].forEach(function(f){ var o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=f[0]; g.gain.value=f[1]; o.connect(g); g.connect(am); o.start(); });
    am.connect(bus); bus.connect(lp); lp.connect(master); master.connect(ctx.destination); lfo.start();
  }
  function start(){ try{ build(); if(ctx&&ctx.state!=='running') ctx.resume(); started=true; }catch(e){} }
  try{ build(); if(ctx) ctx.resume(); }catch(e){}
  ['pointerdown','mousedown','keydown','touchstart','click'].forEach(function(ev){ addEventListener(ev,start,{capture:true,passive:true}); });
  var last=0;
  window.ZTPThrob={
    level:function(L){ if(!ctx||ctx.state!=='running') return; var now=ctx.currentTime; if(now-last<0.03) return; last=now;
      var x=Math.max(0,Math.min(1,L||0)), s=x*x*(3-2*x), v=s*s; /* eases in late, gentle peak */
      var cur=bus.gain.value; bus.gain.setTargetAtTime(v,now,v>cur?0.9:0.6);
    },
    toggle:function(){ on=!on; localStorage.setItem(KEY,on?'1':'0'); start(); if(master) master.gain.setTargetAtTime(on?VOL:0,ctx.currentTime,0.05); return on; },
    on:function(){ return on; },
    _dbg:function(){ return ctx?{state:ctx.state,bus:bus.gain.value,master:master.gain.value}:null; }
  };
})();
