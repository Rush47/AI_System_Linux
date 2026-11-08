import http from 'node:http';
import { spawn } from 'node:child_process';
const port = Number(process.env.NLP_CLI_PORT || 8765);
const ollama = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_MODEL || 'qwen3:8b';
const token = process.env.NLP_CLI_TOKEN;
if (!token) { console.error('Set NLP_CLI_TOKEN before starting'); process.exit(1); }
const jobs = new Map();
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
const server=http.createServer(async(req,res)=>{
  if(req.url==='/health') return reply(res,200,{status:'ok',model});
  if(req.headers.authorization!=='Bearer '+token) return reply(res,401,{error:'Unauthorized'});
  try {
    if(req.method==='POST' && req.url==='/api/plan'){
      const {instruction}=await read(req);
      if(typeof instruction!=='string'||!instruction.trim()||instruction.length>4000) return reply(res,400,{error:'Invalid instruction'});
      const plan=await generate(instruction);
      const id=crypto.randomUUID();
      jobs.set(id,{...plan,created:Date.now()});
      setTimeout(()=>jobs.delete(id),300000).unref();
      return reply(res,200,{id,...plan,requires_confirmation:true,executed:false});
    }
    if(req.method==='POST' && req.url==='/api/execute'){
      const {id,command,confirm}=await read(req);
      const job=jobs.get(id);
      if(!job||Date.now()-job.created>300000||confirm!==true||command!==job.command) return reply(res,400,{error:'Explicit confirmation of exact command required'});
      jobs.delete(id);
      const child=spawn('bash',['-lc',job.command],{cwd:process.env.CLI_WORKDIR||process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,TERM:'dumb'},stdio:['ignore','pipe','pipe']});
      let output='',truncated=false;
      for(const stream of [child.stdout,child.stderr]) stream.on('data',b=>{if(output.length<60000) output+=b.toString().slice(0,60000-output.length); else truncated=true;});
      const timer=setTimeout(()=>child.kill('SIGKILL'),30000);
      const code=await new Promise(resolve=>child.on('close',resolve));
      clearTimeout(timer);
      return reply(res,200,{exit_code:code,output,truncated,executed:true});
    }
    reply(res,404,{error:'Not found'});
  }catch(e){reply(res,500,{error:String(e.message||e)});}
});
server.listen(port,'127.0.0.1',()=>console.log('AI Linux NLP CLI on localhost:'+port));
