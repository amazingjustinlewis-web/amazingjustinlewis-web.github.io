/* Safety Third v0.1 (DEV). Top-down site, inspector catches violators inside their pulsing bubble. Family-clean only. */
(function(){
var cv=document.getElementById('c'),g=cv.getContext('2d'),W,H,S,DPR=Math.min(2,devicePixelRatio||1);
var VW=400,VH=640,HUD=56,PAD=150,AH=VH-HUD-PAD; // world area
function rs(){var w=innerWidth,h=innerHeight;S=Math.min(w/VW,h/VH);W=VW*S;H=VH*S;cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px';cv.style.marginTop=((h-H)/2)+'px';}
addEventListener('resize',rs);rs();
var R=Math.random,rr=function(a,b){return a+R()*(b-a)},pick=function(a){return a[Math.floor(R()*a.length)]};
// site props
var props=[{t:'hole',x:80,y:120,r:22},{t:'hole',x:310,y:330,r:18},{t:'scaf',x:250,y:70,w:110,h:46},{t:'scaf',x:20,y:300,w:46,h:110},{t:'crane',x:200,y:230},{t:'rebar',x:110,y:380,w:80,h:26},{t:'fuel',x:340,y:170},{t:'ladder',x:160,y:90},{t:'ladder',x:290,y:250},{t:'pallet',x:60,y:220},{t:'pallet',x:330,y:400}];
var V=[{k:'hat',n:'No hard hat',c:['Hair: not rated for falling objects.','Bold choice, skull.','"It\'s a hat-optional site," he claims.'],m:['A pigeon has made its move. Ouch.','Bonk. He has discovered gravity.']},
{k:'ladtop',n:'Top rung standing',c:['The top rung says "not a step." He read it as a dare.','Ladder summit reached. Ladder disagrees.'],m:['The ladder has filed for separation.','Down he goes, gracefully, into the mud.']},
{k:'load',n:'Under the load',c:['Standing under a pallet of bricks. Classic.','He wanted shade. The shade weighs a ton.'],m:['Sandbags. Fortunately, just sandbags.','The load landed. On his lunch. Lunch is gone.']},
{k:'harness',n:'No harness up high',c:['Edge work, no harness. Living like a cat.','He trusts the breeze to hold him.'],m:['Into the hay pile. He got lucky.','He is now a ground-level employee.']},
{k:'horse',n:'Horseplay',c:['Wheelbarrow jousting. Not in the manual.','A tickle fight near the rebar. Inadvisable.'],m:['Both are now in the wheelbarrow. Stuck.','Someone got a wedgie. Morale: unclear.']},
{k:'fork',n:'Forklift speeding',c:['That forklift is doing 40 in a 5.','He calls it "drifting." We call it a ticket.'],m:['He took out the porta-potty. It was empty. Mostly.','Pallet of drywall: now powder.']},
{k:'smoke',n:'Smoking by the fuel',c:['A cigarette next to the gas cans. Ambitious.','He wanted to see what happens. We don\'t.'],m:['Small poof. Eyebrows: departed.','A puff of soot. He looks like a raccoon now.']}];
var CAT=['Caught red-handed.','Paperwork incoming.','Citation issued, with love.','The clipboard has spoken.','Nice catch, Inspector.'];
var P,ws,pops,st,T,score,money,caught,missed,next,shake;
function worker(){var x=rr(30,370),y=rr(40,AH-30);return{x:x,y:y,tx:x,ty:y,c:pick(['#f6a623','#3b8fd9','#e85d5d','#4bb86b','#a06bd9']),v:null,vt:0,dur:0,cool:rr(2,8),gag:0,ph:R()*6,job:0}}
function start(){P={x:200,y:AH-40};ws=[];for(var i=0;i<12;i++)ws.push(worker());pops=[];T=0;score=0;money=1000;caught=0;missed=0;st='play';shake=0;}
var ROUND=150;
// input
var keys={},joy={on:0,x:0,y:0,bx:200,by:VH-PAD/2};
addEventListener('keydown',function(e){keys[e.key]=1;if(st==='end'&&(e.key==='Enter'||e.key===' '))start();});addEventListener('keyup',function(e){keys[e.key]=0});
function tp(e){var r=cv.getBoundingClientRect(),t=e.touches?e.touches[0]||e.changedTouches[0]:e;return{x:(t.clientX-r.left)/S,y:(t.clientY-r.top)/S}}
function down(e){e.preventDefault();var p=tp(e);if(st!=='play'){if(st==='title'||(p.y>VH*0.62&&p.y<VH*0.74))start();return}joy.on=1;mv(e)}
function mv(e){if(!joy.on)return;e.preventDefault();var p=tp(e),dx=p.x-joy.bx,dy=p.y-joy.by,d=Math.hypot(dx,dy),m=55;if(d>m){dx*=m/d;dy*=m/d}joy.x=dx/m;joy.y=dy/m}
function up(){joy.on=0;joy.x=joy.y=0}
cv.addEventListener('touchstart',down,{passive:false});cv.addEventListener('touchmove',mv,{passive:false});cv.addEventListener('touchend',up);cv.addEventListener('mousedown',down);addEventListener('mousemove',mv);addEventListener('mouseup',up);
function pop(x,y,t,col){pops.push({x:x,y:y,t:t,c:col,a:0})}
function step(dt){T+=dt;if(T>=ROUND){st='end';return}
 var f=T/ROUND,want=Math.round(12+18*f);while(ws.length<want)ws.push(worker());
 var ix=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0)+joy.x,iy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0)+joy.y,im=Math.hypot(ix,iy);if(im>1){ix/=im;iy/=im}
 P.x=Math.max(12,Math.min(388,P.x+ix*150*dt));P.y=Math.max(12,Math.min(AH-12,P.y+iy*150*dt));
 var live=ws.filter(function(w){return w.v}).length,maxLive=2+Math.floor(f*5);
 ws.forEach(function(w){w.ph+=dt*6;if(w.gag>0){w.gag-=dt;return}
  if(!w.v){var dx=w.tx-w.x,dy=w.ty-w.y,d=Math.hypot(dx,dy);if(d<3){w.tx=rr(20,380);w.ty=rr(30,AH-20)}else{w.x+=dx/d*35*dt;w.y+=dy/d*35*dt}
   w.cool-=dt;if(w.cool<=0&&live<maxLive){live++;w.v=pick(V);w.dur=w.vt=rr(4.5,7)*(1-.45*f);if(w.v.k==='fork'){w.fx=w.x;w.fa=R()*6.3}}}
  else{w.vt-=dt;if(w.v.k==='fork'){w.fa+=dt*1.2;w.x=Math.max(25,Math.min(375,w.x+Math.cos(w.fa)*110*dt));w.y=Math.max(25,Math.min(AH-25,w.y+Math.sin(w.fa)*110*dt))}
   var br=34;if(Math.hypot(P.x-w.x,P.y-w.y)<br){var pts=Math.round(100+200*w.vt/w.dur);score+=pts;caught++;pop(w.x,w.y-30,'+'+pts+'  '+pick(CAT),'#1f7a3a');pop(w.x,w.y-14,pick(w.v.c),'#222');w.v=null;w.cool=rr(3,9)}
   else if(w.vt<=0){money-=150;missed++;shake=.35;pop(w.x,w.y-30,'-$150',"#c0392b");pop(w.x,w.y-14,pick(w.v.m),'#222');w.gag=1.6;w.gk=w.v.k;w.v=null;w.cool=rr(4,9)}}});
 pops.forEach(function(p){p.a+=dt});pops=pops.filter(function(p){return p.a<2.6});shake=Math.max(0,shake-dt);}
// drawing
function rect(x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h)}
function circ(x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
function drawSite(){rect(0,0,VW,AH,'#d9c79a');g.globalAlpha=.25;for(var i=0;i<40;i++)circ((i*97)%400,(i*53)%AH,6,'#b89f6a');g.globalAlpha=1;
 props.forEach(function(p){if(p.t==='hole'){circ(p.x,p.y,p.r+4,'#f2c230');circ(p.x,p.y,p.r,'#4a3b28')}
 else if(p.t==='scaf'){rect(p.x,p.y,p.w,p.h,'rgba(120,130,140,.35)');g.strokeStyle='#6b7480';g.lineWidth=3;g.strokeRect(p.x,p.y,p.w,p.h);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x+p.w,p.y+p.h);g.moveTo(p.x+p.w,p.y);g.lineTo(p.x,p.y+p.h);g.stroke()}
 else if(p.t==='crane'){rect(p.x-14,p.y-14,28,28,'#e0a800');g.strokeStyle='#e0a800';g.lineWidth=7;var a=T*.3;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x+Math.cos(a)*150,p.y+Math.sin(a)*150);g.stroke();var lx=p.x+Math.cos(a)*120,ly=p.y+Math.sin(a)*120;g.globalAlpha=.25;circ(lx+6,ly+6,14,'#000');g.globalAlpha=1;rect(lx-12,ly-10,24,20,'#9b5b2d')}
 else if(p.t==='rebar'){g.strokeStyle='#7a5a44';g.lineWidth=2;for(var i=0;i<6;i++){g.beginPath();g.moveTo(p.x,p.y+i*5);g.lineTo(p.x+p.w,p.y+i*5);g.stroke()}}
 else if(p.t==='fuel'){for(var i=0;i<3;i++)rect(p.x+i*14-20,p.y,12,16,'#d63a3a')}
 else if(p.t==='ladder'){g.strokeStyle='#c98c3a';g.lineWidth=3;g.strokeRect(p.x,p.y,14,44);for(var i=1;i<5;i++){g.beginPath();g.moveTo(p.x,p.y+i*9);g.lineTo(p.x+14,p.y+i*9);g.stroke()}}
 else if(p.t==='pallet')rect(p.x,p.y,30,24,'#b98b52')});}
