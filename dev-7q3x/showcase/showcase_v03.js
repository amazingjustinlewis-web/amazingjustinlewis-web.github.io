/* Zero to Phi Arcade Showcase v0.3 (seat heights, staff serving, non-players, LIVE game feeds on screens, View All Games preview) — "sales game for Joe" (DEV)
   Street -> Bar / Coffee Shop / Arcade. Tap a shop: camera flies in. SELL: shop TV lights up, QR codes pop, pitch plays.
   CHARACTER SWAP SLOT: everything person-related goes through makePerson(opts) + setPose(p,pose).
   Poses: 'stand','sit','phone' (sit+phone),'standPhone' (scan). Movement is a SLIDE (p.goal), no walk cycle.
   To swap in the rigged glb: replace makePerson() to clone the glb scene, recolour materials named
   'Shirt','Pants','Shoes' with opts.shirt/pants/shoes, put face texture on 'Face' material (circle head),
   parent phone to bone 'Hand_R', and make setPose() play clips 'stand_idle','sit_idle','sit_phone','stand_scan'.
   Units metres, faces +Z, feet y=0. */
(function(){
var Q=new URLSearchParams(location.search),W=innerWidth,H=innerHeight;
var R=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(W,H);document.body.appendChild(R.domElement);
var S=new THREE.Scene();S.background=new THREE.Color(0x0c0e16);S.fog=new THREE.Fog(0x0c0e16,30,90);
var C=new THREE.PerspectiveCamera(55,W/H,.1,300);
S.add(new THREE.HemisphereLight(0xbfd4ff,0x302020,.75));var sun=new THREE.DirectionalLight(0xffe2c0,.6);sun.position.set(10,20,8);S.add(sun);
function M(c,e){return new THREE.MeshStandardMaterial({color:c,roughness:.7,emissive:e||0})}
function box(w,h,d,c,x,y,z,par){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof c=='object'?c:M(c));m.position.set(x,y,z);(par||S).add(m);return m}
function cyl(r,h,c,x,y,z,par){var m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),typeof c=='object'?c:M(c));m.position.set(x,y,z);(par||S).add(m);return m}
function cv(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;var t=new THREE.CanvasTexture(c);return {c:c,g:c.getContext('2d'),t:t}}
function screen(w,h,pw,ph,x,y,z,ry,par){var k=cv(pw,ph);var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:k.t}));m.position.set(x,y,z);m.rotation.y=ry||0;(par||S).add(m);box(w+.12,h+.12,.06,0x111111,0,0,-.04,m);k.m=m;return k}
function label(txt,w,h,col,bg,x,y,z,ry,par,font){var k=cv(512,Math.round(512*h/w));var g=k.g;g.fillStyle=bg;g.fillRect(0,0,k.c.width,k.c.height);g.fillStyle=col;g.font=(font||'bold 64px sans-serif');g.textAlign='center';g.textBaseline='middle';g.fillText(txt,256,k.c.height/2);var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:k.t}));m.position.set(x,y,z);m.rotation.y=ry||0;(par||S).add(m);return m}
// ---- QR: deterministic per-shop pattern -> join?shop=<id> (every shop gets its own code)
function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return function(){h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%1000)/1000}}
function qrCanvas(id,col){var k=cv(256,300),g=k.g,r=hash(id),n=21,s=10,o=23;g.fillStyle='#fff';g.fillRect(0,0,256,300);g.fillStyle='#000';
 for(var y=0;y<n;y++)for(var x=0;x<n;x++){var f=(x<7&&y<7)||(x>13&&y<7)||(x<7&&y>13);if(f){var a=x>13?x-14:x,b=y>13?y-14:y;if(a==0||a==6||b==0||b==6||(a>1&&a<5&&b>1&&b<5))g.fillRect(o+x*s,o+y*s,s,s)}else if(r()>.5)g.fillRect(o+x*s,o+y*s,s,s)}
 g.fillStyle=col||'#222';g.font='bold 17px sans-serif';g.textAlign='center';g.fillText('join?shop='+id,128,272);g.fillText('SCAN TO PLAY',128,292);return k}
function qrStand(id,col,x,y,z,ry,par,sc){var g=new THREE.Group();var k=qrCanvas(id,col);var p=new THREE.Mesh(new THREE.PlaneGeometry(.26,.3),new THREE.MeshBasicMaterial({map:k.t}));p.position.y=.17;p.rotation.x=-.25;g.add(p);box(.28,.32,.02,col||0x333333,0,.16,-.015,g).rotation.x=-.25;g.position.set(x,y,z);g.rotation.y=ry||0;g.scale.setScalar(sc||1);(par||S).add(g);g.userData.s=sc||1;g.visible=false;return g}
// ---- PERSON (swap slot)
var FACE=['^ ^','o o','- -','• •','u u'];
function faceTex(i,skin){var k=cv(128,128),g=k.g;g.fillStyle=skin;g.fillRect(0,0,128,128);g.fillStyle='#222';g.beginPath();g.arc(44,56,7,0,7);g.arc(84,56,7,0,7);g.fill();g.lineWidth=5;g.strokeStyle='#222';g.beginPath();if(i%3==0)g.arc(64,74,16,.3,2.8);else if(i%3==1){g.moveTo(50,86);g.lineTo(78,86)}else g.arc(64,92,10,3.5,6);g.stroke();return k.t}
var SKIN=['#f1c9a5','#d9a479','#a86f48','#7a4b2c','#ffdcb8'];
function makePerson(o){o=o||{};var i=o.i||0,p={root:new THREE.Group(),pose:'stand',goal:null,col:o.col||'#ffffff'};
 var sh=M(o.shirt||0x3d7bd9),pa=M(o.pants||0x2b2f3a),so=M(o.shoes||0x111111);
 p.legs=new THREE.Group();p.root.add(p.legs);[-.09,.09].forEach(function(dx){box(.13,.5,.15,pa,dx,.3,0,p.legs);box(.14,.08,.24,so,dx,.04,.04,p.legs)});
 p.up=new THREE.Group();p.up.position.y=.55;p.root.add(p.up);
 box(.42,.55,.24,sh,0,.28,0,p.up);
 var head=new THREE.Mesh(new THREE.SphereGeometry(.17,20,16),[M(SKIN[i%5])][0]);head.position.y=.76;p.up.add(head);
 var face=new THREE.Mesh(new THREE.CircleGeometry(.15,24),new THREE.MeshBasicMaterial({map:faceTex(i,SKIN[i%5])}));face.position.set(0,.76,.171);p.up.add(face);
 p.armR=new THREE.Group();p.armR.position.set(.25,.52,0);p.up.add(p.armR);box(.1,.45,.1,sh,0,-.2,0,p.armR);
 p.armL=new THREE.Group();p.armL.position.set(-.25,.52,0);p.up.add(p.armL);box(.1,.45,.1,sh,0,-.2,0,p.armL);
 // phone in right hand (Hand_R) with glow in player colour + static game + hovering finger
 p.phone=new THREE.Group();p.phone.position.set(0,-.43,.04);p.armR.add(p.phone);
 var pk=cv(64,112);p.pk=pk;var pm=new THREE.Mesh(new THREE.PlaneGeometry(.07,.13),new THREE.MeshBasicMaterial({map:pk.t}));pm.position.z=.012;p.phone.add(pm);box(.08,.14,.015,0x111111,0,0,0,p.phone);
 p.glow=new THREE.PointLight(0xffffff,0,1.4);p.glow.position.z=.15;p.phone.add(p.glow);
 p.finger=box(.02,.02,.06,SKIN[i%5],0,0,.05,p.phone);p.phone.visible=false;
 S.add(p.root);return p}
