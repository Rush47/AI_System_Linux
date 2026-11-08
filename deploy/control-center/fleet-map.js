// Interactive schematic solar-system map. Planet markers are NOT real-time ephemerides.
// Only authenticated, time-stamped spacecraft telemetry is plotted as a position.
(() => {
 const canvas=document.getElementById('solarCanvas'),detail=document.getElementById('solarDetails');
 if(!canvas)return;
 const ctx=canvas.getContext('2d');
 const planets=[['Merkury',.387,'#9eacb6'],['Wenus',.723,'#e7c394'],['Ziemia',1,'#69b8ff'],['Mars',1.524,'#ed8e6c'],['Jowisz',5.203,'#d5b18b'],['Saturn',9.537,'#d5c2a0'],['Uran',19.19,'#7ccbd2'],['Neptun',30.07,'#658fe5']];
 let ships=[],missions=[],contacts=[],zoom=1,panX=0,panY=0,drag=null,markers=[],selected=null;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function radius(au){return Math.log1p(au)*72*zoom}
 function draw(){
  const width=canvas.clientWidth,height=canvas.clientHeight,dpr=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#050d1b';ctx.fillRect(0,0,width,height);
  const cx=width/2+panX,cy=height/2+panY;markers=[];
  ctx.strokeStyle='rgba(95,166,206,.22)';ctx.lineWidth=1;
  for(const [name,au,color] of planets){
   const r=radius(au);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
   // Fixed orbital labels are diagrammatic; never imply current planetary positions.
   const px=cx+r,py=cy;ctx.beginPath();ctx.fillStyle=color;ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
   ctx.font='11px system-ui';ctx.fillStyle='#a9c4d7';ctx.fillText(name,px+8,py-6);
  }
  ctx.beginPath();ctx.fillStyle='#ffd66e';ctx.shadowColor='#ffae43';ctx.shadowBlur=18;ctx.arc(cx,cy,8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#ffdf8d';ctx.fillText('Słońce',cx+13,cy-10);
  for(const ship of ships){
   const t=ship.telemetry;if(!t||t.source!=='authenticated-device')continue;
   const age=Date.now()-Date.parse(t.measuredAt);if(!Number.isFinite(age)||age<0||age>15*60*1000)continue;
   const distance=Math.hypot(t.xAu,t.yAu);
   const r=radius(distance),angle=Math.atan2(t.yAu,t.xAu),px=cx+Math.cos(angle)*r,py=cy+Math.sin(angle)*r;
   ctx.strokeStyle='#5bf1c2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py-8);ctx.lineTo(px+8,py+6);ctx.lineTo(px-8,py+6);ctx.closePath();ctx.stroke();
   ctx.fillStyle='#b6ffde';ctx.font='12px system-ui';ctx.fillText(ship.name,px+12,py-9);
   markers.push({x:px,y:py,ship});
  }
  for(const contact of contacts){
   if(contact.source!=='authenticated-sensor')continue;
   const age=Date.now()-Date.parse(contact.measuredAt);if(!Number.isFinite(age)||age<0||age>15*60*1000)continue;
   const r=radius(Math.hypot(contact.xAu,contact.yAu)),a=Math.atan2(contact.yAu,contact.xAu),px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;
   const color=contact.classification==='sojuszniczy'?'#69d7a6':contact.classification==='potencjalnie wrogi'?'#ff9b7c':'#f4ce75';
   ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(px-6,py-6,12,12);
   ctx.font='11px system-ui';ctx.fillStyle=color;ctx.fillText(contact.contactId,px+10,py-7);
   markers.push({x:px,y:py,contact});
  }
  ctx.font='12px system-ui';ctx.fillStyle='#88a8bc';ctx.fillText('Orbity schematyczne • pozycje statków wyłącznie z telemetrii',12,height-14);
 }
 function select(ship){
  selected=ship;detail.replaceChildren();
  if(!ship){detail.textContent='Wybierz statek na mapie lub z listy. Brak danych = brak znacznika.';return}
  const title=document.createElement('h3');title.textContent=ship.name;detail.append(title);
  const p=document.createElement('p');const t=ship.telemetry;
  p.textContent=t&&t.source==='authenticated-device'?'Ostatni pomiar: '+t.measuredAt+' | x='+t.xAu+' AU, y='+t.yAu+' AU, z='+t.zAu+' AU | '+t.frame:'Brak zweryfikowanych współrzędnych';detail.append(p);
  const list=document.createElement('p');list.textContent='Misje: '+(missions.filter(m=>m.shipId===ship.id).map(m=>m.title+' ('+m.status+')').join(', ')||'brak');detail.append(list);
 }
 function refresh(data){ships=data.ships||[];missions=data.missions||[];contacts=data.contacts||[];const list=document.getElementById('solarShips');list.replaceChildren();
  for(const ship of ships){const b=document.createElement('button');b.type='button';b.className='action';const t=ship.telemetry;const fresh=t&&t.source==='authenticated-device'&&Date.now()-Date.parse(t.measuredAt)<=900000;
   b.textContent=ship.name+' · '+(fresh?'telemetria aktualna':'pozycja nieznana / nieaktualna');b.onclick=()=>select(ship);list.append(b)}
  if(!ships.length)list.textContent='Brak statków w rejestrze';
  drawContacts();if(selected)select(ships.find(s=>s.id===selected.id)||null);draw();
 }
 function selectContact(contact){detail.replaceChildren();const title=document.createElement('h3');title.textContent='Kontakt '+contact.contactId;detail.append(title);
  const p=document.createElement('p');p.textContent='Klasyfikacja: '+contact.classification+' | Sensor: '+contact.sensorId+' | Pomiar: '+contact.measuredAt+' | '+contact.xAu+', '+contact.yAu+', '+contact.zAu+' AU';detail.append(p)}
 function drawContacts(){const list=document.getElementById('solarContacts');if(!list)return;list.replaceChildren();
  for(const contact of contacts){const b=document.createElement('button');b.type='button';b.className='action';const age=Date.now()-Date.parse(contact.measuredAt);
   b.textContent=contact.contactId+' · '+contact.classification+(age>900000?' · nieaktualny':'');b.onclick=()=>selectContact(contact);list.append(b)}
  if(!contacts.length)list.textContent='Brak wykrytych kontaktów';
 }
 window.updateSolarFleet=refresh;
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.88:1.12),.3,9);draw()},{passive:false});
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;panX+=dx;panY+=dy;drag.x=e.clientX;drag.y=e.clientY;draw()});
 canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const hit=markers.find(m=>Math.hypot(m.x-x,m.y-y)<18);if(hit){if(hit.ship)select(hit.ship);else if(hit.contact)selectContact(hit.contact)}}drag=null});
 document.getElementById('solarZoomIn').onclick=()=>{zoom=clamp(zoom*1.3,.3,9);draw()};
 document.getElementById('solarZoomOut').onclick=()=>{zoom=clamp(zoom/1.3,.3,9);draw()};
 document.getElementById('solarReset').onclick=()=>{zoom=1;panX=0;panY=0;draw()};
 window.addEventListener('resize',draw);setInterval(draw,60000);select(null);draw();
})();
