import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const file=process.env.SHIP_LABS_DATA_PATH||'/tmp/ai-linux-labs.json';
let queue=Promise.resolve();
async function read(){try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return {projects:[],measurements:[],strains:[],compounds:[]};throw e}}
async function save(data){await mkdir(dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await rename(tmp,file)}
const text=(s,n=200)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const numeric=v=>typeof v==='number'&&Number.isFinite(v);
export const labsList=()=>read();
export function labsWrite(action,payload,source='operator'){
 const work=queue.catch(()=>{}).then(async()=>{
  const d=await read(),now=new Date().toISOString();let item;
  if(action==='project.create'){
   if(!['badania','botanika'].includes(payload.module)||!text(payload.shipId,100)||!text(payload.title)||!text(payload.description,2000))throw Error('Nieprawidłowe dane projektu');
   item={id:randomUUID(),module:payload.module,shipId:payload.shipId,title:payload.title.trim(),description:payload.description.trim(),status:'planowany',progress:null,eta:null,createdAt:now,updatedAt:now};d.projects.push(item);
  }else if(action==='project.update'){
   item=d.projects.find(p=>p.id===payload.id);if(!item)throw Error('Nie znaleziono projektu');
   if(payload.status!==undefined){if(!['planowany','aktywny','wstrzymany','zakończony'].includes(payload.status))throw Error('Nieprawidłowy status');item.status=payload.status}
   if(payload.progress!==undefined){if(payload.progress!==null&&(!numeric(payload.progress)||payload.progress<0||payload.progress>100))throw Error('Nieprawidłowy postęp');item.progress=payload.progress}
   if(payload.eta!==undefined){if(payload.eta!==null&&(!text(payload.eta,40)||!Number.isFinite(Date.parse(payload.eta))))throw Error('Nieprawidłowe ETA');item.eta=payload.eta}
   if(!text(payload.evidence,1000))throw Error('Aktualizacja wymaga źródła danych lub uzasadnienia');
   item.lastEvidence=payload.evidence.trim();item.updatedAt=now;
  }else if(action==='strain.create'){
   if(!text(payload.projectId,100)||!text(payload.name,200)||!text(payload.species,200)||!text(payload.origin,1000))throw Error('Wymagane nazwa, gatunek i pochodzenie');
   const project=d.projects.find(p=>p.id===payload.projectId&&p.module==='botanika');if(!project)throw Error('Wymagany projekt Botanika');
   d.strains??=[];
   item={id:randomUUID(),projectId:project.id,shipId:project.shipId,name:payload.name.trim(),species:payload.species.trim(),origin:payload.origin.trim(),status:'zarejestrowany',createdAt:now,updatedAt:now};d.strains.push(item);
  }else if(action==='compound.create'){
   const strain=(d.strains||[]).find(x=>x.id===payload.strainId);
   if(!strain||!text(payload.name,200)||!text(payload.evidence,2000))throw Error('Wymagany szczep, nazwa i opis źródła');
   d.compounds??=[];
   item={id:randomUUID(),strainId:strain.id,shipId:strain.shipId,name:payload.name.trim(),evidence:payload.evidence.trim(),status:'hipoteza badawcza',medicalClaimVerified:false,createdAt:now,updatedAt:now};d.compounds.push(item);
  }else if(action==='measurement.ingest'){
   item=d.projects.find(p=>p.id===payload.projectId);if(!item||item.shipId!==payload.shipId)throw Error('Projekt nie należy do statku');
   if(!text(payload.sensorId,128)||!text(payload.metric,128)||!text(payload.unit,40)||!numeric(payload.value))throw Error('Nieprawidłowy pomiar');
   const ts=Date.parse(payload.measuredAt);if(!Number.isFinite(ts)||ts>Date.now()+60000||ts<Date.now()-86400000)throw Error('Nieaktualny pomiar');
   const m={id:randomUUID(),projectId:item.id,shipId:item.shipId,module:item.module,sensorId:payload.sensorId,metric:payload.metric.trim(),unit:payload.unit.trim(),value:payload.value,measuredAt:new Date(ts).toISOString(),receivedAt:now,source:'authenticated-ship-sensor'};
   d.measurements.push(m);d.measurements=d.measurements.slice(-5000);item.lastMeasurementAt=m.measuredAt;item.updatedAt=now;item=m;
  }else throw Error('Nieznana operacja');
  await save(d);return item;
 });queue=work;return work;
}