function drawPhone(p,col,kind){var g=p.pk.g;g.fillStyle='#0b0d14';g.fillRect(0,0,64,112);g.strokeStyle=col;g.lineWidth=6;g.strokeRect(3,3,58,106);
 if(kind=='hockey'){g.fillStyle='#dfeeff';g.fillRect(10,14,44,60);g.fillStyle=col;g.beginPath();g.arc(32,52,6,0,7);g.fill();g.fillStyle='#333';g.beginPath();g.arc(32,92,12,0,7);g.fill()}
 else if(kind=='puzzle'){for(var y=0;y<4;y++)for(var x=0;x<4;x++){g.fillStyle=['#e85','#5ae','#ec4','#6c6'][(x*3+y*5)%4];g.fillRect(10+x*11,22+y*11,10,10)}}
 else if(kind=='board'){for(var y=0;y<5;y++)for(var x=0;x<5;x++){g.fillStyle=(x+y)%2?'#863':'#edc';g.fillRect(8+x*10,22+y*10,10,10)}}
 else if(kind=='infra'){g.fillStyle=col;g.font='9px sans-serif';['phone','  ↓','room','  ↓','screen','pods'].forEach(function(t,j){g.fillText(t,12,24+j*14)})}
 else {g.fillStyle='#fff';g.font='bold 12px sans-serif';g.fillText('JOIN',16,60)}
 p.pk.t.needsUpdate=true}
function setPose(p,pose,sy){p.pose=pose;var sit=pose=='sit'||pose=='phone';p.sy=sit?(sy||0.45):0;p.up.position.y=sit?0:.55;
 p.legs.rotation.x=sit?Math.PI/2:0;p.legs.scale.y=sit?.75:1;p.legs.position.set(0,sit?.06:0,sit?-.05:0);
 var ph=pose=='phone'||pose=='standPhone';p.phone.visible=ph;p.armR.rotation.x=pose=='standPhone'?-1.5:ph?-1.1:0;p.armL.rotation.x=ph&&pose!='standPhone'?-1.0:0;p.armL.rotation.z=ph?-.35:0;p.armR.rotation.z=ph?.25:0;
 p.glow.intensity=ph?1.4:0;p.root.userData.pop=1.12}
function slideTo(p,x,z,ry,then){p.goal={x:x,z:z,ry:ry,then:then}}
function updPerson(p,dt,t){if(p.goal){var dx=p.goal.x-p.root.position.x,dz=p.goal.z-p.root.position.z,d=Math.hypot(dx,dz),sp=1.6*dt;
  if(d<=sp){p.root.position.x=p.goal.x;p.root.position.z=p.goal.z;p.root.rotation.y=p.goal.ry;var f=p.goal.then;p.goal=null;f&&f()}else{p.root.position.x+=dx/d*sp;p.root.position.z+=dz/d*sp;p.root.rotation.y=Math.atan2(dx,dz);p.root.position.y=Math.abs(Math.sin(t*9))*.03}}
 else p.root.position.y=p.sy||0;
 var s=p.root.userData.pop||1;if(s>1){s=Math.max(1,s-dt*.6);p.root.userData.pop=s}p.root.scale.setScalar(s);
 if(p.phone.visible)p.finger.position.set(Math.sin(t*3+p.root.id)*.02,Math.cos(t*2.3+p.root.id)*.03-.01,.03+Math.abs(Math.sin(t*5+p.root.id))*.02)}
// ---- STREET (Red Deer proxy)
var SHOPS={bar:{name:'THE RUSTY PUCK TAVERN',id:'rusty-puck',col:0xb33a2a,x:-9},coffee:{name:'MORNING EMBER COFFEE',id:'morning-ember',col:0x7a5233,x:0},arcade:{name:'PIXEL DEPOT ARCADE',id:'pixel-depot',col:0x3b2a8a,x:9}};
box(40,.05,10,0x2a2a2e,0,0,6);box(40,.1,3,0x6b6b70,0,.05,0);for(var i=-18;i<19;i+=4)box(2,.06,.15,0xe8d36a,i,.04,6);
label('ROSS ST · RED DEER (PROXY)',6,.5,'#fff','#1e5a2e',-15,3.2,8.5,0);
var lamps=[];
Object.keys(SHOPS).forEach(function(k){var s=SHOPS[k];box(8,5.5,6,s.col,s.x,2.75,-4.5);box(8.2,.4,6.2,0x222222,s.x,5.6,-4.5);
 label(s.name,6,.8,'#ffe9a8','#151515',s.x,4.4,-1.48,0,null,'bold 34px sans-serif');
 var win=box(4.6,2.2,.1,M(0x223344,0x0a1a2a),s.x-1,1.8,-1.5);s.win=win;box(1.3,2.4,.12,0x3a2a1a,s.x+2.6,1.2,-1.47);
 var l=new THREE.PointLight(0xffc070,0,8);l.position.set(s.x,3,1);S.add(l);lamps.push(l)});
