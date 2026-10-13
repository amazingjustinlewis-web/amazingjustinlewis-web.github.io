/* explorer came from a screen: offer to put a big-screen game back on that TV (re-pair to the remembered room) */
(function(){var BIG={'red-deer-rich':1,'zombie-tiles':1,'space':1,'mech':1,'laser-range':1,'walker':1},last=null;
 try{last=JSON.parse(localStorage.getItem('ztp-last-room'))}catch(e){}
 if(!last||Date.now()-last.t>2*3600e3)return;
 var css=document.createElement('style');css.textContent='#ztpSheet{position:fixed;left:0;right:0;bottom:0;z-index:99;background:#0a0805;border-top:1px solid #e2b84a;padding:18px 18px calc(18px + env(safe-area-inset-bottom));font:16px Georgia,serif;color:#e9dcc0;box-shadow:0 -10px 30px #000}#ztpSheet a,#ztpSheet button{display:block;width:100%;margin:8px 0;padding:14px;border-radius:12px;border:1px solid rgba(226,184,74,.4);background:#14100a;color:#f3dc95;font:inherit;text-align:center;text-decoration:none}#ztpSheet .go{background:linear-gradient(180deg,#f6dc8e,#d4a63e);color:#120d03}';document.head.appendChild(css);
 document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(!a)return;var m=/games\/([a-z-]+)\//.exec(a.getAttribute('href'));if(!m||!BIG[m[1]])return;e.preventDefault();
  var d=document.getElementById('ztpSheet');if(d)d.remove();d=document.createElement('div');d.id='ztpSheet';
  d.innerHTML='<b>'+((a.closest('article,li,.game-card,.soft-game')||a).querySelector('h3')||a).textContent.trim()+'</b> is best on the big screen.<a class="go" href="go/?pair='+last.code+'&launch='+m[1]+(last.local?'&local=1':'')+'">Play on screen '+last.code+'</a><button id="ztpScan">Scan a screen\u2019s code</button><a href="'+a.getAttribute('href')+'">Just look on my phone</a>';
  document.body.appendChild(d);document.getElementById('ztpScan').onclick=function(){this.textContent='Point your camera at the code on the TV';}},true);
})();
