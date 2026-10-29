/* Rig Mystery v0.1 — Zero to Phi dev prototype. Scenario cards are pure data: add one to SCENARIOS. */
(function(){
'use strict';
var $=function(i){return document.getElementById(i)};
// ---------- DATA ----------
var AREAS={
 heli:{name:'Helideck',p:[-14,4,-10],m:[18,22]},
 control:{name:'Control Room',p:[-8,0,4],m:[30,60]},
 quarters:{name:'Crew Quarters',p:[-14,0,12],m:[16,82]},
 drill:{name:'Drill Floor',p:[4,0,0],m:[58,48]},
 pump:{name:'Pump & Valve Deck',p:[12,0,10],m:[78,76]},
 crane:{name:'Crane Pedestal',p:[12,0,-10],m:[80,20]},
 derrick:{name:'Derrick Top',p:[4,14,-1.2],m:[56,12],ladder:'drill'}
};
var CREW=[
 {id:'rosa',name:'Rosa',role:'Toolpush (site boss)',col:'#e0b040',area:'control',task:'running the whole shift and the daily meeting',ask:'call a crew huddle',done:'Rosa gathers everyone for a quick huddle. Morale ticks up.'},
 {id:'dale',name:'Dale',role:'Driller',col:'#d9603b',area:'drill',task:'keeping the bit turning at the right weight',ask:'slow the drill rate a touch',done:'Dale eases the brake. "Nice and steady, boss."'},
 {id:'priya',name:'Priya',role:'Mud Engineer',col:'#5aa86b',area:'pump',task:'mixing mud so the well pressure stays balanced',ask:'run a mud weight test',done:'Priya dips the balance. "Weight looks right on my end."'},
 {id:'gus',name:'Gus',role:'Mechanic',col:'#4a7fd0',area:'pump',task:'keeping pumps, winches and gear in shape',ask:'show me the gear locker',done:'Gus opens the locker. Everything is neatly hung up.'},
 {id:'lena',name:'Lena',role:'Electrician',col:'#a86bd0',area:'control',task:'power, lighting and the sensor wiring',ask:'check the sensor wiring',done:'Lena tests the loom. "All sensors reporting, no faults."'},
 {id:'omar',name:'Omar',role:'Safety & Medic',col:'#e8e8e8',area:'quarters',task:'permits, first aid and harness inspections',ask:'pull the inspection permits',done:'Omar hands over the permit binder. Most boxes are signed.'},
 {id:'jo',name:'Jo',role:'Crane Operator',col:'#f08aa0',area:'crane',task:'lifting pipe and supplies off the boat',ask:'pause lifts for a minute',done:'Jo parks the boom. "Taking five, no worries."'},
 {id:'kai',name:'Kai',role:'Data Tech',col:'#40c0c8',area:'control',task:'logging drilling data and sending reports to shore',ask:'show me the network log',done:'Kai pulls up the log. Lots of normal traffic to shore.'}
];
var LOG=[ // base logbook; scenario adds/replaces one entry
 ['Day 41 · Weather','Wind 18 km/h from the NW, seas 1.2 m. Supply boat due at noon. Helideck cleared for the 15:00 crew change.'],
 ['Day 41 · Drilling','Depth 2,840 m. Mud weight 1.32 SG (Priya). Bit change planned for tomorrow. Dale on the brake all shift.'],
 ['Day 41 · Maintenance','Pump 2 seals greased (Gus). Derrick lights re-lamped (Lena). Crane wire rope inspection passed (Jo).'],
 ['Day 41 · Safety','Toolbox talk: dropped objects (Omar). Fire drill complete, muster in 3 min 10 s. No incidents.']
];
var SCENARIOS=[
 {id:'valve',title:'The Skipped Valve Check',culprit:'dale',motive:'tired',mech:'Kill-line pressure relief valve',area:'pump',
  log:[1,'Day 41 · Drilling','Depth 2,840 m. Mud weight 1.32 SG (Priya). Relief valve check ✔ 06:00 (Dale) — Dale also logged on the brake 05:30–06:30.'],
  slips:['Dale rubs his eyes. "Sorry, double shift. Baby kept us up on the video call."','"The relief valve? Yeah… I think I got to it. Pretty sure."','Dale goes pale. "I signed it before I checked it. I meant to go back."'],
  inspect:['The relief valve tag is still dated yesterday.','The valve gauge needle is twitching above the line.','The valve is hissing. It is stuck shut.'],
  hints:['Priya: "Pressure is a hair high, probably nothing."','Lena: "Pressure alarm on Pump Deck keeps chirping."','Rosa: "Pressure is climbing! Somebody find out why!"'],
  chain:'A stuck relief valve lets pressure build in the kill line. Left alone it bursts a hose, mud floods the pump deck, the well loses balance and the rig has to shut in, maybe with injuries. Catching the bad log entry early meant a 5‑minute valve check instead.'},
 {id:'clip',title:'The Cracked Harness Clip',culprit:'gus',motive:'covering a mistake',mech:'Cracked derrick harness clip',area:'derrick',
  log:[2,'Day 41 · Maintenance','Pump 2 seals greased (Gus). Derrick lights re-lamped (Lena) — harness #3 signed out and back by Gus, inspection box left blank.'],
  slips:['Gus laughs a bit too fast. "Gear\'s fine! All fine."','"I may have dropped a clip off the monkey board. Little ding, nothing big."','Gus sighs. "I hid the cracked clip. Didn\'t want to be the guy who broke gear again."'],
  inspect:['Harness #3 is hung up backwards from the rest.','A hairline crack on the harness clip, painted over with marker.','The clip is cracking open. Someone is about to climb with it.'],
  hints:['Omar: "Harness #3 never came back for inspection."','Jo: "Lena wants to go up the derrick to fix a light."','Rosa: "Lena is clipping in up top right now!"'],
  chain:'A cracked clip looks fine until it takes a load. If Lena had clipped in and slipped, the clip fails and it becomes a fall from height, the worst incident on any rig. Finding it early meant swapping a $40 part.'},
 {id:'data',title:'The Leaking Data Line',culprit:'kai',motive:'copying data for a rival company',mech:'Hidden data upload to a rival',area:'control',
  log:[3,'Day 41 · Safety','Toolbox talk: dropped objects (Omar). Fire drill complete — all hands mustered except Kai (stayed in control room "for the uplink").'],
  slips:['Kai smiles. "Data is my happy place. Lots to send today."','"The satellite link has been slow. Big files. Normal stuff."','Kai looks away. "They offered me a lot. I didn\'t think anyone would get hurt."'],
  inspect:['The uplink light is blinking even with no report scheduled.','A USB drive labelled "BACKUP" taped under the desk.','The sensor feed is lagging. The upload is hogging the link and the gauges are delayed.'],
  hints:['Lena: "Weird lag on my sensor screens."','Dale: "My depth readout froze for ten seconds."','Rosa: "We are drilling half blind, the data link is choked!"'],
  chain:'Sending secret data is a crime, and here it also choked the link the safety sensors use. With delayed gauges the driller cannot see a pressure kick coming. Catching it early protected the company and kept the crew\'s eyes working.'}
];
var MOTIVES=['tired','covering a mistake','copying data for a rival company','careless'];
// ---------- STATE ----------
var q=new URLSearchParams(location.search);
var S=SCENARIOS[(+q.get('s')||Math.floor(Math.random()*SCENARIOS.length))%SCENARIOS.length];
if(q.get('s')!=null)S=SCENARIOS[(+q.get('s'))%SCENARIOS.length];
var st={esc:0,trust:{},evid:[],talking:null,cur:'heli',pts:0,wrong:0,over:false,t0:performance.now(),stage:0,found:{}};
CREW.forEach(function(c){st.trust[c.id]=0});
var DUR=+(q.get('dur')||360); // seconds to catastrophe
function crew(id){return CREW.filter(function(c){return c.id===id})[0]}
// ---------- 3D ----------
var cv=$('cv'),R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,devicePixelRatio));
var scene=new THREE.Scene();scene.background=new THREE.Color(0x8fb4d0);scene.fog=new THREE.Fog(0x8fb4d0,40,140);
var cam=new THREE.PerspectiveCamera(65,1,.1,300);
scene.add(new THREE.HemisphereLight(0xfff4e0,0x335070,.9));var sun=new THREE.DirectionalLight(0xffffff,.8);sun.position.set(20,40,10);scene.add(sun);
function M(c){return new THREE.MeshLambertMaterial({color:c})}
function box(w,h,d,c,x,y,z){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c));m.position.set(x,y,z);scene.add(m);return m}
var sea=new THREE.Mesh(new THREE.PlaneGeometry(400,400),M(0x2c5c80));sea.rotation.x=-Math.PI/2;sea.position.y=-12;scene.add(sea);
box(40,1,32,0x5d6670,0,-.5,1); // main deck
[[-18,-14],[18,-14],[-18,16],[18,16]].forEach(function(p){box(2.4,12,2.4,0xd8a030,p[0],-6.5,p[1])});
var hd=new THREE.Mesh(new THREE.CylinderGeometry(7,7,.4,32),M(0x3a4a3a));hd.position.set(-14,3.8,-10);scene.add(hd);
box(1,4,1,0x777777,-14,1.8,-10);var H=new THREE.Mesh(new THREE.RingGeometry(2.6,3,32),new THREE.MeshBasicMaterial({color:0xffd040}));H.rotation.x=-Math.PI/2;H.position.set(-14,4.05,-10);scene.add(H);
box(8,4,6,0xe8e0d0,-8,2,6.5);box(8,.3,6.4,0xc9a24a,-8,4.1,6.5); // control room
box(8,6,7,0xd0c8b8,-15,3,15);
for(var i=0;i<6;i++)box(.8,.8,.1,0x223344,-17.5+i*1,4,11.45);
box(10,.4,10,0x8a6a40,4,.2,0); // drill floor
// derrick lattice
(function(){var g=new THREE.Group(),m=M(0xd03030);for(var k=0;k<4;k++){var a=k*Math.PI/2+Math.PI/4;var leg=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,16),m);leg.position.set(Math.cos(a)*2.4,8,Math.sin(a)*2.4);leg.rotation.z=Math.cos(a)*.08;leg.rotation.x=-Math.sin(a)*.08;g.add(leg)}
for(var y=2;y<16;y+=2){var r=new THREE.Mesh(new THREE.TorusGeometry(2.4-y*.06,.08,4,4),m);r.rotation.x=Math.PI/2;r.rotation.z=Math.PI/4;r.position.y=y;g.add(r)}
var top=new THREE.Mesh(new THREE.BoxGeometry(3,.3,3),M(0x666666));top.position.y=13.8;g.add(top);g.position.set(4,0,0);scene.add(g)})();
for(var y=.5;y<14;y+=.5)box(.9,.06,.06,0xffd040,4,y,-2.3); box(.06,14,.06,0xffd040,3.55,7,-2.3);box(.06,14,.06,0xffd040,4.45,7,-2.3);
// pumps & valves
var valveM=null;[[10,8],[14,8],[10,12]].forEach(function(p,i){box(2.4,1.6,1.6,0x3a7ad0,p[0],.8,p[1]);var v=new THREE.Mesh(new THREE.TorusGeometry(.4,.1,6,12),M(0xd03030));v.position.set(p[0],2,p[1]);scene.add(v);if(!i)valveM=v});
box(.3,.3,8,0x888888,12,1.9,10);
// crane
var crP=box(2,5,2,0xf0c020,12,2.5,-10);var boom=box(.5,.5,14,0xf0c020,12,5.5,-4);boom.rotation.x=-.4;
// supply crates / pipe racks
for(i=0;i<5;i++){var pp=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,9),M(0x777766));pp.rotation.z=Math.PI/2;pp.position.set(-2,.3+i%2*.5,-12+i*.55);scene.add(pp)}
// signs
function label(txt,x,y,z){var c=document.createElement('canvas');c.width=256;c.height=64;var g=c.getContext('2d');g.fillStyle='#2a1a08';g.fillRect(0,0,256,64);g.strokeStyle='#c9a24a';g.lineWidth=4;g.strokeRect(2,2,252,60);g.fillStyle='#f4d98a';g.font='bold 28px Georgia';g.textAlign='center';g.fillText(txt,128,42);
 var s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));s.scale.set(2.4,.6,1);s.position.set(x,y,z);scene.add(s)}
