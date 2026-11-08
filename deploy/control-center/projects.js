(() => {
 const notice=document.getElementById('projectsNotice'),list=document.getElementById('projectsList');
 const token=()=>document.getElementById('fleetToken').value;
 async function write(action,payload){
  const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},body:JSON.stringify({action,payload})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Błąd zapisu');await refresh();return d.item;
 }
 async function refresh(){
  try{const r=await fetch('/api/projects',{cache:'no-store'});if(!r.ok)throw Error('Brak połączenia');const data=await r.json();list.replaceChildren();
   for(const p of data.projects||[]){
    const card=document.createElement('article');card.className='bubble';
    const h=document.createElement('h3');h.textContent=p.title;card.append(h);
    const desc=document.createElement('p');desc.textContent=p.type+' · '+p.phase+' · '+p.description;card.append(desc);
    const info=document.createElement('p');info.textContent='Postęp: '+(p.progress===null?'niezweryfikowany':p.progress+'%')+' · ETA: '+(p.eta||'brak')+' · zadania: '+p.tasks.filter(x=>x.status==='ukończone').length+'/'+p.tasks.length;card.append(info);
    for(const task of p.tasks){const row=document.createElement('div'),btn=document.createElement('button');btn.type='button';btn.textContent=task.status==='ukończone'?'✓ '+task.title:'○ '+task.title+' · '+task.status;btn.onclick=async()=>{try{await write('task.update',{projectId:p.id,taskId:task.id,status:task.status==='ukończone'?'do wykonania':'ukończone'})}catch(e){notice.textContent=e.message}};row.append(btn);card.append(row)}
    const form=document.createElement('form'),input=document.createElement('input'),button=document.createElement('button');input.required=true;input.maxLength=300;input.placeholder='Dodaj etap / zadanie';button.textContent='Dodaj';form.append(input,button);form.onsubmit=async e=>{e.preventDefault();try{await write('task.add',{projectId:p.id,title:input.value})}catch(err){notice.textContent=err.message}};card.append(form);list.append(card);
   }
   if(!(data.projects||[]).length)list.textContent='Brak projektów. Utwórz pierwszy przez czat lub formularz.';
  }catch(e){notice.textContent=e.message}
 }
 async function createFromChat(text){
  const m=text.match(/^\\/projekt\\s+(statek|moduł|inny)\\s+([^|]+)\\|\\s*(.+)$/is);
  if(!m)return null;
  const type=m[1].toLowerCase()==='statek'?'statek kosmiczny':m[1].toLowerCase()==='moduł'?'moduł':'inny';
  try{const item=await write('create',{type,title:m[2].trim(),description:m[3].trim()});notice.textContent='Utworzono projekt '+item.title;return 'Utworzono projekt: '+item.title+' ('+item.id+'). Otwórz moduł Projekty, aby zarządzać etapami. Projekt nie oznacza fizycznej budowy.'}
  catch(e){return 'Nie utworzono projektu: '+e.message}
 }
 document.getElementById('projectForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{await write('create',{type:f.elements.type.value,title:f.elements.title.value,description:f.elements.description.value});f.reset()}catch(err){notice.textContent=err.message}};
 document.getElementById('projectsRefresh').onclick=refresh;
 window.createProjectFromChat=createFromChat;window.refreshProjects=refresh;refresh();
})();