for(var i=-16;i<17;i+=8){cyl(.06,4,0x333333,i+4,2,1.4);var b=new THREE.Mesh(new THREE.SphereGeometry(.18),new THREE.MeshBasicMaterial({color:0xffe9b0}));b.position.set(i+4,4,1.4);S.add(b)}
// street walkers sliding around
var streetPpl=[];for(var i=0;i<5;i++){var p=makePerson({i:i,shirt:[0xd84a4a,0x4ab0d8,0xd8c04a,0x6ad84a,0xb04ad8][i]});p.root.position.set(-14+i*7,0,2+(i%2));streetPpl.push(p)}
// ---- INTERIOR helper
function room(ox,col,wall){var g=new THREE.Group();g.position.x=ox;S.add(g);box(14,.1,10,col,0,0,0,g);box(14,5,.2,wall,0,2.5,-5,g);box(.2,5,10,wall,-7,2.5,0,g);box(.2,5,10,wall,7,2.5,0,g);
 var l=new THREE.PointLight(0xffd8a0,.8,20);l.position.set(0,4.2,0);g.add(l);return g}
function seatAt(g,x,z){return {x:g.position.x+x,z:z}}
// ======= BAR =======
var BAR=room(100,0x3a2618,0x4a2c22);var B=SHOPS.bar;B.g=BAR;
box(8,1.1,.8,0x5a3418,0,.55,-2.4,BAR);box(8.2,.08,1,0x2a1a0c,0,1.12,-2.4,BAR);box(8,2,.4,0x2a1810,0,2.6,-4.7,BAR);
var barStools=[];for(var i=0;i<7;i++){var x=-3.3+i*1.1;cyl(.2,.06,0x881a1a,x,.7,-1.6,BAR);cyl(.04,.7,0x777777,x,.35,-1.6,BAR);barStools.push({x:100+x,z:-1.6,ry:Math.PI,y:.73})}
B.tv=screen(4.2,2.36,640,360,0,3.4,-4.45,0,BAR);B.qr=[qrStand(B.id,'#b33a2a',100-3.8,1.16,-2.2,0,null,1),qrStand(B.id,'#b33a2a',100+3.8,1.16,-2.2,0,null,1),qrStand(B.id,'#b33a2a',100,1.16,-2.2,0,null,1)];
B.qrTV=null;B.cam=[[100,2.6,5.2],[100,2.2,-2.5]];
// ======= COFFEE =======
var COF=room(200,0x8a6a48,0xd8c8a8);var CF=SHOPS.coffee;CF.g=COF;
box(4,1,.8,0x6a4a2a,-3.5,.5,-3.6,COF);CF.tv=screen(3.6,2.02,640,360,1.8,2.9,-4.85,0,COF);
var cTables=[[-4,1],[-1,2.2],[2,1],[4.5,2.8],[-3,3.6]],cSeats=[];CF.qr=[];
cTables.forEach(function(t,j){cyl(.45,.05,0xe8e0d0,t[0],.75,t[1],COF);cyl(.05,.75,0x444444,t[0],.37,t[1],COF);
 CF.qr.push(qrStand(CF.id,'#7a5233',200+t[0],.78,t[1],0,null,.7));
 [[0,-.75,0],[0,.75,Math.PI]].forEach(function(s){box(.4,.45,.4,0x5a3a22,t[0]+s[0],.22,t[1]+s[1],COF);cSeats.push({x:200+t[0]+s[0],z:t[1]+s[1]+(s[1]<0?.06:-.06),ry:s[2]+Math.PI,y:.445,tx:200+t[0],tz:t[1],side:s[1]})})});
CF.cam=[[200,2.8,7.5],[201,1.8,-1]];
// ======= ARCADE =======
var ARC=room(300,0x1a1830,0x221a40);var A=SHOPS.arcade;A.g=ARC;
for(var i=0;i<6;i++){var n=new THREE.Mesh(new THREE.BoxGeometry(13.6,.05,.05),new THREE.MeshBasicMaterial({color:[0xff3cac,0x2bd2ff][i%2]}));n.position.set(0,.3+i*.8,-4.88);ARC.add(n)}
// cabinets left side for flavour
for(var i=0;i<3;i++){box(.9,1.8,.8,0x2a2a6a,-5.8,.9,-3+i*1.6,ARC);var s=box(.7,.5,.05,M(0x000000,[0xff5a3c,0x3cff8a,0x3c8aff][i]),-5.34,1.35,-3+i*1.6,ARC);s.rotation.y=Math.PI/2}
// GyroForge pods in the corner: open frame (cage) + tilting shell (rig) so motion reads through the mesh
A.pods=[];for(var i=0;i<4;i++){var g=new THREE.Group();g.position.set(1.4+i*1.5,0,-3.4+(i%2)*.4);ARC.add(g);
 var cage=new THREE.Mesh(new THREE.TorusGeometry(.75,.04,8,24),M(0x9aa4b0));cage.position.y=1;g.add(cage);var c2=cage.clone();c2.rotation.y=Math.PI/2;g.add(c2);cyl(.5,.12,0x555566,0,.06,0,g);
 var rig=new THREE.Group();rig.position.y=1;g.add(rig);var sh=new THREE.Mesh(new THREE.SphereGeometry(.55,20,14,0,Math.PI*2,0,2.1),new THREE.MeshStandardMaterial({color:0xdde4ee,metalness:.6,roughness:.25,transparent:true,opacity:.55}));rig.add(sh);
 var ring=new THREE.Mesh(new THREE.TorusGeometry(.56,.025,8,30),new THREE.MeshBasicMaterial({color:0x2bd2ff}));ring.rotation.x=Math.PI/2;rig.add(ring);
 label('GYROFORGE '+(i+1),1,.2,'#2bd2ff','#0b0b18',0,.15,.6,0,g,'bold 60px sans-serif');
 A.pods.push({g:g,rig:rig,ring:ring,game:null,who:null,t:i*2})}