Object.keys(AREAS).forEach(function(k){var a=AREAS[k].p;label(AREAS[k].name,a[0],a[1]+(k==='derrick'?2.2:4.4),a[2]-(k==='derrick'?0:1))});
// warning light
var alarmL=new THREE.PointLight(0xff2020,0,30);alarmL.position.set(-8,5,4);scene.add(alarmL);
var beacon=new THREE.Mesh(new THREE.SphereGeometry(.35),new THREE.MeshBasicMaterial({color:0x550000}));beacon.position.set(-8,4.6,4);scene.add(beacon);
// crew figures
function faceTex(col){var c=document.createElement('canvas');c.width=c.height=128;var g=c.getContext('2d');g.fillStyle='#ffe2c0';g.fillRect(0,0,128,128);g.fillStyle='#222';g.beginPath();g.arc(44,56,7,0,7);g.arc(84,56,7,0,7);g.fill();g.lineWidth=6;g.strokeStyle='#222';g.beginPath();g.arc(64,70,20,.2,Math.PI-.2);g.stroke();g.fillStyle='#ff9a9a88';g.beginPath();g.arc(30,76,8,0,7);g.arc(98,76,8,0,7);g.fill();return new THREE.CanvasTexture(c)}
var figs=[],offs=[[-1.5,1],[1.5,-1],[1,2],[-1,-2]],used={};
CREW.forEach(function(c){var g=new THREE.Group();var body=new THREE.Mesh(new THREE.CylinderGeometry(.35,.45,1,12),M(c.col));body.position.y=.6;g.add(body);
 var head=new THREE.Mesh(new THREE.SphereGeometry(.42,16,12),[M(0xffe2c0)][0]);head.position.y=1.45;g.add(head);
 var face=new THREE.Mesh(new THREE.CircleGeometry(.3,16),new THREE.MeshBasicMaterial({map:faceTex()}));face.position.set(0,1.47,.41);g.add(face);
 var hat=new THREE.Mesh(new THREE.SphereGeometry(.45,16,8,0,Math.PI*2,0,Math.PI/2),M(c.id==='omar'?0xffffff:0xffc020));hat.position.y=1.55;g.add(hat);
 var n=used[c.area]=(used[c.area]||0);used[c.area]++;var a=AREAS[c.area].p,o=offs[n%4];g.position.set(a[0]+o[0],a[1],a[2]+o[1]);g.userData={c:c,home:g.position.clone(),ph:Math.random()*6};
 g.traverse(function(m){m.userData.fig=g});scene.add(g);figs.push(g);c.fig=g});
