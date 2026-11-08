(() => {
 const notice=document.getElementById('fleetAppsNotice'),list=document.getElementById('fleetAppsList'),shipSelect=document.getElementById('fleetAppShip');
 const token=()=>document.getElementById('fleetToken').value;
 async function write(action,payload){const r=await fetch('/api/fleet-apps',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},body:JSON.stringify({action,payload})});const d=await r.json();if(!r.ok)throw Error(d.error||'Błąd zapisu');await refresh();return d.item}
 async function refresh(){try{
  const [ar,fr]=await Promise.all([fetch('/api/fleet-apps',{cache:'no-store'}),fetch('/api/fleet',{cache:'no-store'})]);if(!ar.ok||!fr.ok)throw Error('API niedostępne');
  const data=await ar.json(),fleet=await fr.json(),prev=shipSelect.value;shipSelect.replaceChildren();
  for(const ship of fleet.ships||[]){const o=document.createElement('option');o.value=ship.id;o.textContent=ship.name;shipSelect.append(o)}
  if([...shipSelect.options].some(o=>o.value===prev))shipSelect.value=prev;
  list.replaceChildren();
  for(const app of data.apps||[]){
   const card=document.createElement('article');card.className='bubble';
   const heading=document.createElement('h3');heading.textContent=app.name;card.append(heading);
   const details=document.createElement('p');details.textContent='Statek: '+(fleet.ships||[]).find(s=>s.id===app.shipId)?.name+' · wersja docelowa: '+(app.desiredVersion||'nieustalona')+' · zainstalowana: '+(app.installedVersion||'brak potwierdzenia');card.append(details);
   const age=app.lastReportAt?Date.now()-Date.parse(app.lastReportAt):Infinity;
   const state=document.createElement('p');state.textContent='Urządzenie: '+(age<=15*60*1000?app.deviceStatus:'brak aktualnego potwierdzenia')+' · projekt: '+app.developmentStatus;card.append(state);
   const description=document.createElement('p');description.textContent=app.description;card.append(description);
   const form=document.createElement('form');const select=document.createElement('select');
   for(const name of ['planowana','w realizacji','gotowa do weryfikacji']){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option)}
   select.value=app.developmentStatus;
   const reason=document.createElement('input');reason.required=true;reason.maxLength=1000;reason.placeholder='Uzasadnienie aktualizacji';
   const button=document.createElement('button');button.textContent='Aktualizuj plan';form.append(select,reason,button);
   form.onsubmit=async e=>{e.preventDefault();try{await write('app.plan',{id:app.id,developmentStatus:select.value,reason:reason.value})}catch(err){notice.textContent=err.message}};card.append(form);list.append(card);
  }
  if(!(data.apps||[]).length)list.textContent='Brak aplikacji w rejestrze floty.';
 }catch(e){notice.textContent=e.message}}
 async function createFromChat(text){
  const m=text.match(/^\\/aplikacja\\s+([0-9a-f-]{36})\\s*\\|\\s*([^|]+)\\|\\s*(.+)$/is);
  if(!m)return null;
  try{const app=await write('app.create',{shipId:m[1],name:m[2].trim(),description:m[3].trim()});return 'Zarejestrowano projekt aplikacji '+app.name+' ('+app.id+'). Nie potwierdzono instalacji na statku.'}
  catch(e){return 'Nie utworzono aplikacji: '+e.message}
 }
 document.getElementById('fleetAppForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{await write('app.create',{shipId:f.elements.shipId.value,name:f.elements.name.value,description:f.elements.description.value,desiredVersion:f.elements.desiredVersion.value});f.reset()}catch(err){notice.textContent=err.message}};
 document.getElementById('fleetAppsRefresh').onclick=refresh;
 window.createFleetAppFromChat=createFromChat;window.refreshFleetApps=refresh;refresh();
})();