A.tv=screen(5.6,2.4,800,340,3.6,3.6,-4.8,0,ARC);A.qr=[qrStand(A.id,'#3b2a8a',300-2,1.1,-1,0.3,null,1.4)];
box(.08,1.1,.08,0x333333,298,.55,-1,null);
A.cam=[[300,3,6.5],[302.5,2.4,1.5]];
// ---- camera
var cam={p:new THREE.Vector3(0,4,16),l:new THREE.Vector3(0,2,0),tp:new THREE.Vector3(0,4,16),tl:new THREE.Vector3(0,2,0),k:2};
function shot(p,l,k){cam.tp.set(p[0],p[1],p[2]);cam.tl.set(l[0],l[1],l[2]);cam.k=k||2}
var portrait=W<H;function fitCam(){C.fov=portrait?75:55;C.aspect=W/H;C.updateProjectionMatrix()}fitCam();
// ---- state
var mode='street',sold={},pend=[],T=0,FZ=Q.has('freeze');
function after(s,f){pend.push({t:T+s,f:f})}
var capEl=document.getElementById('cap');function cap(s){capEl.textContent=s;capEl.style.opacity=s?1:0}
var ttl=document.getElementById('ttl');
function go(m){if(PV)stopPreview(true);menu(false);mode=m;pend=[];syncFeeds(m);updBtns();
 if(m=='street'){shot([0,4,16],[0,2,0],2);ttl.textContent='ZERO TO PHI · RED DEER STREET';cap('Pick a spot on the street. Every shop gets its own QR → its own room.');return}
 var s=SHOPS[m];ttl.textContent=s.name;
 shot([s.x,2.2,3],[s.x,2,-2],3);cap('Heading into '+s.name.toLowerCase().replace(/\b\w/g,function(a){return a.toUpperCase()})+'…');
 after(1.1,function(){cam.p.set(s.cam[0][0],s.cam[0][1]+.5,s.cam[0][2]+3);cam.l.set(s.cam[1][0],s.cam[1][1],s.cam[1][2]);shot(s.cam[0],s.cam[1],1.5);
  cap(sold[m]?PITCH[m]:'Tap SELL to put Zero to Phi in this room.')})}
var PITCH={bar:'Bar pitch: Bubble Hockey on the TV. Walk in, scan, your phone glows your colour — so does your skater.',
 coffee:'Coffee pitch: QR on every table for quick puzzles, plus a live board game on the TV wrapped in your menu.',
 arcade:'Arcade pitch: GyroForge pods run Drift Signal and Orbit Brawl. The big screen splits between live pods.'};
function sell(){if(mode=='street')return;var m=mode,s=SHOPS[m];if(!sold[m]){sold[m]=1;s.soldT=T;s.qr.forEach(function(q,j){q.visible=true;q.scale.setScalar(.01);q.userData.popAt=T+.3+j*.25})}
 cap(PITCH[m]);updBtns();var c=s.cam;shot([c[0][0],c[0][1]-.3,c[0][2]-1.2],[s.tv.m.parent.position.x+s.tv.m.position.x,s.tv.m.position.y-.3,s.tv.m.position.z],1.2);after(4,function(){if(mode==m)shot(c[0],c[1],1)})}
// ---- buttons
var bar=document.getElementById('bar'),BTN=[['street','Street'],['bar','Bar'],['coffee','Coffee Shop'],['arcade','Arcade'],['sell','SELL ▶'],['games','View All Games']];
BTN.forEach(function(b){var e=document.createElement('button');e.textContent=b[1];e.id='b_'+b[0];e.onclick=function(){b[0]=='sell'?sell():b[0]=='games'?(gm.style.display=='block'?(menu(false),stopPreview()):menu(true)):go(b[0])};bar.appendChild(e)});
function updBtns(){BTN.forEach(function(b){var e=document.getElementById('b_'+b[0]);e.className=(b[0]==mode||(b[0]=='sell'&&sold[mode]))?'on':'';if(b[0]=='games'){e.disabled=mode=='street';e.style.opacity=mode=='street'?.35:1;e.className=PV?'on':''}if(b[0]=='sell'){e.disabled=mode=='street';e.style.opacity=mode=='street'?.35:1;e.textContent=sold[mode]?'SOLD ✓':'SELL ▶'}})}
// ---- patrons per shop
var PCOL=['#ff4b4b','#4b9bff','#ffd23c','#4bff7a','#c14bff','#ff8c2a','#2bf0e0'];
function crowd(s,n,seats,door,kind,qrPos){s.ppl=[];s.seats=seats;for(var i=0;i<n;i++){var p=makePerson({i:i+3,np:0,shirt:new THREE.Color(PCOL[i]).multiplyScalar(.7),pants:[0x2b2f3a,0x3a3326,0x223a55][i%3]});p.col=PCOL[i];p.root.position.set(door[0],0,door[1]);p.root.visible=false;p.np=(i%3==1);p.state='out';p.next=1+i*2.3+Math.random();p.kind=kind;s.ppl.push(p)}s.door=door;s.qrPos=qrPos}
crowd(B,7,barStools,[105.8,4],'hockey',[[96.2,-1.4],[103.8,-1.4],[100,-1.4]]);
crowd(CF,6,cSeats,[205.8,4],'puzzle',null);
crowd(A,5,null,[305.8,4],'pod',[[298,-.3]]);
function freeSeat(s){var used=s.ppl.map(function(p){return p.seat});for(var i=0;i<s.seats.length;i++)if(used.indexOf(i)<0)return i;return -1}
function stepCrowd(s,key,dt){if(!sold[key])return;s.ppl.forEach(function(p,i){updPerson(p,dt,T);if(p.goal)return;p.next-=dt;if(p.next>0)return;
 if(p.state=='out'){ // drift in
  if(key=='arcade'){var pod=A.pods.filter(function(q){return !q.who})[0];if(!pod){p.next=3;return}p.pod=pod;pod.who=p;p.root.visible=true;p.root.position.set(s.door[0],0,s.door[1]);setPose(p,'stand');
   var scanFirst=Math.random()<.45;p.state='walk';var pw=pod.g.position;
   var toPod=function(){slideTo(p,300+pw.x,pw.z+1.1,Math.PI,function(){p.state='inpod';p.root.visible=false;pod.game=A.session=='allOB'?'dog':(A.pods.indexOf(pod)%2?'dog':'drift');pod.ring.material.color.set(p.col);p.next=10+Math.random()*8})};
   if(scanFirst)slideTo(p,s.qrPos[0][0]+.5,s.qrPos[0][1]+.7,-2.6,function(){setPose(p,'standPhone');drawPhone(p,p.col,'infra');p.state='scan';A.infraT=T+4;p.next=2.2;p.after=function(){setPose(p,'stand');toPod()}});else toPod();return}
  var si=freeSeat(s);if(si<0){p.next=2;return}p.seat=si;var st=s.seats[si];p.root.visible=true;p.root.position.set(s.door[0],0,s.door[1]);setPose(p,'stand');p.state='walk';
  var q=s.qrPos?s.qrPos[i%s.qrPos.length]:[st.x,st.z+(st.ry==0?-.5:.5)];if(p.np)q=[st.x+.01,st.z+.6];
  slideTo(p,q[0],q[1]+(s.qrPos?.6:0),Math.PI,function(){setPose(p,'standPhone');drawPhone(p,p.col,'join');p.state='scan';p.next=1.4;p.after=function(){slideTo(p,st.x,st.z,st.ry,function(){if(p.np){setPose(p,'sit',st.y);p.player=-1}else{setPose(p,'phone',st.y);drawPhone(p,p.col,key=='coffee'?(i%2?'board':'puzzle'):'hockey');p.glow.color.set(p.col);p.player=i}p.state='play';p.next=22+Math.random()*20})};if(p.np){setPose(p,'stand');p.next=0}});return}
 if(p.state=='scan'){p.state='walk';var f=p.after;p.after=null;f();return}
 if(p.state=='play'){p.state='walk';clearProps(p);setPose(p,'stand');p.seat=null;slideTo(p,s.door[0],s.door[1],0,function(){p.root.visible=false;p.state='out';p.next=2+Math.random()*4});return}
 if(p.state=='inpod'){var pod=p.pod;pod.who=null;pod.game=null;pod.ring.material.color.set(0x2bd2ff);p.root.visible=true;setPose(p,'stand');p.state='walk';slideTo(p,s.door[0],s.door[1],0,function(){p.root.visible=false;p.state='out';p.next=4+Math.random()*5})}
})}
// ---- LIVE GAME FEEDS: real games in hidden same-origin iframes, WebGL canvas copied (after each of the game's own frames) into a low-res 2D canvas
// used as the screen texture. Max 3 live iframes (shop feeds 1-2 + 1 preview). Fallback = placeholder drawings if a feed isn't ready.
var FEEDS={},FEEDURL={hockey:'../bubble/index.html?tv=1&watch=1',orbit:'../orbit/index.html?tv=1',drift:'../../games/space/attract_v01.html?nonet=1'};
function mkFeed(key,url){var f={key:key,url:url,ready:false,out:document.createElement('canvas'),t0:performance.now()};f.out.width=480;f.out.height=270;var o=f.out.getContext('2d');
 var ifr=document.createElement('iframe');ifr.src=url;ifr.setAttribute('aria-hidden','true');ifr.style.cssText='position:fixed;left:0;top:0;width:480px;height:270px;border:0;opacity:0;pointer-events:none;z-index:-1';
 ifr.onload=function(){try{var w=ifr.contentWindow,raf=w.requestAnimationFrame.bind(w),last=0;w.BH_MUTE=true;
  function grab(){var n=performance.now();if(n-last<110)return;last=n;try{var cs=w.document.getElementsByTagName('canvas'),best=null,ba=0;for(var i=0;i<cs.length;i++){var a=cs[i].width*cs[i].height;if(a>ba&&cs[i].offsetWidth>100){ba=a;best=cs[i]}}if(best){o.drawImage(best,0,0,480,270);f.ready=true}}catch(e){}}
  w.requestAnimationFrame=function(cb){return raf(function(t){cb(t);grab()})}}catch(e){f.err=1}};
 document.body.appendChild(ifr);f.ifr=ifr;FEEDS[key]=f;return f}