// ---------- CAMERA / MOVE ----------
var pos=new THREE.Vector3().fromArray(AREAS.heli.p).add(new THREE.Vector3(3,1.6,5)),yaw=-2.2,pitch=-.2,path=[],onArrive=null;
function setLoc(k){st.cur=k;$('loc').textContent=AREAS[k].name}
function walkTo(target,cb,lookAt){var p=[];var from=st.cur,toA=null;
 if(typeof target==='string'){toA=target;var a=AREAS[target];target=new THREE.Vector3(a.p[0],a.p[1]+1.6,a.p[2]+(target==='derrick'?0:2.5))}
 var atTop=pos.y>10;
 if(atTop&&toA!=='derrick'){p.push(new THREE.Vector3(4,15.6,-1.8),new THREE.Vector3(4,1.6,-3))}
 if(pos.y>5&&pos.y<10){p.push(new THREE.Vector3(-14,5.6,-3),new THREE.Vector3(-12,1.6,0))} // heli stairs down
 if(toA==='derrick'){p.push(new THREE.Vector3(4,1.6,-3),new THREE.Vector3(4,15.6,-2.6))}
 if(toA==='heli'||(target.y>5&&target.y<10)){p.push(new THREE.Vector3(-12,1.6,0),new THREE.Vector3(-14,5.6,-3))}
 p.push(target);path=p;onArrive=function(){if(toA)setLoc(toA);face(lookAt||new THREE.Vector3(0,0,2));if(!lookAt&&pos.y>10)pitch=-.6;cb&&cb()}}
