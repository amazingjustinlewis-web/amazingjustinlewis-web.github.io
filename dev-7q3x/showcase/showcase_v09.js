/* v0.9: auto tour holds 2.5 s and adds GyroForge full-frame close-up (prefers a rider boarding/leaving) + floor-level look-up at the big screen past a pod; under-the-hood overlay removed (screen just shows the games); original procedural chiptune per place, street ambience, game sounds near screens, Sound menu (Ambient/Music sliders, localStorage), crossfades; TRACK_FILES swap slot.
   v0.8: pod doors rest OPEN, close only once rider is seated+reclined; rider turns 45deg left + leans back 18deg; Change View auto-tour (wide/cafe/big screen/ads/sponsor/pods); hides focused head in over-shoulder view.
   Zero to Phi Arcade Showcase v0.4 (v0.3 + shared Orbit Brawl match, auto-playing previews (muted), Change View phone close-up, cabinets+pinball, high-score ticker, split-flap ad slot, sponsor boards, Rush Hour, Shop Admin tablet) — "sales game for Joe" (DEV)
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
function ihash(s){var r=hash(s);return function(){return (r()*1000)|0}}
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
 var head=new THREE.Mesh(new THREE.SphereGeometry(.17,20,16),[M(SKIN[i%5])][0]);head.position.y=.76;p.up.add(head);p.head=head;
 var face=new THREE.Mesh(new THREE.CircleGeometry(.15,24),new THREE.MeshBasicMaterial({map:faceTex(i,SKIN[i%5])}));face.position.set(0,.76,.171);p.up.add(face);p.face=face;
 p.armR=new THREE.Group();p.armR.position.set(.25,.52,0);p.up.add(p.armR);box(.1,.45,.1,sh,0,-.2,0,p.armR);
 p.armL=new THREE.Group();p.armL.position.set(-.25,.52,0);p.up.add(p.armL);box(.1,.45,.1,sh,0,-.2,0,p.armL);
 // phone in right hand (Hand_R) with glow in player colour + static game + hovering finger
 p.phone=new THREE.Group();p.phone.position.set(0,-.43,.04);p.armR.add(p.phone);
 var pk=cv(64,112);p.pk=pk;var pm=new THREE.Mesh(new THREE.PlaneGeometry(.07,.13),new THREE.MeshBasicMaterial({map:pk.t}));pm.position.z=.012;p.phone.add(pm);p.pm=pm;box(.08,.14,.015,0x111111,0,0,0,p.phone);
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
 else if(!p.inRing)p.root.position.y=p.sy||0;
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
// v0.4 MACHINES: proxy arcade cabinets + pinball. Each is one THREE.Group (swap slot: replace m.g children with Justin's model, keep m.scr screen plane + m.spot)
A.mach=[];
function mkCab(name,col,x,z,ry){var g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;ARC.add(g);g.name='SWAP_cabinet_'+name;
 box(.8,1.25,.75,col,0,.62,0,g);box(.8,.5,.45,col,0,1.5,-.15,g);box(.8,.2,.55,0x111111,0,1.95,-.1,g);
 var cp=box(.78,.06,.35,0x222233,0,1.22,.38,g);cp.rotation.x=-.35;cyl(.025,.1,0xdd2222,-.15,1.3,.38,g);cyl(.035,.02,0xffdd22,.1,1.3,.38,g);cyl(.035,.02,0x22ddff,.22,1.3,.33,g);
 var sk=screen(.62,.44,160,120,0,1.55,.085,0,g);sk.m.rotation.x=-.18;label(name,.78,.16,'#fff',['#d0306a','#2a8a3a','#2a50c0'][A.mach.length%3],0,1.95,.18,0,g,'bold 56px sans-serif');
 var m={g:g,k:sk,name:name,kind:'cab',who:null,spot:null};A.mach.push(m);return m}
function mkPin(name,x,z,ry){var g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;ARC.add(g);g.name='SWAP_pinball_'+name;
 [[-.3,-.55],[.3,-.55],[-.3,.55],[.3,.55]].forEach(function(l){box(.06,.8,.06,0x888899,l[0],.4,l[1],g)});
 var tb=box(.7,.22,1.4,0x7a1a8a,0,.95,0,g);tb.rotation.x=-.12;var pf=screen(.62,1.3,96,200,0,1.075,0,0,g);pf.m.rotation.x=-Math.PI/2-.12;
 box(.7,.8,.12,0x7a1a8a,0,1.6,-.68,g);var bg=screen(.62,.5,160,128,0,1.62,-.61,0,g);
 var m={g:g,k:bg,pf:pf,name:name,kind:'pin',who:null};A.mach.push(m);return m}
mkCab('METEOR MASH',0x3a1a5a,-5.6,-4.45,0);mkCab('GOBBLE GRID',0x1a3a2a,-4.6,-4.45,0);mkCab('TANK TUSSLE',0x1a2a5a,-6.45,-1.6,Math.PI/2);mkPin('PRAIRIE PINBALL',-2.6,-3.7,0);
A.mach.forEach(function(m){var v=new THREE.Vector3(0,0,m.kind=='pin'?1.05:.8);v.applyAxisAngle(new THREE.Vector3(0,1,0),m.g.rotation.y);m.spot=[300+m.g.position.x+v.x,m.g.position.z+v.z,m.g.rotation.y+Math.PI]});
function drawMach(m,t){var k=m.k,g=k.g,w=k.c.width,h=k.c.height,on=!!m.who,tt=t*(on?1.6:1);g.fillStyle='#05050c';g.fillRect(0,0,w,h);
 if(m.name=='METEOR MASH'){for(var i=0;i<7;i++){var x=(i*37+tt*20*(1+i%3))%w,y=(i*53+tt*30)%h;g.fillStyle='#b98';g.beginPath();g.arc(x,y,5+i%3*3,0,7);g.fill()}g.fillStyle='#4ff';g.fillRect(w/2+Math.sin(tt*2)*40-6,h-18,12,10)}
 else if(m.name=='GOBBLE GRID'){g.strokeStyle='#33f';g.lineWidth=2;for(var i=0;i<5;i++)g.strokeRect(10+i*6,10+i*6,w-20-i*12,h-20-i*12);var a=(tt*1.5)%(Math.PI*2),px=w/2+Math.cos(a)*50,py=h/2+Math.sin(a)*30;g.fillStyle='#ff0';g.beginPath();g.moveTo(px,py);g.arc(px,py,8,.5,5.8);g.fill()}
 else if(m.name=='TANK TUSSLE'){g.fillStyle='#2a4';g.fillRect(0,h-20,w,20);[[30,'#6f6'],[w-40,'#f66']].forEach(function(q,j){g.fillStyle=q[1];g.fillRect(q[0],h-30,20,10)});var u=(tt%2)/2;g.fillStyle='#ff8';g.beginPath();g.arc(40+u*(w-80),h-30-Math.sin(u*Math.PI)*70,3,0,7);g.fill()}
 else {g.fillStyle='#401050';g.fillRect(0,0,w,h);g.fillStyle='#ffd23c';g.font='bold 20px sans-serif';g.textAlign='center';g.fillText('PRAIRIE',w/2,40);g.fillText('PINBALL',w/2,66);g.textAlign='left';
  var p=m.pf,q=p.g;q.fillStyle='#1a0830';q.fillRect(0,0,96,200);[[30,50],[66,60],[48,90]].forEach(function(b,j){q.fillStyle=Math.sin(tt*6+j)>0?'#ff3cac':'#802060';q.beginPath();q.arc(b[0],b[1],9,0,7);q.fill()});q.fillStyle='#ddd';q.beginPath();q.arc(48+Math.sin(tt*2.3)*30,100+Math.cos(tt*1.7)*70,4,0,7);q.fill();q.fillStyle='#fd4';q.fillRect(22,180,20,5);q.fillRect(54,180,20,5);p.t.needsUpdate=true}
 g.fillStyle=on?'#fff':'#f5b82e';g.font='bold 12px monospace';g.fillText(on?'1UP '+String((t*137|0)%99999).padStart(5,'0'):(Math.sin(t*3)>0?'INSERT COIN':''),6,14);k.t.needsUpdate=true}
// v0.5 GyroForge pods: the real pod (web-light GLB exported from the GyroForge Blender scene). Doors use the baked clips
// v0.6: GLB v02 adds the internal pod + inner doors (GF_InnerDoor_*, children of GF_Ring_Inner) in the same clips; rider hides once shut.
// 'close' (frames 1-64) and 'open' (530-594); rings GF_Ring_Outer > GF_Ring_Middle > GF_Ring_Inner are driven live from each pilot's Orbit Brawl ship.
var GF={s:.55,gltf:null,ok:false};
A.pods=[];for(var i=0;i<4;i++){var g=new THREE.Group();g.position.set(1.4+i*1.5,0,-3.4+(i%2)*.4);ARC.add(g);
 var ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.025,8,36),new THREE.MeshBasicMaterial({color:0x2bd2ff}));ring.rotation.x=Math.PI/2;ring.position.y=.03;g.add(ring);
 var rig=new THREE.Group();g.add(rig);
 label('GYROFORGE '+(i+1),1,.2,'#2bd2ff','#0b0b18',0,.15,.85,0,g,'bold 60px sans-serif');
 A.pods.push({g:g,rig:rig,ring:ring,game:null,who:null,t:i*2,door:{clip:'open',t0:-99},ang:[0,0,0]})}
function podDoor(pod,clip){pod.door={clip:clip,t0:T}}window.__podDoor=function(i,c){podDoor(A.pods[i],c)};
function doorDur(clip){return GF.ok?GF.dur[clip]:2.6}
(function(){if(!THREE.GLTFLoader)return;var GL=new THREE.GLTFLoader();if(window.MeshoptDecoder)GL.setMeshoptDecoder(window.MeshoptDecoder);GL.load('models/gyroforge_pod_v02.glb?b=2',function(gl){GF.gltf=gl;GF.dur={};gl.animations.forEach(function(a){GF.dur[a.name]=a.duration});
 gl.scene.traverse(function(o){if(o.isMesh){o.castShadow=false;var mm=Array.isArray(o.material)?o.material:[o.material];if(/Panel/.test(o.name))mm.forEach(function(m){m.transparent=true;m.opacity=/Door/.test(o.name)?.6:.3;m.depthWrite=false;m.side=THREE.DoubleSide})}});
 A.pods.forEach(function(pod){var m=gl.scene.clone(true);m.scale.setScalar(GF.s);m.position.set(.19*GF.s,0,-.01*GF.s);pod.rig.add(m);pod.model=m;
  pod.mixer=new THREE.AnimationMixer(m);pod.act={};gl.animations.forEach(function(a){var ac=pod.mixer.clipAction(a);ac.setLoop(THREE.LoopOnce);ac.clampWhenFinished=true;pod.act[a.name]=ac});
  pod.nodes={o:m.getObjectByName('GF_Ring_Outer'),m:m.getObjectByName('GF_Ring_Middle'),i:m.getObjectByName('GF_Ring_Inner')};pod.rest={};for(var k in pod.nodes)pod.rest[k]=pod.nodes[k].quaternion.clone();addGlow(pod)});
 GF.ok=true},undefined,function(e){console.warn('GyroForge GLB failed',e)})})();
// ship attitude from the live Orbit Brawl iframe (Orbit.Sim instance), smooth fallback when the feed isn't running
var _q=new THREE.Quaternion(),_e=new THREE.Euler(),_ax=new THREE.Vector3(1,0,0),_rq=new THREE.Quaternion();
function orbitShips(){var f=FEEDS.orbit;try{var w=f&&f.ifr&&f.ifr.contentWindow;if(!w||!w.Orbit)return null;if(!w.__ztpSimHook){w.__ztpSimHook=1;var st=w.Orbit.Sim.prototype.step;w.Orbit.Sim.prototype.step=function(){w.__ztpSim=this;return st.apply(this,arguments)}}var sm=w.__ztpSim;return sm&&sm.ships&&sm.ships.length?sm.ships:null}catch(e){return null}}
function podTarget(pod,i,dt){var tt=T+pod.t,a=[0,0,0];
 if(pod.game=='dog'){var sh=orbitShips(),s=sh&&sh[i%sh.length];if(s&&s.q){_q.set(s.q.x,s.q.y,s.q.z,s.q.w);_e.setFromQuaternion(_q,'YXZ');a=[_e.x,_e.z,_e.y];pod.live=1}
  else{a=[Math.sin(tt*1.6)*.9,Math.sin(tt*2.2)*1.4,tt*.7];pod.live=0}}
 else if(pod.game=='drift')a=[Math.sin(tt*.4)*.25,Math.sin(tt*.5)*.35,Math.sin(tt*.21)*.6];
 for(var k=0;k<3;k++){var d=a[k]-pod.ang[k];if(k==2||pod.game=='dog'){d=Math.atan2(Math.sin(d),Math.cos(d))}pod.ang[k]+=d*(1-Math.exp(-4*dt))}
 if(!pod.game)for(var k=0;k<3;k++)pod.ang[k]=Math.atan2(Math.sin(pod.ang[k]),Math.cos(pod.ang[k]))*Math.exp(-1.5*dt)}
// v0.7 ring glow: additive sprites parented to ring nodes (no bloom pass, no point lights -> phone-safe). Brightness = smoothed angular speed.
var GLOWTEX=(function(){var c=document.createElement('canvas');c.width=c.height=64;var g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,255,255,.75)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
var GLOW_SPEC={o:[[0x00e5ff,0],[0xff2bd6,Math.PI]],m:[[0xffb000,Math.PI/2]],i:[[0x39ff6a,-Math.PI/2]]};
var LQ=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||Q.has('lq'),_fps={t:0,n:0};
function addGlow(pod){pod.model.updateWorldMatrix(true,true);pod.glow={o:[],m:[],i:[]};pod.pa=[0,0,0];pod.gv=[0,0,0];
 for(var k in GLOW_SPEC){var nd=pod.nodes[k],mesh=nd.getObjectByName(nd.name+'_Mesh')||nd.children[0],r=.5;var cen=new THREE.Vector3();
  if(mesh){var bb=new THREE.Box3().setFromObject(mesh);var sz=new THREE.Vector3();bb.getSize(sz);nd.updateWorldMatrix(true,false);var ws=new THREE.Vector3();nd.getWorldScale(ws);r=Math.max(sz.x,sz.y,sz.z)/2/ws.x*.92;bb.getCenter(cen);nd.worldToLocal(cen)}
  GLOW_SPEC[k].forEach(function(sp){var core=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:sp[0],blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.2}));
   var halo=new THREE.Sprite(core.material.clone());core.position.set(cen.x,cen.y+Math.cos(sp[1])*r,cen.z+Math.sin(sp[1])*r);halo.position.copy(core.position);
   core.renderOrder=halo.renderOrder=10;nd.add(core);nd.add(halo);core.userData.k=halo.userData.k=1/(nd.getWorldScale(new THREE.Vector3()).x);halo.visible=!LQ;pod.glow[k].push({c:core,h:halo})})}}
function glowStep(pod,dt){if(!pod.glow||!dt)return;['o','m','i'].forEach(function(k,j){var d=pod.ang[j]-pod.pa[j];d=Math.atan2(Math.sin(d),Math.cos(d));pod.pa[j]=pod.ang[j];
 var sp=Math.abs(d)/dt;pod.gv[j]+=(sp-pod.gv[j])*Math.min(1,dt*3);var b=Math.min(1,pod.gv[j]/1.2);
 pod.glow[k].forEach(function(g){g.c.material.opacity=.3+.7*b;g.c.scale.setScalar((.05+.05*b)*g.c.userData.k);g.h.material.opacity=.08+.8*b;g.h.scale.setScalar((.1+.2*b)*g.h.userData.k);g.h.visible=!LQ})})}
function fpsWatch(dt){if(LQ||!dt||Q.has('hq'))return;_fps.t+=dt;_fps.n++;if(_fps.t>3){if(_fps.n/_fps.t<40)LQ=true;_fps.t=0;_fps.n=0}}
window.__glow=function(){return {LQ:LQ,gv:A.pods.map(function(p){return p.gv&&p.gv.map(function(v){return +v.toFixed(2)})})}};
// v0.8 seat pose: yaw 45deg to rider's left (+Y when facing out/+Z) then lean back 18deg, in the rider's own frame on top of the seat attach quaternion
var RECL_D=.9,RECL_YAW=Math.PI/4,RECL_TILT=-18*Math.PI/180,_re=new THREE.Euler(0,0,0,'YXZ'),_rq2=new THREE.Quaternion();
function ease(u){u=Math.max(0,Math.min(1,u));return u*u*(3-2*u)}
function stepRecline(){A.ppl&&A.ppl.forEach(function(p){if(!p.rc||!p.q0)return;var u=ease((T-p.rc.t0)/RECL_D);if(p.rc.dir<0)u=1-u;p.recl=u;
 var uy=Math.min(1,u*1.6),ux=Math.max(0,u*1.6-.6);_re.set(RECL_TILT*ux,RECL_YAW*uy,0);_rq2.setFromEuler(_re);p.root.quaternion.copy(p.q0).multiply(_rq2)})}
function stepPods(dt){stepRecline();fpsWatch(dt);window.__A=A;A.pods.forEach(function(pod,i){podTarget(pod,i,dt);if(!pod.model)return;
 ['o','m','i'].forEach(function(k,j){_rq.setFromAxisAngle(_ax,pod.ang[j]);pod.nodes[k].quaternion.copy(pod.rest[k]).multiply(_rq)});
 for(var n in pod.act){var ac=pod.act[n];if(n==pod.door.clip){ac.enabled=true;ac.play();ac.setEffectiveWeight(1);ac.time=Math.min(ac.getClip().duration,Math.max(0,T-pod.door.t0))}else{ac.enabled=false}}
 pod.mixer.update(0);glowStep(pod,dt)})}
A.tv=screen(5.6,2.4,800,340,3.6,3.6,-4.8,0,ARC);A.qr=[qrStand(A.id,'#3b2a8a',300-2,1.1,-1,0.3,null,1.4)];
box(.08,1.1,.08,0x333333,298,.55,-1,null);
A.cam=[[299.6,3.3,7.2],[301.2,2.1,-1]];
// ---- camera
var cam={p:new THREE.Vector3(0,4,16),l:new THREE.Vector3(0,2,0),tp:new THREE.Vector3(0,4,16),tl:new THREE.Vector3(0,2,0),k:2};
function shot(p,l,k){cam.tp.set(p[0],p[1],p[2]);cam.tl.set(l[0],l[1],l[2]);cam.k=k||2}
var portrait=W<H;function fitCam(){C.fov=portrait?75:55;C.aspect=W/H;C.updateProjectionMatrix()}fitCam();
// ---- state
var mode='street',sold={},pend=[],T=0,FZ=Q.has('freeze');
function after(s,f){pend.push({t:T+s,f:f})}
var capEl=document.getElementById('cap');function cap(s){capEl.textContent=s;capEl.style.opacity=s?1:0}
var ttl=document.getElementById('ttl');
function go(m){if(PV)stopPreview(true);menu(false);admin(false);if(VIEW){VIEW=0;TOUR=null;unfocus()}mode=m;pend=[];syncFeeds(m);updBtns();
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
var bar=document.getElementById('bar'),BTN=[['street','Street'],['bar','Bar'],['coffee','Coffee Shop'],['arcade','Arcade'],['sell','SELL ▶'],['games','View All Games'],['view','Change View'],['rush','Rush Hour'],['admin','Shop Admin']];
BTN.forEach(function(b){var e=document.createElement('button');e.textContent=b[1];e.id='b_'+b[0];e.onclick=function(){if(b[0]=='view')return toggleView();if(b[0]=='rush')return rush();if(b[0]=='admin')return admin(adm.style.display!='block');b[0]=='sell'?sell():b[0]=='games'?(gm.style.display=='block'?(menu(false),stopPreview()):menu(true)):go(b[0])};bar.appendChild(e)});
function updBtns(){BTN.forEach(function(b){var e=document.getElementById('b_'+b[0]);e.className=(b[0]==mode||(b[0]=='sell'&&sold[mode]))?'on':'';if(['view','rush','admin'].indexOf(b[0])>=0){e.disabled=mode=='street';e.style.opacity=mode=='street'?.35:1;if(b[0]=='view')e.className=VIEW?'on':''}if(b[0]=='games'){e.disabled=mode=='street';e.style.opacity=mode=='street'?.35:1;e.className=PV?'on':''}if(b[0]=='sell'){e.disabled=mode=='street';e.style.opacity=mode=='street'?.35:1;e.textContent=sold[mode]?'SOLD ✓':'SELL ▶'}})}
// ---- patrons per shop
var PCOL=['#ff4b4b','#4b9bff','#ffd23c','#4bff7a','#c14bff','#ff8c2a','#2bf0e0'];
function crowd(s,n,seats,door,kind,qrPos){s.ppl=[];s.seats=seats;for(var i=0;i<n;i++){var p=makePerson({i:i+3,np:0,shirt:new THREE.Color(PCOL[i]).multiplyScalar(.7),pants:[0x2b2f3a,0x3a3326,0x223a55][i%3]});p.col=PCOL[i];p.root.position.set(door[0],0,door[1]);p.root.visible=false;p.np=(i%3==1);p.state='out';p.next=1+i*2.3+Math.random();p.kind=kind;s.ppl.push(p)}s.door=door;s.qrPos=qrPos}
crowd(B,7,barStools,[105.8,4],'hockey',[[96.2,-1.4],[103.8,-1.4],[100,-1.4]]);
crowd(CF,6,cSeats,[205.8,4],'puzzle',null);
crowd(A,5,null,[305.8,4],'pod',[[298,-.3]]);
function useMach(p,mm,s){mm.who=p;p.mach=mm;p.root.visible=true;p.root.position.set(s.door[0],0,s.door[1]);setPose(p,'stand');p.state='walk';
 slideTo(p,mm.spot[0],mm.spot[1],mm.spot[2],function(){p.state='mach';p.armR.rotation.x=p.armL.rotation.x=-1.1;p.next=p.rush?14+Math.random()*10:12+Math.random()*10})}
function leaveMach(p,s){if(p.mach){p.mach.who=null;p.mach=null}setPose(p,'stand');p.state='walk';slideTo(p,s.door[0],s.door[1],0,function(){p.root.visible=false;p.state=p.rush?'gone':'out';p.next=3+Math.random()*4})}
function freeSeat(s){var used=s.ppl.map(function(p){return p.seat});for(var i=0;i<s.seats.length;i++)if(used.indexOf(i)<0)return i;return -1}
function stepCrowd(s,key,dt){if(!sold[key])return;s.ppl.forEach(function(p,i){updPerson(p,dt,T);if(p.goal)return;p.next-=dt;if(p.next>0)return;
 if(p.state=='out'){ // drift in
  if(key=='arcade'){var fm=A.mach.filter(function(q){return !q.who});var pod=A.pods.filter(function(q){return !q.who})[0];
   if(fm.length&&(!pod||Math.random()<.3)){var mm=fm[(Math.random()*fm.length)|0];useMach(p,mm,s);return}
   if(!pod){p.next=3;return}p.pod=pod;pod.who=p;p.root.visible=true;p.root.position.set(s.door[0],0,s.door[1]);setPose(p,'stand');
   var scanFirst=Math.random()<.45;p.state='walk';var pw=pod.g.position;
   var toPod=function(){slideTo(p,300+pw.x,pw.z+1.15,Math.PI,function(){p.state='board';p.next=.4;p.after=function(){slideTo(p,300+pw.x,pw.z+.05,0,function(){setPose(p,'sit',.4);p.root.position.y=.4;p.root.scale.setScalar(.5);var inr=pod.model&&pod.nodes.i;if(inr){inr.attach(p.root);p.inRing=1}p.q0=p.root.quaternion.clone();p.rc={t0:T+.35,dir:1};p.state='inpod';pod.ring.material.color.set(p.col);var D=RECL_D+.55;after(D,function(){if(pod.who===p&&p.state=='inpod')podDoor(pod,'close')});after(D+doorDur('close'),function(){if(pod.who===p&&p.state=='inpod')p.root.visible=false});after(D+doorDur('close')*.9,function(){if(pod.who===p&&p.state=='inpod')pod.game=A.session!='mix'?'dog':(A.pods.indexOf(pod)%2?'dog':'drift')});p.next=12+D+Math.random()*8})}})};
   if(scanFirst)slideTo(p,s.qrPos[0][0]+.5,s.qrPos[0][1]+.7,-2.6,function(){setPose(p,'standPhone');drawPhone(p,p.col,'infra');p.state='scan';p.next=2.2;p.after=function(){setPose(p,'stand');toPod()}});else toPod();return}
  var si=freeSeat(s);if(si<0){p.next=2;return}p.seat=si;var st=s.seats[si];p.root.visible=true;p.root.position.set(s.door[0],0,s.door[1]);setPose(p,'stand');p.state='walk';
  var q=s.qrPos?s.qrPos[i%s.qrPos.length]:[st.x,st.z+(st.ry==0?-.5:.5)];if(p.np)q=[st.x+.01,st.z+.6];
  slideTo(p,q[0],q[1]+(s.qrPos?.6:0),Math.PI,function(){setPose(p,'standPhone');drawPhone(p,p.col,'join');p.state='scan';p.next=1.4;p.after=function(){slideTo(p,st.x,st.z,st.ry,function(){if(p.np){setPose(p,'sit',st.y);p.player=-1}else{setPose(p,'phone',st.y);drawPhone(p,p.col,key=='coffee'?(i%2?'board':'puzzle'):'hockey');p.glow.color.set(p.col);p.player=i}p.state='play';p.next=22+Math.random()*20})};if(p.np){setPose(p,'stand');p.next=0}});return}
 if(p.state=='scan'||p.state=='board'){p.state='walk';var f=p.after;p.after=null;f();return}
 if(p.state=='alight'){var pod=p.pod;pod.who=null;p.pod=null;pod.ring.material.color.set(0x2bd2ff);p.state='walk';slideTo(p,s.door[0],s.door[1],0,function(){p.root.visible=false;p.state='out';p.next=4+Math.random()*5});return}
 if(p.state=='play'){p.state='walk';clearProps(p);setPose(p,'stand');p.seat=null;slideTo(p,s.door[0],s.door[1],0,function(){p.root.visible=false;p.state='out';p.next=2+Math.random()*4});return}
 if(p.state=='mach'){leaveMach(p,s);return}
 if(p.state=='inpod'){var pod=p.pod;pod.game=null;podDoor(pod,'open');p.root.visible=true;p.rc={t0:T+doorDur('open')*.35,dir:-1};p.state='exiting';p.next=Math.max(1.6+RECL_D,doorDur('open')*.35+RECL_D+.2);return}
 if(p.state=='exiting'){var pod=p.pod;if(p.root.parent!==ARC.parent){ARC.parent.attach(p.root)}p.inRing=0;p.rc=null;p.q0=null;p.root.scale.setScalar(1);p.root.rotation.set(0,0,0);p.root.position.y=0;setPose(p,'stand');var pw=pod.g.position;p.state='walk';slideTo(p,300+pw.x,pw.z+1.2,0,function(){p.state='alight';p.next=.3});return}
})}
// ---- LIVE GAME FEEDS: real games in hidden same-origin iframes, WebGL canvas copied (after each of the game's own frames) into a low-res 2D canvas
// used as the screen texture. Max 3 live iframes (shop feeds 1-2 + 1 preview). Fallback = placeholder drawings if a feed isn't ready.
var FEEDS={},FEEDURL={hockey:'../bubble/index.html?tv=1&watch=1',orbit:'../orbit/index.html?tv=1',drift:'../../games/space/attract_v01.html?nonet=1'};
function mkFeed(key,url){var f={key:key,url:url,ready:false,out:document.createElement('canvas'),t0:performance.now()};f.out.width=480;f.out.height=270;var o=f.out.getContext('2d');
 var ifr=document.createElement('iframe');ifr.src=url;ifr.setAttribute('aria-hidden','true');ifr.style.cssText='position:fixed;left:0;top:0;width:480px;height:270px;border:0;opacity:0;pointer-events:none;z-index:-1';
 ifr.onload=function(){try{var w=ifr.contentWindow,raf=w.requestAnimationFrame.bind(w),last=0;w.BH_MUTE=true;
  function grab(){var n=performance.now();if(n-last<110)return;last=n;try{var cs=w.document.getElementsByTagName('canvas'),best=null,ba=0;for(var i=0;i<cs.length;i++){var a=cs[i].width*cs[i].height;if(a>ba&&cs[i].offsetWidth>100){ba=a;best=cs[i]}}if(best){o.drawImage(best,0,0,480,270);f.ready=true}}catch(e){}}
  w.requestAnimationFrame=function(cb){return raf(function(t){cb(t);grab()})}}catch(e){f.err=1}};
 document.body.appendChild(ifr);f.ifr=ifr;FEEDS[key]=f;var n0=0,mi=Q.has("nomute")?0:setInterval(function(){n0++;try{var w=ifr.contentWindow;if(w&&w.location.href!='about:blank')muteWin(w)}catch(e){}if(n0>400||!ifr.isConnected)clearInterval(mi)},10);
 ifr.addEventListener('load',function(){try{muteWin(ifr.contentWindow);if(key=='pv'&&PV&&PV.auto)autoPlay(ifr,f)}catch(e){}});return f}
// v0.4 MUTE: every feed/preview iframe is silent. Audio graphs never reach the speakers; media elements muted; speech off.
function muteWin(w){if(w.__ztpMute)return;w.__ztpMute=1;var AN=w.AudioNode;if(AN){var oc=AN.prototype.connect;AN.prototype.connect=function(d){if(w.AudioDestinationNode&&d instanceof w.AudioDestinationNode)return d;return oc.apply(this,arguments)}}
 if(w.HTMLMediaElement){var op=w.HTMLMediaElement.prototype.play;w.HTMLMediaElement.prototype.play=function(){this.muted=true;this.volume=0;return op.apply(this,arguments)}}if(w.speechSynthesis)try{w.speechSynthesis.speak=function(){}}catch(e){}}
// v0.4 AUTO-PLAY for previews of games that sit on a title screen: press the start control (buttons/keys/tap), then a simple idle bot feeds random input.
var STARTRX=/^\s*(▶\s*)?(start|play|begin|go!?|tap to (start|play|begin)|press start|solo|single ?player|1 player|play solo|play vs (cpu|ai|bots?)|vs (cpu|ai|computer|bots?)|practice|quick ?play|demo|watch|start game|new game|let'?s go|continue|ok|got it|skip|launch|deploy|race|fight)\b/i;
function autoPlay(ifr,f){var w=ifr.contentWindow,d=w.document,n=0,clicked=[];
 function key(k,c,up){[d,w,d.body].forEach(function(t){try{t.dispatchEvent(new w.KeyboardEvent(up?'keyup':'keydown',{key:k,code:c,keyCode:{' ':32,Enter:13,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,a:65,d:68,w:87,s:83}[k]||0,bubbles:true}))}catch(e){}})}
 function tap(el,x,y){['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t){try{el.dispatchEvent(new w[t.indexOf('pointer')==0&&w.PointerEvent?'PointerEvent':'MouseEvent'](t,{bubbles:true,clientX:x,clientY:y,pointerId:1,isPrimary:true}))}catch(e){}})}
 var st=setInterval(function(){if(!ifr.isConnected){clearInterval(st);return}n++;try{
  var els=[].slice.call(d.querySelectorAll('button,[role=button],a,.btn,div,span')).filter(function(e){var t=(e.innerText||'').trim();return t&&t.length<32&&STARTRX.test(t)&&e.offsetWidth>0&&clicked.indexOf(e)<0&&!e.querySelector('button')&&!/phone|feedback|share|install|host|join|qr|online/i.test(t)});
  if(els.length&&n<14){clicked.push(els[0]);els[0].click();tap(els[0],0,0)}
  if(n<10&&n%2==0){key('Enter','Enter');key('Enter','Enter',1);key(' ','Space');key(' ','Space',1)}
  var c=d.querySelector('canvas');if(c&&n<8&&n%3==1)tap(c,c.clientWidth/2,c.clientHeight/2);
  if(n>4){var ks=[['ArrowLeft','ArrowLeft'],['ArrowRight','ArrowRight'],['ArrowUp','ArrowUp'],[' ','Space'],['a','KeyA'],['d','KeyD'],['w','KeyW']],q=ks[(Math.random()*ks.length)|0];key(q[0],q[1]);setTimeout(function(){key(q[0],q[1],1)},120+Math.random()*300);
   if(c&&Math.random()<.35){var x=Math.random()*c.clientWidth,y=Math.random()*c.clientHeight;tap(c,x,y)}}}catch(e){}},700)}
function killFeed(key){var f=FEEDS[key];if(f){f.ifr.src='about:blank';f.ifr.remove();delete FEEDS[key]}}
function feed(key){var f=FEEDS[key];return f&&f.ready?f.out:null}
function syncFeeds(m){var want=m=='bar'?['hockey']:m=='arcade'?['orbit','drift']:[];['hockey','orbit','drift'].forEach(function(k){if(want.indexOf(k)<0)killFeed(k);else if(!FEEDS[k]&&!Q.has('nolive'))mkFeed(k,FEEDURL[k])})}
// ---- View All Games: menu (list reused from ../joe/index.html) + one preview iframe on the current shop's main screen
var PV=null,GLIST=[];
// games with a real attract/AI mode -> use it; everything else gets autoPlay(). Extend ATTRACT with new ?attract hook files as they appear.
var ATTRACT={};function attractFor(u){for(var k in ATTRACT)if(u.indexOf(k)>=0)return ATTRACT[k];return null}
function previewUrl(u){var A2=attractFor(u);if(A2)return A2;if(/bubble\/?$/.test(u))return [FEEDURL.hockey,'AI demo'];if(/\/orbit\/?$/.test(u))return [FEEDURL.orbit,'AI bots'];if(/games\/space\/?$/.test(u))return [FEEDURL.drift,'AI pilot'];return [u+(u.indexOf('?')<0?'?':'&')+'tv=1','title screen']}
function startPreview(g){stopPreview(true);var p=previewUrl(g[3].replace('../','../').replace(/^\.\.\/\.\.\//,'../../'));PV={name:g[0],kind:p[1]=='title screen'?'auto-play (bot input)':p[1],auto:p[1]=='title screen'};mkFeed('pv',p[0]);menu(false);cap('Preview: '+g[0]+' ('+p[1]+') on the '+(SHOPS[mode]?SHOPS[mode].name.toLowerCase():'')+' screen. Tap View All Games again to close.')}
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
 g.fillStyle='#fff';g.fillRect(w-92,h-112,84,84);g.drawImage(B.qrImg,w-90,h-110,80,80);k.t.needsUpdate=true;return}
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
 var one=A.session=='one'&&act.length>=3;if(one){var ids=act.map(function(p){return A.pods.indexOf(p)+1});drawSpace(g,0,w,h,'dog',t,'POD '+ids[0]+'-'+ids[ids.length-1]+' · ONE MATCH · '+act.length+' PILOTS, ONE ARENA');act.forEach(function(p,j){g.fillStyle=p.who?p.who.col:'#fff';g.beginPath();g.arc(20+j*26,44,9,0,7);g.fill();g.fillStyle='#000';g.font='bold 10px sans-serif';g.textAlign='center';g.fillText('P'+(A.pods.indexOf(p)+1),20+j*26,48)});g.textAlign='left'}
 else if(!act.length){drawSpace(g,0,w,h,'drift',t,'ATTRACT · DRIFT SIGNAL')}else{var cw=w/act.length;act.forEach(function(p,i){drawSpace(g,i*cw,cw-3,h,p.game,t+i*7,'POD '+(A.pods.indexOf(p)+1)+' · '+(p.game=='dog'?'ORBIT BRAWL':'DRIFT SIGNAL'))})}
 g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,h-46,290,24);g.fillStyle='#2bd2ff';g.font='bold 13px sans-serif';g.textAlign='left';g.fillText(one?'SESSION: SHARED MATCH · ONE ORBIT BRAWL ARENA':A.session=='mix'?'SESSION: MIXED · DRIFT SIGNAL + ORBIT BRAWL':'SESSION: SEPARATE ORBIT BRAWL GAMES',8,h-30);
 g.fillStyle='#fff';g.fillRect(w-86,h-124,80,98);g.drawImage(A.qrImg,w-84,h-122,76,94);k.t.needsUpdate=true}
[[B,'#b33a2a'],[CF,'#ffd9a0'],[A,'#2bd2ff']].forEach(function(a){tvOff(a[0].tv,a[0].name,a[1])});
// ---- v0.4 SCREEN DECOR: high-score ticker (bottom) + split-flap local-ad slot (top corner). Made-up local businesses only.
var ADMIN={ads:!Q.has('noads'),ticker:true,rating:{bar:'Mature (18+ room)',coffee:'All ages',arcade:'Teen'},games:{}};
var SPON=['Prairie Pie Co.','Northline Tire & Lube','Aspen Hollow Dental','Red Hill Hardware','Bluebird Laundromat','Joshua Tree Ventures'];
var ADS=[['PRAIRIE PIE CO.','fresh pies daily · 49th St','#ffd9a0','#5a2a12'],['NORTHLINE TIRE & LUBE','winter tires · book now','#fff','#1a3a6a'],['ASPEN HOLLOW DENTAL','new smiles welcome','#123','#bfe8e0'],['RED HILL HARDWARE','keys cut while you wait','#fff','#9a1a1a'],['BLUEBIRD LAUNDROMAT','open 24/7 · free wifi','#fff','#2a6ab0'],['MOOSE PASTURE MINI GOLF','18 holes · all ages','#1a2a0a','#a8d860'],['Joshua Tree Ventures','','#fff','#222']];
var INI=['JTV','ZTP','ACE','MAX','LOU','KAT','DEV','BOB','SAM','REX','JUN','PIP','RDR','ELK'];
function scores(game){var r=ihash(game),a=[];for(var i=0;i<8;i++){var v=game.indexOf('HOCKEY')>=0?(9-i)+'-'+(r()%4):String(((99000-i*9000)*(1+r()%9/10))|0);a.push((i+1)+'. '+INI[r()%INI.length]+'  '+v)}return '★ HIGH SCORES · '+game+' ·  '+a.join('     ')+'          '}
var TKC={};function ticker(g,w,h,t,game){var txt=TKC[game]||(TKC[game]=scores(game));g.fillStyle='rgba(0,0,0,.78)';g.fillRect(0,h-20,w,20);g.font='bold 13px monospace';var tw=g.measureText(txt).width,x=-((t*55)%tw);g.fillStyle='#f5b82e';g.textAlign='left';g.fillText(txt,x,h-6);g.fillText(txt,x+tw,h-6)}
function card(g,c,x,y,w,h,half,sc){g.save();g.beginPath();if(half=='top')g.rect(x,y,w,h/2);else g.rect(x,y+h/2,w,h/2);g.clip();var my=y+h/2;g.translate(0,my);g.scale(1,sc);g.translate(0,-my);
 g.fillStyle=c[3];g.fillRect(x,y,w,h);g.fillStyle=c[2];g.textAlign='center';g.font=(c[1]?'bold 14px':'italic bold 15px')+' Georgia,serif';g.fillText(c[0],x+w/2,y+(c[1]?24:h/2+5),w-8);if(c[1]){g.font='11px Georgia,serif';g.fillText(c[1],x+w/2,y+42,w-8)}g.restore()}
function flap(g,x,y,w,h,t){var P=9,fd=.8,i=Math.floor(t/P),ph=t%P,c=ADS[i%ADS.length],n=ADS[(i+1)%ADS.length];g.fillStyle='#111';g.fillRect(x-3,y-3,w+6,h+6);
 if(ph<P-fd){card(g,c,x,y,w,h,'top',1);card(g,c,x,y,w,h,'bot',1)}else{var u=(ph-(P-fd))/fd;card(g,n,x,y,w,h,'top',1);card(g,c,x,y,w,h,'bot',1);if(u<.5)card(g,c,x,y,w,h,'top',1-2*u);else card(g,n,x,y,w,h,'bot',2*u-1)}
 g.fillStyle='rgba(0,0,0,.5)';g.fillRect(x,y+h/2-1,w,2);g.fillStyle='rgba(255,255,255,.55)';g.fillRect(x,y+h-3,w*Math.min(1,ph/(P-fd)),3);g.fillStyle='rgba(255,255,255,.6)';g.font='8px sans-serif';g.textAlign='right';g.fillText('LOCAL AD',x+w-3,y+9);g.textAlign='left'}
function deco(k,game,t,ay){var g=k.g,w=k.c.width,h=k.c.height;if(ADMIN.ticker)ticker(g,w,h,t,game);if(ADMIN.ads)flap(g,w-176,ay,168,56,t);k.t.needsUpdate=true}
// ---- v0.4 TODAY'S SPONSOR boards (one per shop wall)
var SPB=[[B,-5,3.2],[CF,-4.6,3.2],[A,-5.1,3.5]].map(function(a){var k=screen(2,1.1,384,212,a[1],a[2],-4.83,0,a[0].g);return {s:a[0],k:k}});
function drawSpon(b,t){var g=b.k.g,w=384,h=212,i=Math.floor(t/10)%SPON.length,u=(t%10)/10;g.fillStyle='#14161c';g.fillRect(0,0,w,h);g.strokeStyle='#f5b82e';g.lineWidth=4;g.strokeRect(6,6,w-12,h-12);g.fillStyle='#f5b82e';g.font='bold 22px sans-serif';g.textAlign='center';g.fillText("TODAY'S SPONSOR",w/2,44);
 g.globalAlpha=Math.min(1,Math.min(u,1-u)*8);g.fillStyle='#fff';g.font='bold 30px Georgia,serif';g.fillText(SPON[i]||'',w/2,112,w-30);g.globalAlpha=1;g.font='14px sans-serif';g.fillStyle='#aaa';g.fillText('thanks for supporting '+b.s.name.toLowerCase(),w/2,160,w-30);
 g.fillText((i+1)+' / '+SPON.length,w/2,190);b.k.t.needsUpdate=true}
SPB.forEach(function(b){drawSpon(b,0)});
// ---- v0.4 RUSH HOUR: packs the current room. Pool of 6 extra proxies (shared across rooms, performance cap) + every waiting regular comes in now.
var RUSHP=[],rushOn=0;function rush(){if(!SHOPS[mode])return;var s=SHOPS[mode];if(!sold[mode])sell();s.ppl.forEach(function(p){if(p.state=='out')p.next=Math.random()*1.5});
 while(RUSHP.length<6){var p=makePerson({i:RUSHP.length+20,shirt:new THREE.Color().setHSL(Math.random(),.5,.45),pants:[0x2b2f3a,0x3a3326,0x223a55][RUSHP.length%3]});p.col=PCOL[RUSHP.length%7];p.root.visible=false;p.rush=1;RUSHP.push(p)}
 RUSHP.forEach(function(p,j){if(p.mach){p.mach.who=null;p.mach=null}p.goal=null;p.shop=s;p.root.visible=false;p.state='wait';p.next=.3+j*.7})
 if(mode=='arcade')after(6,function(){A.session='one';A.sessT=0;A.pods.forEach(function(q){if(q.game)q.game='dog'})});cap('Rush hour! '+s.name.toLowerCase().replace(/\b\w/g,function(a){return a.toUpperCase()})+' is packed.')}
function stepRush(dt){RUSHP.forEach(function(p,j){var s=p.shop;if(!s)return;updPerson(p,dt,T);if(p.goal)return;p.next-=dt;if(p.next>0)return;
 if(p.state=='wait'){p.root.visible=true;p.root.position.set(s.door[0],0,s.door[1]);setPose(p,'stand');
  if(s==A){var fm=A.mach.filter(function(q){return !q.who})[0];if(fm){useMach(p,fm,s);p.next=30+Math.random()*15;return}}
  var ox=s.g.position.x,sp=s==B?[ox-4.5+j*1.8,.7+(j%2)*.9]:s==CF?[ox-5+j*2,4.3-(j%2)*.5]:[ox+.4+j*.9,1.4+(j%2)*.8];p.state='walk';
  slideTo(p,sp[0],sp[1],Math.PI,function(){setPose(p,j%2?'standPhone':'stand');if(j%2)drawPhone(p,p.col,'join');p.state='hang';p.next=30+Math.random()*15});return}
 if(p.state=='hang'){p.up.rotation.y=0;p.state='walk';setPose(p,'stand');slideTo(p,s.door[0],s.door[1],0,function(){p.root.visible=false;p.state='gone';p.shop=null});return}
 if(p.state=='mach'){leaveMach(p,s);p.shop=null}});
 RUSHP.forEach(function(p){if(p.state=='hang'&&!p.phone.visible){p.up.rotation.y=Math.sin(T*1.2+p.root.id)*.3;p.armL.rotation.x=-.3-Math.max(0,Math.sin(T*2+p.root.id))*.6}})}
// ---- v0.4 CHANGE VIEW: normal <-> over-the-shoulder close-up of a seated player's phone (bar phone = live top-down Bubble Hockey from the real sim)
var VIEW=0,FOC=null;function pickFocus(){var s=SHOPS[mode];if(!s)return null;if(s==A){var m=A.mach.filter(function(q){return q.who&&q.who.state=='mach'})[0];return m?{p:m.who,m:m}:null}
 var c=s.ppl.filter(function(p){return p.state=='play'&&!p.np&&p.phone.visible});return c.length?{p:c[(Math.random()*c.length)|0]}:null}
function unfocus(){if(FOC){FOC.p.head.visible=FOC.p.face.visible=true}if(FOC&&FOC.p.bigPk){FOC.p.pm.material.map=FOC.p.pk.t}if(FOC&&FOC.p.phone)FOC.p.phone.scale.setScalar(1);FOC=null}
function toggleView(){if(VIEW==1){VIEW=0;unfocus();startTour();updBtns();return}if(VIEW==2){VIEW=0;TOUR=null;var s=SHOPS[mode];if(s)shot(s.cam[0],s.cam[1],2);cap(sold[mode]?PITCH[mode]:'');updBtns();return}if(VIEW){VIEW=0;unfocus();var s=SHOPS[mode];if(s)shot(s.cam[0],s.cam[1],2);cap(sold[mode]?PITCH[mode]:'');updBtns();return}
 var f=pickFocus();if(!f){startTour();updBtns();return}VIEW=1;FOC=f;if(!f.m){if(!f.p.bigPk)f.p.bigPk=cv(192,336);f.p.pm.material.map=f.p.bigPk.t}
 cap(f.m?'Over the shoulder: a customer on '+f.m.name.toLowerCase()+'.':mode=='bar'?'Over the shoulder: their phone shows the live top-down rink, their skater glows their colour.':'Over the shoulder: the phone is the controller, the TV is the table.');updBtns()}
var _v=new THREE.Vector3(),_h=new THREE.Vector3();
// v0.8 auto tour: eases between cameras every ~5 s. Shots built from live object positions so they track layout changes.
var TOUR=null,TOUR_P=2.5;
function wp(o,x,y,z){var v=new THREE.Vector3(x||0,y||0,z||0);o.updateWorldMatrix(true,false);return o.localToWorld(v).toArray()}
function tvShot(k,name,u,v,d){var g=k.m.geometry.parameters,x=(u-.5)*g.width,y=(.5-v)*g.height;return {n:name,p:wp(k.m,x*.6,y*.6,d),l:wp(k.m,x,y,0)}}
function tourShots(){var L=[],s=SHOPS[mode];
 if(s)L.push({n:'Wide: '+s.name.toLowerCase(),p:s.cam[0],l:s.cam[1]});
 if(s&&s.tv){var c=s.tv.c;L.push(tvShot(s.tv,'Close-up: the big screen',.5,.5,2.6));if(ADMIN.ads)L.push(tvShot(s.tv,'Close-up: the scrolling ad slot',(c.width-92)/c.width,((s==A?32:s==B?40:8)+28)/c.height,1.05));if(ADMIN.ticker)L.push(tvShot(s.tv,'Close-up: high-score ticker',.25,1-10/c.height,1.1))}
 if(s==A&&A.pods){L.push({n:'GyroForge pods',p:wp(ARC,4.2,2.2,.2),l:wp(ARC,3.6,.8,-3.3)});var pi=A.pods.filter(function(q){return q.who})[0]||A.pods[1];L.push({n:'GyroForge '+(A.pods.indexOf(pi)+1)+' up close',p:wp(pi.g,.9,1.3,1.7),l:wp(pi.g,0,.75,0)});
  var busy=A.pods.filter(function(q){return q.who&&/walk|board|exiting|alight/.test(q.who.state)})[0]||pi,bi=A.pods.indexOf(busy)+1;
  L.splice(2,0,{n:'GyroForge '+bi+' full frame'+(busy.who&&busy.who.state!='inpod'?' · rider '+(busy.who.state=='exiting'||busy.who.state=='alight'?'climbing out':'climbing in'):''),p:wp(busy.g,.15,.95,2.05),l:wp(busy.g,0,.72,0)});
  var fp=A.pods[2];L.splice(4,0,{n:'Floor level: GyroForge 3 under the big screen',p:wp(fp.g,.5,.18,1.9),l:wp(A.tv.m,-.4,-.2,0)})}
 SPB.forEach(function(b){if(b.s==s)L.push({n:"Close-up: today's sponsor board",p:wp(b.k.m,0,-.1,1.8),l:wp(b.k.m,0,0,0)})});
 if(s!==CF)L.push({n:'Meanwhile at the café',p:CF.cam[0],l:CF.cam[1]});if(s!==A&&sold.arcade)L.push({n:'Meanwhile at the arcade',p:A.cam[0],l:A.cam[1]});
 return L}
function startTour(){VIEW=2;TOUR={i:-1,t:0};tourNext()}
function tourNext(){var L=tourShots();if(!L.length)return;TOUR.i=(TOUR.i+1)%L.length;var sh=L[TOUR.i];TOUR.t=T;shot(sh.p,sh.l,1.4);cap('Auto view · '+sh.n+'  (tap Change View to stop)')}
function stepTour(){if(VIEW==2&&TOUR&&T-TOUR.t>TOUR_P)tourNext()}
window.__cam=function(p,l){shot(p,l,99);cam.p.copy(cam.tp);cam.l.copy(cam.tl)};window.__tour=function(){return TOUR&&{i:TOUR.i,n:tourShots().map(function(x){return x.n})}};
function viewCam(snap){if(!VIEW||!FOC)return;var p=FOC.p;if(FOC.m?p.state!='mach':p.state!='play'){unfocus();var f=pickFocus();if(!f){VIEW=0;var s=SHOPS[mode];shot(s.cam[0],s.cam[1],2);updBtns();return}FOC=f;if(!f.m){if(!f.p.bigPk)f.p.bigPk=cv(192,336);f.p.pm.material.map=f.p.bigPk.t}p=f.p}
 p.head.visible=p.face.visible=false;p.root.updateMatrixWorld(true);_h.set(0,.76,0);p.up.localToWorld(_h);var ry=p.root.rotation.y,fx=Math.sin(ry),fz=Math.cos(ry),rx=Math.cos(ry),rz=-Math.sin(ry);
 if(FOC.m){FOC.m.k.m.getWorldPosition(_v);cam.tp.set(_h.x-fx*.55+rx*.3,_h.y+.42,_h.z-fz*.55+rz*.3)}else{p.phone.scale.setScalar(2);p.phone.getWorldPosition(_v);var dx=_h.x-_v.x,dz=_h.z-_v.z,dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;cam.tp.set(_h.x+dx*.45-dz*.42,_h.y+.55,_h.z+dz*.45+dx*.42)}
 cam.tl.copy(_v);cam.k=4;if(snap){cam.p.copy(cam.tp);cam.l.copy(cam.tl)}}
function bhSim(){try{return FEEDS.hockey.ifr.contentWindow.BHT.sim}catch(e){return null}}
function pip(p){var e=document.getElementById('pip');if(!e){e=document.createElement('div');e.id='pip';e.style.cssText='position:fixed;right:18px;bottom:64px;width:150px;padding:6px;background:#111;border-radius:18px;box-shadow:0 6px 24px #000a;z-index:20;font:600 10px sans-serif;color:#aaa;text-align:center';e.innerHTML='<canvas width=192 height=336 style="width:138px;border-radius:12px;display:block;margin:0 auto 4px"></canvas>THEIR PHONE · LIVE';document.body.appendChild(e)}e.style.display=p?'block':'none';if(p&&p.bigPk)e.firstChild.getContext('2d').drawImage(p.bigPk.c||p.bigPk.g.canvas,0,0)}
function drawBig(p,t){var k=p.bigPk,g=k.g,w=192,h=336;g.fillStyle='#0b0d14';g.fillRect(0,0,w,h);g.strokeStyle=p.col;g.lineWidth=8;g.strokeRect(4,4,w-8,h-8);g.fillStyle=p.col;g.font='bold 14px sans-serif';g.textAlign='center';
 if(mode=='bar'){var sm=bhSim();g.fillText('P'+(p.player+1)+' · RUSTY PUCK',w/2,26);var x0=36,y0=44,rw=120,rh=240;g.fillStyle='#e8f2ff';g.beginPath();g.roundRect?g.roundRect(x0,y0,rw,rh,28):g.rect(x0,y0,rw,rh);g.fill();g.strokeStyle='#c33';g.lineWidth=2;g.beginPath();g.moveTo(x0,y0+rh/2);g.lineTo(x0+rw,y0+rh/2);g.stroke();g.strokeStyle='#36c';[.3,.7].forEach(function(f){g.beginPath();g.moveTo(x0,y0+rh*f);g.lineTo(x0+rw,y0+rh*f);g.stroke()});
  var P=sm&&sm.prevP,pk=sm&&sm.p,mine=(p.player||0)%5;function mp(q){return [x0+Math.max(0,Math.min(1,q[0]))*rw,y0+Math.max(0,Math.min(1,q[1]/2))*rh]}
  if(P&&P.length){P.forEach(function(q,i){if(!q)return;var c=mp(q);g.fillStyle=i<P.length/2?'#d33':'#36d';g.beginPath();g.arc(c[0],c[1],7,0,7);g.fill();if(i==mine){g.strokeStyle=p.col;g.lineWidth=4;g.beginPath();g.arc(c[0],c[1],12,0,7);g.stroke()}});if(pk){var c=mp(pk);g.fillStyle='#111';g.beginPath();g.arc(c[0],c[1],4,0,7);g.fill()}
   if(sm.sc){g.fillStyle='#fff';g.font='bold 16px sans-serif';g.fillText(sm.sc[0]+' – '+sm.sc[1],w/2,306)}}
  else{for(var i=0;i<10;i++){var c=[x0+rw/2+Math.sin(t*.7+i*1.9)*rw*.4,y0+rh/2+Math.cos(t*.5+i*2.3)*rh*.42];g.fillStyle=i<5?'#d33':'#36d';g.beginPath();g.arc(c[0],c[1],7,0,7);g.fill()}}
  g.fillStyle='rgba(255,255,255,.18)';g.beginPath();g.arc(w/2+Math.sin(t*3)*20,320-6,9,0,7);g.fill()}
 else{g.fillText('MORNING EMBER · TABLE',w/2,26);for(var y=0;y<5;y++)for(var x=0;x<5;x++){var on=((x+y*5+Math.floor(t*1.5))%11)==0;g.fillStyle=on?p.col:['#e85','#5ae','#ec4','#6c6'][(x*3+y*5)%4];g.fillRect(22+x*30,60+y*30,26,26)}g.fillStyle='#fff';g.font='13px sans-serif';g.fillText('your move · tap a tile',w/2,250);g.fillText('score '+(120+(t*7|0)%400),w/2,280)}
 k.t.needsUpdate=true}
// ---- v0.4 SHOP ADMIN tablet: how an owner sets up their shop (unfolding layers)
var adm=document.createElement('div');adm.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-52%);width:min(400px,94vw);max-height:80vh;overflow:auto;background:#f4f5f8;color:#1a1c22;border:14px solid #15161a;border-radius:30px;box-shadow:0 20px 60px rgba(0,0,0,.6);display:none;z-index:6;font:14px system-ui';document.body.appendChild(adm);
function admin(on){adm.style.display=on?'block':'none';if(!on)return;var s=SHOPS[mode];if(!s)return;var gs=ADMIN.games[mode]||(ADMIN.games[mode]={bar:['Bubble Hockey'],coffee:['Red Deer Rich','Marble Rush'],arcade:['Orbit Brawl','Drift Signal']}[mode].slice());
 var sec=function(t,body,open){return '<details'+(open?' open':'')+' style="background:#fff;border-radius:12px;margin:8px 0;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,.08)"><summary style="font-weight:700;cursor:pointer">'+t+'</summary><div style="padding-top:8px">'+body+'</div></details>'};
 var tg=function(id,lab,v){return '<label style="display:flex;justify-content:space-between;padding:6px 0">'+lab+'<input type="checkbox" id="'+id+'"'+(v?' checked':'')+'></label>'};
 adm.innerHTML='<div style="padding:12px 14px"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11px;opacity:.55;letter-spacing:.1em">ZERO TO PHI · SHOP ADMIN</div><b style="font-size:17px">'+s.name+'</b></div><button id="admx" style="border:0;border-radius:14px;padding:7px 14px;background:#1a1c22;color:#fff;font-weight:700">Done</button></div>'+
  sec('1 · Shop QR code','<div style="display:flex;gap:12px;align-items:center"><img src="'+s.qrImg.toDataURL()+'" style="width:96px;border-radius:6px;border:1px solid #ddd"><div>Print or show this code.<br><code style="font-size:12px">join?shop='+s.id+'</code><br><span style="opacity:.6;font-size:12px">Every scan joins this room.</span></div></div>',1)+
  sec('2 · Games on your screen','<div style="max-height:160px;overflow:auto">'+(GLIST.length?GLIST:[['Bubble Hockey'],['Orbit Brawl'],['Drift Signal']]).map(function(g){return tg('ag_'+g[0].replace(/\W/g,''),g[0],gs.indexOf(g[0])>=0)}).join('')+'</div>')+
  sec('3 · Content mode cap','<select id="arat" style="width:100%;padding:8px;border-radius:8px">'+['All ages','Teen','Mature (18+ room)'].map(function(r){return '<option'+(ADMIN.rating[mode]==r?' selected':'')+'>'+r+'</option>'}).join('')+'</select><div style="opacity:.6;font-size:12px;margin-top:6px">Games above this rating are hidden from the room.</div>')+
  sec('4 · Ad slots',tg('aads','Corner flip-card local ads',ADMIN.ads)+tg('atick','High-score ticker',ADMIN.ticker)+'<div style="opacity:.6;font-size:12px">Ad revenue split shown in owner payouts.</div>')+
  sec('5 · Sponsors','<div id="asp">'+SPON.map(function(n,i){return '<div style="display:flex;justify-content:space-between;padding:4px 0">'+n+'<a data-x="'+i+'" style="cursor:pointer;opacity:.5">✕</a></div>'}).join('')+'</div><div style="display:flex;gap:6px;margin-top:6px"><input id="anew" placeholder="Add a local sponsor" style="flex:1;padding:7px;border-radius:8px;border:1px solid #ccc"><button id="aadd" style="border:0;border-radius:8px;padding:7px 12px;background:#f5b82e;font-weight:700">Add</button></div>')+'</div>';
 adm.querySelector('#admx').onclick=function(){admin(false)};adm.querySelector('#aads').onchange=function(e){ADMIN.ads=e.target.checked};adm.querySelector('#atick').onchange=function(e){ADMIN.ticker=e.target.checked};adm.querySelector('#arat').onchange=function(e){ADMIN.rating[mode]=e.target.value};
 adm.querySelectorAll('input[id^=ag_]').forEach(function(e){e.onchange=function(){var n=e.parentNode.textContent;var i=gs.indexOf(n);if(e.checked&&i<0)gs.push(n);if(!e.checked&&i>=0)gs.splice(i,1)}});
 adm.querySelectorAll('[data-x]').forEach(function(e){e.onclick=function(){SPON.splice(+e.dataset.x,1);admin(true);adm.querySelectorAll('details')[4].open=true}});
 adm.querySelector('#aadd').onclick=function(){var v=adm.querySelector('#anew').value.trim();if(v){SPON.push(v);admin(true);adm.querySelectorAll('details')[4].open=true}}}
// ---- v0.9 AUDIO: original procedural chiptune per place + synthesized ambience + nearby game sounds. All WebAudio, nothing sampled.
// SWAP SLOT for Forge's tracks: set TRACK_FILES[place]='url.mp3' (or window.ZTP_TRACKS before this script). Falls back to the synth if empty or it fails to load.
var _ext=(function(){try{return new Audio().canPlayType('audio/ogg; codecs="vorbis"')?'ogg':'mp3'}catch(e){return 'mp3'}})();
function _af(n){return n?'audio/'+n+'.'+_ext+'?b=1':''}
// Forge's loops v1 (audio/*.ogg, mp3 fallback for Safari). Lazy: a file is only fetched the first time its place is visited.
var TRACK_FILES=Object.assign({street:_af('showcase_street_music'),bar:_af('showcase_bar'),coffee:_af('showcase_cafe'),arcade:_af('showcase_arcade')},window.ZTP_TRACKS||{}),
    AMB_FILES=Object.assign({street:_af('showcase_street_ambience')},window.ZTP_AMB||{});
var AU={ctx:null,place:null,pl:{},set:{music:.55,amb:.6}};try{var _sv=JSON.parse(localStorage.getItem('ztp-showcase-audio')||'null');if(_sv){AU.set.music=+_sv.music;AU.set.amb=+_sv.amb}}catch(e){}
function auSave(){try{localStorage.setItem('ztp-showcase-audio',JSON.stringify(AU.set))}catch(e){}}
var SONG={ // tempo, root midi, scale, chord degrees, lead wave, swing, feel
 street:{bpm:92,root:57,sc:[0,2,4,7,9],ch:[0,5,3,4],lead:'square',bass:'triangle',drum:'soft',arp:'triangle',seed:'ross-st'},
 bar:{bpm:118,root:52,sc:[0,3,5,7,10],ch:[0,0,3,4],lead:'square',bass:'square',drum:'rock',arp:'sawtooth',seed:'rusty-puck'},
 coffee:{bpm:78,root:60,sc:[0,2,4,7,9,11],ch:[0,3,5,4],lead:'triangle',bass:'sine',drum:'brush',arp:'triangle',seed:'morning-ember'},
 arcade:{bpm:138,root:55,sc:[0,2,3,7,8],ch:[0,5,6,4],lead:'square',bass:'sawtooth',drum:'chip',arp:'square',seed:'pixel-depot'}};
var MAJ=[0,2,4,5,7,9,11];
function mtof(m){return 440*Math.pow(2,(m-69)/12)}
function auInit(){if(AU.ctx)return;var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;var c=AU.ctx=new AC();
 AU.mus=c.createGain();AU.amb=c.createGain();AU.mus.gain.value=AU.set.music*.5;AU.amb.gain.value=AU.set.amb;
 var comp=c.createDynamicsCompressor();AU.mus.connect(comp);AU.amb.connect(comp);comp.connect(c.destination);
 var n=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=n.getChannelData(0),b=0;for(var i=0;i<d.length;i++){d[i]=Math.random()*2-1}AU.noise=n;
 var bn=c.createBuffer(1,c.sampleRate*4,c.sampleRate),e=bn.getChannelData(0);for(var i=0;i<e.length;i++){b=(b+.02*(Math.random()*2-1))/1.02;e[i]=b*3.5}AU.brown=bn;
 Object.keys(SONG).forEach(function(k){var g=c.createGain();g.gain.value=0;g.connect(AU.mus);var a=c.createGain();a.gain.value=0;a.connect(AU.amb);AU.pl[k]={g:g,a:a,step:0,next:0,r:hash(SONG[k].seed),mel:null,file:null};
});
 ambience();setInterval(auTick,90);auTick()}
function loadFile(k,url,dest,slot){var P=AU.pl[k];if(!url||P['try'+slot])return;P['try'+slot]=1;var el=new Audio();el.loop=true;el.preload='auto';el.src=url;
 el.addEventListener('playing',function(){if(P[slot])return;try{AU.ctx.createMediaElementSource(el).connect(dest);P[slot]=el;if(slot=='afile'&&k=='street'){AU.traffic.g.gain.value=0;AU.wind.g.gain.value=0}}catch(e){}},{once:true});
 el.onerror=function(){P[slot]=null};el.play().catch(function(){})}
function env(g,t,a,v,r){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+r)}
function tone(dest,t,f,dur,type,v,slide){var c=AU.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);env(g,t,.005,v,dur);o.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.05)}
function nz(dest,t,dur,v,ft,ff,buf){var c=AU.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buf||AU.noise;f.type=ft;f.frequency.value=ff;env(g,t,.002,v,dur);s.connect(f);f.connect(g);g.connect(dest);s.start(t,Math.random()*1.5);s.stop(t+dur+.05)}
function drum(k,dest,t,i){var s=SONG[k].drum,b=i%16;
 if(s=='chip'){if(b%4==0)tone(dest,t,160,.12,'square',.22,40);if(b%8==4)nz(dest,t,.08,.25,'highpass',1800);if(b%2==1)nz(dest,t,.03,.08,'highpass',7000)}
 else if(s=='rock'){if(b==0||b==10)tone(dest,t,120,.18,'sine',.5,45);if(b%8==4)nz(dest,t,.14,.3,'bandpass',1500);if(b%2==0)nz(dest,t,.035,.07,'highpass',8000)}
 else if(s=='brush'){if(b==0||b==9)tone(dest,t,90,.2,'sine',.3,45);if(b%8==4)nz(dest,t,.2,.08,'bandpass',2500);if(b%4==2)nz(dest,t,.05,.03,'highpass',6000)}
 else{if(b%8==0)tone(dest,t,100,.2,'sine',.35,42);if(b%8==4)nz(dest,t,.1,.12,'bandpass',2000);if(b%4==2)nz(dest,t,.03,.04,'highpass',7000)}}
function melody(P,S){var r=P.r,m=[];for(var i=0;i<32;i++)m.push(r()<.38?null:S.sc[(r()*S.sc.length)|0]+(r()<.2?12:0));return m}
function schedPlace(k,now){var S=SONG[k],P=AU.pl[k],sp=60/S.bpm/4;if(P.file)return;if(P.next<now)P.next=now+.05;if(!P.mel)P.mel=melody(P,S);
 while(P.next<now+.25){var t=P.next,i=P.step,bar=(i>>4)%4,deg=S.ch[bar],ro=S.root+MAJ[deg%7]+(S.root%12==0?0:0),b=i%16;
  if(i%128==0&&i>0)P.mel=melody(P,S); // new phrase every 8 bars, same style
  if(b%4==0||(S.drum=='rock'&&b%4==3))tone(P.g,t,mtof(ro-12),sp*(S.drum=='brush'?3.5:1.8),S.bass,.22);
  var tri=[0,4,7,12];if(S.sc.indexOf(3)>=0)tri=[0,3,7,12];tone(P.g,t,mtof(ro+tri[b%4]+12),sp*.9,S.arp,S.drum=='brush'?.04:.05);
  var mn=P.mel[i%32];if(mn!=null&&(i>>5)%4!=3)tone(P.g,t,mtof(S.root+12+mn),sp*(1.6+(i%3)*.5),S.lead,.075);
  drum(k,P.g,t,i);P.step++;P.next+=sp*((S.drum=='brush'&&i%2==0)?1.12:(S.drum=='brush'?.88:1))}}
// ambience: street = traffic rumble swells + wind + footsteps; rooms = muffled chatter murmur. Lives on the Ambient bus.
function loopNoise(dest,buf,ft,ff,q,v){var c=AU.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buf;s.loop=true;f.type=ft;f.frequency.value=ff;f.Q.value=q||.7;g.gain.value=v;s.connect(f);f.connect(g);g.connect(dest);s.start();return {f:f,g:g}}
function ambience(){var c=AU.ctx;AU.traffic=loopNoise(AU.pl.street.a,AU.brown,'lowpass',260,.5,.35);AU.wind=loopNoise(AU.pl.street.a,AU.noise,'bandpass',500,2.5,.05);
 ['bar','coffee','arcade'].forEach(function(k){AU.pl[k].mur=loopNoise(AU.pl[k].a,AU.brown,'bandpass',k=='bar'?420:k=='coffee'?600:520,1.2,k=='bar'?.32:.2)})}
function streetFx(now){if(!AU.pl.street.afile&&Math.random()<.18){var t=now+.05,v=.05+Math.random()*.05;for(var j=0;j<4;j++)nz(AU.pl.street.a,t+j*.42,.05,v,'lowpass',700)}
 if(Math.random()<.02){var o=AU.ctx.createOscillator(),g=AU.ctx.createGain(),f=AU.ctx.createBiquadFilter();o.type='sawtooth';o.frequency.value=60+Math.random()*30;f.type='lowpass';f.frequency.value=300;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.08,now+1.2);g.gain.linearRampToValueAtTime(0,now+3);o.connect(f);f.connect(g);g.connect(AU.pl.street.a);o.start(now);o.stop(now+3.1)}
 if(AU.pl.street.afile)return;AU.wind.f.frequency.setTargetAtTime(350+300*Math.sin(now*.23)+200*Math.sin(now*.61),now,.5);AU.wind.g.gain.setTargetAtTime(.03+.03*(1+Math.sin(now*.17)),now,.8);AU.traffic.g.gain.setTargetAtTime(.25+.12*Math.sin(now*.11),now,1)}
// game sounds: arcade cabinets / pods / pinball blip near the camera; bar puck clacks + crowd cheer. Distance falloff from the camera.
var _ap=new THREE.Vector3();
function nearVol(obj){obj.getWorldPosition(_ap);var d=_ap.distanceTo(C.position);return Math.max(0,Math.min(1,2.2/(d+.6)))}
function gameFx(now){var k=mode;if(k=='arcade'&&sold.arcade){var D=AU.pl.arcade.a;
  A.mach.forEach(function(m){var v=nearVol(m.g)*(m.who?1:.35);if(v<.03||Math.random()>.35)return;var t=now+Math.random()*.08;
   if(m.name=='METEOR MASH'){Math.random()<.5?tone(D,t,900,.08,'square',.06*v,300):nz(D,t,.12,.08*v,'lowpass',900)}
   else if(m.name=='GOBBLE GRID')tone(D,t,Math.random()<.5?480:360,.06,'square',.05*v);
   else if(m.name=='TANK TUSSLE'){if(Math.random()<.3)nz(D,t,.25,.1*v,'lowpass',400)}
   else tone(D,t,[660,880,990][(Math.random()*3)|0],.07,'triangle',.07*v)});
  var tv=nearVol(A.tv.m);if(A.pods.some(function(p){return p.game=='dog'})&&Math.random()<.5){var t=now+Math.random()*.06;Math.random()<.7?tone(D,t,1400,.05,'square',.04*tv,600):nz(D,t,.3,.07*tv,'lowpass',600)}}
 if(k=='bar'&&sold.bar){var v=nearVol(B.tv.m);if(Math.random()<.25)nz(AU.pl.bar.a,now,.03,.12*v,'bandpass',2200);if(Math.random()<.01)nz(AU.pl.bar.a,now,1.4,.12*v,'bandpass',900)}
 if(k=='coffee'&&Math.random()<.04)tone(AU.pl.coffee.a,now,2600+Math.random()*600,.05,'sine',.02)}
var _ft=0;
function auTick(){var c=AU.ctx;if(!c||c.state!='running')return;var now=c.currentTime,want=SHOPS[mode]?mode:'street';
 if(want!=AU.place){AU.place=want;loadFile(want,TRACK_FILES[want],AU.pl[want].g,'file');loadFile('street',AMB_FILES.street,AU.pl.street.a,'afile');Object.keys(AU.pl).forEach(function(k){var P=AU.pl[k],on=k==want;P.g.gain.setTargetAtTime(on?1:0,now,.6);P.a.gain.setTargetAtTime(on?1:(k=='street'&&want!='street'?.12:0),now,.6);[P.file,P.afile].forEach(function(f){if(f&&(on||(k=='street'&&f==P.afile)))f.play().catch(function(){})})})}
 Object.keys(AU.pl).forEach(function(k){var P=AU.pl[k];if(k==want||P.g.gain.value>.02){if(k==want||P.g.gain.value>.02)schedPlace(k,now)}else{P.next=0;if(P.file&&!P.file.paused&&P.g.gain.value<.01)P.file.pause()}});
 if(want=='street'||AU.pl.street.a.gain.value>.05)streetFx(now);gameFx(now)}
function auStart(){auInit();if(AU.ctx&&AU.ctx.state!='running')AU.ctx.resume();var h=document.getElementById('snd');if(h)h.dataset.on=1;sndHint(false)}
['pointerdown','touchstart','keydown'].forEach(function(ev){addEventListener(ev,auStart,{passive:true})});
// settings menu (gear, top right): Ambient + Music sliders, saved in localStorage
var sndB=document.createElement('button');sndB.id='sndb';sndB.textContent='⚙︎ Sound';sndB.style.cssText='position:fixed;top:8px;right:10px;z-index:8;border:0;border-radius:18px;padding:8px 14px;font:600 13px system-ui;background:rgba(255,255,255,.14);color:#fff;backdrop-filter:blur(6px)';document.body.appendChild(sndB);
var snd=document.createElement('div');snd.id='snd';snd.style.cssText='position:fixed;top:48px;right:10px;z-index:8;width:230px;padding:12px 14px;border-radius:14px;background:rgba(12,14,22,.94);border:1px solid #333;font:13px system-ui;display:none';
function sl(id,lab,v){return '<label style="display:block;margin:6px 0 10px">'+lab+' <span id="'+id+'v" style="float:right;opacity:.7">'+Math.round(v*100)+'</span><input id="'+id+'" type="range" min="0" max="100" value="'+Math.round(v*100)+'" style="width:100%;accent-color:#f5b82e"></label>'}
snd.innerHTML='<b style="letter-spacing:.08em">SOUND</b>'+sl('sAmb','Ambient',AU.set.amb)+sl('sMus','Music',AU.set.music)+'<div style="opacity:.55;font-size:11px">Original retro tunes for every place, street sounds and game sounds near the screens.</div>';document.body.appendChild(snd);
sndB.onclick=function(){snd.style.display=snd.style.display=='block'?'none':'block'};
snd.querySelector('#sAmb').oninput=function(e){AU.set.amb=e.target.value/100;snd.querySelector('#sAmbv').textContent=e.target.value;if(AU.amb)AU.amb.gain.setTargetAtTime(AU.set.amb,AU.ctx.currentTime,.05);auSave()};
snd.querySelector('#sMus').oninput=function(e){AU.set.music=e.target.value/100;snd.querySelector('#sMusv').textContent=e.target.value;if(AU.mus)AU.mus.gain.setTargetAtTime(AU.set.music*.5,AU.ctx.currentTime,.05);auSave()};
var hint=document.createElement('div');hint.style.cssText='position:fixed;top:14px;right:110px;z-index:8;font:600 12px system-ui;opacity:.7;pointer-events:none';hint.textContent='🔈 tap for sound';document.body.appendChild(hint);
function sndHint(on){hint.style.display=on?'block':'none'}
window.__audio=function(){return AU.ctx?{state:AU.ctx.state,place:AU.place,set:AU.set,gains:Object.keys(AU.pl).map(function(k){return k+':'+AU.pl[k].g.gain.value.toFixed(2)})}:{state:'off',set:AU.set}};
// ---- loop
var last=performance.now(),tvAcc=0;
function step(dt){T+=dt;for(var i=pend.length-1;i>=0;i--)if(T>=pend[i].t){var f=pend[i].f;pend.splice(i,1);f()}
 streetPpl.forEach(function(p,i){updPerson(p,dt,T);if(!p.goal)slideTo(p,-16+Math.random()*32,1.5+Math.random()*1.5,0,function(){setPose(p,Math.random()<.4?'standPhone':'stand');if(p.phone.visible)drawPhone(p,'#2bd2ff','join')})});
 stepCrowd(B,'bar',dt);stepStaff(B,'bar',dt);stepStaff(CF,'coffee',dt);stepStaffBack(B);stepStaffBack(CF);stepProps(dt);chat(B);chat(CF);stepCrowd(CF,'coffee',dt);stepCrowd(A,'arcade',dt);stepRush(dt);viewCam();stepTour();
 [B,CF,A].forEach(function(s){s.qr.forEach(function(q){if(q.userData.popAt){var a=T-q.userData.popAt;if(a>0){var e=Math.min(1,a/.5);q.scale.setScalar(q.userData.s*(e<1?e*1.25-(e>.8?(e-.8)*1.25:0):1));q.rotation.y+=a<.5?.3:0;if(e>=1){q.rotation.y=0;q.userData.popAt=0}}}})});
 Object.keys(SHOPS).forEach(function(k,i){lamps[i].intensity=sold[k]?1.5:0;SHOPS[k].win.material.emissive.setHex(sold[k]?0x2a6a9a:0x0a1a2a)});
 if(sold.arcade){A.sessT+=dt;var occ=A.pods.filter(function(q){return q.who}).length;var nx={mix:'allOB',allOB:'one',one:'mix'}[A.session];if(A.session=='mix'&&occ>=3&&Math.random()<.5)nx='one';if(A.sessT>{mix:26,allOB:16,one:24}[A.session]){A.sessT=0;A.session=nx;A.pods.forEach(function(p,i){if(p.game)p.game=A.session!='mix'?'dog':(i%2?'dog':'drift')})}}
 stepPods(dt);
 var nw=performance.now();if(nw-tvAcc>66){tvAcc=nw;var tv=FZ&&!dt?T+nw/1000:T;var cur=PV&&SHOPS[mode]?SHOPS[mode]:null;if(sold.bar&&cur!==B)drawHockey(B.tv,tv);if(sold.coffee&&cur!==CF)drawBoard(CF.tv,tv);if(sold.arcade&&cur!==A)drawArcade(A.tv,tv);if(cur)drawPreview(cur.tv);
  if(sold.bar&&(mode=='bar'||mode=='street'))deco(B.tv,cur===B?PV.name.toUpperCase():'BUBBLE HOCKEY',tv,cur===B?8:40);if(sold.coffee&&mode=='coffee')deco(CF.tv,cur===CF?PV.name.toUpperCase():'RED DEER RICH',tv,8);if(sold.arcade&&mode=='arcade')deco(A.tv,cur===A?PV.name.toUpperCase():'ORBIT BRAWL',tv,cur===A?8:32);
  if(mode=='arcade')A.mach.forEach(function(m){drawMach(m,tv)});SPB.forEach(function(b){if(b.s==SHOPS[mode])drawSpon(b,tv)});if(VIEW&&FOC&&!FOC.m&&FOC.p.bigPk){drawBig(FOC.p,tv);pip(FOC.p)}else pip(null)}
 var k=1-Math.exp(-cam.k*dt);cam.p.lerp(cam.tp,k);cam.l.lerp(cam.tl,k)}
function frame(){var now=performance.now(),dt=FZ?0:Math.min(.05,(now-last)/1000);last=now;step(dt);var pp=cam.p.clone();if(portrait){pp.sub(cam.l).multiplyScalar(1.3).add(cam.l)}C.position.copy(pp);C.lookAt(cam.l);R.render(S,C);requestAnimationFrame(frame)}
addEventListener('resize',function(){W=innerWidth;H=innerHeight;portrait=W<H;R.setSize(W,H);fitCam()});
// boot: ?scene=bar|coffee|arcade&sell&t=N&freeze (deterministic pre-sim for screenshots)
var sc=Q.get('scene');updBtns();go(sc&&SHOPS[sc]?sc:'street');
if(sc&&SHOPS[sc]){var tt=+(Q.get('t')||0);if(Q.has('sell'))after(1.2,sell);for(var x=0;x<tt;x+=.05)step(.05);cam.p.copy(cam.tp);cam.l.copy(cam.tl);if(Q.has('shot'))shot(cam.tp.toArray(),cam.tl.toArray(),9)}
if(Q.has('rush')&&SHOPS[mode]){rush();for(var x=0;x<+(Q.get('rush')||12);x+=.05)step(.05);cam.p.copy(cam.tp);cam.l.copy(cam.tl)}
if(Q.has('view')&&SHOPS[mode]){toggleView();viewCam(true)}
if(Q.has('tour')&&SHOPS[mode]){startTour();updBtns();for(var x=0;x<+(Q.get('tour')||0);x+=.05)step(.05);cam.p.copy(cam.tp);cam.l.copy(cam.tl)}
if(Q.has('admin')&&SHOPS[mode])setTimeout(function(){admin(true)},600);
if(Q.has('cam')){var c=Q.get('cam').split(',').map(Number);shot(c.slice(0,3),c.slice(3,6),99);cam.p.copy(cam.tp);cam.l.copy(cam.tl)}
if(Q.get('preview')&&SHOPS[mode]){var pvn=Q.get('preview');var iv=setInterval(function(){var g=GLIST.filter(function(x){return x[0].toLowerCase().indexOf(pvn)==0})[0];if(g){clearInterval(iv);startPreview(g)}},200)}
frame();
})();
