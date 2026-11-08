(() => {
const nav=document.querySelector('.nav');
const main=document.querySelector('.main');
const operations=[
 {id:'kernel',label:'uname -a'},
 {id:'processes',label:'ps -ef'},
 {id:'disk',label:'df -h'},
 {id:'memory',label:'free -h'},
 {id:'workspace',label:'git status --short --branch'},
 {id:'containers',label:'docker compose ps'}
];

function addView(id,label,title){
 const button=document.createElement('button');button.type='button';button.dataset.view=id;button.textContent=label;nav.append(button);
 button.addEventListener('click',()=>{
  nav.querySelectorAll('[data-view]').forEach(item=>item.classList.toggle('active',item===button));
  document.querySelectorAll('.view').forEach(item=>item.classList.toggle('active',item.id===id));
 });
 const section=document.createElement('section');section.id=id;section.className='view';
 const panel=document.createElement('div');panel.className='panel';const heading=document.createElement('h2');heading.textContent=title;panel.append(heading);section.append(panel);main.append(section);return {button,panel,section};
}

const settings=addView('settings','⚙ Ustawienia','Integracje i ustawienia');
const statusButton=document.createElement('button');statusButton.type='button';statusButton.textContent='↻ Odśwież status';settings.panel.append(statusButton);
const statusGrid=document.createElement('div');statusGrid.className='telemetry-grid';statusGrid.setAttribute('aria-live','polite');settings.panel.append(statusGrid);
const settingsNote=document.createElement('p');settingsNote.className='muted';settingsNote.textContent='Sekrety ustawiaj wyłącznie w Codespaces Secrets lub lokalnym, ignorowanym pliku środowiskowym. Status „skonfigurowano” nie oznacza potwierdzonego połączenia.';settings.panel.append(settingsNote);

function renderStatus(name,label,detail,ok){
 const card=document.createElement('div');card.className='telemetry-tile';const title=document.createElement('h3');title.textContent=label;const state=document.createElement('span');state.className='telemetry-state '+(ok?'ok':'off');state.textContent=ok?'Połączony':'Niepołączony';const description=document.createElement('div');description.className='telemetry-meta';description.textContent=detail;card.append(title,state,description);statusGrid.append(card);
}

async function refreshStatus(){
 statusGrid.replaceChildren();
 try{
  const response=await fetch('/api/control/status',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();
  const modelList=data.ollama.models.length?data.ollama.models.join(', '):'brak pobranych modeli';
  renderStatus('ollama','Ollama',data.ollama.connected?modelList:(data.ollama.error||'API niedostępne'),data.ollama.connected);
  renderStatus('github','GitHub',data.github.connected?data.github.repository+' · '+data.github.defaultBranch:(data.github.error||'Brak tokenu GITHUB_TOKEN'),data.github.connected);
  renderStatus('openai','OpenAI API',data.openai.configured?data.openai.model+' · klucz niezweryfikowany':'Brak OPENAI_API_KEY',false);
    renderStatus('integrationsApi','Dostęp do API integracji',data.integrationsApi.configured?'INTEGRATIONS_TOKEN ustawiony':'Brak INTEGRATIONS_TOKEN; chronione endpointy API są niedostępne',data.integrationsApi.configured);
  renderStatus('gemini','Gemini fallback',data.gemini.configured?'Klucz skonfigurowany; połączenie niezweryfikowane':'Wyłączony lub brak GEMINI_API_KEY',false);
  renderStatus('codex','Codex','Brak podłączonego wykonawcy zadań',false);
  renderStatus('mcp','MCP',data.mcp.detail,false);
  for(const [agent,info] of Object.entries(data.agents))renderStatus(agent,agent[0].toUpperCase()+agent.slice(1),info.configured?'Endpoint skonfigurowany, niezweryfikowany':'Brak endpointu',info.connected);
  renderStatus('terminal','Terminal',data.terminal.operations.join(' · ')+' · '+data.terminal.scope+' · root hosta: niepodłączony',true);
 }catch(error){renderStatus('status','Status integracji','Nie udało się odczytać statusu: '+error.message,false)}
}
statusButton.addEventListener('click',refreshStatus);refreshStatus();

const logs=addView('logs','▤ Logi','Logi Control Center');
const logsButton=document.createElement('button');logsButton.type='button';logsButton.textContent='↻ Odśwież logi';logs.panel.append(logsButton);
const logOutput=document.createElement('pre');logOutput.className='terminal';logOutput.setAttribute('aria-live','polite');logOutput.textContent='Brak odczytanych logów';logs.panel.append(logOutput);
async function refreshLogs(){
 logOutput.textContent='Pobieranie logów…';
 try{const response=await fetch('/api/control/logs',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'HTTP '+response.status);logOutput.textContent=(data.lines||[]).join('\n')||'Brak wpisów w logu'}catch(error){logOutput.textContent='Nie udało się pobrać logów: '+error.message}
}
logsButton.addEventListener('click',refreshLogs);refreshLogs();

const terminalPanel=document.querySelector('#terminal .panel');
const terminalControls=document.createElement('div');terminalControls.className='telemetry-actions';
const operationSelect=document.createElement('select');operationSelect.setAttribute('aria-label','Zatwierdzona operacja terminala');operationSelect.style.cssText='max-width:100%;padding:10px';
for(const operation of operations){const option=document.createElement('option');option.value=operation.id;option.textContent=operation.label;operationSelect.append(option)}
const executeButton=document.createElement('button');executeButton.type='button';executeButton.textContent='Wykonaj odczyt w Codespaces';terminalControls.append(operationSelect,executeButton);
const executionOutput=document.createElement('pre');executionOutput.className='terminal';executionOutput.setAttribute('aria-live','polite');executionOutput.textContent='Wykonanie ograniczone do jawnie wybranego polecenia odczytowego.';
terminalPanel.append(terminalControls,executionOutput);
executeButton.addEventListener('click',async()=>{
 const selected=operations.find(operation=>operation.id===operationSelect.value);if(!selected||!window.confirm('Wykonać '+selected.label+' w kontenerze Codespaces? To nie użyje roota hosta.'))return;
 executeButton.disabled=true;executionOutput.textContent='Wykonywanie '+selected.label+'…';
 try{const response=await fetch('/api/terminal/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:selected.id})});const data=await response.json();if(!response.ok||!data.executed)throw Error(data.error||'Polecenie nie zostało wykonane');executionOutput.textContent='$ '+data.command+'\nZakres: '+data.scope+'\n\n'+(data.stdout||'')+(data.stderr?'\nSTDERR:\n'+data.stderr:'')}
 catch(error){executionOutput.textContent='Nie wykonano: '+error.message}finally{executeButton.disabled=false}
});
})();