function face(v){var d=v.clone().sub(pos);yaw=Math.atan2(-d.x,-d.z);pitch=-.08}
function nearestArea(v){var b='drill',bd=1e9;Object.keys(AREAS).forEach(function(k){var a=AREAS[k].p,d=Math.hypot(a[0]-v.x,a[2]-v.z)+Math.abs(a[1]-v.y)*2;if(d<bd){bd=d;b=k}});return b}
// ---------- INPUT ----------
var down=null,moved=0,holdT=null;
cv.addEventListener('pointerdown',function(e){down={x:e.clientX,y:e.clientY,t:performance.now()};moved=0;clearTimeout(holdT);holdT=setTimeout(function(){if(moved<10){down=null;openMap()}},550)});
addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-down.x,dy=e.clientY-down.y;moved+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.005;pitch=Math.max(-1.2,Math.min(1.2,pitch-dy*.005));down.x=e.clientX;down.y=e.clientY});
addEventListener('pointerup',function(e){clearTimeout(holdT);if(down&&moved<10&&performance.now()-down.t<500)tap(e);down=null});
var ray=new THREE.Raycaster();
function tap(e){if(st.over)return;ray.setFromCamera({x:e.clientX/innerWidth*2-1,y:-e.clientY/innerHeight*2+1},cam);var h=ray.intersectObjects(figs,true)[0];if(h)approach(h.object.userData.fig.userData.c)}
// ---------- UI ----------
function toast(t,ms){var d=$('toast');d.innerHTML=t;d.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(function(){d.style.display='none'},ms||3200)}
function show(id,html){$(id+'c')&&($(id+'c').innerHTML=html);$(id).style.display='flex'}
function hide(id){$(id).style.display='none'}
function card(title,body,opts){var h='<h2>'+title+'</h2>'+body;opts.forEach(function(o,i){h+='<button class="opt" data-i="'+i+'">'+o[0]+'</button>'});show('dlg',h);
 [].forEach.call($('dlgc').querySelectorAll('.opt'),function(b){b.onclick=function(){opts[+b.dataset.i][1]()}})}