function killFeed(key){var f=FEEDS[key];if(f){f.ifr.src='about:blank';f.ifr.remove();delete FEEDS[key]}}
function feed(key){var f=FEEDS[key];return f&&f.ready?f.out:null}
function syncFeeds(m){var want=m=='bar'?['hockey']:m=='arcade'?['orbit','drift']:[];['hockey','orbit','drift'].forEach(function(k){if(want.indexOf(k)<0)killFeed(k);else if(!FEEDS[k]&&!Q.has('nolive'))mkFeed(k,FEEDURL[k])})}
// ---- View All Games: menu (list reused from ../joe/index.html) + one preview iframe on the current shop's main screen
var PV=null,GLIST=[];
function previewUrl(u){if(/bubble\/?$/.test(u))return [FEEDURL.hockey,'AI demo'];if(/\/orbit\/?$/.test(u))return [FEEDURL.orbit,'AI bots'];if(/games\/space\/?$/.test(u))return [FEEDURL.drift,'AI pilot'];return [u+(u.indexOf('?')<0?'?':'&')+'tv=1','title screen']}
function startPreview(g){stopPreview(true);var p=previewUrl(g[3].replace('../','../').replace(/^\.\.\/\.\.\//,'../../'));PV={name:g[0],kind:p[1]};mkFeed('pv',p[0]);menu(false);cap('Preview: '+g[0]+' ('+p[1]+') on the '+(SHOPS[mode]?SHOPS[mode].name.toLowerCase():'')+' screen. Tap View All Games again to close.')}
function stopPreview(q){killFeed('pv');PV=null;if(!q&&SHOPS[mode]){var s=SHOPS[mode];if(!sold[mode])tvOff(s.tv,s.name,'#ffffff');cap(sold[mode]?PITCH[mode]:'Tap SELL to put Zero to Phi in this room.')}}
var gm=document.createElement('div');gm.id='gm';gm.style.cssText='position:fixed;right:10px;bottom:64px;top:44px;width:min(380px,92vw);overflow:auto;background:rgba(12,14,22,.94);border:1px solid #333;border-radius:14px;padding:8px;display:none;z-index:5;font:14px system-ui';document.body.appendChild(gm);
function menu(on){gm.style.display=on?'block':'none';if(!on)return;gm.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px"><b>ALL GAMES · tap for a preview</b><button id="gmx" style="border:0;border-radius:14px;padding:6px 12px;background:#f5b82e;font-weight:700">Close</button></div>'+
 (GLIST.length?GLIST.map(function(g,i){return '<div data-i="'+i+'" style="padding:8px 10px;border-radius:10px;margin:2px 0;background:'+(PV&&PV.name==g[0]?'#2b3b5a':'rgba(255,255,255,.06)')+';cursor:pointer"><b>'+g[0]+'</b> <span style="opacity:.6">'+g[1]+'</span><div style="opacity:.7;font-size:12px">'+g[2]+'</div></div>'}).join(''):'<div style="padding:10px">Loading list…</div>');
 gm.querySelector('#gmx').onclick=function(){menu(false);stopPreview()};gm.querySelectorAll('[data-i]').forEach(function(e){e.onclick=function(){startPreview(GLIST[+e.dataset.i])}})}
fetch('../joe/index.html').then(function(r){return r.text()}).then(function(t){var m=t.match(/var G=(\[[\s\S]*?\n\]);/);if(m){GLIST=(new Function('return '+m[1]))().filter(function(g){return !/showcase/.test(g[3])})}if(gm.style.display=='block')menu(true)}).catch(function(){});
function drawPreview(k){var c=feed('pv'),g=k.g,w=k.c.width,h=k.c.height;g.fillStyle='#000';g.fillRect(0,0,w,h);if(c)g.drawImage(c,0,0,w,h);else{g.fillStyle='#fff';g.font='bold '+(h/12|0)+'px sans-serif';g.textAlign='center';g.fillText('Loading '+PV.name+'…',w/2,h/2)}
 g.fillStyle='rgba(0,0,0,.65)';g.fillRect(0,h-30,w,30);g.fillStyle='#f5b82e';g.font='bold 17px sans-serif';g.textAlign='left';g.fillText('PREVIEW · '+PV.name.toUpperCase()+' · '+PV.kind,10,h-10);k.t.needsUpdate=true}
// ---- STAFF + served props
var props=[];function clearProps(p){props.forEach(function(o){if(o.who==p)o.life=Math.min(o.life,.5)})}
function mkProp(kind){var g=new THREE.Group();if(kind=='beer'){cyl(.045,.16,M(0xd99a20,0x3a2200),0,.08,0,g);cyl(.047,.03,0xfff8e0,0,.17,0,g)}
 else if(kind=='coffee'){cyl(.11,.012,0xffffff,0,.006,0,g);cyl(.045,.08,0xf4f0e8,0,.05,0,g);cyl(.04,.005,0x4a2a14,0,.09,0,g)}
 else{cyl(.13,.015,0xffffff,0,.008,0,g);box(.1,.05,.07,[0xd8a050,0x6ab04a,0xc84a3a][(Math.random()*3)|0],0,.04,0,g)}S.add(g);return g}
function mkStaff(shop,x,z,col,menu){var p=makePerson({i:shop.ppl.length+9,shirt:0xf2f2f2,pants:0x111111,shoes:0x222222});var ap=box(.44,.4,.02,col,0,.12,.13,p.up);p.root.position.set(x,0,z);p.home=[x,z];p.wait=2;p.menu=menu;shop.staff=p;return p}
var bt=mkStaff(B,100,-3.3,0x6a1a10,['beer','beer','plate']),ba=mkStaff(CF,196.5,-2.8,0x2a5a3a,['coffee','coffee','plate']);
function stepStaff(s,key,dt){var p=s.staff;if(!p)return;updPerson(p,dt,T);if(!sold[key]||p.goal)return;p.wait-=dt;if(p.wait>0)return;
 var c=s.ppl.filter(function(q){return q.state=='play'&&!props.some(function(o){return o.who==q&&o.life>0})});if(!c.length){p.wait=2;return}var q=c[(Math.random()*c.length)|0],st=s.seats[q.seat],kind=p.menu[(Math.random()*p.menu.length)|0];
 var tx,tz,ty,px,pz;if(key=='bar'){tx=st.x;tz=-3.2;px=st.x+(Math.random()-.5)*.2;pz=-2.15;ty=1.16}else{px=st.tx+(st.x-st.tx)*.15+(Math.random()-.5)*.15;pz=st.tz+st.side*.22;ty=.775;tx=st.tx+.75;tz=st.tz}
 slideTo(p,tx,tz,key=='bar'?0:-Math.PI/2,function(){var o=mkProp(kind);o.position.set(px,ty,pz);o.scale.setScalar(.01);props.push({g:o,who:q,life:14+Math.random()*12,age:0});p.root.userData.pop=1.08;p.wait=1;
  setTimeout(function(){},0);p.goal=null;p.wait=.8;p.back=1});}
function stepStaffBack(s){var p=s.staff;if(p&&p.back&&!p.goal&&p.wait<=0){p.back=0;slideTo(p,p.home[0],p.home[1],key0(s),function(){p.wait=3+Math.random()*5})}}
function key0(s){return s==B?0:Math.PI/2}
function stepProps(dt){for(var i=props.length-1;i>=0;i--){var o=props[i];o.age+=dt;o.life-=dt;var sc=Math.min(1,o.age*4);if(o.life<1)sc=Math.max(0,o.life);o.g.scale.setScalar(Math.max(.01,sc));if(o.life<=0){S.remove(o.g);props.splice(i,1)}}}
function chat(s){s.ppl.forEach(function(p){if(p.np&&p.state=='play'){p.up.rotation.y=Math.sin(T*1.3+p.root.id)*.35;p.up.rotation.z=Math.sin(T*2.1+p.root.id)*.05;p.armL.rotation.x=-.4-.4*Math.max(0,Math.sin(T*.7+p.root.id))}else{p.up.rotation.y=0;p.up.rotation.z=0}})}
// ---- TV drawing
function tvOff(k,name,col){var g=k.g,w=k.c.width,h=k.c.height;g.fillStyle='#08090c';g.fillRect(0,0,w,h);g.fillStyle=col;g.globalAlpha=.35;g.font='bold '+Math.round(h/9)+'px sans-serif';g.textAlign='center';g.fillText(name,w/2,h/2);g.globalAlpha=1;k.t.needsUpdate=true}
var skaters=[];for(var i=0;i<10;i++)skaters.push({x:Math.random(),y:Math.random(),a:Math.random()*7});
function drawHockey(k,t){var g=k.g,w=640,h=360,act=B.ppl.filter(function(p){return p.state=='play'&&!p.np});var lv=feed('hockey');if(lv){g.drawImage(lv,0,0,w,h);
 g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,0,w,34);g.fillStyle='#fff';g.font='bold 18px sans-serif';g.textAlign='left';g.fillText('RUSTY PUCK · BUBBLE HOCKEY · LIVE',12,23);
 act.forEach(function(p,j){var x=w-24-j*34;g.fillStyle=p.col;g.beginPath();g.arc(x,17,12,0,7);g.fill();g.fillStyle='#000';g.font='bold 11px sans-serif';g.textAlign='center';g.fillText('P'+(p.player+1),x,21)});g.textAlign='left';
 g.fillStyle='#fff';g.fillRect(w-92,h-92,84,84);g.drawImage(B.qrImg,w-90,h-90,80,80);k.t.needsUpdate=true;return}
 var zoom=1+.35*(.5+.5*Math.sin(t*.25)),fx=.5+(.5-.5/zoom)*Math.sin(t*.17);g.fillStyle='#0a0c12';g.fillRect(0,0,w,h);g.save();g.translate(w/2,h/2);g.scale(zoom,zoom);g.translate(-w*fx,-h/2);
 g.fillStyle='#e8f2ff';g.fillRect(20,30,600,300);g.strokeStyle='#c22';g.lineWidth=4;g.beginPath();g.moveTo(320,30);g.lineTo(320,330);g.stroke();g.strokeStyle='#22c';[220,420].forEach(function(x){g.beginPath();g.moveTo(x,30);g.lineTo(x,330);g.stroke()});g.beginPath();g.arc(320,180,40,0,7);g.stroke();
 var px=320+220*Math.sin(t*.9),py=180+100*Math.sin(t*1.3);
 skaters.forEach(function(s,i){var x=40+560*(.5+.45*Math.sin(t*(.3+i*.05)+s.a)),y=50+260*(.5+.45*Math.cos(t*(.35+i*.04)+s.a*2));x+=(px-x)*.25;y+=(py-y)*.25;
  var who=act.filter(function(p){return p.player==i})[0];g.fillStyle=i<5?'#2a5bd8':'#d83a2a';g.beginPath();g.arc(x,y,12,0,7);g.fill();if(who){g.strokeStyle=who.col;g.lineWidth=6;g.beginPath();g.arc(x,y,19,0,7);g.stroke();g.fillStyle=who.col;g.font='bold 14px sans-serif';g.fillText('P'+(i+1),x-9,y-24)}});
 g.fillStyle='#000';g.beginPath();g.arc(px,py,6,0,7);g.fill();g.restore();
 g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,0,w,34);g.fillStyle='#fff';g.font='bold 20px sans-serif';g.textAlign='left';g.fillText('RUSTY PUCK · BUBBLE HOCKEY   BLUE '+(3+((t/23)|0)%4)+' – '+(2+((t/31)|0)%4)+' RED',12,24);
 g.textAlign='right';g.fillText(act.length+' on phones',w-12,24);
 // QR corner -> join this room
 g.fillStyle='#fff';g.fillRect(w-92,h-92,84,84);g.drawImage(B.qrImg,w-90,h-90,80,80);g.textAlign='left';k.t.needsUpdate=true}
B.qrImg=qrCanvas(B.id,'#b33a2a').c;CF.qrImg=qrCanvas(CF.id,'#7a5233').c;A.qrImg=qrCanvas(A.id,'#3b2a8a').c;
var MENU=['Flat White  4.75','Ember Latte  5.50','Maple Scone  3.95','Chai  4.95','Oat Cookie  2.75','Drip  2.95'];
function drawBoard(k,t){var g=k.g,w=640,h=360;g.fillStyle='#2a1c12';g.fillRect(0,0,w,h);g.fillStyle='#ffd9a0';g.font='bold 26px serif';g.textAlign='center';g.fillText('MORNING EMBER COFFEE',w/2,34);
 g.font='16px sans-serif';g.textAlign='left';MENU.forEach(function(m,i){g.fillText(m,i<3?14:490,90+(i%3)*50)});
 var bx=200,by=60,s=30;for(var y=0;y<8;y++)for(var x=0;x<8;x++){g.fillStyle=(x+y)%2?'#6b4426':'#e8d2ac';g.fillRect(bx+x*s,by+y*s,s,s)}
 var mv=(t/1.5|0);for(var i=0;i<12;i++){var x=(i*3+((i+mv)%3==0?1:0)+mv*(i%2))%8,y=(i<6?(i%3):5+(i%3));if((x+y)%2==0)x=(x+1)%8;g.fillStyle=i<6?'#c33':'#222';g.beginPath();g.arc(bx+x*s+15,by+y*s+15,11,0,7);g.fill()}
 g.fillStyle='#ffd9a0';g.font='14px sans-serif';g.textAlign='center';g.fillText('Live table game · scan any table code to join · '+CF.ppl.filter(function(p){return p.state=='play'&&!p.np}).length+' playing',w/2,h-12);
 g.drawImage(CF.qrImg,w-88,h-118,76,90);k.t.needsUpdate=true}
var stars=[];for(var i=0;i<60;i++)stars.push([Math.random(),Math.random(),Math.random()]);
function drawSpace(g,x0,w,h,kind,t,label){g.save();g.beginPath();g.rect(x0,0,w,h);g.clip();var lv=feed(kind=='dog'?'orbit':'drift');if(lv){var sw=Math.min(480,270*w/h),sx=(480-sw)/2;g.drawImage(lv,sx,0,sw,270,x0,0,w,h);g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x0,0,w,26);g.fillStyle='#fff';g.font='bold 15px sans-serif';g.textAlign='left';g.fillText(label,x0+8,18);g.restore();return}g.fillStyle=kind=='dog'?'#07040f':'#020814';g.fillRect(x0,0,w,h);
 stars.forEach(function(s){var sx=x0+((s[0]*w+(kind=='dog'?-t*120:-t*15)*s[2])%w+w)%w;g.fillStyle='rgba(255,255,255,'+(.3+s[2]*.7)+')';g.fillRect(sx,s[1]*h,2,2)});
 if(kind=='drift'){g.fillStyle='#3a6cff';g.beginPath();g.arc(x0+w*.7,h*.6,h*.25,0,7);g.fill();g.fillStyle='#bfe';g.beginPath();var sx=x0+w*.35+Math.sin(t*.5)*20,sy=h*.45+Math.cos(t*.4)*14;g.moveTo(sx+16,sy);g.lineTo(sx-10,sy-8);g.lineTo(sx-10,sy+8);g.fill()}
 else{var sx=x0+w*.3,sy=h*.5+Math.sin(t*2.2)*h*.25;g.fillStyle='#ff5';g.beginPath();g.moveTo(sx+18,sy);g.lineTo(sx-12,sy-10);g.lineTo(sx-12,sy+10);g.fill();
  for(var i=0;i<3;i++){var ex=x0+w*(.6+.12*i)+Math.sin(t*3+i)*15,ey=h*(.3+.2*i)+Math.cos(t*2+i)*20;g.fillStyle='#f44';g.fillRect(ex-8,ey-6,16,12)}
  g.strokeStyle='#4ff';g.lineWidth=2;for(var i=0;i<4;i++){var lx=sx+20+((t*400+i*60)%(w*.6));g.beginPath();g.moveTo(lx,sy);g.lineTo(lx+18,sy);g.stroke()}}
 g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x0,0,w,26);g.fillStyle='#fff';g.font='bold 15px sans-serif';g.textAlign='left';g.fillText(label,x0+8,18);g.restore()}
