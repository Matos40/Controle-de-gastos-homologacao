import {mountSmartAI} from '../ux/smart-ai.mjs';
import {mountReview} from './review.mjs';

export function bindNativeInvoice({modal,apiKey,getIdToken,readCategories,confirm}){
 const get=id=>document.getElementById(id),getNode=(id,key)=>{const node=get(id);node.setAttribute('data-'+key,'');return node;};
 const input=getNode('invoiceFileInput','file'),send=getNode('ocrProcessBtn','send'),zone=get('ocrDropZone');
 const content=zone.parentElement;
 content.dataset.form='';
 input.removeAttribute('onchange');send.removeAttribute('onclick');
 const modalHeading=modal.querySelector('h3');
 modalHeading.id='nativeInvoiceTitle';
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby',modalHeading.id);
 const topClose=modal.querySelector('[onclick="closeOcrModal()"]');
 topClose.setAttribute('aria-label','Fechar leitura de fatura');
 const chooser=document.createElement('div');
 chooser.className='native-ai-modes';
 chooser.innerHTML='<button type="button" data-native-smart>Smart AI</button><button type="button" data-native-key>Chave API</button>';
 content.before(chooser);
 const details=document.createElement('div');
 details.className='native-ai-details';
 details.innerHTML=`<div class="native-ai-summary" aria-live="polite">
 <span data-plan>Créditos disponíveis</span> <strong data-count>—</strong>
 <p data-renewal hidden></p><p data-operational hidden></p><p data-lock hidden>Créditos esgotados</p></div>
 <button type="button" data-refresh>Atualizar saldo</button><button type="button" data-upgrade hidden>Conhecer o Premium</button>`;
 content.prepend(details);
 const result=document.createElement('div');
 result.innerHTML='<p data-filename class="text-xs text-slate-400"></p><p data-status role="status" class="text-sm text-slate-200"></p><button type="button" data-review hidden>Revisar lançamentos</button><div data-review-panel></div>';
 content.append(result);
 const review=result.querySelector('[data-review-panel]');
 let opener,returnToInvoice=false,previewFile,previewUrl;
 const preview=get('ocrPreviewContainer'),pdf=get('ocrPdfPreview'),image=get('ocrImagePreview');
 function renderNative({file,busy}){
  get('ocrLoading').classList.toggle('hidden',!busy);
  if(previewFile===file)return;
  previewFile=file;
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=undefined;}
  image.removeAttribute('src');
  const supported=file&&file.size<=10*1024*1024&&/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type);
  preview.classList.toggle('hidden',!supported);
  const isPdf=file?.type==='application/pdf';
  pdf.classList.toggle('hidden',!supported||!isPdf);
  image.classList.toggle('hidden',!supported||isPdf);
  if(supported&&!isPdf){previewUrl=URL.createObjectURL(file);image.src=previewUrl;}
  get('ocrImageInfo').textContent=supported?file.name:'';
 }
 const smart=mountSmartAI(modal,{native:true,getIdToken,onRender:renderNative,fetcher:(path,opts)=>{
  if(!navigator.onLine)throw Error('OFFLINE');
  return fetch(path,opts);
 },onUpgrade:()=>{result.querySelector('[data-status]').textContent='Premium oferece 15 créditos mensais. Assinaturas estão desativadas neste ambiente.';},onReview:invoice=>{
  if(modal.classList.contains('hidden'))return;
  mountReview(review,invoice,{categories:readCategories(),confirm:rows=>confirm(invoice,rows),cancel:message=>{
   smart.discardReview();result.querySelector('[data-status]').textContent=message??'';
  }});
  review.scrollIntoView({block:'nearest'});
 }});
 const visible=()=>!modal.classList.contains('hidden');
 const discard=()=>{
  if(smart.hasReview()&&!window.confirm('Descartar a revisão não confirmada?'))return false;
  review.replaceChildren();smart.reset();return true;
 };
 function close({restoreFocus=true}={}){
  if(!discard())return false;
  modal.classList.add('hidden');if(restoreFocus)opener?.focus();return true;
 }
 function open(){
  opener=document.activeElement;
  modal.classList.remove('hidden');content.hidden=false;
  void smart.refresh();topClose.focus();
 }
 const keyInput=get('geminiApiKeyInput');
 keyInput.disabled=true;keyInput.placeholder='Configuração simulada';
 const link=apiKey.querySelector('a[href]');
 if(link){link.removeAttribute('href');link.removeAttribute('target');}
 const text=document.createElement('p');text.className='text-xs text-amber-300';
 text.textContent='Ambiente experimental. Nenhuma chave é solicitada ou usada.';
 keyInput.before(text);
 function openKey(){
  returnToInvoice=visible();
  if(returnToInvoice&&!close({restoreFocus:false})){returnToInvoice=false;return;}
  apiKey.classList.remove('hidden');apiKey.querySelector('button')?.focus();
 }
 function closeKey(){
  apiKey.classList.add('hidden');
  if(returnToInvoice){returnToInvoice=false;open();}
 }
 Object.assign(globalThis,{openOcrModal:open,closeOcrModal:()=>close(),openApiKeyModal:openKey,
  closeApiKeyModal:closeKey,saveApiKey:closeKey});
 chooser.querySelector('[data-native-smart]').onclick=()=>{content.hidden=false;void smart.refresh();input.focus();};
 chooser.querySelector('[data-native-key]').onclick=openKey;
 for(const eventName of ['dragenter','dragover','drop'])zone.addEventListener(eventName,event=>{
  event.preventDefault();
  if(eventName==='drop'&&!input.disabled)smart.select(event.dataTransfer?.files[0]);
 });
 document.addEventListener('paste',event=>{
  if(!visible()||input.disabled)return;
  const file=[...(event.clipboardData?.files??[])].find(item=>item.type.startsWith('image/'));
  if(file){event.preventDefault();smart.select(file);}
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(!apiKey.classList.contains('hidden')){event.preventDefault();closeKey();}
  else if(visible()){event.preventDefault();close();}
 });
 window.addEventListener('offline',()=>{if(visible())void smart.refresh();});
 return {clear(){review.replaceChildren();smart.reset();}};
}
