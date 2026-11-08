(() => {
const historyKey='ai-linux-chat-history-v1';
const compose=document.getElementById('compose');
const promptField=document.getElementById('prompt');
const messages=document.getElementById('messages');
const toolbar=document.querySelector('.chat-tools');
const chatPanel=document.querySelector('.chat');
const modelSelect=document.getElementById('modelSelect');
const savedChats=()=>{try{return JSON.parse(localStorage.getItem(historyKey)||'[]')}catch{return[]}};
const makeId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2,8);
let activeId=makeId();
let activeAbort=null;
let attachments=[];

const historyButton=document.createElement('button');historyButton.type='button';historyButton.textContent='◷ Historia';historyButton.title='Historia zapisana lokalnie w tej przeglądarce';toolbar.append(historyButton);
const historyPanel=document.createElement('div');historyPanel.className='chat-history';historyPanel.hidden=true;historyPanel.setAttribute('aria-label','Lokalna historia rozmów');chatPanel.append(historyPanel);
const attachmentInput=document.createElement('input');attachmentInput.type='file';attachmentInput.multiple=true;attachmentInput.accept='.txt,.md,.csv,.json,.log,.py,.js,.ts,.jsx,.tsx,.html,.css,.yaml,.yml,.toml,.sh';attachmentInput.hidden=true;attachmentInput.setAttribute('aria-label','Wybierz pliki tekstowe');
const attachmentButton=document.createElement('button');attachmentButton.type='button';attachmentButton.textContent='＋ Plik';attachmentButton.title='Dołącz plik tekstowy (maks. 200 KB)';toolbar.append(attachmentButton,attachmentInput);
const stopButton=document.createElement('button');stopButton.type='button';stopButton.textContent='■ Zatrzymaj';stopButton.hidden=true;toolbar.append(stopButton);
const attachmentPreview=document.createElement('div');attachmentPreview.className='chat-attachment-preview';attachmentPreview.setAttribute('aria-live','polite');
const composer=compose.querySelector('div[style*="flex:1"]');composer.insertBefore(attachmentPreview,promptField);

function renderAttachments(){
 attachmentPreview.replaceChildren();
 for(const [index,item] of attachments.entries()){
  const card=document.createElement('div');card.className='chat-file';const name=document.createElement('strong');name.textContent=item.name+' · '+Math.ceil(item.size/1024)+' KB';const remove=document.createElement('button');remove.type='button';remove.textContent='Usuń';remove.addEventListener('click',()=>{attachments.splice(index,1);renderAttachments()});card.append(name,remove);
  const preview=document.createElement('pre');preview.textContent=item.text.slice(0,240)+(item.text.length>240?'…':'');card.append(preview);attachmentPreview.append(card);
 }
}
attachmentButton.addEventListener('click',()=>attachmentInput.click());
attachmentInput.addEventListener('change',async()=>{
 for(const file of attachmentInput.files||[]){
  if(attachments.length>=3){addMessage('Załączniki','Można dołączyć maksymalnie 3 pliki tekstowe.');break}
  if(file.size>200*1024){addMessage('Załączniki','Pominięto '+file.name+': limit wynosi 200 KB.');continue}
  try{const text=await file.text();if(attachments.reduce((sum,item)=>sum+item.text.length,0)+text.length>12000){addMessage('Załączniki','Pominięto '+file.name+': łączny limit treści to 12 000 znaków.');continue}attachments.push({name:file.name,size:file.size,text})}catch(error){addMessage('Załączniki','Nie można odczytać '+file.name+': '+error.message)}
 }
 attachmentInput.value='';renderAttachments();
});

function persistConversation(){
 if(!conversation.length)return;
 const records=savedChats().filter(item=>item.id!==activeId);
 records.unshift({id:activeId,title:(conversation.find(item=>item.who==='Ty')?.content||'Nowa rozmowa').replace(/\s+/g,' ').slice(0,72),channel,updatedAt:new Date().toISOString(),messages:conversation.slice(-40)});
 try{localStorage.setItem(historyKey,JSON.stringify(records.slice(0,10)))}catch(error){console.warn('Historia czatu nie została zapisana:',error)}
}
function restoreConversation(item){
 activeId=item.id;channel=item.channel||'System';conversation.splice(0,conversation.length,...item.messages);messages.replaceChildren();
 for(const message of conversation)addMessage(message.who,message.content,message.who==='Ty'?'user':'assistant');
 if(typeof drawChannels==='function')drawChannels();historyPanel.hidden=true;messages.scrollTop=messages.scrollHeight;
}
function renderHistory(){
 historyPanel.replaceChildren();const clearButton=document.createElement('button');clearButton.type='button';clearButton.className='chat-history-clear';clearButton.textContent='Wyczyść historię lokalną';clearButton.addEventListener('click',()=>{if(!window.confirm('Usunąć zapisane rozmowy z tej przeglądarki?'))return;localStorage.removeItem(historyKey);conversation.splice(0,conversation.length);messages.replaceChildren();addMessage('AI Linux','Historia lokalna została wyczyszczona.');activeId=makeId();historyPanel.hidden=true});historyPanel.append(clearButton);const records=savedChats();
 if(!records.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Brak zapisanych rozmów w tej przeglądarce.';historyPanel.append(empty);return}
 for(const item of records){const button=document.createElement('button');button.type='button';button.className='chat-history-item';const title=document.createElement('strong');title.textContent=item.title||'Rozmowa';const details=document.createElement('small');details.textContent=(item.channel||'System')+' · '+new Date(item.updatedAt).toLocaleString('pl-PL');button.append(title,details);button.addEventListener('click',()=>restoreConversation(item));historyPanel.append(button)}
}
historyButton.addEventListener('click',()=>{historyPanel.hidden=!historyPanel.hidden;if(!historyPanel.hidden)renderHistory()});
document.addEventListener('click',event=>{if(!historyPanel.contains(event.target)&&event.target!==historyButton)historyPanel.hidden=true});
document.getElementById('newChat').addEventListener('click',()=>{activeId=makeId();attachments=[];renderAttachments();historyPanel.hidden=true;setTimeout(persistConversation,0)});

const latest=savedChats()[0];
if(latest?.messages?.length)restoreConversation(latest);
const intro=[...messages.querySelectorAll('p')].find(node=>node.textContent.includes('Do rozmowy z działającym modelem'));
if(intro)intro.textContent='Pytaj lokalny model, dołączaj pliki tekstowe i kontynuuj wcześniejsze rozmowy. Odpowiedzi są przesyłane strumieniowo.';

function eventFromBlock(block,onMeta,onDelta,onComplete,onError){
 let name='message';const data=[];
 for(const line of block.split(/\r?\n/)){if(line.startsWith('event:'))name=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).trim())}
 if(!data.length)return;const payload=JSON.parse(data.join('\n'));
 if(name==='meta')onMeta(payload);else if(name==='delta')onDelta(payload.text||'');else if(name==='complete')onComplete(payload);else if(name==='error')onError(payload.error||'Błąd streamingu');
}
function historyForRequest(){
 let remaining=12000;const recent=[];
 for(const item of conversation.slice(-12).reverse()){
  if(remaining<=0)break;
  const content=String(item.content||'');const clipped=content.length>remaining?content.slice(-remaining):content;
  recent.push({role:item.who==='Ty'?'user':'assistant',content:clipped});remaining-=clipped.length;
 }
 return recent.reverse();
}