A.session='mix';A.sessT=0;
function drawArcade(k,t){var g=k.g,w=800,h=340,act=A.pods.filter(function(p){return p.game});g.fillStyle='#000';g.fillRect(0,0,w,h);
 if(!act.length){drawSpace(g,0,w,h,'drift',t,'ATTRACT · DRIFT SIGNAL')}else{var cw=w/act.length;act.forEach(function(p,i){drawSpace(g,i*cw,cw-3,h,p.game,t+i*7,'POD '+(A.pods.indexOf(p)+1)+' · '+(p.game=='dog'?'ORBIT BRAWL':'DRIFT SIGNAL'))})}
 if(A.infraT&&T<A.infraT){g.fillStyle='rgba(5,10,30,.9)';g.fillRect(150,40,500,260);g.strokeStyle='#2bd2ff';g.lineWidth=2;g.strokeRect(150,40,500,260);g.fillStyle='#2bd2ff';g.font='bold 18px monospace';g.textAlign='center';g.fillText('UNDER THE HOOD',400,70);
  [['PHONE',220,140],['ROOM SERVER',400,140],['BIG SCREEN',580,110],['POD 1-4',580,180],['SHOP ADMIN',400,250]].forEach(function(b){g.strokeRect(b[1]-70,b[2]-18,140,36);g.fillText(b[0],b[1],b[2]+6)});
  g.beginPath();g.moveTo(290,140);g.lineTo(330,140);g.moveTo(470,135);g.lineTo(510,112);g.moveTo(470,145);g.lineTo(510,178);g.moveTo(400,158);g.lineTo(400,232);g.stroke();g.font='13px monospace';g.fillText('join?shop=pixel-depot · websocket · 60 Hz state',400,290)}
 g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,h-24,250,24);g.fillStyle='#2bd2ff';g.font='bold 13px sans-serif';g.textAlign='left';g.fillText(A.session=='allOB'?'SESSION: ALL PODS · ORBIT BRAWL':'SESSION: MIXED · DRIFT SIGNAL + ORBIT BRAWL',8,h-8);
 g.fillStyle='#fff';g.fillRect(w-86,h-104,80,98);g.drawImage(A.qrImg,w-84,h-102,76,94);k.t.needsUpdate=true}