function goodbye(){if(st.talking){toast('"Well, I\'ll see you later, '+st.talking.name+'!"',1800);st.talking=null;hide('dlg')}}
// map
function openMap(){if(st.over)return;var mc=$('mapc'),h='';Object.keys(AREAS).forEach(function(k){var a=AREAS[k];h+='<div class="spot" data-k="'+k+'" style="left:'+a.m[0]+'%;top:'+a.m[1]+'%">'+a.name+(k==='derrick'?' 🪜':'')+'</div>'});mc.innerHTML=h;
 var cl='';CREW.forEach(function(c){cl+='<div class="cm" data-c="'+c.id+'"><span class="face" style="background:'+c.col+'"></span>'+c.name+'</div>'});$('crewl').innerHTML=cl;$('map').style.display='flex';
 [].forEach.call(mc.querySelectorAll('.spot'),function(s){s.onclick=function(ev){ev.stopPropagation();s.classList.add('on');s.textContent='✔ '+s.textContent;setTimeout(function(){hide('map');goodbye();walkTo(s.dataset.k)},350)}});
 [].forEach.call($('crewl').querySelectorAll('.cm'),function(s){s.onclick=function(ev){ev.stopPropagation();hide('map');var c=crew(s.dataset.c);if(st.talking&&st.talking!==c)goodbye();approach(c)}})}
$('map').onclick=function(){hide('map')};$('bMap').onclick=openMap;
// logbook
var page=0;function logbook(){var L=LOG.slice();L[S.log[0]]=[S.log[1],S.log[2]];var p=L[page];
 card('📖 Logbook · page '+(page+1)+'/4','<p><b>'+p[0]+'</b></p><p>'+p[1]+'</p>',[['◀ Previous page',function(){page=(page+3)%4;logbook()}],['Next page ▶',function(){page=(page+1)%4;logbook()}],['🔎 Flag this entry as odd',function(){if(page===S.log[0])addEvid('log','Odd logbook entry: '+p[0]);else toast('Looks normal on a second read.');logbook()}],['Close logbook',function(){hide('dlg')}]])}
$('bLog').onclick=function(){if(!st.over){page=0;logbook()}};
function addEvid(k,t){if(st.found[k])return toast('Already in your notes.');st.found[k]=1;st.evid.push(t);var bonus=Math.round(150*(1-st.esc/100));st.pts+=bonus;toast('📝 Clue noted (+'+bonus+'): '+t,3800)}
// conversation
function approach(c){goodbye();var f=c.fig.position;var dir=pos.clone().setY(0).sub(f.clone().setY(0)).normalize();var t=f.clone().add(dir.multiplyScalar(1.8));t.y=f.y+1.6;
 walkTo(t,function(){setLoc(nearestArea(f));st.talking=c;toast('"Hey there, '+c.name+'!"',1500);setTimeout(function(){talk(c)},600)},f.clone().setY(f.y+1.4))}