async function requestStream(message,history,answer){
 const response=await fetch('/api/system/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history,model:modelSelect.value}),signal:activeAbort.signal});
 if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'HTTP '+response.status)}
 const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',complete=false;
 while(true){
  const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()||'';
  for(const block of blocks)eventFromBlock(block,meta=>{answer.wrap.querySelector('strong').textContent='System AI · '+meta.model+(meta.fallback?' · fallback':'')},delta=>{answer.text+=delta;answer.body.innerHTML=markdown(answer.text);messages.scrollTop=messages.scrollHeight},()=>{complete=true},error=>{throw Error(error)});
 }
 if(buffer.trim())eventFromBlock(buffer,()=>{},delta=>{answer.text+=delta;answer.body.innerHTML=markdown(answer.text)},()=>{complete=true},error=>{throw Error(error)});
 if(!complete&&!activeAbort.signal.aborted)throw Error('Strumień zakończył się przedwcześnie');
}

async function requestJsonFallback(message,history,answer){
 const response=await fetch('/api/system/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history,model:modelSelect.value}),signal:activeAbort.signal});
 const data=await response.json();if(!response.ok)throw Error(data.error||'HTTP '+response.status);
 answer.text=data.text||'';answer.wrap.querySelector('strong').textContent='System AI · '+(data.model||'Ollama')+(data.fallback?' · fallback':'');answer.body.innerHTML=markdown(answer.text);
}

compose.addEventListener('submit',async event=>{
 const input=promptField.innerText.trim();if(channel!=='System'||!input||/@(?:aria|alex|astyria|aurelius)\b/i.test(input))return;
 event.preventDefault();event.stopImmediatePropagation();
 const attachmentText=attachments.map(item=>'[Załącznik: '+item.name.replace(/[^\w.-]/g,'_')+']\n'+item.text).join('\n\n');
 const message=attachmentText?input+'\n\n'+attachmentText:input;
 if(message.length>8000){addMessage('Załączniki','Wiadomość wraz z plikami przekracza limit 8000 znaków. Usuń plik lub skróć treść.');return}
 const history=historyForRequest();
 promptField.replaceChildren();conversation.push({who:'Ty',content:input+(attachments.length?'\n\nZałączniki: '+attachments.map(item=>item.name).join(', '):'')});addMessage('Ty',input+(attachments.length?'\n\n📎 '+attachments.map(item=>item.name).join(', '):''),'user');persistConversation();
 const answer=addMessage('System AI','Łączenie z Ollama…');answer.text='';activeAbort=new AbortController();stopButton.hidden=false;stopButton.disabled=false;
 stopButton.onclick=()=>{stopButton.disabled=true;activeAbort?.abort()};
 try{await requestStream(message,history,answer)}catch(error){
  if(activeAbort.signal.aborted){if(!answer.text)answer.text='Generowanie zatrzymane.'}
  else if(!answer.text){try{await requestJsonFallback(message,history,answer)}catch(fallbackError){answer.text='Błąd czatu: '+fallbackError.message}}
  else answer.text+='\n\n[Strumień przerwany: '+error.message+']';
  answer.body.innerHTML=markdown(answer.text);
 }finally{stopButton.hidden=true;activeAbort=null;attachments=[];renderAttachments();conversation.push({who:answer.wrap.querySelector('strong').textContent,content:answer.text});persistConversation();messages.scrollTop=messages.scrollHeight}
},true);
})();