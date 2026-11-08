import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { chmod, readFile as readStored, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const publicBase = (process.env.MCP_PUBLIC_BASE_URL || (process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-3082.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev'}`
  : 'http://127.0.0.1:3082')).replace(/\/$/, '');
const publicUrl = new URL(publicBase);
if (publicUrl.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(publicUrl.hostname)) {
  throw new Error('MCP_PUBLIC_BASE_URL must use HTTPS outside localhost');
}
const resource = publicBase + '/mcp';
const internalMcpUrl = process.env.MCP_INTERNAL_URL || 'http://127.0.0.1:3081/mcp';
const operatorToken = process.env.MCP_AUTH_TOKEN || '';
const terminalToken = process.env.MCP_TERMINAL_TOKEN || '';
if (!operatorToken || !terminalToken || operatorToken === terminalToken) {
  throw new Error('Distinct MCP_AUTH_TOKEN and MCP_TERMINAL_TOKEN are required');
}

const clients = new Map();
const authorizationCodes = new Map();
const accessTokens = new Map();
const refreshTokens = new Map();
const csrfForms = new Map();
const loginFailures = new Map();
const statePath = resolve(process.env.MCP_OAUTH_STATE_PATH || '.mcp-oauth-state.json');
let stateWrite = Promise.resolve();
const ttl = { code: 5 * 60_000, access: 15 * 60_000, refresh: 30 * 24 * 60 * 60_000, csrf: 5 * 60_000 };
const scopes = new Set(['mcp:operator', 'mcp:terminal']);

try {
  const saved = JSON.parse(await readStored(statePath, 'utf8'));
  for (const client of saved.clients || []) {
    if (typeof client.id === 'string' && Array.isArray(client.redirectUris) && client.redirectUris.every(publicRedirectUri)) clients.set(client.id, client);
  }
  for (const [token, session] of saved.refreshTokens || []) {
    if (typeof token === 'string' && clients.has(session.clientId) && session.expiresAt > Date.now() && session.scope.split(/\s+/).every(scope => scopes.has(scope))) refreshTokens.set(token, session);
  }
  await chmod(statePath, 0o600);
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('Unable to load persisted OAuth clients/tokens');
}

async function persistOAuthState() {
  const snapshot = JSON.stringify({ clients: [...clients.values()], refreshTokens: [...refreshTokens.entries()] }) + '\n';
  stateWrite = stateWrite.then(async () => {
    const temp = statePath + '.' + process.pid + '.' + randomToken(6) + '.tmp';
    await writeFile(temp, snapshot, { mode: 0o600 });
    await rename(temp, statePath);
    await chmod(statePath, 0o600);
  });
  await stateWrite;
}

function randomToken(bytes = 32) { return randomBytes(bytes).toString('base64url'); }
function constantEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
function json(res, status, value, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}
function text(res, status, value, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(value);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function parseScope(value) {
  const result = [...new Set(String(value || '').split(/\s+/).filter(Boolean))];
  return result.length ? result : ['mcp:operator'];
}
function publicRedirectUri(uri) {
  try {
    const parsed = new URL(uri);
    return !parsed.username && !parsed.password && !parsed.hash && (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)));
  } catch { return false; }
}
async function readForm(req, maxBytes = 16_384) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}
async function readJson(req, maxBytes = 32_768) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function sendOAuthError(res, status, error, description) {
  json(res, status, { error, error_description: description });
}
function clientFor(id, redirectUri) {
  const client = clients.get(id);
  return client && client.redirectUris.includes(redirectUri) ? client : null;
}
function csrfHtml(params, clientName, message = '') {
  const now = Date.now();
  for (const [key, value] of csrfForms) if (value.expiresAt < now) csrfForms.delete(key);
  if (csrfForms.size >= 2000) return null;
  const csrf = randomToken(24);
  csrfForms.set(csrf, { ...params, expiresAt: Date.now() + ttl.csrf });
  const requested = parseScope(params.scope);
  const terminalChecked = requested.includes('mcp:terminal');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize AI Linux MCP</title><style>body{font:16px system-ui;background:#0b1118;color:#e8f0f5;max-width:560px;margin:8vh auto;padding:24px}form{display:grid;gap:14px}input{padding:12px;background:#111b25;border:1px solid #536775;border-radius:8px;color:inherit}button{padding:12px;background:#167b89;border:0;border-radius:8px;color:white;font-weight:700}label{display:grid;gap:7px}.scope{display:flex;align-items:center;gap:9px}.note{color:#a7bac5;font-size:13px}</style><h1>Authorize AI Linux MCP</h1><p>${escapeHtml(clientName)} requests access to this Codespace.</p>${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}<form method="post" action="/authorize"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}"><input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}"><input type="hidden" name="response_type" value="code"><input type="hidden" name="state" value="${escapeHtml(params.state)}"><input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}"><input type="hidden" name="code_challenge_method" value="S256"><input type="hidden" name="resource" value="${escapeHtml(params.resource)}"><label class="scope"><input type="checkbox" name="scope" value="mcp:operator" ${requested.includes('mcp:operator') ? 'checked' : ''}> Read status and dispatch agent tasks</label><label class="scope"><input type="checkbox" name="scope" value="mcp:terminal" ${terminalChecked ? 'checked' : ''}> Read-only diagnostic terminal (separate credential required)</label><label>Operator authorization token<input type="password" name="operator_token" autocomplete="current-password" required></label><label>Terminal token (required only when granting terminal scope)<input type="password" name="terminal_token" autocomplete="off"></label><p class="note">Tokens stay in this Codespace. The terminal is an allowlist of read-only diagnostics; there is no shell or host-root access.</p><button type="submit">Authorize</button></form></html>`;
}
function markLoginFailure(ip) {
 const now = Date.now();
 const values = (loginFailures.get(ip) || []).filter(time => now - time < 10 * 60_000);
 values.push(now);loginFailures.set(ip, values);return values.length;
}
function isRateLimited(ip) {
 const values = (loginFailures.get(ip) || []).filter(time => Date.now() - time < 10 * 60_000);
 loginFailures.set(ip, values);return values.length >= 10;
}
async function internalMcp(body, token, method = 'POST') {
 let response;
 try { response = await fetch(internalMcpUrl, {
  method,
  headers: { authorization: 'Bearer '+token, accept: 'application/json, text/event-stream', ...(body ? { 'content-type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
  signal: AbortSignal.timeout(30_000),
  redirect: 'error',
 }); } catch { return { status: 502, headers: new Headers(), value: { error: 'Private MCP backend unavailable' } }; }
 const contentType = response.headers.get('content-type') || '';
 if (!contentType.includes('text/event-stream')) return { status: response.status, headers: response.headers, value: await response.json().catch(() => null) };
 const output = await response.text();
 const dataLine = output.split(/\r?\n/).find(line => line.startsWith('data:'));
 return { status: response.status, headers: response.headers, value: dataLine ? JSON.parse(dataLine.slice(5).trim()) : null };
}
function serveMcp(res, status, value) {
 json(res, status, value);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  const url = new URL(req.url, publicBase);
  const ip = req.socket.remoteAddress || 'unknown';

  if (req.method === 'GET' && url.pathname === '/health') { json(res, 200, { ok: true, issuer: publicBase }); return; }
  if (req.method === 'GET' && (url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === '/.well-known/oauth-protected-resource/mcp')) {
    json(res, 200, { resource, authorization_servers: [publicBase], bearer_methods_supported: ['header'], scopes_supported: [...scopes] }); return;
  }
  if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
    json(res, 200, { issuer: publicBase, authorization_endpoint: publicBase+'/authorize', token_endpoint: publicBase+'/token', registration_endpoint: publicBase+'/register', response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: [...scopes], authorization_response_iss_parameter_supported: true }); return;
  }
  if (req.method === 'POST' && url.pathname === '/register') {
    let data;
    try { data = await readJson(req); } catch { sendOAuthError(res, 400, 'invalid_client_metadata', 'Expected a JSON client registration request.'); return; }
    if (clients.size >= 1000) { sendOAuthError(res, 429, 'rate_limited', 'Client registration limit reached.'); return; }
    const redirectUris = data.redirect_uris;
    if (!Array.isArray(redirectUris) || !redirectUris.length || redirectUris.length > 10 || redirectUris.some(uri => typeof uri !== 'string' || !publicRedirectUri(uri))) { sendOAuthError(res, 400, 'invalid_redirect_uri', 'Only exact HTTPS or loopback redirect URIs are accepted.'); return; }
    if (data.token_endpoint_auth_method && data.token_endpoint_auth_method !== 'none') { sendOAuthError(res, 400, 'invalid_client_metadata', 'This gateway registers public PKCE clients only.'); return; }
    const id = randomToken(24);
    clients.set(id, { id, name: String(data.client_name || 'MCP client').slice(0, 120), redirectUris: [...new Set(redirectUris)], createdAt: Date.now() });
    try { await persistOAuthState(); } catch { clients.delete(id); sendOAuthError(res, 500, 'server_error', 'Unable to persist OAuth client.'); return; }
    json(res, 201, { client_id: id, client_id_issued_at: Math.floor(Date.now()/1000), redirect_uris: clients.get(id).redirectUris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }); return;
  }
  if (req.method === 'GET' && url.pathname === '/authorize') {
    const params = { clientId:url.searchParams.get('client_id')||'', redirectUri:url.searchParams.get('redirect_uri')||'', state:url.searchParams.get('state')||'', codeChallenge:url.searchParams.get('code_challenge')||'', scope:url.searchParams.get('scope')||'mcp:operator', resource:url.searchParams.get('resource')||resource, ip };
    const client=clientFor(params.clientId,params.redirectUri);const requested=parseScope(params.scope);
    if(url.searchParams.get('response_type')!=='code'||!client||!params.state||params.state.length>512||!/^[-A-Za-z0-9._~]{43,128}$/.test(params.codeChallenge)||url.searchParams.get('code_challenge_method')!=='S256'||params.resource!==resource||requested.some(scope=>!scopes.has(scope))){sendOAuthError(res,400,'invalid_request','Authorization Code with PKCE S256 and a registered redirect URI is required.');return}
    if(isRateLimited(ip)){sendOAuthError(res,429,'slow_down','Too many authorization attempts.');return}
    const form=csrfHtml(params,client.name);if(!form){sendOAuthError(res,429,'slow_down','Too many pending authorization forms.');return}
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(form);return;
  }
  if (req.method === 'POST' && url.pathname === '/authorize') {
    let form;try{form=await readForm(req)}catch{sendOAuthError(res,400,'invalid_request','Invalid form body.');return}
    const csrf=form.get('csrf')||'';const saved=csrfForms.get(csrf);csrfForms.delete(csrf);
    const clientId=form.get('client_id')||'';const redirectUri=form.get('redirect_uri')||'';const client=clientFor(clientId,redirectUri);
    const request={clientId,redirectUri,state:form.get('state')||'',codeChallenge:form.get('code_challenge')||'',scope:form.getAll('scope').filter(scope=>scopes.has(scope)).join(' '),resource:form.get('resource')||resource,ip};
    if(!saved||saved.expiresAt<Date.now()||!client||saved.clientId!==clientId||saved.redirectUri!==redirectUri||saved.state!==request.state||saved.codeChallenge!==request.codeChallenge||request.resource!==resource){sendOAuthError(res,400,'invalid_request','Authorization form expired or did not match the request.');return}
    const submittedScopes=form.getAll('scope').filter(scope=>scopes.has(scope));
    const requested=parseScope(saved.scope);const granted=[...new Set(submittedScopes)];
    if(!granted.length||granted.some(scope=>!requested.includes(scope))){const form=csrfHtml(saved,client.name,'Choose at least one requested scope.');if(!form){sendOAuthError(res,429,'slow_down','Too many pending authorization forms.');return}res.writeHead(400,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(form);return}
    if(isRateLimited(ip)){sendOAuthError(res,429,'slow_down','Too many authorization attempts.');return}
    const operatorOk=!granted.includes('mcp:operator')||constantEqual(form.get('operator_token'),operatorToken);
    const terminalOk=!granted.includes('mcp:terminal')||constantEqual(form.get('terminal_token'),terminalToken);
    if(!operatorOk||!terminalOk){markLoginFailure(ip);const form=csrfHtml(saved,client.name,'Authorization token did not match.');if(!form){sendOAuthError(res,429,'slow_down','Too many pending authorization forms.');return}res.writeHead(401,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(form);return}
    loginFailures.delete(ip);
    const code=randomToken();authorizationCodes.set(code,{clientId,redirectUri,codeChallenge:saved.codeChallenge,scope:granted.join(' '),resource,expiresAt:Date.now()+ttl.code});
    const callback=new URL(redirectUri);callback.searchParams.set('code',code);callback.searchParams.set('state',saved.state);callback.searchParams.set('iss',publicBase);
    res.writeHead(303,{location:callback.toString(),'cache-control':'no-store'});res.end();return;
  }
  if (req.method === 'POST' && url.pathname === '/token') {
    let form;try{form=await readForm(req)}catch{sendOAuthError(res,400,'invalid_request','Expected form-encoded token request.');return}
    const grant=form.get('grant_type');const clientId=form.get('client_id')||'';const client=clients.get(clientId);
    if(!client||form.get('client_secret')){sendOAuthError(res,401,'invalid_client','Unknown public client.');return}
    if(grant==='authorization_code'){
      const codeValue=form.get('code')||'';const code=authorizationCodes.get(codeValue);authorizationCodes.delete(codeValue);
      const verifier=form.get('code_verifier')||'';const challenge=createHash('sha256').update(verifier).digest('base64url');
      if(!code||code.expiresAt<Date.now()||code.clientId!==clientId||code.redirectUri!==form.get('redirect_uri')||!/^[-A-Za-z0-9._~]{43,128}$/.test(verifier)||!constantEqual(challenge,code.codeChallenge)||((form.get('resource')||resource)!==code.resource)){sendOAuthError(res,400,'invalid_grant','Authorization code, redirect URI, PKCE verifier, or resource is invalid.');return}
      const access=randomToken();const refresh=randomToken();const accessExpires=Date.now()+ttl.access;
      const session={clientId,scope:code.scope,resource:code.resource,expiresAt:accessExpires};accessTokens.set(access,session);refreshTokens.set(refresh,{...session,expiresAt:Date.now()+ttl.refresh});
      try { await persistOAuthState(); } catch { accessTokens.delete(access);refreshTokens.delete(refresh);sendOAuthError(res,500,'server_error','Unable to persist refresh token.');return; }
      json(res,200,{access_token:access,token_type:'Bearer',expires_in:Math.floor(ttl.access/1000),refresh_token:refresh,scope:code.scope,resource:code.resource});return;
    }
    if(grant==='refresh_token'){
      const refresh=form.get('refresh_token')||'';const prior=refreshTokens.get(refresh);
      if(!prior||prior.expiresAt<Date.now()||prior.clientId!==clientId||(form.get('resource')&&form.get('resource')!==prior.resource)){sendOAuthError(res,400,'invalid_grant','Refresh token is invalid, expired, or bound to another resource.');return}
      refreshTokens.delete(refresh);
      const access=randomToken();const nextRefresh=randomToken();const accessExpires=Date.now()+ttl.access;
      accessTokens.set(access,{...prior,expiresAt:accessExpires});refreshTokens.set(nextRefresh,{...prior,expiresAt:Date.now()+ttl.refresh});
      try { await persistOAuthState(); } catch { accessTokens.delete(access);refreshTokens.delete(nextRefresh);refreshTokens.set(refresh,prior);sendOAuthError(res,500,'server_error','Unable to rotate refresh token.');return; }
      json(res,200,{access_token:access,token_type:'Bearer',expires_in:Math.floor(ttl.access/1000),refresh_token:nextRefresh,scope:prior.scope,resource:prior.resource});return;
    }
    sendOAuthError(res,400,'unsupported_grant_type','Only authorization_code and refresh_token are supported.');return;
  }
  if (url.pathname === '/mcp' && ['GET','POST','DELETE'].includes(req.method)) {
    const metadata=publicBase+'/.well-known/oauth-protected-resource/mcp';
    const bearer=(req.headers.authorization||'').startsWith('Bearer ')?req.headers.authorization.slice(7):'';
    const session=accessTokens.get(bearer);
    if(!session||session.expiresAt<Date.now()||session.resource!==resource){accessTokens.delete(bearer);json(res,401,{error:'invalid_token'},{'www-authenticate':`Bearer resource_metadata="${metadata}"`});return}
    if(req.method!=='POST'){
      await relayMcp(req,res,session,null);
      return;
    }
    let body;try{body=await readJson(req)}catch{json(res,400,{error:'invalid_request'});return}
    const granted=new Set(session.scope.split(/\s+/));
    const tool=body.method==='tools/call'?body.params?.name:'';
    if(['send_message','create_task'].includes(tool)&&!granted.has('mcp:operator')){json(res,403,{error:'insufficient_scope',scope:'mcp:operator'});return}
    if(tool==='terminal_execute'&&!granted.has('mcp:terminal')){json(res,403,{error:'insufficient_scope',scope:'mcp:terminal'});return}
    if(body.method==='tools/list'&&granted.has('mcp:operator')&&granted.has('mcp:terminal')){
      const [operatorResponse,terminalResponse]=await Promise.all([internalMcp(body,operatorToken),internalMcp(body,terminalToken)]);
      const operatorResult=operatorResponse.value;const terminalResult=terminalResponse.value;
      if(operatorResponse.status<200||operatorResponse.status>=300||!operatorResult?.result?.tools){serveMcp(res,operatorResponse.status||502,operatorResult||{error:'MCP tools/list failed'});return}
      const operatorTools=operatorResult.result.tools;const terminalTools=terminalResult?.result?.tools||[];const names=new Set(operatorTools.map(item=>item.name));
      operatorResult.result.tools=[...operatorTools,...terminalTools.filter(item=>!names.has(item.name))];serveMcp(res,200,operatorResult);return;
    }
    await relayMcp(req,res,session,body);return;
  }
  if (url.pathname === '/mcp') { res.writeHead(405,{'allow':'GET, POST, DELETE'});res.end();return; }
  text(res,404,'Not found');
});

async function relayMcp(req,res,session,body){
  const scope=new Set(session.scope.split(/\s+/));
  const tool=body?.method==='tools/call'?body.params?.name:'';
  const token=tool==='terminal_execute'&&scope.has('mcp:terminal')?terminalToken:scope.has('mcp:operator')?operatorToken:terminalToken;
  let response;
  try { response=await fetch(internalMcpUrl,{method:req.method,headers:{authorization:'Bearer '+token,accept:req.headers.accept||'application/json, text/event-stream',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000),redirect:'error'}); }
  catch { json(res,502,{error:'Private MCP backend unavailable'});return; }
  res.writeHead(response.status,{'content-type':response.headers.get('content-type')||'application/json','cache-control':'no-store'});
  if(response.body){for await(const chunk of response.body)if(!res.destroyed)res.write(chunk)}
  if(!res.writableEnded)res.end();
}

server.listen(Number(process.env.MCP_GATEWAY_PORT||3082),'0.0.0.0',()=>console.log(`[oauth-mcp] listening at ${publicBase}/mcp`));