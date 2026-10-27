/* Zero to Phi Arcade Showcase v0.1 (DEV). three.js room + capsule stand-ins + scripted presentation scenes.
   CHARACTER SWAP: every figure is made by makePerson() and driven ONLY through setState(p, state) + per-frame animPerson(p, dt).
   To use a rigged glb later: load it, clone per person, put an AnimationMixer on p.mixer, map states -> clips via CLIPS below, and
   keep p.root as the moved/rotated group (character faces +Z, feet at y=0, metres). Phone = child of hand bone named in CLIPS.phoneBone. */
(function(){
var CLIPS={walk:'walk',sit:'sit_idle',phonePlay:'sit_phone',scan:'stand_scan',celebrate:'celebrate_jump',enterPod:'pod_enter',exitPod:'pod_exit',idle:'stand_idle',phoneBone:'Hand_R'};
var R=new THREE.WebGLRenderer({antialias:true});R.setPixelRatio(Math.min(2,devicePixelRatio));document.body.appendChild(R.domElement);
R.shadowMap.enabled=true;var S=new THREE.Scene();S.background=new THREE.Color(0x14161d);S.fog=new THREE.Fog(0x14161d,18,34);
var C=new THREE.PerspectiveCamera(50,1,.1,100);function rs(){R.setSize(innerWidth,innerHeight);C.aspect=innerWidth/innerHeight;C.fov=C.aspect<1?72:50;C.updateProjectionMatrix()}addEventListener('resize',rs);rs();
S.add(new THREE.HemisphereLight(0xcfd8ff,0x30261c,.75));var sun=new THREE.DirectionalLight(0xfff0dd,.7);sun.position.set(4,10,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);var sc=sun.shadow.camera;sc.left=sc.bottom=-10;sc.right=sc.top=10;S.add(sun);
function L(c,x,y,z,i){var l=new THREE.PointLight(c,i||.8,9);l.position.set(x,y,z);S.add(l)}L(0xff5ab0,-6,3,-3);L(0x46c8ff,6,3,-3);L(0xffc070,0,3,3);
function M(c,o){return new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.7},o||{}))}
function box(w,h,d,m,x,y,z,p){var b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.castShadow=b.receiveShadow=true;(p||S).add(b);return b}
function cyl(r,h,m,x,y,z,p){var b=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),m);b.position.set(x,y,z);b.castShadow=b.receiveShadow=true;(p||S).add(b);return b}
// room 16 x 12, back wall z=-6, door at front-left (x=-6.5,z=5.5)
box(16,.1,12,M(0x2a2420),0,-.05,0);box(16,5,.2,M(0x262b38),0,2.5,-6.1);box(.2,5,12,M(0x2d2638),-8.1,2.5,0);box(.2,5,12,M(0x2d2638),8.1,2.5,0);
for(var i=0;i<8;i++)box(16,.01,.04,M(0x3a3029),0,.005,-5.5+i*1.5);
function cvTex(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;var t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return{c:c,g:c.getContext('2d'),t:t}}
// big screen
var BIG=cvTex(768,432);box(7.4,4.3,.15,M(0x111111),0,3.0,-5.98);var bigM=new THREE.Mesh(new THREE.PlaneGeometry(7,3.94),new THREE.MeshBasicMaterial({map:BIG.t}));bigM.position.set(0,3.0,-5.89);S.add(bigM);
// sponsor boards along back wall
var SP=cvTex(2048,128);var spM=new THREE.Mesh(new THREE.PlaneGeometry(14,.875),new THREE.MeshBasicMaterial({map:SP.t}));spM.position.set(0,.5,-5.95);S.add(spM);box(14.2,.06,.12,M(0xffffff),0,.96,-5.95);
(function(){var g=SP.g;g.fillStyle='#fff';g.fillRect(0,0,2048,128);var ads=['JOSHUA TREE VENTURES','YOUR AD HERE','JOSHUA TREE VENTURES','LOCAL SPONSOR','JOSHUA TREE VENTURES'];ads.forEach(function(a,i){var x=i*410;g.fillStyle=i%2?'#1d3557':'#fff';g.fillRect(x,0,410,128);g.fillStyle=i%2?'#fff':'#1d3557';g.font='bold 27px sans-serif';g.textAlign='center';g.fillText(a,x+205,78);g.fillStyle='#c1121f';g.fillRect(x,0,410,8)});SP.t.needsUpdate=true})();
// tables
var TABLES=[[-3.5,-1],[0,1.5],[3.5,-1]],SEATS=[];var wood=M(0x8a5a3b),chairM=M(0xe85d75);
TABLES.forEach(function(t,ti){cyl(.75,.06,wood,t[0],.76,t[1]);cyl(.07,.74,M(0x333333),t[0],.37,t[1]);for(var k=0;k<4;k++){var a=k*Math.PI/2+Math.PI/4,x=t[0]+Math.cos(a)*1.1,z=t[1]+Math.sin(a)*1.1;var ch=new THREE.Group();ch.position.set(x,0,z);ch.rotation.y=Math.atan2(t[0]-x,t[1]-z);box(.45,.06,.45,chairM,0,.46,0,ch);box(.45,.5,.06,chairM,0,.72,-.22,ch);[[-.19,-.19],[.19,-.19],[-.19,.19],[.19,.19]].forEach(function(q){cyl(.025,.46,M(0x222222),q[0],.23,q[1],ch)});S.add(ch);SEATS.push({x:x,z:z,ry:ch.rotation.y,t:ti})}});
// pods along right wall
var PODS=[];for(var i=0;i<4;i++){var z=-4.3+i*2.3,g=new THREE.Group();g.position.set(6.6,0,z);g.rotation.y=-Math.PI/2;S.add(g);
 var shell=new THREE.Mesh(new THREE.SphereGeometry(.85,24,16),M(0xdfe6ee,{metalness:.4,roughness:.3}));shell.scale.set(1,1.25,1);shell.position.y=1.1;shell.castShadow=true;g.add(shell);
 var ring=new THREE.Mesh(new THREE.TorusGeometry(.95,.06,8,32),M(0x46c8ff,{emissive:0x46c8ff,emissiveIntensity:.8}));ring.position.y=1.1;g.add(ring);
 var door=new THREE.Mesh(new THREE.CircleGeometry(.6,24),M(0x0b0e14,{metalness:.2}));door.position.set(0,1.0,.86);g.add(door);
 var tx=cvTex(320,180),scr=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.85),new THREE.MeshBasicMaterial({map:tx.t}));scr.position.set(0,2.75,0);g.add(scr);box(1.6,.95,.05,M(0x111111),0,2.75,-.04,g);
 var lab=cvTex(256,48);lab.g.fillStyle='#46c8ff';lab.g.font='bold 30px sans-serif';lab.g.textAlign='center';lab.g.fillText('GYROFORGE '+(i+1),128,36);var lm=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.22),new THREE.MeshBasicMaterial({map:lab.t,transparent:true}));lm.position.set(0,2.18,0);g.add(lm);
 PODS.push({g:g,tx:tx,ring:ring,on:0,t:i*4.3,x:6.6,z:z,ent:{x:5.4,z:z}})}
