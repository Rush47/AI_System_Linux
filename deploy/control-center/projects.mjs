import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const path=process.env.PROJECTS_DATA_PATH||'/tmp/ai-linux-projects.json';let queue=Promise.resolve();
async function load(){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return {projects:[]};throw e}}
async function save(data){await mkdir(dirname(path),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await rename(tmp,path)}
const valid=(s,max=200)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export const projectList=()=>load();
export function projectWrite(action,payload){
 const work=queue.catch(()=>{}).then(async()=>{
  const data=await load(),now=new Date().toISOString();let item;
  if(action==='create'){
   if(!valid(payload.title)||!valid(payload.description,4000))throw Error('Wymagana nazwa i opis');
   if(!['statek kosmiczny','moduł','inny'].includes(payload.type))throw Error('Nieprawidłowy typ');
   item={id:randomUUID(),title:payload.title.trim(),description:payload.description.trim(),type:payload.type,phase:'koncepcja',progress:null,eta:null,etaSource:null,tasks:[],createdAt:now,updatedAt:now,source:'operator-chat'};
   data.projects.push(item);
  }else if(action==='task.add'){
   item=data.projects.find(p=>p.id===payload.projectId);if(!item||!valid(payload.title,300))throw Error('Nieznany projekt lub zadanie');
   item.tasks.push({id:randomUUID(),title:payload.title.trim(),status:'do wykonania',createdAt:now});item.updatedAt=now;
  }else if(action==='task.update'){
   item=data.projects.find(p=>p.id===payload.projectId);const task=item?.tasks.find(t=>t.id===payload.taskId);
   if(!task||!['do wykonania','w toku','ukończone'].includes(payload.status))throw Error('Nieprawidłowe zadanie');
   task.status=payload.status;task.updatedAt=now;item.updatedAt=now;
  }else if(action==='update'){
   item=data.projects.find(p=>p.id===payload.id);if(!item)throw Error('Nieznany projekt');
   if(payload.phase!==undefined){if(!['koncepcja','projekt techniczny','prototyp','budowa','weryfikacja'].includes(payload.phase))throw Error('Nieprawidłowy etap');item.phase=payload.phase}
   if(payload.progress!==undefined){if(payload.progress!==null&&(!Number.isFinite(payload.progress)||payload.progress<0||payload.progress>100))throw Error('Nieprawidłowy postęp');item.progress=payload.progress}
   if(payload.eta!==undefined){if(payload.eta!==null&&(!valid(payload.eta,50)||!Number.isFinite(Date.parse(payload.eta))))throw Error('Nieprawidłowe ETA');item.eta=payload.eta;item.etaSource=payload.eta?'operator':null}
   if(!valid(payload.evidence,1000))throw Error('Wymagane uzasadnienie');item.lastEvidence=payload.evidence.trim();item.updatedAt=now;
  }else throw Error('Nieznana operacja');
  await save(data);return item;
 });queue=work;return work;
}
