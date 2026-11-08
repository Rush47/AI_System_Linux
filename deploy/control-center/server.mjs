import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const page=await readFile(new URL('./index.html',import.meta.url));
const model=process.env.SYSTEM_AI_MODEL||'thox-ai/thoxopen-8b-heretic:q4_k_m';
const fallbackModel=process.env.SYSTEM_AI_FALLBACK_MODEL||'maternion/spark-x2.5-heretic:4b';
const endpoint=process.env.OLLAMA_URL||'http://ollama:11434';
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
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&['/','/index.html'].includes(req.url)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return}
  if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return}
  if(req.method!=='POST'||req.url!=='/api/system/chat'){res.writeHead(404);res.end();return}
  let input='';try{
    for await(const chunk of req){input+=chunk;if(input.length>16384)throw Error('Za długa wiadomość')}
    const message=JSON.parse(input).message;
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
    let text,usedModel=model,fallback=false;
    try{text=await ask(model)}catch(primaryError){
      if(fallbackModel===model)throw primaryError;
      try{text=await ask(fallbackModel);usedModel=fallbackModel;fallback=true}
      catch(fallbackError){throw Error('Model 8B i awaryjny 4B niedostępne: '+primaryError.message+'; '+fallbackError.message)}
    }
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({text,model:usedModel,fallback}));
  }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
});
server.listen(3081,'0.0.0.0');