// QR standee by door
var QR=cvTex(256,384);(function(){var g=QR.g;g.fillStyle='#f5b82e';g.fillRect(0,0,256,384);g.fillStyle='#111';g.font='bold 26px sans-serif';g.textAlign='center';g.fillText('SCAN TO PLAY',128,44);g.fillStyle='#fff';g.fillRect(28,64,200,200);g.fillStyle='#111';var s=8;for(var y=0;y<23;y++)for(var x=0;x<23;x++){var f=(x<7&&y<7)||(x>15&&y<7)||(x<7&&y>15);if(f?((x%6==0||y%6==0||x==22||y==22||(x%22>1&&x%22<5&&y%22>1&&y%22<5)||(x>17&&x<21&&y>1&&y<5)||(x>1&&x<5&&y>17&&y<21))&&!(x==6&&y>6)):((x*7+y*13+x*y)%5<2))g.fillRect(36+x*s,72+y*s,s,s)}g.font='600 18px sans-serif';g.fillText('No app. Just your phone.',128,300);g.font='bold 22px sans-serif';g.fillText('ZERO TO PHI',128,346);QR.t.needsUpdate=true})();
var qg=new THREE.Group();qg.position.set(-5.6,0,4.2);qg.rotation.y=Math.PI*.75;S.add(qg);box(.06,1.1,.06,M(0x222222),0,.55,0,qg);var qm=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.2),new THREE.MeshBasicMaterial({map:QR.t}));qm.position.set(0,1.6,.04);qg.add(qm);box(.86,1.26,.04,M(0x111111),0,1.6,0,qg);
var QPOS={x:-5.0,z:3.6};var DOOR={x:-7.6,z:5};box(.1,2.4,1.4,M(0x5b4a3a),-8.0,1.2,5);
// people
var COLS=[0xe63946,0x2a9d8f,0xf4a261,0x457b9d,0x9b5de5,0x00bb77,0xff7096,0xffd166];var P=[];
function makePerson(i){var root=new THREE.Group(),m=M(COLS[i]),skin=M(0xf1c9a5);var body=new THREE.Group();root.add(body);
 var torso=cyl(.2,.55,m,0,1.05,0,body);var cap1=new THREE.Mesh(new THREE.SphereGeometry(.2,16,10),m);cap1.position.y=1.33;body.add(cap1);var cap2=cap1.clone();cap2.position.y=.78;body.add(cap2);
 var head=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),skin);head.position.y=1.65;head.castShadow=true;body.add(head);
 var legL=cyl(.08,.7,M(0x2b2d42),-.1,.38,0,body),legR=cyl(.08,.7,M(0x2b2d42),.1,.38,0,body);[legL,legR].forEach(function(l){l.geometry.translate(0,-.35,0);l.position.y=.73});
 var armR=new THREE.Group();armR.position.set(.25,1.3,0);body.add(armR);cyl(.06,.5,m,0,-.25,0,armR);var phone=box(.08,.14,.015,M(0x111111,{emissive:0x000000}),0,-.52,.05,armR);
 var armL=new THREE.Group();armL.position.set(-.25,1.3,0);body.add(armL);cyl(.06,.5,m,0,-.25,0,armL);
 S.add(root);root.position.set(DOOR.x,0,DOOR.z);return{root:root,body:body,legL:legL,legR:legR,armR:armR,armL:armL,phone:phone,st:'idle',t:0,path:[],sp:1.3,lit:0,seat:null}}