[[B,'#b33a2a'],[CF,'#ffd9a0'],[A,'#2bd2ff']].forEach(function(a){tvOff(a[0].tv,a[0].name,a[1])});
// ---- loop
var last=performance.now(),tvAcc=0;
function step(dt){T+=dt;for(var i=pend.length-1;i>=0;i--)if(T>=pend[i].t){var f=pend[i].f;pend.splice(i,1);f()}
 streetPpl.forEach(function(p,i){updPerson(p,dt,T);if(!p.goal)slideTo(p,-16+Math.random()*32,1.5+Math.random()*1.5,0,function(){setPose(p,Math.random()<.4?'standPhone':'stand');if(p.phone.visible)drawPhone(p,'#2bd2ff','join')})});
 stepCrowd(B,'bar',dt);stepStaff(B,'bar',dt);stepStaff(CF,'coffee',dt);stepStaffBack(B);stepStaffBack(CF);stepProps(dt);chat(B);chat(CF);stepCrowd(CF,'coffee',dt);stepCrowd(A,'arcade',dt);
 [B,CF,A].forEach(function(s){s.qr.forEach(function(q){if(q.userData.popAt){var a=T-q.userData.popAt;if(a>0){var e=Math.min(1,a/.5);q.scale.setScalar(q.userData.s*(e<1?e*1.25-(e>.8?(e-.8)*1.25:0):1));q.rotation.y+=a<.5?.3:0;if(e>=1){q.rotation.y=0;q.userData.popAt=0}}}})});
 Object.keys(SHOPS).forEach(function(k,i){lamps[i].intensity=sold[k]?1.5:0;SHOPS[k].win.material.emissive.setHex(sold[k]?0x2a6a9a:0x0a1a2a)});
 if(sold.arcade){A.sessT+=dt;if(A.sessT>(A.session=='allOB'?20:28)){A.sessT=0;A.session=A.session=='allOB'?'mix':'allOB';A.pods.forEach(function(p,i){if(p.game)p.game=A.session=='allOB'?'dog':(i%2?'dog':'drift')})}}
 A.pods.forEach(function(p,i){var tt=T+p.t;if(p.game=='dog'){p.rig.rotation.z=Math.sin(tt*2.2)*.5;p.rig.rotation.x=Math.sin(tt*1.6)*.35}else if(p.game=='drift'){p.rig.rotation.z=Math.sin(tt*.5)*.12;p.rig.rotation.x=Math.sin(tt*.4)*.08}else{p.rig.rotation.z*=.95;p.rig.rotation.x*=.95}});
 var nw=performance.now();if(nw-tvAcc>66){tvAcc=nw;var tv=FZ&&!dt?T+nw/1000:T;var cur=PV&&SHOPS[mode]?SHOPS[mode]:null;if(sold.bar&&cur!==B)drawHockey(B.tv,tv);if(sold.coffee&&cur!==CF)drawBoard(CF.tv,tv);if(sold.arcade&&cur!==A)drawArcade(A.tv,tv);if(cur)drawPreview(cur.tv)}
 var k=1-Math.exp(-cam.k*dt);cam.p.lerp(cam.tp,k);cam.l.lerp(cam.tl,k)}
