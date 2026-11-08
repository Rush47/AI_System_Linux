import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const path=process.env.FLEET_DATA_PATH||'/tmp/ai-linux-fleet.json';
let queue=Promise.resolve();
async function load(){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return {ships:[],missions:[]};throw e}}
async function save(data){await mkdir(dirname(path),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await rename(tmp,path)}
function validText(v,max=200){return typeof v==='string'&&v.trim()&&v.length<=max}
export async function fleetList(){return load()}
export function fleetWrite(action,payload){
 const work=queue.catch(()=>{}).then(async()=>{
  const data=await load();const now=new Date().toISOString();let item;
  if(action==='ship.create'){
   if(!validText(payload.name)||!validText(payload.description||'',2000))throw Error('Nazwa i opis są wymagane');
   item={id:randomUUID(),name:payload.name.trim(),description:payload.description.trim(),status:'projekt',verified:false,createdAt:now,updatedAt:now};data.ships.push(item);
  }else if(action==='mission.create'){
   if(!data.ships.some(s=>s.id===payload.shipId)||!validText(payload.title)||!validText(payload.objective||'',2000))throw Error('Wymagany istniejący statek, tytuł i cel');
   item={id:randomUUID(),shipId:payload.shipId,title:payload.title.trim(),objective:payload.objective.trim(),status:'planowana',createdAt:now,updatedAt:now};data.missions.push(item);
  }else if(action==='mission.update'){
   item=data.missions.find(m=>m.id===payload.id);if(!item)throw Error('Nie znaleziono misji');
   if(!['planowana','w przygotowaniu','wstrzymana','zakończona'].includes(payload.status))throw Error('Nieprawidłowy status');
   item.status=payload.status;item.updatedAt=now;
  }else throw Error('Nieznana operacja');
  await save(data);return item;
 });queue=work;return work;
}