for(var i=0;i<8;i++)P.push(makePerson(i));
function setState(p,s){p.st=s;p.t=0}
function go(p,pts,then){p.path=pts.slice();p.then=then||'idle';setState(p,'walk')}
function faceTo(p,x,z){p.root.rotation.y=Math.atan2(x-p.root.position.x,z-p.root.position.z)}
function animPerson(p,dt){p.t+=dt;var b=p.body,s=p.st,w=Math.sin(p.t*8);b.position.y=0;b.rotation.x=0;p.legL.rotation.x=p.legR.rotation.x=0;p.armL.rotation.x=0;p.armR.rotation.set(0,0,0);
 if(s==='walk'){var tg=p.path[0];if(!tg){setState(p,p.then);return animPerson(p,0)}var dx=tg.x-p.root.position.x,dz=tg.z-p.root.position.z,d=Math.hypot(dx,dz);if(d<.08){p.path.shift()}else{var st=Math.min(d,p.sp*dt);p.root.position.x+=dx/d*st;p.root.position.z+=dz/d*st;var ry=Math.atan2(dx,dz),cr=p.root.rotation.y,dd=Math.atan2(Math.sin(ry-cr),Math.cos(ry-cr));p.root.rotation.y=cr+dd*Math.min(1,dt*8)}
  p.legL.rotation.x=w*.5;p.legR.rotation.x=-w*.5;p.armL.rotation.x=-w*.4;p.armR.rotation.x=w*.4;b.position.y=Math.abs(Math.cos(p.t*8))*.04}
 else if(s==='sit'||s==='phonePlay'){b.position.y=-.27;p.legL.rotation.x=p.legR.rotation.x=-1.45;if(s==='phonePlay'){p.armR.rotation.x=-1.1;p.armL.rotation.x=-1.0;p.armR.rotation.z=.35;p.armR.position.x=.25;b.rotation.x=.12+Math.sin(p.t*3)*.03}}
 else if(s==='scan'){p.armR.rotation.x=-1.5+Math.sin(p.t*2)*.05}
 else if(s==='celebrate'){var j=Math.abs(Math.sin(p.t*6));b.position.y=j*.45;p.armR.rotation.x=p.armL.rotation.x=-2.8;p.armR.rotation.z=.3;p.armL.rotation.z=-.3}
 else if(s==='enterPod'||s==='inPod'){var u=Math.min(1,p.t/1.2);p.root.scale.setScalar(s==='inPod'?0.001:Math.max(.001,1-u));if(u>=1&&s==='enterPod')setState(p,'inPod')}
 else if(s==='exitPod'){var u=Math.min(1,p.t/1.0);p.root.scale.setScalar(Math.max(.001,u));if(u>=1)setState(p,'idle')}
 if(s!=='enterPod'&&s!=='inPod'&&s!=='exitPod')p.root.scale.setScalar(1);
 p.phone.material.emissive.setHex(p.lit?0x5ad1ff:0);p.phone.material.emissiveIntensity=p.lit?1.6:0}
