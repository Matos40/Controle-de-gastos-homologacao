export function bindRecovery(invoice,dialog){
 const input=document.getElementById('geminiApiKeyInput');
 input.disabled=true;input.placeholder='Configuração simulada';
 const link=dialog.querySelector('a[href]');
 link?.removeAttribute('href');
 const note=document.createElement('p');note.textContent='Recuperação simulada. Nenhuma chave é solicitada ou usada.';
 input.before(note);
 let back=false;
 function open(){
  back=!invoice.chooser.closest('#ocrModal').classList.contains('hidden');
  if(back&&!invoice.close({restoreFocus:false})){back=false;return;}
  dialog.classList.remove('hidden');
 }
 function close(){
  dialog.classList.add('hidden');
  if(back){back=false;invoice.open();}
 }
 invoice.chooser.innerHTML='<button type="button" data-smart>Smart AI</button><button type="button" data-key>Chave API</button>';
 invoice.chooser.querySelector('[data-smart]').onclick=()=>{invoice.content.hidden=false;};
 invoice.chooser.querySelector('[data-key]').onclick=open;
 Object.assign(globalThis,{openApiKeyModal:open,closeApiKeyModal:close,saveApiKey:close});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.classList.contains('hidden'))close();});
}

globalThis.raytechRecoveryBind=invoice=>bindRecovery(invoice,document.getElementById('apiKeyModal'));
