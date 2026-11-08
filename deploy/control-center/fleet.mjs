import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const path=process.env.FLEET_DATA_PATH||'/tmp/ai-linux-fleet.json';
let queue=Promise.resolve();
async function load(){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return {ships:[],missions:[],contacts:[]};throw e}}
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
  }else if(action==='telemetry.ingest'){
   item=data.ships.find(ship=>ship.id===payload.shipId);if(!item)throw Error('Nieznany identyfikator statku');
   const x=payload.xAu,y=payload.yAu,z=payload.zAu;
   if(![x,y,z].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000))throw Error('Wymagane skończone współrzędne heliocentryczne xAu/yAu/zAu');
   if(payload.frame!=='heliocentric-ecliptic-J2000')throw Error('Wymagany układ heliocentric-ecliptic-J2000');
   const measured=Date.parse(payload.measuredAt);
   if(!Number.isFinite(measured)||measured>Date.now()+60000||measured<Date.now()-86400000)throw Error('Nieprawidłowy lub nieaktualny czas pomiaru');
   item.telemetry={xAu:x,yAu:y,zAu:z,frame:payload.frame,measuredAt:new Date(measured).toISOString(),receivedAt:now,source:'authenticated-device'};
   item.updatedAt=now;
  }else if(action==='contact.ingest'){
   if(!data.ships.some(ship=>ship.id===payload.shipId))throw Error('Nieznany statek źródłowy');
   if(!validText(payload.contactId,128)||!validText(payload.sensorId,128))throw Error('Wymagane ID kontaktu i sensora');
   if(payload.frame!=='heliocentric-ecliptic-J2000'||![payload.xAu,payload.yAu,payload.zAu].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000))throw Error('Wymagane poprawne współrzędne heliocentryczne w AU');
   const measured=Date.parse(payload.measuredAt);
   if(!Number.isFinite(measured)||measured>Date.now()+60000||measured<Date.now()-86400000)throw Error('Pomiar nieaktualny lub nieprawidłowy');
   data.contacts??=[];
   item=data.contacts.find(x=>x.shipId===payload.shipId&&x.contactId===payload.contactId);
   if(!item){item={id:randomUUID(),shipId:payload.shipId,contactId:payload.contactId,classification:'nieznany',createdAt:now};data.contacts.push(item)}
   if(item.measuredAt&&measured<Date.parse(item.measuredAt))throw Error('Starszy pomiar');
   Object.assign(item,{sensorId:payload.sensorId,xAu:payload.xAu,yAu:payload.yAu,zAu:payload.zAu,frame:payload.frame,measuredAt:new Date(measured).toISOString(),receivedAt:now,source:'authenticated-sensor'});
  }else if(action==='contact.classify'){
   item=(data.contacts||[]).find(x=>x.id===payload.id);if(!item)throw Error('Nie znaleziono kontaktu');
   if(!['nieznany','sojuszniczy','potencjalnie wrogi'].includes(payload.classification))throw Error('Nieprawidłowa klasyfikacja');
   if(!validText(payload.reason,500))throw Error('Wymagane uzasadnienie klasyfikacji');
   item.classification=payload.classification;item.classificationReason=payload.reason.trim();item.classifiedAt=now;
  }else if(action==='mission.update'){
   item=data.missions.find(m=>m.id===payload.id);if(!item)throw Error('Nie znaleziono misji');
   if(!['planowana','w przygotowaniu','wstrzymana','zakończona'].includes(payload.status))throw Error('Nieprawidłowy status');
   item.status=payload.status;item.updatedAt=now;
  }else throw Error('Nieznana operacja');
  await save(data);return item;
 });queue=work;return work;
}