function seatPerson(p,k){var s=SEATS[k];p.root.position.set(s.x,0,s.z);p.root.rotation.y=s.ry;p.seat=k}
// screens
var big={mode:'attract',t:0},hk={x:0,y:0,vx:220,vy:140,pl:[]};for(var i=0;i<10;i++)hk.pl.push({x:Math.random()*600+80,y:Math.random()*280+70,c:i<5?'#2d7cf6':'#e63946'});
var hs={score:0};
function drawBig(dt){var g=BIG.g,W=768,H=432;big.t+=dt;var m=big.mode;
 if(m==='attract'||m==='idle'){var gr=g.createLinearGradient(0,0,W,H);gr.addColorStop(0,'#1b1f3a');gr.addColorStop(1,'#3a1b3a');g.fillStyle=gr;g.fillRect(0,0,W,H);g.fillStyle='#f5b82e';g.font='bold 64px sans-serif';g.textAlign='center';g.fillText('ZERO TO PHI',W/2,170);g.fillStyle='#fff';g.font='600 28px sans-serif';g.fillText('ARCADE',W/2,214);g.globalAlpha=.6+.4*Math.sin(big.t*3);g.font='600 24px sans-serif';g.fillText('Scan the code by the door to join',W/2,320);g.globalAlpha=1}
 if(m==='hockey'||m==='highscore'){g.fillStyle='#e9f2f8';g.fillRect(0,0,W,H);g.strokeStyle='#c1121f';g.lineWidth=5;g.beginPath();g.moveTo(W/2,30);g.lineTo(W/2,H-30);g.stroke();g.strokeStyle='#2d7cf6';[W*.33,W*.67].forEach(function(x){g.beginPath();g.moveTo(x,30);g.lineTo(x,H-30);g.stroke()});g.strokeStyle='#333';g.lineWidth=6;g.strokeRect(30,30,W-60,H-60);g.beginPath();g.arc(W/2,H/2,50,0,7);g.strokeStyle='#2d7cf6';g.lineWidth=3;g.stroke();
  hk.x+=hk.vx*dt;hk.y+=hk.vy*dt;if(hk.x<50||hk.x>W-50)hk.vx*=-1;if(hk.y<50||hk.y>H-50)hk.vy*=-1;hk.x=Math.max(50,Math.min(W-50,hk.x));hk.y=Math.max(50,Math.min(H-50,hk.y));
  hk.pl.forEach(function(q,i){var tx=hk.x+Math.cos(i*1.7+big.t)*60*(1+i%3),ty=hk.y+Math.sin(i*2.3+big.t)*50;q.x+=(tx-q.x)*dt*1.5;q.y+=(ty-q.y)*dt*1.5;g.fillStyle='rgba(0,0,0,.15)';g.beginPath();g.arc(q.x+4,q.y+5,15,0,7);g.fill();g.fillStyle=q.c;g.beginPath();g.arc(q.x,q.y,14,0,7);g.fill();g.fillStyle='#f1c9a5';g.beginPath();g.arc(q.x,q.y,7,0,7);g.fill()});
  g.fillStyle='#111';g.beginPath();g.arc(hk.x,hk.y,7,0,7);g.fill();g.fillStyle='rgba(0,0,0,.7)';g.fillRect(W/2-120,0,240,34);g.fillStyle='#fff';g.font='bold 22px sans-serif';g.textAlign='center';g.fillText('BLUE 3  ·  2:14  ·  2 RED',W/2,24);
  if(m==='highscore'){var u=Math.min(1,(big.t-big.hs0)/0.6);if(u>0){hs.score=Math.min(48250,Math.floor(48250*Math.min(1,(big.t-big.hs0)/1.5)));g.fillStyle='rgba(10,10,20,'+(.75*u)+')';g.fillRect(0,0,W,H);g.save();g.translate(W/2,H/2);g.scale(.6+.4*u+.04*Math.sin(big.t*8),.6+.4*u+.04*Math.sin(big.t*8));g.fillStyle='#f5b82e';g.font='bold 70px sans-serif';g.fillText('NEW HIGH SCORE!',0,-20);g.fillStyle='#fff';g.font='bold 54px sans-serif';g.fillText(hs.score.toLocaleString(),0,50);g.font='600 26px sans-serif';g.fillText('KRS · Table 2',0,95);g.restore();for(var i=0;i<40;i++){g.fillStyle=['#f5b82e','#e63946','#2d7cf6','#fff'][i%4];g.fillRect((i*97+big.t*60*(1+i%3))%W,(i*53+big.t*140*(1+i%2))%H,8,12)}}}}
 if(m==='credits'){g.fillStyle='#0c0f1a';g.fillRect(0,0,W,H);g.textAlign='center';var y=H-((big.t*45)%(H+420));var L2=[['THANKS TO OUR SPONSORS','#f5b82e',40],['',0,30],['JOSHUA TREE VENTURES','#fff',44],['',0,30],['Your business here','#9aa',28],['',0,30],['Local Sponsor','#9aa',28],['',0,30],['ZERO TO PHI ARCADE','#f5b82e',34]];L2.forEach(function(l,i){if(!l[1])return;g.fillStyle=l[1];g.font='bold '+l[2]+'px sans-serif';g.fillText(l[0],W/2,H/2+y-200+i*50)})}
 BIG.t.needsUpdate=true}
