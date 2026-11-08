// AI Linux external integrations: server-side only, no browser API keys.
const timeout=ms=>AbortSignal.timeout(ms);
export async function integrationStatus(){
 const github=Boolean(process.env.GITHUB_TOKEN);
 const openai=Boolean(process.env.OPENAI_API_KEY);
 return {openai:{configured:openai,verified:false},github:{configured:github,verified:false,repository:process.env.GITHUB_REPOSITORY||'Rush47/AI_System_Linux'},codex:{configured:false,verified:false,reason:'Codex task execution requires a separately connected supported runtime'},chatgpt:{configured:false,verified:false,reason:'ChatGPT account sessions are not interchangeable with OpenAI API credentials'}};
}
export async function openaiChat(message){
 if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY not configured');
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',instructions:'You are an AI Linux assistant. Do not claim to execute system actions or impersonate the original agents. Answer in Polish.',input:message,max_output_tokens:1200}),signal:timeout(45000),redirect:'error'});
 const data=await response.json();
 if(!response.ok)throw Error('OpenAI HTTP '+response.status+': '+String(data.error?.message||'request failed').slice(0,180));
 const text=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
 return {text:text||'Model nie zwrócił tekstu',model:data.model||process.env.OPENAI_MODEL||'gpt-4.1-mini',responseId:data.id};
}
export async function githubRepoStatus(){
 const token=process.env.GITHUB_TOKEN;
 if(!token)throw Error('GITHUB_TOKEN not configured');
 const repository=process.env.GITHUB_REPOSITORY||'Rush47/AI_System_Linux';
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw Error('Invalid GITHUB_REPOSITORY');
 const response=await fetch('https://api.github.com/repos/'+repository,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'ai-linux-control-center'},signal:timeout(12000),redirect:'error'});
 if(!response.ok)throw Error('GitHub HTTP '+response.status);
 const data=await response.json();
 return {repository:data.full_name,private:data.private,defaultBranch:data.default_branch,updatedAt:data.updated_at,openIssues:data.open_issues_count,url:data.html_url};
}
