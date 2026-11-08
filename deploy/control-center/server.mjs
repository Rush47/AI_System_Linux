import {appendFile,readFile as readStored} from 'node:fs/promises';
import http from 'node:http';
import {integrationStatus,openaiChat,githubRepoStatus} from './integrations.mjs';
import {fleetList,fleetWrite} from './fleet.mjs';
import {labsList,labsWrite} from './ship-labs.mjs';
import {projectList,projectWrite} from './projects.mjs';
import {fleetAppsList,fleetAppsWrite} from './fleet-apps.mjs';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {handleMcpRequest} from './mcp.mjs';
const exec=promisify(execFile);
const page=(await readFile(new URL('./index.html',import.meta.url),'utf8')).replace('</head>','<link rel="stylesheet" href="/theme.css"></head>').replace('</body>','<script src="/operations.js" defer></script><script src="/chat-ui.js" defer></script></body>');
const operationsScript=await readFile(new URL('./operations.js',import.meta.url));
const themeStyles=await readFile(new URL('./theme.css',import.meta.url));
const chatUiScript=await readFile(new URL('./chat-ui.js',import.meta.url));
const fleetMapScript=await readFile(new URL('./fleet-map.js',import.meta.url));
const shipLabsScript=await readFile(new URL('./ship-labs.js',import.meta.url));
const projectsScript=await readFile(new URL('./projects.js',import.meta.url));
const fleetAppsScript=await readFile(new URL('./fleet-apps.js',import.meta.url));
const model=process.env.SYSTEM_AI_MODEL||'thox-ai/thoxopen-8b-heretic:q4_k_m';
const fallbackModel=process.env.SYSTEM_AI_FALLBACK_MODEL||'maternion/spark-x2.5-heretic:4b';
const endpoint=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const allowedModels=[...new Set([model,fallbackModel,...(process.env.SYSTEM_AI_EXTRA_MODELS||'').split(',').map(s=>s.trim()).filter(Boolean)])];

const prompt='Jesteś System AI, lokalnym asystentem systemu AI Linux na Ubuntu. Działasz przez model Ollama 8B. Wyjaśniaj, diagnozuj i proponuj kroki. Nie twierdź, że wykonałeś polecenia, zmieniłeś pliki lub odczytałeś stan hosta, jeśli nie masz takich narzędzi. Nie podszywaj się pod Aria, Alex, Astyria ani Aurelius.';
// Strictly read-only diagnostics from the control-center container; never shell-evaluate model output.
const diagnostics=Object.freeze({
  '/status':['uname',['-a']],
  '/procesy':['ps',[]],
  '/dysk':['df',['-h']],
  '/pamiec':['cat',['/proc/meminfo']],
  '/pamięć':['free',['-h']]
});
const safeTerminalOperations=Object.freeze({
 kernel:{file:'uname',args:['-a'],label:'uname -a'},
 processes:{file:'ps',args:['-ef'],label:'ps -ef'},
 disk:{file:'df',args:['-h'],label:'df -h'},
 memory:{file:'free',args:['-h'],label:'free -h'},
 workspace:{file:'git',args:['status','--short','--branch'],label:'git status --short --branch'},
 containers:{file:'docker',args:['compose','ps'],label:'docker compose ps'}
});
async function runDiagnostic(message){
  const command=diagnostics[message.trim().toLowerCase()];
  if(!command)return null;
  const {stdout}=await exec(command[0],command[1],{timeout:5000,maxBuffer:32768,env:{PATH:'/usr/bin:/bin'}});
  return 'Diagnostyka kontenera Control Center (nie hosta Ubuntu):\\n'+stdout.slice(0,12000);
}
const agentNames=new Set(['Aria','Alex','Astyria','Aurelius']);
const outgoingTasks=new Map();
const taskHistoryPath=process.env.AGENT_TASKS_PATH||'/tmp/ai-linux-agent-tasks.jsonl';
const taskResultsPath=process.env.AGENT_TASK_RESULTS_PATH||'/tmp/ai-linux-agent-delivery.jsonl';
const agentDestinations={
 aria:process.env.ARIA_TASK_URL,alex:process.env.ALEX_TASK_URL,
 astyria:process.env.ASTYRIA_TASK_URL,aurelius:process.env.AURELIUS_TASK_URL
};
async function dispatchAgentTask(task,agent){
 const url=agentDestinations[agent];
 if(!url)return {agent,status:'unconfigured'};
 let parsed;
 try{parsed=new URL(url);if(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname)))throw Error('HTTPS required')}
 catch(e){return {agent,status:'invalid-endpoint',error:e.message}}
 const secret=process.env.AGENT_OUTBOUND_TOKEN;
 if(!secret)return {agent,status:'missing-outbound-token'};
 try{
  const response=await fetch(parsed,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+secret},body:JSON.stringify({taskId:task.id,agent,text:task.text,channel:task.channel,createdAt:task.timestamp}),signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!response.ok)return {agent,status:'delivery-failed',httpStatus:response.status};
  return {agent,status:'accepted-by-endpoint',httpStatus:response.status};
 }catch(e){return {agent,status:'delivery-failed',error:String(e.message).slice(0,180)}}
}