function drawPod(p,dt){var g=p.tx.g,W=320,H=180;p.t=(p.t||0)+dt;g.fillStyle='#04060f';g.fillRect(0,0,W,H);if(!p.on){g.fillStyle='#46c8ff';g.font='bold 22px sans-serif';g.textAlign='center';g.globalAlpha=.5+.5*Math.sin(p.t*2);g.fillText('READY',W/2,H/2+8);g.globalAlpha=1;p.tx.t.needsUpdate=true;return}
 g.fillStyle='#fff';for(var i=0;i<60;i++){var x=(i*53)%W,y=((i*37)+p.t*(40+i%5*30))%H;g.fillRect(x,y,2,2)}
 var sx=W/2+Math.sin(p.t*1.3+p.ph)*90;g.fillStyle='#46c8ff';g.beginPath();g.moveTo(sx,H-40);g.lineTo(sx-14,H-14);g.lineTo(sx+14,H-14);g.fill();
 for(var i=0;i<4;i++){var ex=(i*80+40+Math.sin(p.t+i)*30)%W,ey=((p.t*50+i*45)%(H-40));g.fillStyle=['#e63946','#f5b82e','#9b5de5','#00bb77'][i];g.beginPath();g.arc(ex,ey,9,0,7);g.fill()}
 g.fillStyle='#f5b82e';for(var i=0;i<3;i++){var by=H-50-((p.t*260+i*50)%130);g.fillRect(sx-1,by,3,10)}g.fillStyle='#fff';g.font='bold 14px sans-serif';g.textAlign='left';g.fillText('SCORE '+Math.floor(p.t*370),8,18);p.tx.t.needsUpdate=true}
