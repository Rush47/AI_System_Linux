import {appendFile,readFile as readStored} from 'node:fs/promises';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const page=await readFile(new URL('./index.html',import.meta.url));
const model=process.env.SYSTEM_AI_MODEL||'thox-ai/thoxopen-8b-heretic:q4_k_m';
const fallbackModel=process.env.SYSTEM_AI_FALLBACK_MODEL||'maternion/spark-x2.5-heretic:4b';
const endpoint=process.env.OLLAMA_URL||'http://ollama:11434';
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
async function runDiagnostic(message){
  const command=diagnostics[message.trim().toLowerCase()];
  if(!command)return null;
  const {stdout}=await exec(command[0],command[1],{timeout:5000,maxBuffer:32768,env:{PATH:'/usr/bin:/bin'}});
  return 'Diagnostyka kontenera Control Center (nie hosta Ubuntu):\\n'+stdout.slice(0,12000);
}
const agentNames=new Set(['Aria','Alex','Astyria','Aurelius']);
const inboxPath=process.env.AGENT_INBOX_PATH||'/tmp/ai-linux-agent-inbox.jsonl';
let inbox=[];
try{inbox=(await readStored(inboxPath,'utf8')).split('\\n').filter(Boolean).slice(-500).map(line=>JSON.parse(line))}catch(e){if(e.code!=='ENOENT')console.error('Agent inbox unavailable:',e.message)}
const syncClients=new Set();let syncRevision=0;
function syncBroadcast(type,details={}) {
 const event=JSON.stringify({revision:++syncRevision,type,details,timestamp:new Date().toISOString()});
 for(const client of syncClients){try{client.write('id: '+syncRevision+'\\ndata: '+event+'\\n\\n')}catch{syncClients.delete(client)}}
}
const syncHeartbeat=setInterval(()=>{for(const client of syncClients){try{client.write(': heartbeat\\n\\n')}catch{syncClients.delete(client)}}},20000);
syncHeartbeat.unref();
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
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
      const message={id:Date.now()*1000+Math.floor(Math.random()*1000),agent:payload.agent,channel:payload.channel||payload.agent,text:payload.text,timestamp:new Date().toISOString()};
      await appendFile(inboxPath,JSON.stringify(message)+'\\n',{mode:0o600});
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
      const r=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,format:'json',messages:[{role:'system',content:'Return JSON with command, explanation, risk. Propose one Ubuntu or Python command. Do not execute anything.'},{role:'user',content:input.prompt}]}),signal:AbortSignal.timeout(45000)});
      if(!r.ok)throw Error('Ollama HTTP '+r.status);
      const data=JSON.parse((await r.json()).message.content);
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({command:String(data.command||'').slice(0,1500),explanation:String(data.explanation||'').slice(0,2000),risk:String(data.risk||'unknown'),executed:false,hostRootConnected:false}));syncBroadcast('terminal-proposal',{executed:false});
    }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}return;
  }
  if(req.method!=='POST'||req.url!=='/api/system/chat'){res.writeHead(404);res.end();return}
  let input='';try{
    for await(const chunk of req){input+=chunk;if(input.length>16384)throw Error('Za długa wiadomość')}
    const payload=JSON.parse(input);const message=payload.message;
    const requestedModel=payload.model==null?'':payload.model;
    if(typeof requestedModel!=='string'||(requestedModel&&!allowedModels.includes(requestedModel)))throw Error('Model nie jest dozwolony');
    const activeModel=requestedModel||model;
    if(typeof message!=='string'||!message.trim()||message.length>8000)throw Error('Nieprawidłowa wiadomość');
    const diagnostic=await runDiagnostic(message);
    if(diagnostic!==null){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({text:diagnostic}));return}
    async function ask(selectedModel){
      const response=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:selectedModel,stream:false,messages:[{role:'system',content:prompt},{role:'user',content:message}],options:{num_predict:1024}}),signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw Error('Ollama HTTP '+response.status);
      const data=await response.json();
      if(typeof data.message?.content!=='string'||!data.message.content.trim())throw Error('Brak odpowiedzi modelu');
      return data.message.content;
    }
    let text,usedModel=activeModel,fallback=false;
    try{text=await ask(activeModel)}catch(primaryError){
      if(fallbackModel===activeModel)throw primaryError;
      try{text=await ask(fallbackModel);usedModel=fallbackModel;fallback=true}
      catch(fallbackError){throw Error('Wybrany model i model awaryjny niedostępne: '+primaryError.message+'; '+fallbackError.message)}
    }
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({text,model:usedModel,fallback}));syncBroadcast('chat-completed',{model:usedModel,fallback});
  }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
});
server.listen(3081,'0.0.0.0');