function frame(){var now=performance.now(),dt=FZ?0:Math.min(.05,(now-last)/1000);last=now;step(dt);var pp=cam.p.clone();if(portrait){pp.sub(cam.l).multiplyScalar(1.3).add(cam.l)}C.position.copy(pp);C.lookAt(cam.l);R.render(S,C);requestAnimationFrame(frame)}
addEventListener('resize',function(){W=innerWidth;H=innerHeight;portrait=W<H;R.setSize(W,H);fitCam()});
// boot: ?scene=bar|coffee|arcade&sell&t=N&freeze (deterministic pre-sim for screenshots)
var sc=Q.get('scene');updBtns();go(sc&&SHOPS[sc]?sc:'street');
if(sc&&SHOPS[sc]){var tt=+(Q.get('t')||0);if(Q.has('sell'))after(1.2,sell);for(var x=0;x<tt;x+=.05)step(.05);cam.p.copy(cam.tp);cam.l.copy(cam.tl);if(Q.has('shot'))shot(cam.tp.toArray(),cam.tl.toArray(),9)}
if(Q.has('cam')){var c=Q.get('cam').split(',').map(Number);shot(c.slice(0,3),c.slice(3,6),99);cam.p.copy(cam.tp);cam.l.copy(cam.tl)}
if(Q.get('preview')&&SHOPS[mode]){var pvn=Q.get('preview');var iv=setInterval(function(){var g=GLIST.filter(function(x){return x[0].toLowerCase().indexOf(pvn)==0})[0];if(g){clearInterval(iv);startPreview(g)}},200)}
frame();
})();