// camera director
var cam={from:null,to:null,t:0,d:1},look=new THREE.Vector3(),camP=new THREE.Vector3(0,6,12);C.position.copy(camP);
function shot(px,py,pz,lx,ly,lz,d){cam.from={p:C.position.clone(),l:look.clone()};cam.to={p:new THREE.Vector3(px,py,pz),l:new THREE.Vector3(lx,ly,lz)};cam.t=0;cam.d=d||2.5}
function camStep(dt){if(!cam.to)return;cam.t+=dt;var u=Math.min(1,cam.t/cam.d);u=u*u*(3-2*u);var ph=C.aspect<1?1.35:1;var tp=cam.to.p.clone().sub(cam.to.l).multiplyScalar(ph).add(cam.to.l);C.position.lerpVectors(cam.from.p,tp,u);look.lerpVectors(cam.from.l,cam.to.l,u);C.lookAt(look)}
// timeline
var TL=[],tl=0,cur=null,capEl=document.getElementById('cap');function caption(t){capEl.style.opacity=0;setTimeout(function(){capEl.textContent=t;capEl.style.opacity=t?1:0},FZ?0:300)}
function at(t,f){TL.push({t:t,f:f})}
function reset(){TL=[];tl=0;PODS.forEach(function(p){p.on=0});big.mode='attract';big.t=0;P.forEach(function(p,i){p.lit=0;p.path=[];p.root.scale.setScalar(1);p.root.visible=true;p.seat=null;p.root.position.set(-7+((i%4)*.6),0,5.6+Math.floor(i/4)*.6);p.root.visible=false;setState(p,'idle')})}
function show(arr){arr.forEach(function(i){P[i].root.visible=true})}
var SC={
 scan:function(){caption('Walk in & scan: no app, no sign-up. Point the camera at the code.');show([0,1,2]);[0,1,2].forEach(function(i,k){var p=P[i];p.root.position.set(DOOR.x,0,DOOR.z+k*.2);at(k*1.6,function(){go(p,[{x:-6.2,z:4.6},{x:QPOS.x-.25+k*.55,z:QPOS.z-.3-k*.4}],'scan')});at(k*1.6+4.6,function(){faceTo(p,-5.6,4.2)});at(k*1.6+5.6,function(){p.lit=1});at(k*1.6+8,function(){go(p,[{x:-3+k,z:2.5},{x:-1+k*1.5,z:-2.5}])})});
  shot(-1,4,9,-5,1.2,4,.1);at(.2,function(){shot(-2.5,2.4,7,-5.4,1.4,4,3)});at(5,function(){shot(-4.2,1.7,2.3,-5.3,1.5,4.0,2.5)});at(8,function(){caption('Their phone is now the controller. Joined in about five seconds.')});at(10,function(){shot(0,4,8,-2,1,0,3)});return 14},
 play:function(){caption('Play together: a table picks up their phones and the big screen comes alive.');big.mode='attract';[0,1,2,3].forEach(function(i,k){var p=P[i],s=SEATS[4+k];p.root.visible=true;p.root.position.set(s.x+(k<2?-2:2),0,s.z+2.5);at(k*.4,function(){go(p,[{x:s.x,z:s.z}],'sit')});at(5,function(){p.root.rotation.y=s.ry;setState(p,'phonePlay');p.lit=1})});
  shot(5,4,9,0,1,1.5,.1);at(.2,function(){shot(3,3,6.5,0,.9,1.5,4)});at(5.5,function(){big.mode='hockey';shot(0,1.3,4.2,0,2.4,-5,3)});at(9,function(){caption('Bubble Hockey, up to 10 phones, on the venue screen.')});at(10,function(){shot(1.4,1.6,3.6,0,1,1.5,3)});return 15},
 hs:function(){caption('High score! The room sees it happen.');big.mode='highscore';big.t=0;big.hs0=1.5;[0,1,2,3].forEach(function(i,k){var p=P[i];p.root.visible=true;seatPerson(p,4+k);setState(p,'phonePlay');p.lit=1});
  shot(0,2,3,0,2.6,-5,.1);at(.2,function(){shot(0,2.3,1.2,0,3,-5.5,2.5)});at(3.4,function(){var p=P[1];p.root.position.x+=.15;setState(p,'celebrate');shot(1.6,1.5,5.2,0.6,1.1,2.0,1.5)});at(4,function(){setState(P[3],'celebrate')});at(6,function(){caption('Names and scores stay on the leaderboard for the next group to beat.')});at(9,function(){shot(0,3.5,8,0,2,-3,3)});return 12},
 pod:function(){caption('GyroForge: step into the pod, the screen above shows what they see.');[4,5,6,7].forEach(function(i,k){var p=P[i],d=PODS[k];p.root.visible=true;p.root.position.set(2+k*.4,0,2.5+k*.3);at(k*.5,function(){go(p,[{x:d.ent.x,z:d.ent.z}],'idle')});at(4+k*.3,function(){faceTo(p,d.x,d.z);go(p,[{x:d.x-.3,z:d.z}],'enterPod')});at(5.6+k*.3,function(){d.on=1;d.ph=k})});
  shot(0,3,6,5.5,1.2,-1,.1);at(.2,function(){shot(1,2.5,3,6,1.4,-1,3.5)});at(6,function(){shot(3.2,2.6,-.3,6.6,2.6,-1,3)});at(9.5,function(){caption('A space shooter with the pod moving with you. Four players, one room.')});at(10,function(){shot(3.4,2.7,-2.5,6.6,2.7,-3.2,3)});
  at(14,function(){shot(1.5,2.4,3,6,1.3,-1,2.5);[4,5,6,7].forEach(function(i,k){var p=P[i],d=PODS[k];at(14+k*.3,function(){d.on=0;p.root.position.set(d.ent.x,0,d.ent.z);p.root.rotation.y=-Math.PI/2;setState(p,'exitPod')})})});
  at(15.5,function(){caption('And back out, grinning.');[4,5,6,7].forEach(function(i,k){at(16+k*.4,function(){go(P[i],[{x:2+k*.6,z:3}])})})});return 20},
 spon:function(){caption('Sponsors: board ads all night, credits between games.');big.mode='credits';big.t=0;
  shot(-6.5,.9,-3.4,-5,.6,-6,.1);at(.2,function(){shot(5.5,.9,-3.4,5,.6,-6,7)});at(7.5,function(){shot(0,2.8,3,0,2.6,-6,3)});at(9,function(){caption('Thanks to our sponsors: plain-text placeholders until real partners sign.')});return 15},
};
var ORDER=['scan','play','hs','pod','spon'],LABEL={scan:'1 · Walk in & scan',play:'2 · Play together',hs:'3 · High score!',pod:'4 · GyroForge',spon:'5 · Sponsors',tour:'6 · Auto tour'};
var tour=0,ti=0,dur=0,btns={};
function run(k){reset();cur=k;for(var b in btns)btns[b].className=(b===k||(tour&&b==='tour'))?'on':'';dur=SC[k]()}
var bar=document.getElementById('bar');ORDER.concat('tour').forEach(function(k){var b=document.createElement('button');b.textContent=LABEL[k];b.onclick=function(){if(k==='tour'){tour=1;ti=0;run(ORDER[0])}else{tour=0;run(k)}};bar.appendChild(b);btns[k]=b});
var q=(location.search.match(/scene=(\w+)/)||[])[1],jt=+((location.search.match(/[?&]t=([\d.]+)/)||[])[1]||0);
var FZ=/freeze/.test(location.search),last=0;function loop(ts){var dt=FZ?0:Math.min(.05,(ts-last)/1000||0);last=ts;tl+=dt;
 for(var i=0;i<TL.length;i++)if(TL[i].t<=tl&&!TL[i].d){TL[i].d=1;TL[i].f()}
 if(tour&&tl>dur){ti=(ti+1)%ORDER.length;run(ORDER[ti])}
 P.forEach(function(p){animPerson(p,dt)});PODS.forEach(function(p){drawPod(p,dt);p.ring.material.emissiveIntensity=p.on?1.5+Math.sin(tl*6):.6});drawBig(dt);camStep(dt);R.render(S,C);if(/dbg/.test(location.search))document.getElementById('ttl').textContent=JSON.stringify([tl.toFixed(1),PODS.map(function(d){return d.on}),P.slice(4).map(function(p){return [p.st,p.root.position.x.toFixed(1),p.root.position.z.toFixed(1),p.path.length]})]);requestAnimationFrame(loop)}
tour=!q||q==='tour';run(q&&SC[q]?q:'scan');if(jt){var st=1/30;for(var s=0;s<jt;s+=st){tl+=st;for(var i=0;i<TL.length;i++)if(TL[i].t<=tl&&!TL[i].d){TL[i].d=1;TL[i].f()}P.forEach(function(p){animPerson(p,st)});drawBig(st);PODS.forEach(function(p){drawPod(p,st)});camStep(st)}}
requestAnimationFrame(loop);window.SHOW={run:run};
})();
