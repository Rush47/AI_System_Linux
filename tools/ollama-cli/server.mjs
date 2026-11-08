import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const port = Number(process.env.NLP_CLI_PORT || 8765);
const ollama = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_MODEL || 'qwen3:8b';
const token = process.env.NLP_CLI_TOKEN;
if (!token) { console.error('Set NLP_CLI_TOKEN before starting'); process.exit(1); }
const jobs = new Map();
const autoExec = process.env.NLP_AUTO_EXEC === 'true';
if (autoExec && process.getuid?.() === 0) { console.error('AUTO-EXEC must not run as root'); process.exit(1); }
const runCommand = async command => {
  const child=spawn('bash',['-lc',command],{cwd:process.env.CLI_WORKDIR||process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,TERM:'dumb'},stdio:['ignore','pipe','pipe']});
  let output='',truncated=false;
  for(const stream of [child.stdout,child.stderr]) stream.on('data',b=>{if(output.length<60000) output+=b.toString().slice(0,60000-output.length); else truncated=true;});
  const timer=setTimeout(()=>child.kill('SIGKILL'),30000);
  const code=await new Promise(resolve=>child.on('close',resolve));
  clearTimeout(timer);
  return {exit_code:code,output,truncated,executed:true};
};
const reply = (res, code, data) => { res.writeHead(code, {'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(data)); };
const read = async req => { let s=''; for await (const c of req) { s += c; if(s.length>20000) throw Error('Request too large'); } return JSON.parse(s); };
const generate = async instruction => {
  const response = await fetch(ollama+'/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,stream:false,format:'json',prompt:'Translate the user instruction into ONE Bash command for the current Linux environment. Respond with JSON only: {"command":"...","explanation":"..."}. Do not execute it. User: '+instruction}),signal:AbortSignal.timeout(90000)});
  if(!response.ok) throw Error('Ollama HTTP '+response.status);
  const data = await response.json();
  const parsed = JSON.parse(data.response);
  if(typeof parsed.command!=='string' || !parsed.command.trim() || parsed.command.length>4000) throw Error('Invalid command');
  return {command:parsed.command,explanation:String(parsed.explanation||'').slice(0,2000)};
};

const hyperAnchors = {
  SYSTEM: 'aaaabbbbccccddddeeeeffff00001111',
  CHAT: '55556666777788889999aaaabbbbcccc',
  COMPUTE: '0f0f0f0f0f0f0f0ff0f0f0f0f0f0f0f0',
  DIAGNOSTIC: '3333333333333333cccccccccccccccc'
};
const bitDistance = (a,b) => { let x=a^b,n=0;while(x){n+=Number(x&1n);x>>=1n;}return n; };
const hyperspaceResolve = input => {
  // Stable 128-bit binary vector; diagnostic classification, not an LLM.
  const vector=BigInt('0x'+createHash('sha256').update(input).digest('hex').slice(0,32));
  const scores=Object.fromEntries(Object.entries(hyperAnchors).map(([name,hex])=>[name,1-bitDistance(vector,BigInt('0x'+hex))/128]));
  const intent=Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0];
  return {intent,score:scores[intent],scores,vector:vector.toString(2).padStart(128,'0')};
};
const hyperHistory=[];
const hyperPrompt = async (instruction, resolution) => {
  const response=await fetch(ollama+'/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,stream:false,prompt:'You are the AI Linux Binary Hyperspace Terminal. Answer in Polish. Explain real system operations accurately; never claim to have executed a command or accessed hardware. Classification metadata is diagnostic only: '+resolution.intent+'. User: '+instruction}),signal:AbortSignal.timeout(90000)});
  if(!response.ok) throw Error('Ollama HTTP '+response.status);
  const data=await response.json();
  return String(data.response||'').trim();
};

const server=http.createServer(async(req,res)=>{
  if(req.url==='/health') return reply(res,200,{status:'ok',model});
  if(req.headers.authorization!=='Bearer '+token) return reply(res,401,{error:'Unauthorized'});
  try {
    if(req.method==='GET' && req.url==='/api/hyperos/history') return reply(res,200,{success:true,history:hyperHistory.slice(-100)});
    if(req.method==='POST' && req.url==='/api/hyperos/console'){
      const {command}=await read(req);
      if(typeof command!=='string'||!command.trim()||command.length>2000) return reply(res,400,{error:'Polecenie musi mieć od 1 do 2000 znaków.'});
      const resolution=hyperspaceResolve(command.trim());
      const answer=await hyperPrompt(command.trim(),resolution);
      const item={id:randomUUID(),at:new Date().toISOString(),command:command.trim(),...resolution,reply:answer,nlpProvider:'Ollama ('+model+')',kernelOutput:null};
      hyperHistory.push(item);if(hyperHistory.length>100)hyperHistory.shift();
      return reply(res,200,{success:true,...item});
    }
    if(req.method==='POST' && req.url==='/api/plan'){
      const {instruction}=await read(req);
      if(typeof instruction!=='string'||!instruction.trim()||instruction.length>4000) return reply(res,400,{error:'Invalid instruction'});
      const plan=await generate(instruction);
      const id=randomUUID();
      jobs.set(id,{...plan,created:Date.now()});
      setTimeout(()=>jobs.delete(id),300000).unref();
      if (autoExec) {
        const result=await runCommand(plan.command);
        console.log(JSON.stringify({event:'auto_exec',id,command:plan.command,exit_code:result.exit_code,at:new Date().toISOString()}));
        jobs.delete(id);
        return reply(res,200,{id,...plan,requires_confirmation:false,...result});
      }
      return reply(res,200,{id,...plan,requires_confirmation:true,executed:false});
    }
    if(req.method==='POST' && req.url==='/api/execute'){
      const {id,command,confirm}=await read(req);
      const job=jobs.get(id);
      if(!job||Date.now()-job.created>300000||confirm!==true||command!==job.command) return reply(res,400,{error:'Explicit confirmation of exact command required'});
      jobs.delete(id);
      return reply(res,200,await runCommand(job.command));
    }
    reply(res,404,{error:'Not found'});
  }catch(e){reply(res,500,{error:String(e.message||e)});}
});
server.listen(port,'127.0.0.1',()=>console.log('AI Linux NLP CLI on localhost:'+port));
