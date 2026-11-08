(() => {
 const state={projects:[],measurements:[],ships:[]};
 const labels={badania:'Badania',botanika:'Botanika'};
 const status=document.getElementById('labsNotice');
 function el(tag,txt,cls){const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;if(cls)x.className=cls;return x}
 async function refresh(){
  try{
   const [lr,fr]=await Promise.all([fetch('/api/labs',{cache:'no-store'}),fetch('/api/fleet',{cache:'no-store'})]);if(!lr.ok||!fr.ok)throw Error('API niedostępne');
   const data=await lr.json(),fleet=await fr.json();state.projects=data.projects||[];state.measurements=data.measurements||[];state.ships=fleet.ships||[];
   for(const id of ['researchShip','botanyShip']){const select=document.getElementById(id),prev=select.value;select.replaceChildren();for(const ship of state.ships){const o=el('option',ship.name);o.value=ship.id;select.append(o)}if([...select.options].some(o=>o.value===prev))select.value=prev}
   for(const module of ['badania','botanika']){
    const list=document.getElementById(module==='badania'?'researchProjects':'botanyProjects');list.replaceChildren();
    const projects=state.projects.filter(p=>p.module===module);
    for(const p of projects){
     const card=el('article',undefined,'bubble'),title=el('h3',p.title);card.append(title);
     card.append(el('p','Statek: '+(state.ships.find(s=>s.id===p.shipId)?.name||p.shipId)+' · '+p.status));
     card.append(el('p','Postęp: '+(p.progress===null?'brak danych':p.progress+'%')+' · ETA: '+(p.eta?new Date(p.eta).toLocaleString('pl-PL'):'brak danych do oszacowania')));
     card.append(el('p',p.description));if(p.lastEvidence)card.append(el('p','Źródło aktualizacji: '+p.lastEvidence));
     const measurements=state.measurements.filter(m=>m.projectId===p.id).slice(-8).reverse();
     for(const m of measurements)card.append(el('p',m.metric+': '+m.value+' '+m.unit+' · '+m.measuredAt+' · '+m.sensorId,'muted'));
     const form=el('form');form.innerHTML='<label>Status <select name="status"><option>planowany</option><option>aktywny</option><option>wstrzymany</option><option>zakończony</option></select></label><label>Postęp % <input name="progress" type="number" min="0" max="100" step="0.1" placeholder="brak danych"></label><label>ETA <input name="eta" type="datetime-local"></label><input name="evidence" required maxlength="1000" placeholder="Źródło / uzasadnienie aktualizacji"><button class="action">Zapisz aktualizację</button>';
     form.elements.status.value=p.status;if(p.progress!==null)form.elements.progress.value=p.progress;
     if(p.eta)form.elements.eta.value=p.eta.slice(0,16);
     form.onsubmit=async e=>{e.preventDefault();await write('project.update',{id:p.id,status:form.elements.status.value,progress:form.elements.progress.value===''?null:Number(form.elements.progress.value),eta:form.elements.eta.value?new Date(form.elements.eta.value).toISOString():null,evidence:form.elements.evidence.value})};
     card.append(form);
     const estimateButton=el('button','✦ Oszacuj ETA przez AI','action');estimateButton.type='button';
     const estimateOutput=el('p','Prognoza AI nie została jeszcze obliczona','muted');
     estimateButton.onclick=async()=>{estimateButton.disabled=true;estimateOutput.textContent='AI analizuje dostępne dane…';
      try{const r=await fetch('/api/labs/estimate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+document.getElementById('fleetToken').value},body:JSON.stringify({projectId:p.id})});
       const d=await r.json();if(!r.ok)throw Error(d.error||'Błąd AI');
       estimateOutput.textContent=d.estimatedCompletion?'ETA szacowane przez AI: '+new Date(d.estimatedCompletion).toLocaleString('pl-PL')+' · pewność: '+d.confidence+' · '+d.reason+' · Założenia: '+d.assumptions:'AI: nie można wiarygodnie oszacować. '+d.reason;
      }catch(e){estimateOutput.textContent='Prognoza niedostępna: '+e.message}finally{estimateButton.disabled=false}
     };
     card.append(estimateButton,estimateOutput);list.append(card);
    }
    if(!projects.length)list.textContent='Brak zarejestrowanych projektów. Nie wygenerowano przykładowych danych.';
   }
  }catch(e){status.textContent='Błąd pobierania: '+e.message}
 }
 async function write(action,payload){try{
  const token=document.getElementById('fleetToken').value;
  const r=await fetch('/api/labs',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action,payload})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Błąd zapisu');status.textContent='Zapisano: '+d.item.id;await refresh();return true;
 }catch(e){status.textContent='Nie zapisano: '+e.message;return false}}
 for(const [id,module] of [['researchForm','badania'],['botanyForm','botanika']]){
  document.getElementById(id).onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;
   if(await write('project.create',{module,shipId:f.elements.shipId.value,title:f.elements.title.value,description:f.elements.description.value}))f.reset();
  };
 }
 document.getElementById('labsRefresh').onclick=refresh;
 window.refreshShipLabs=refresh;
 refresh();
})();