function stress(){return st.stage>=2?' (looks stressed)':st.stage>=1?' (a little tense)':''}
function talk(c,msg){var isC=c.id===S.culprit;
 card(c.name+' · '+c.role+stress(),'<p>'+(msg||'"Hi! What can I do for you?"')+'</p>',[
  ['😊 How you doing, '+c.name+'?',function(){st.trust[c.id]++;var m;if(isC&&st.trust[c.id]>=2)m=S.slips[Math.min(2,st.stage+(st.trust[c.id]>=3?1:0))],addEvid('slip'+st.stage,c.name+': '+m.replace(/<[^>]+>/g,''));else if(!isC&&st.stage>0&&Math.random()<.7)m=S.hints[st.stage];else m=['"Doing great, thanks for asking!"','"Living the dream out here!"','"Good! Coffee\'s fresh in the galley."'][Math.floor(Math.random()*3)];talk(c,m)}],
  ['🛠 What are you working on?',function(){var m='"I\'m '+c.task+'."';if(isC&&st.stage>=1)m+=' '+(st.trust[c.id]>0?S.slips[st.stage-1]:'"Everything\'s fine. Really."');if(!isC&&st.stage>=1)m+=' '+S.hints[st.stage-1];talk(c,m)}],
  ['📋 Could you '+c.ask+'?',function(){var m=c.done;if(c.id==='rosa'){st.esc=Math.max(0,st.esc-3);CREW.forEach(function(x){st.trust[x.id]+=.5})}if(isC)m='"Uh, sure… later? Kind of busy."';talk(c,m)}],
  ['🔎 Inspect the '+AREAS[c.area].name.toLowerCase(),function(){var m;if(c.area===S.area||(S.area==='derrick'&&c.id==='gus'))m=S.inspect[st.stage],addEvid('insp'+st.stage,m);else m='Everything here is tidy and by the book.';talk(c,m)}],
  ['👋 See you later',function(){goodbye()}]])}
// accusation via Rosa
$('bAcc').onclick=function(){if(st.over)return;goodbye();card('⚖ Ask Rosa to call a meeting','<p>Rosa (toolpush) will bring someone in. Notes so far:</p><ul>'+(st.evid.map(function(e){return '<li>'+e+'</li>'}).join('')||'<li><i>No clues yet</i></li>')+'</ul><p>Who is behind the problem?</p>',
 CREW.filter(function(c){return c.id!=='rosa'}).map(function(c){return [c.name+' · '+c.role,function(){pickMotive(c)}]}).concat([['Never mind',function(){hide('dlg')}]]))};
function pickMotive(c){card('Why, though?','<p>What do you think is going on with '+c.name+'?</p>',MOTIVES.map(function(m){return [m[0].toUpperCase()+m.slice(1),function(){accuse(c,m)}]}))}
function accuse(c,m){if(c.id===S.culprit)return end(true,m===S.motive);st.wrong++;st.pts=Math.max(0,st.pts-200);st.esc=Math.min(99,st.esc+12);CREW.forEach(function(x){st.trust[x.id]=Math.max(0,st.trust[x.id]-1)});
 card('Meeting with '+c.name,'<p>Rosa calls '+c.name+' in. Turns out '+c.name+' had nothing to do with it. The crew is tense now, and the meeting cost time. The real problem is still getting worse.</p><p><b>−200 pts · trust down</b></p>',[['Back to work',function(){hide('dlg')}]])}