function drawWorker(w){var bob=Math.sin(w.ph)*1.5,x=w.x,y=w.y+bob;
 if(w.v){var pr=34+Math.sin(T*8)*3,u=w.vt/w.dur;g.globalAlpha=.18+.12*(1-u);circ(x,y,pr,'#ff3b30');g.globalAlpha=1;g.strokeStyle='#ff3b30';g.lineWidth=3;g.beginPath();g.arc(x,y,pr,-Math.PI/2,-Math.PI/2+6.283*u);g.stroke()}
 var k=w.v&&w.v.k;if(k==='fork'){rect(x-11,y-14,22,28,'#f0b400');rect(x-8,y+14,3,10,'#555');rect(x+5,y+14,3,10,'#555');circ(x,y-2,6,w.c);return}
 if(k==='ladtop'||k==='harness'){g.globalAlpha=.3;circ(x+8,y+10,10,'#000');g.globalAlpha=1}
 if(w.gag>0){g.save();g.translate(x,y);g.rotate(Math.sin(w.gag*12)*.6);if(w.gk==='smoke'){circ(0,-14,16*w.gag/1.6+4,'rgba(80,80,80,.5)')}circ(0,0,10,w.c);circ(0,0,7,'#f1c9a5');rect(-6,-2,4,2,'#000');rect(2,-2,4,2,'#000');g.restore();g.font='bold 14px sans-serif';g.fillStyle='#444';g.fillText('✶',x-4,y-14);return}
 circ(x,y,10,w.c);circ(x,y,7,'#f1c9a5');if(k!=='hat')circ(x,y-1,7.5,'#ffd21a');
 if(k==='smoke'){circ(x+9,y-6,2,'#ff7a00');g.globalAlpha=.4;circ(x+12,y-14-Math.sin(T*4)*3,5,'#999');g.globalAlpha=1}
 if(k==='horse'){g.font='14px sans-serif';g.fillText('🤸',x+8,y-8)}
 if(k==='load'){rect(x-10,y-34,20,14,'#9b5b2d');g.strokeStyle='#333';g.beginPath();g.moveTo(x,y-34);g.lineTo(x,y-60);g.stroke()}}