const inboxPath=process.env.AGENT_INBOX_PATH||'/tmp/ai-linux-agent-inbox.jsonl';
let inbox=[];
try{inbox=(await readStored(inboxPath,'utf8')).split('\n').filter(Boolean).slice(-500).map(line=>JSON.parse(line))}catch(e){if(e.code!=='ENOENT')console.error('Agent inbox unavailable:',e.message)}
const syncClients=new Set();let syncRevision=0;
function syncBroadcast(type,details={}) {
 const event=JSON.stringify({revision:++syncRevision,type,details,timestamp:new Date().toISOString()});
 for(const client of syncClients){try{client.write('id: '+syncRevision+'\\ndata: '+event+'\\n\\n')}catch{syncClients.delete(client)}}
}
const syncHeartbeat=setInterval(()=>{for(const client of syncClients){try{client.write(': heartbeat\\n\\n')}catch{syncClients.delete(client)}}},20000);
syncHeartbeat.unref();
const controlCenterUrl=(process.env.CONTROL_CENTER_URL||'http://127.0.0.1:3081').replace(/\/$/,'');
async function mcpSystemStatus(){
 const response=await fetch(controlCenterUrl+'/api/control/status',{signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Control Center status HTTP '+response.status);
 return response.json();
}
function mcpListAgents(){
 const now=Date.now();
 return {agents:Object.entries(agentDestinations).map(([id,url])=>{
  const recent=[...inbox].reverse().find(item=>item.agent?.toLowerCase()===id&&item.taskId&&now-Date.parse(item.timestamp)<15*60*1000);
  const pendingTasks=[...outgoingTasks.values()].filter(task=>task.mentions?.includes(id)&&['queued-not-delivered','accepted-by-endpoint','pending'].includes(task.status)).length;
  return {id,name:[...agentNames].find(name=>name.toLowerCase()===id),endpointConfigured:Boolean(url),status:recent?'online':url?'unverified':'offline',workerVerified:Boolean(recent),lastAuthenticatedResultAt:recent?.timestamp||null,pendingTasks};
 })};
}
async function mcpTaskStatus(taskId){
 if(outgoingTasks.has(taskId))return outgoingTasks.get(taskId);
 for(const path of [taskResultsPath,taskHistoryPath]){
  try{const rows=(await readStored(path,'utf8')).split('\n').filter(Boolean);for(let index=rows.length-1;index>=0;index--){const item=JSON.parse(rows[index]);if(item.id===taskId)return item}}
  catch(error){if(error.code!=='ENOENT')throw Error('Agent task history unavailable')}
 }
 throw Error('Unknown task id');
}
async function mcpCreateAgentTask(agent,text){
 const normalized=String(agent).toLowerCase();
 if(!Object.hasOwn(agentDestinations,normalized))throw Error('Unknown original agent');
 if(!agentDestinations[normalized])throw Error('Agent endpoint is not configured');
 if(!process.env.AGENT_OUTBOUND_TOKEN)throw Error('AGENT_OUTBOUND_TOKEN is not configured');
 if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('Task must contain 1-4000 characters');
 const agentName=[...agentNames].find(name=>name.toLowerCase()===normalized);
 const task={id:Date.now()+'-'+Math.random().toString(36).slice(2,10),mentions:[normalized],text:text.trim(),channel:agentName,status:'queued-not-delivered',timestamp:new Date().toISOString()};
 await appendFile(taskHistoryPath,JSON.stringify(task)+'\n',{mode:0o600});outgoingTasks.set(task.id,{...task,delivery:[{agent:normalized,status:'pending'}]});syncBroadcast('agent-task-queued',task);
 const delivery=await dispatchAgentTask(task,normalized);const previous=outgoingTasks.get(task.id);
 const state={...task,delivery:[delivery],status:previous?.status==='result-received'?'result-received':delivery.status};
 outgoingTasks.set(task.id,state);await appendFile(taskResultsPath,JSON.stringify(state)+'\n',{mode:0o600});syncBroadcast('agent-task-delivery',state);
 return {taskId:task.id,agent:agentName,status:state.status,executionVerified:state.status==='result-received',delivery};
}
async function mcpLogs(lines=50){
 const count=Math.max(1,Math.min(Number.isInteger(lines)?lines:50,100));
 try{
  const contents=await readStored('/tmp/ai-linux/control-center.log','utf8');
  let output=contents.trimEnd().split('\n').slice(-count);
  for(const secret of [process.env.MCP_AUTH_TOKEN,process.env.MCP_TERMINAL_TOKEN,process.env.AGENT_OUTBOUND_TOKEN,process.env.AGENT_INGEST_TOKEN].filter(Boolean))output=output.map(line=>line.split(secret).join('[REDACTED]'));
  return {source:'control-center',lines:output};
 }catch(error){if(error.code==='ENOENT')return {source:'control-center',lines:[]};throw Error('Control Center logs unavailable')}
}
async function mcpTerminalExecute(operation){
 if(typeof operation!=='string'||!Object.hasOwn(safeTerminalOperations,operation))throw Error('Operation is not allowlisted');
 const selected=safeTerminalOperations[operation];
 const {stdout,stderr}=await exec(selected.file,selected.args,{cwd:process.cwd(),timeout:10000,maxBuffer:32768,env:{PATH:process.env.PATH||'/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME||'/tmp'}});
 syncBroadcast('terminal-executed',{operation});
 return {executed:true,operation,command:selected.label,scope:'Codespaces container; host root is not connected',stdout:stdout.slice(0,24000),stderr:stderr.slice(0,8000)};
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  if(new URL(req.url,'http://localhost').pathname==='/mcp'){
    await handleMcpRequest(req,res,{
      authToken:process.env.MCP_AUTH_TOKEN,
      terminalToken:process.env.MCP_TERMINAL_TOKEN,
      systemStatus:mcpSystemStatus,
      listAgents:mcpListAgents,
      sendMessage:(agent,message)=>mcpCreateAgentTask(agent,message),
      createTask:(agent,task)=>mcpCreateAgentTask(agent,task),
      getTaskStatus:mcpTaskStatus,
      getLogs:mcpLogs,
      terminalExecute:mcpTerminalExecute,
    });
    return;
  }
  if(req.url==='/api/integrations/status'&&req.method==='GET'){
    const token=process.env.INTEGRATIONS_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end('Unauthorized');return}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(await integrationStatus()));return;
  }
  if(req.url==='/api/integrations/github/repository'&&req.method==='GET'){
    const token=process.env.INTEGRATIONS_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end('Unauthorized');return}
    try{const data=await githubRepoStatus();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data))}
    catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.url==='/api/integrations/openai/chat'&&req.method==='POST'){
    const token=process.env.INTEGRATIONS_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end('Unauthorized');return}
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Too large')}
      const payload=JSON.parse(raw);
      if(typeof payload.message!=='string'||!payload.message.trim()||payload.message.length>4000)throw Error('Invalid message');
      const data=await openaiChat(payload.message);
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
    }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='GET'&&req.url==='/fleet-apps.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(fleetAppsScript);return}
  if(req.method==='GET'&&req.url==='/operations.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(operationsScript);return}
  if(req.method==='GET'&&req.url==='/chat-ui.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(chatUiScript);return}
  if(req.method==='GET'&&req.url==='/theme.css'){res.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});res.end(themeStyles);return}
  if(req.method==='GET'&&req.url==='/api/control/status'){
    let ollama={connected:false,models:[]};
    try{const response=await fetch(endpoint+'/api/tags',{signal:AbortSignal.timeout(3500)});if(!response.ok)throw Error('Ollama HTTP '+response.status);const data=await response.json();ollama={connected:true,models:(data.models||[]).map(item=>item.name||item.model).filter(Boolean)}}catch(e){ollama.error=e.message}
    let github={configured:Boolean(process.env.GITHUB_TOKEN),connected:false,repository:process.env.GITHUB_REPOSITORY||'Rush47/AI_System_Linux'};
    if(github.configured){try{github={configured:true,connected:true,...await githubRepoStatus()}}catch(e){github.error=e.message}}
    const agents=Object.fromEntries(Object.entries(agentDestinations).map(([name,url])=>[name,{configured:Boolean(url),connected:false}]));
    const mcpConfigured=Boolean(process.env.MCP_AUTH_TOKEN&&process.env.MCP_TERMINAL_TOKEN&&process.env.MCP_AUTH_TOKEN!==process.env.MCP_TERMINAL_TOKEN);
    const status={ollama:{...ollama,defaultModel:model,fallbackModel},github,openai:{configured:Boolean(process.env.OPENAI_API_KEY),verified:false,model:process.env.OPENAI_MODEL||'gpt-4.1-mini'},integrationsApi:{configured:Boolean(process.env.INTEGRATIONS_TOKEN)},gemini:{configured:Boolean(process.env.GEMINI_API_KEY&&process.env.GEMINI_FALLBACK_ENABLED==='true'),verified:false},codex:{configured:false,connected:false},mcp:{configured:mcpConfigured,connected:mcpConfigured,endpoint:'/mcp',transport:'Streamable HTTP',authentication:'Bearer operator/terminal tokens',detail:mcpConfigured?'Chroniony endpoint Streamable HTTP aktywny; terminal wymaga osobnego MCP_TERMINAL_TOKEN.':'MCP wymaga dwóch różnych tokenów bearer.'},agents,terminal:{scope:'Kontener Codespaces',hostRoot:false,operations:Object.values(safeTerminalOperations).map(item=>item.label)}};
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(status));return;
  }
  if(req.method==='GET'&&req.url==='/api/control/logs'){
    try{const contents=await readStored('/tmp/ai-linux/control-center.log','utf8');const lines=contents.trimEnd().split('\n').slice(-100);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({lines}))}
    catch(e){if(e.code==='ENOENT'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({lines:[]}))}else{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Logs unavailable'}))}}return;
  }
  if(req.method==='GET'&&req.url==='/api/fleet-apps'){
   try{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(await fleetAppsList()))}catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/fleet-apps'){
   const token=process.env.FLEET_WRITE_TOKEN;
   if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized operator'}));return}
   try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Too large')}
    const {action,payload}=JSON.parse(raw);
    if(action==='app.create'&&!(await fleetList()).ships.some(x=>x.id===payload?.shipId))throw Error('Nieznany statek');
    const item=await fleetAppsWrite(action,payload||{});
    res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({item}));syncBroadcast('fleet-apps-updated',{action,id:item.id});
   }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/fleet-apps/report'){
   const token=process.env.FLEET_DEVICE_TOKEN;
   if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized device'}));return}
   try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Too large')}
    const item=await fleetAppsWrite('app.report',JSON.parse(raw));
    res.writeHead(202,{'Content-Type':'application/json'});res.end(JSON.stringify({accepted:true,id:item.id}));syncBroadcast('fleet-apps-updated',{action:'app.report',id:item.id});
   }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='GET'&&req.url==='/projects.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(projectsScript);return}
  if(req.method==='GET'&&req.url==='/api/projects'){
   try{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(await projectList()))}catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/projects'){
   const token=process.env.FLEET_WRITE_TOKEN;
   if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized operator'}));return}
   try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Too large')}
    const {action,payload}=JSON.parse(raw);const item=await projectWrite(action,payload||{});
    res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({item}));syncBroadcast('projects-updated',{action,id:item.id});
   }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='GET'&&req.url==='/ship-labs.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(shipLabsScript);return}
  if(req.method==='POST'&&req.url==='/api/labs/estimate'){
    const token=process.env.FLEET_WRITE_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized operator'}));return}
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)throw Error('Too large')}
      const {projectId}=JSON.parse(raw);const data=await labsList();const project=data.projects.find(x=>x.id===projectId);
      if(!project)throw Error('Nieznany projekt');
      const measurements=data.measurements.filter(x=>x.projectId===projectId).slice(-30);
      const instructions='Jesteś analitykiem ETA projektów badawczych i botanicznych. Korzystaj wyłącznie z podanych faktów. Jeśli brak podstaw do sensownego oszacowania, zwróć estimateDays:null. Zwróć TYLKO JSON: {"estimateDays": liczba_dni_lub_null,"confidence":"niska|średnia|wysoka","reason":"krótkie uzasadnienie po polsku","assumptions":"jawne założenia"}. Nie wymyślaj pomiarów ani stanu urządzeń. Szacunek to prognoza, nie fakt.';
      const response=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,format:'json',messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({now:new Date().toISOString(),project,measurements})}]}),signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw Error('Ollama HTTP '+response.status);
      const answer=JSON.parse((await response.json()).message?.content||'{}');
      const days=answer.estimateDays;
      const valid=typeof days==='number'&&Number.isFinite(days)&&days>=0&&days<=36500;
      const estimate={projectId,kind:'ai-estimate',estimateDays:valid?days:null,estimatedCompletion:valid?new Date(Date.now()+days*86400000).toISOString():null,confidence:['niska','średnia','wysoka'].includes(answer.confidence)?answer.confidence:'niska',reason:String(answer.reason||'Brak wystarczających podstaw').slice(0,1000),assumptions:String(answer.assumptions||'').slice(0,1000),generatedAt:new Date().toISOString(),model};
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(estimate));
    }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='GET'&&req.url==='/api/labs'){
    try{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(await labsList()))}catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/labs'){
    const token=process.env.FLEET_WRITE_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized operator'}));return}
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Too large')}
      const {action,payload}=JSON.parse(raw);
      if(action==='project.create'&&!(await fleetList()).ships.some(x=>x.id===payload?.shipId))throw Error('Nieznany statek');
      const item=await labsWrite(action,payload||{});
      res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({item}));syncBroadcast('labs-updated',{action,id:item.id});
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/labs/measurements'){
    const token=process.env.FLEET_SENSOR_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized sensor'}));return}
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Too large')}
      const item=await labsWrite('measurement.ingest',JSON.parse(raw),'sensor');
      res.writeHead(202,{'Content-Type':'application/json'});res.end(JSON.stringify({accepted:true,id:item.id}));syncBroadcast('labs-updated',{action:'measurement.ingest',id:item.id});
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='GET'&&req.url==='/fleet-map.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(fleetMapScript);return}
  if(req.method==='POST'&&req.url==='/api/fleet/contacts'){
    const token=process.env.FLEET_SENSOR_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized sensor'}));return}
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Too large')}
      const item=await fleetWrite('contact.ingest',JSON.parse(raw));
      res.writeHead(202,{'Content-Type':'application/json'});res.end(JSON.stringify({accepted:true,id:item.id,classification:item.classification}));
      syncBroadcast('fleet-updated',{action:'contact.ingest',id:item.id});
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/fleet/telemetry'){
    const token=process.env.FLEET_TELEMETRY_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized device'}));return}
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Too large')}
      const item=await fleetWrite('telemetry.ingest',JSON.parse(raw));
      res.writeHead(202,{'Content-Type':'application/json'});res.end(JSON.stringify({accepted:true,shipId:item.id,measuredAt:item.telemetry.measuredAt}));
      syncBroadcast('fleet-updated',{action:'telemetry.ingest',id:item.id});
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.url?.startsWith('/api/fleet/transmissions/device/')){
    const token=process.env.FLEET_DEVICE_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized device'}));return}
    const shipId=decodeURIComponent(req.url.split('/')[5]?.split('?')[0]||'');
    try{
      if(!(await fleetList()).ships.some(x=>x.id===shipId))throw Error('Unknown ship');
      if(req.method==='GET'){
        const data=await fleetList();const messages=(data.transmissions||[]).filter(x=>x.targetType==='ship'&&x.targetId===shipId&&x.status==='oczekuje na kanał');
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({messages}));return;
      }
      if(req.method==='POST'){
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)throw Error('Too large')}
        const body=JSON.parse(raw);const item=await fleetWrite('transmission.ack',{shipId,id:body.id,status:body.status});
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:item.id,status:item.status}));syncBroadcast('fleet-updated',{action:'transmission.ack',id:item.id});return;
      }
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));return}
  }
  if(req.method==='GET'&&req.url==='/api/fleet'){
    try{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(await fleetList()))}catch(e){res.writeHead(503);res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/fleet'){
    const token=process.env.FLEET_WRITE_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end(JSON.stringify({error:'Wymagany FLEET_WRITE_TOKEN'}));return}
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Za duże żądanie')}
      const {action,payload}=JSON.parse(raw);const item=await fleetWrite(action,payload||{});
      res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({item}));syncBroadcast('fleet-updated',{action,id:item.id});
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/agents/mentions'){
    const token=process.env.AGENT_DISPATCH_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unauthorized'}));return}
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)throw Error('Too large')}
      const payload=JSON.parse(raw);
      if(typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>8000)throw Error('Invalid message');
      const mentions=[...new Set(Array.from(payload.text.matchAll(/@(?:aria|alex|astyria|aurelius)\b/gi),m=>m[0].slice(1).toLowerCase()))];
      if(!mentions.length)throw Error('No valid mentions');
      const task={id:Date.now()+'-'+Math.random().toString(36).slice(2,10),mentions,text:payload.text,channel:'Wszyscy',status:'queued-not-delivered',timestamp:new Date().toISOString()};
      await appendFile(process.env.AGENT_TASKS_PATH||'/tmp/ai-linux-agent-tasks.jsonl',JSON.stringify(task)+'\n',{mode:0o600});
      outgoingTasks.set(task.id,{...task,delivery:mentions.map(agent=>({agent,status:'pending'}))});
      if(outgoingTasks.size>500)outgoingTasks.delete(outgoingTasks.keys().next().value);
      syncBroadcast('agent-task-queued',task);
      res.writeHead(202,{'Content-Type':'application/json'});res.end(JSON.stringify(task));
      void Promise.all(mentions.map(agent=>dispatchAgentTask(task,agent))).then(async delivery=>{
       const state={...task,delivery,status:delivery.every(x=>x.status==='accepted-by-endpoint')?'accepted-by-endpoints':'partially-or-not-delivered'};
       outgoingTasks.set(task.id,state);
      try{await appendFile(taskResultsPath,JSON.stringify(state)+'\n',{mode:0o600})}catch(e){console.error('Agent delivery log:',e.message)}
       syncBroadcast('agent-task-delivery',state);
      }).catch(e=>console.error('Agent dispatch:',e.message));
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='GET'&&req.url?.startsWith('/api/agents/tasks/')){
    const token=process.env.AGENT_DISPATCH_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end('Unauthorized');return}
    const id=decodeURIComponent(req.url.split('?')[0].slice('/api/agents/tasks/'.length));
    const task=outgoingTasks.get(id);res.writeHead(task?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify(task||{error:'Task not in active memory'}));return;
  }
  if(req.method==='GET'&&req.url?.startsWith('/api/agents/messages')){
    const url=new URL(req.url,'http://localhost');const after=Number(url.searchParams.get('after')||0);
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({messages:inbox.filter(m=>m.id>after).slice(-100)}));return;
  }
  if(req.method==='POST'&&req.url==='/api/agents/messages'){
    const token=process.env.AGENT_INGEST_TOKEN;
    if(!token||req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end('Unauthorized');return}
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)throw Error('Too large')}
      const payload=JSON.parse(raw);
      if(!agentNames.has(payload.agent)||typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>8000||!['Wszyscy',payload.agent].includes(payload.channel||payload.agent))throw Error('Invalid agent message');
      const taskId=typeof payload.taskId==='string'?payload.taskId:null;
      if(taskId){
       const task=outgoingTasks.get(taskId);
       if(!task||!task.mentions.includes(payload.agent.toLowerCase()))throw Error('Unknown task or agent');
      }
      const message={id:Date.now()*1000+Math.floor(Math.random()*1000),agent:payload.agent,channel:payload.channel||payload.agent,text:payload.text,taskId,timestamp:new Date().toISOString()};
      if(taskId){const task=outgoingTasks.get(taskId);outgoingTasks.set(taskId,{...task,status:'result-received',lastResultAt:message.timestamp});syncBroadcast('agent-task-result',{taskId,agent:payload.agent})}
      await appendFile(inboxPath,JSON.stringify(message)+'\n',{mode:0o600});
      inbox.push(message);if(inbox.length>500)inbox=inbox.slice(-500);
      syncBroadcast('agent-message',message);
      res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({accepted:true,id:message.id}));
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='GET'&&req.url==='/api/sync/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    syncClients.add(res);res.write('retry: 2000\\ndata: '+JSON.stringify({revision:syncRevision,type:'connected',timestamp:new Date().toISOString()})+'\\n\\n');
    req.on('close',()=>syncClients.delete(res));return;
  }
  if(req.method==='GET'&&['/','/index.html'].includes(req.url)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return}
  if(req.method==='GET'&&req.url==='/api/system/models'){
    try{
      const response=await fetch(endpoint+'/api/tags',{signal:AbortSignal.timeout(3500)});
      if(!response.ok)throw Error('Ollama HTTP '+response.status);
      const data=await response.json();const installed=new Set((data.models||[]).map(m=>m.name||m.model));
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({models:allowedModels.map(name=>({name,installed:installed.has(name)})),defaultModel:model,fallbackModel,ollamaConnected:true}));return;
    }catch(e){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({models:allowedModels.map(name=>({name,installed:null})),defaultModel:model,fallbackModel,ollamaConnected:false,error:e.message}));return}
  }
  if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return}
  if(req.method==='GET'&&req.url==='/api/diagnostics/live'){
    const check=async(url)=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(2200)});return {reachable:r.ok}}catch{return {reachable:false}}};
    const prom=process.env.PROMETHEUS_URL||'http://prometheus:9090';
    const [p,x,o]=await Promise.all([check(prom+'/api/v1/status/buildinfo'),check((process.env.PHOENIX_URL||'http://phoenix:6006')+'/'),check(endpoint+'/api/tags')]);
    const metrics={};
    if(p.reachable)for(const [key,q] of Object.entries({cpu:'100*(1-avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))',ram:'100*(1-node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes)'})){try{const r=await fetch(prom+'/api/v1/query?query='+encodeURIComponent(q),{signal:AbortSignal.timeout(2200)});const j=await r.json();const n=Number(j.data?.result?.[0]?.value?.[1]);metrics[key]=Number.isFinite(n)?Math.round(n*10)/10:null}catch{metrics[key]=null}}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({timestamp:new Date().toISOString(),services:{prometheus:p,phoenix:x,ollama:o},metrics}));return;
  }
  if(req.method==='POST'&&req.url==='/api/terminal/propose'){
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Too long')}
      const input=JSON.parse(raw);if(typeof input.prompt!=='string'||input.prompt.length>2000||!input.prompt.trim())throw Error('Invalid prompt');
      const r=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,think:false,format:'json',messages:[{role:'system',content:'Return JSON with command, explanation, risk. Propose one Ubuntu or Python command. Do not execute anything.'},{role:'user',content:input.prompt}],options:{num_predict:256}}),signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw Error('Ollama HTTP '+r.status);
      const data=JSON.parse((await r.json()).message.content);
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({command:String(data.command||'').slice(0,1500),explanation:String(data.explanation||'').slice(0,2000),risk:String(data.risk||'unknown'),executed:false,hostRootConnected:false}));syncBroadcast('terminal-proposal',{executed:false});
    }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/terminal/execute'){
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)throw Error('Too large')}
      const {operation}=JSON.parse(raw);if(typeof operation!=='string'||!Object.hasOwn(safeTerminalOperations,operation))throw Error('Operation is not allowlisted');const selected=safeTerminalOperations[operation];
      const {stdout,stderr}=await exec(selected.file,selected.args,{cwd:process.cwd(),timeout:10000,maxBuffer:32768,env:{PATH:process.env.PATH||'/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME||'/tmp'}});
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({executed:true,operation,command:selected.label,scope:'Codespaces container; host root is not connected',stdout:stdout.slice(0,24000),stderr:stderr.slice(0,8000)}));syncBroadcast('terminal-executed',{operation});
    }catch(e){const code=e.message==='Operation is not allowlisted'?400:503;res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify({executed:false,error:e.message,stdout:String(e.stdout||'').slice(0,24000),stderr:String(e.stderr||'').slice(0,8000)}))}return;
  }
  if(req.method==='POST'&&req.url==='/api/system/chat/stream'){
    let raw='';try{
      for await(const chunk of req){raw+=chunk;if(raw.length>32768)throw Error('Za długa wiadomość')}
      const payload=JSON.parse(raw);const message=payload.message;const requestedModel=payload.model==null?'':payload.model;
      if(typeof requestedModel!=='string'||(requestedModel&&!allowedModels.includes(requestedModel)))throw Error('Model nie jest dozwolony');
      if(typeof message!=='string'||!message.trim()||message.length>8000)throw Error('Nieprawidłowa wiadomość');
      const history=payload.history==null?[]:payload.history;
      if(!Array.isArray(history)||history.length>16||history.some(item=>!item||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||item.content.length>8000))throw Error('Nieprawidłowa historia rozmowy');
      const historyMessages=history.map(item=>({role:item.role,content:item.content}));
      if(historyMessages.reduce((size,item)=>size+item.content.length,0)>24000)throw Error('Historia rozmowy jest za długa');
      const activeModel=requestedModel||model;
      const diagnostic=await runDiagnostic(message);
      if(diagnostic!==null){res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('event: meta\ndata: '+JSON.stringify({model:'diagnostics',fallback:false,provider:'codespaces'})+'\n\n');res.write('event: delta\ndata: '+JSON.stringify({text:diagnostic})+'\n\n');res.write('event: complete\ndata: {}\n\n');res.end();return}
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),120000);timeout.unref();
      res.on('close',()=>{if(!res.writableEnded)controller.abort()});
      const requestBody=selectedModel=>JSON.stringify({model:selectedModel,stream:true,think:false,messages:[{role:'system',content:prompt},...historyMessages,{role:'user',content:message}],options:{num_predict:512}});
      let upstream,usedModel=activeModel,fallback=false;
      try{
        upstream=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:requestBody(activeModel),signal:controller.signal});
        if(!upstream.ok)throw Error('Ollama HTTP '+upstream.status);
      }catch(primaryError){
        if(controller.signal.aborted||fallbackModel===activeModel)throw primaryError;
        upstream=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:requestBody(fallbackModel),signal:controller.signal});
        if(!upstream.ok)throw Error('Fallback Ollama HTTP '+upstream.status);
        usedModel=fallbackModel;fallback=true;
      }
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      const send=(event,data)=>res.write('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');
      send('meta',{model:usedModel,fallback,provider:'ollama'});
      const decoder=new TextDecoder();let pending='';let completed=false;
      const consumeLine=line=>{
        if(!line.trim())return;
        const item=JSON.parse(line);
        if(item.error)throw Error(String(item.error).slice(0,500));
        const delta=item.message?.content;
        if(typeof delta==='string'&&delta)send('delta',{text:delta});
        if(item.done)completed=true;
      };
      for await(const chunk of upstream.body){
        pending+=decoder.decode(chunk,{stream:true});let newline;
        while((newline=pending.indexOf('\n'))!==-1){const line=pending.slice(0,newline);pending=pending.slice(newline+1);consumeLine(line)}
      }
      pending+=decoder.decode();if(pending.trim())consumeLine(pending);
      if(!completed)throw Error('Strumień Ollama zakończył się bez znacznika done');
      send('complete',{model:usedModel,fallback,provider:'ollama'});res.end();syncBroadcast('chat-completed',{model:usedModel,fallback,provider:'ollama'});
      clearTimeout(timeout);return;
    }catch(e){
      if(res.headersSent){if(!res.destroyed){res.write('event: error\ndata: '+JSON.stringify({error:e.message})+'\n\n');res.end()}}
      else{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
    }return;
  }
  if(req.method!=='POST'||req.url!=='/api/system/chat'){res.writeHead(404);res.end();return}
  let input='';try{
    for await(const chunk of req){input+=chunk;if(input.length>32768)throw Error('Za długa wiadomość')}
    const payload=JSON.parse(input);const message=payload.message;
    const requestedModel=payload.model==null?'':payload.model;
    if(typeof requestedModel!=='string'||(requestedModel&&!allowedModels.includes(requestedModel)))throw Error('Model nie jest dozwolony');
    const activeModel=requestedModel||model;
    if(typeof message!=='string'||!message.trim()||message.length>8000)throw Error('Nieprawidłowa wiadomość');
    const history=payload.history==null?[]:payload.history;
    if(!Array.isArray(history)||history.length>16||history.some(item=>!item||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||item.content.length>8000))throw Error('Nieprawidłowa historia rozmowy');
    const historyMessages=history.map(item=>({role:item.role,content:item.content}));
    if(historyMessages.reduce((size,item)=>size+item.content.length,0)>24000)throw Error('Historia rozmowy jest za długa');
    const diagnostic=await runDiagnostic(message);
    if(diagnostic!==null){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({text:diagnostic}));return}
    async function ask(selectedModel){
      const response=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:selectedModel,stream:false,think:false,messages:[{role:'system',content:prompt},...historyMessages,{role:'user',content:message}],options:{num_predict:256}}),signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('Ollama HTTP '+response.status);
      const data=await response.json();
      if(typeof data.message?.content!=='string'||!data.message.content.trim())throw Error('Brak odpowiedzi modelu');
      return data.message.content;
    }
    // Optional third-tier Gemini fallback; API key is never exposed to the browser.
    async function askGemini(){
      const key=process.env.GEMINI_API_KEY;
      if(!key)throw Error('GEMINI_API_KEY not configured');
      const geminiModel=process.env.GEMINI_FALLBACK_MODEL||'gemini-3.1-flash-lite';
      if(!/^[a-zA-Z0-9._-]+$/.test(geminiModel))throw Error('Invalid Gemini model name');
      const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(geminiModel)+':generateContent';
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:prompt}]},contents:[{role:'user',parts:[{text:message}]}],generationConfig:{maxOutputTokens:1024}}),signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw Error('Gemini HTTP '+response.status);
      const data=await response.json();
      const answer=(data.candidates?.[0]?.content?.parts||[]).map(part=>part.text||'').join('');
      if(!answer.trim())throw Error('Gemini returned an empty response');
      return {answer,geminiModel};
    }
    let text,usedModel=activeModel,fallback=false,provider='ollama';
    const failures=[];
    try{text=await ask(activeModel)}catch(primaryError){
      failures.push('Primary Ollama: '+primaryError.message);
      if(fallbackModel!==activeModel){
        try{text=await ask(fallbackModel);usedModel=fallbackModel;fallback=true}
        catch(fallbackError){failures.push('Fallback Ollama: '+fallbackError.message)}
      }
      if(text===undefined){
        if(process.env.GEMINI_FALLBACK_ENABLED==='true'&&process.env.GEMINI_API_KEY){
          try{const result=await askGemini();text=result.answer;usedModel=result.geminiModel;provider='gemini';fallback=true}
          catch(geminiError){failures.push('Gemini: '+geminiError.message)}
        }else failures.push('Gemini fallback disabled or key missing');
        if(text===undefined)throw Error('Brak dostępnego modelu: '+failures.join('; '));
      }
    }
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({text,model:usedModel,fallback,provider}));syncBroadcast('chat-completed',{model:usedModel,fallback,provider});
  }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
});
server.listen(3081,'0.0.0.0');