// ---------- AUDIO ----------
var AC=null;function beep(f,n){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();for(var i=0;i<n;i++){var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;o.type='square';g.gain.value=.05;o.connect(g);g.connect(AC.destination);var t=AC.currentTime+i*.35;o.start(t);o.stop(t+.2)}}catch(e){}}
// ---------- END ----------
function end(win,motiveRight){st.over=true;hide('map');var early=1-st.esc/100;var h;
 if(win){var base=Math.round(2000*early),mb=motiveRight?400:0,eb=st.evid.length*100;st.pts+=base+mb+eb;
  h='<p><b>You caught it!</b> '+crew(S.culprit).name+' — '+S.motive+'. Problem: '+S.mech+'.</p><p><b>The chain reaction you prevented:</b> '+S.chain+'</p>'+
  '<p>Caught at '+Math.round(st.esc)+'% escalation ('+(st.esc<34?'early, the best kind':st.esc<67?'mid-shift':'just in time')+').</p><ul><li>Early-catch bonus: +'+base+'</li><li>Right motive: +'+mb+'</li><li>Clues ('+st.evid.length+'): +'+eb+'</li><li>Wrong meetings: '+st.wrong+'</li></ul>';}
 else h='<p><b>Incident!</b> The '+S.mech.toLowerCase()+' failed before anyone found it. It was '+crew(S.culprit).name+' ('+S.motive+').</p><p>'+S.chain+'</p><ul><li>Clues found: '+st.evid.length+'</li><li>Wrong meetings: '+st.wrong+'</li></ul>';
 card((win?'✅ ':'🚨 ')+S.title+' · '+st.pts+' pts',h+'<p style="font-size:12px;opacity:.7">Dev build · scores are test-only</p>',[['Play another shift',function(){var n=(SCENARIOS.indexOf(S)+1)%SCENARIOS.length;location.search='?s='+n+'&b=1'}]]);
 try{window.parent.postMessage({type:'ztp-score',game:'rig-mystery',ver:'v0.1',score:st.pts,dev:true},'*')}catch(e){}}
// ---------- LOOP ----------
function resize(){R.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}addEventListener('resize',resize);resize();
var last=performance.now();
function loop(now){var dt=Math.min(.05,(now-last)/1000);last=now;
 if(path.length){var t=path[0],d=t.clone().sub(pos),L=d.length(),sp=(Math.abs(d.y)>2&&Math.hypot(d.x,d.z)<1)?3:5;if(L<sp*dt){pos.copy(t);path.shift();if(!path.length&&onArrive){var f=onArrive;onArrive=null;f()}}else{pos.add(d.multiplyScalar(sp*dt/L));if(Math.hypot(d.x,d.z)>.5){var ty=Math.atan2(-d.x,-d.z),dy=((ty-yaw+Math.PI*3)%(Math.PI*2))-Math.PI;yaw+=dy*Math.min(1,dt*4)}}}
 if(!st.over&&!q.get('freeze')){st.esc=Math.min(100,st.esc+dt*100/DUR);var ns=st.esc>=67?2:st.esc>=34?1:0;if(ns>st.stage){st.stage=ns;beep(880,ns*2);toast('🚨 '+S.hints[ns],4200)}if(st.esc>=100)end(false)}
 $('gbar').style.width=st.esc+'%';$('pts').textContent=st.pts+' pts';
 var al=st.stage>0?(Math.sin(now/(st.stage>1?120:300))>0?1:0):0;alarmL.intensity=al*st.stage*2;beacon.material.color.setHex(al?0xff2020:0x550000);
 if(valveM)valveM.rotation.z+=dt*st.stage*(S.id==='valve'?6:0);
 figs.forEach(function(g){var u=g.userData,sp=1+st.stage;g.position.y=u.home.y+Math.abs(Math.sin(now/1000*sp*2+u.ph))*.08;if(st.talking!==u.c){g.position.x=u.home.x+Math.sin(now/4000+u.ph)*.6;g.rotation.y=Math.sin(now/3000+u.ph)}else{g.lookAt(pos.x,g.position.y,pos.z)}});
 cam.position.copy(pos);cam.rotation.set(pitch,yaw,0,'YXZ');R.render(scene,cam);requestAnimationFrame(loop)}
setLoc('heli');requestAnimationFrame(loop);
setTimeout(function(){card('🛢 Rig Mystery · '+'Day 41','<p>You are the site supervisor on the Spiral Point rig. Great crew, good day… but something is off. Find the problem and who is behind it before it snowballs.</p><p>Drag to look around. Tap a person to talk. Press and hold (or tap Map) to travel. Check the <b>Logbook</b> for clues. When you are sure, ask Rosa to <b>Call a meeting</b>.</p><p style="font-size:12px;opacity:.7">The earlier you catch it, the bigger the score.</p>',[['Start the shift',function(){hide('dlg')}]])},300);
window.__rig={st:st,S:S,openMap:openMap,approach:function(i){approach(CREW[i])},logbook:logbook,end:end,walkTo:walkTo};
})();