function drawP(){circ(P.x,P.y,13,'#fff');circ(P.x,P.y,11,'#1d4ed8');circ(P.x,P.y,7,'#f1c9a5');circ(P.x,P.y-1,7.5,'#fff');rect(P.x+8,P.y-2,8,11,'#7a4b25');rect(P.x+9,P.y,6,7,'#fff')}
function txt(t,x,y,sz,c,al){g.font='bold '+sz+'px system-ui,sans-serif';g.textAlign=al||'center';g.fillStyle=c;g.fillText(t,x,y)}
function wrap(t,x,y,max,sz,c){g.font='600 '+sz+'px system-ui,sans-serif';var w=t.split(' '),l='',ly=y;w.forEach(function(s){if(g.measureText(l+s).width>max){txt(l,x,ly,sz,c);l='';ly+=sz+3}l+=s+' '});txt(l,x,ly,sz,c)}
function draw(){g.setTransform(S*DPR,0,0,S*DPR,0,0);rect(0,0,VW,VH,'#2b2f36');
 rect(0,0,VW,HUD,'#1f2329');txt('SCORE '+score,12,24,18,'#fff','left');txt('$'+money,388,24,18,money<0?'#ff6b6b':'#7CFC9A','right');var left=Math.max(0,ROUND-(T||0));txt(Math.floor(left/60)+':'+('0'+Math.floor(left%60)).slice(-2),200,24,18,'#ffd21a');txt('SAFETY THIRD',200,46,11,'#9aa3ad');
 g.save();g.translate(0,HUD);if(shake)g.translate(R()*6-3,R()*6-3);g.beginPath();g.rect(0,0,VW,AH);g.clip();drawSite();if(ws){ws.forEach(drawWorker);drawP();
 pops.forEach(function(p){g.globalAlpha=Math.max(0,1-p.a/2.6);rect(p.x-0,0,0,0,'');var y=p.y-p.a*14,x=Math.max(90,Math.min(310,p.x));g.fillStyle='rgba(255,255,255,.85)';g.font='600 12px system-ui';var tw=Math.min(220,g.measureText(p.t).width)+10;g.fillRect(x-tw/2,y-12,tw,16);wrap(p.t,x,y,210,12,p.c);g.globalAlpha=1})}g.restore();
 rect(0,VH-PAD,VW,PAD,'#1f2329');circ(joy.bx,joy.by,58,'#333a44');circ(joy.bx+joy.x*55,joy.by+joy.y*55,26,'#ffd21a');txt('drag to move · WASD/arrows',200,VH-8,11,'#6b7480');
 if(st==='title'||st==='end'){g.fillStyle='rgba(20,22,26,.88)';g.fillRect(20,90,360,440);txt('SAFETY THIRD',200,140,34,'#ffd21a');
  if(st==='title'){wrap('You are the site inspector. When a worker\'s bubble starts pulsing, get inside it before the timer runs out. Catch = points. Miss = the company pays. Somebody always pays.',200,190,320,15,'#fff');}
  else{txt('Shift over.',200,180,18,'#fff');txt('Score: '+score,200,225,22,'#fff');txt('Caught '+caught+'  ·  Missed '+missed,200,258,16,'#cfd6dd');txt('Budget left: $'+money,200,288,16,money<0?'#ff6b6b':'#7CFC9A');
   var v=caught+missed?caught/(caught+missed):0;wrap(v>.85?'Commentator: "Frankly, suspiciously safe. We\'re looking into you."':v>.6?'Commentator: "A respectable day. Only some things fell on people."':v>.3?'Commentator: "The site is still standing. Mostly. Technically."':'Commentator: "Bold strategy, letting everything happen."',200,330,320,15,'#ffd21a')}
  rect(110,VH*0.62,180,VH*0.12,'#ffd21a');txt(st==='end'?'RESTART':'START',200,VH*0.62+VH*0.075,24,'#1f2329')}}
var last=0;function loop(t){var dt=Math.min(.05,(t-last)/1000||0);last=t;if(st==='play')step(dt);draw();requestAnimationFrame(loop)}
st='title';if(/[?&]auto=1/.test(location.search))start();requestAnimationFrame(loop);
window.S3={start:start,st:function(){return st}};
})();
