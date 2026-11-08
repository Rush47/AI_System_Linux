import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const file=process.env.FLEET_APPS_DATA_PATH||'/tmp/ai-linux-fleet-apps.json';let queue=Promise.resolve();
async function load(){try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return {apps:[],reports:[]};throw e}}
async function save(data){await mkdir(dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await rename(tmp,file)}
const valid=(s,max=200)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export const fleetAppsList=()=>load();
export function fleetAppsWrite(action,payload){
 const work=queue.catch(()=>{}).then(async()=>{
  const data=await load(),now=new Date().toISOString();let item;
  if(action==='app.create'){
   if(!valid(payload.shipId,100)||!valid(payload.name)||!valid(payload.description,2000))throw Error('Wymagany statek, nazwa i opis');
   data.apps??=[];
   item={id:randomUUID(),shipId:payload.shipId,name:payload.name.trim(),description:payload.description.trim(),desiredVersion:valid(payload.desiredVersion,80)?payload.desiredVersion.trim():null,installedVersion:null,deviceStatus:'niezweryfikowany',developmentStatus:'planowana',createdAt:now,updatedAt:now};
   data.apps.push(item);
  }else if(action==='app.plan'){
   item=(data.apps||[]).find(x=>x.id===payload.id);if(!item)throw Error('Nieznana aplikacja');
   if(!['planowana','w realizacji','gotowa do weryfikacji'].includes(payload.developmentStatus))throw Error('Nieprawidłowy etap');
   if(!valid(payload.reason,1000))throw Error('Wymagane uzasadnienie');
   item.developmentStatus=payload.developmentStatus;item.lastPlanReason=payload.reason.trim();item.updatedAt=now;
  }else if(action==='app.report'){
   item=(data.apps||[]).find(x=>x.id===payload.appId&&x.shipId===payload.shipId);if(!item)throw Error('Nieznana aplikacja statku');
   if(!valid(payload.deviceId,128)||!valid(payload.version,80)||!['działa','błąd','zatrzymana'].includes(payload.status))throw Error('Nieprawidłowy raport urządzenia');
   const ts=Date.parse(payload.measuredAt);if(!Number.isFinite(ts)||ts>Date.now()+60000||ts<Date.now()-86400000)throw Error('Nieaktualny raport');
   data.reports??=[];const report={id:randomUUID(),appId:item.id,shipId:item.shipId,deviceId:payload.deviceId,version:payload.version,status:payload.status,measuredAt:new Date(ts).toISOString(),receivedAt:now,source:'authenticated-device'};
   data.reports.push(report);data.reports=data.reports.slice(-3000);item.installedVersion=report.version;item.deviceStatus=report.status;item.lastReportAt=report.measuredAt;item.updatedAt=now;item=report;
  }else throw Error('Nieznana operacja');
  await save(data);return item;
 });queue=work;return work;
}
