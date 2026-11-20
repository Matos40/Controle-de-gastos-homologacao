const maxBytes=10*1024*1024;
const types=['application/pdf','image/png','image/jpeg','image/webp'];
const messages={
  RATE_LIMIT:'Limite de tentativas por minuto atingido. Aguarde um minuto e tente novamente.',
  QUOTA_EXCEEDED:'Seus créditos Smart AI acabaram.',
  ACTIVE_REQUEST:'Já existe uma fatura em processamento. Atualize o saldo em instantes.',
  DUPLICATE_REQUEST:'Esta solicitação já foi registrada. Confira o saldo antes de iniciar outra leitura.',
  ACCESS_DENIED:'Sua sessão não permite a leitura. Entre novamente e atualize o saldo.',
  INVALID_FILE:'Selecione uma imagem válida ou um PDF.',
  FILE_TOO_LARGE:'O arquivo precisa ter até 10 MiB.',
  TIMEOUT:'A leitura ficou indisponível. Atualize o saldo antes de tentar novamente.',
};
const unavailable='O Smart AI está indisponível no momento. Tente novamente em instantes.';

function base64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result.split(',')[1]);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function mountSmartAI(root,{getIdToken,onUpgrade,onReview,fetcher=fetch}){
  root.innerHTML=`
    <section class="raytech-ai" aria-label="Leitor Smart AI">
      <header class="raytech-ai__header">
        <div><h1>Smart AI</h1><p>Leitor de faturas</p></div>
        <button data-refresh type="button" class="raytech-ai__quiet">Atualizar saldo</button>
      </header>
      <div class="raytech-ai__balance" aria-live="polite">
        <div><span data-plan>Créditos disponíveis</span><strong data-count>—</strong></div>
        <p data-renewal hidden></p>
        <p data-lock hidden>🔒 Créditos esgotados</p>
      </div>
      <button data-upgrade type="button" class="raytech-ai__quiet" hidden>Conhecer o Premium</button>
      <form data-form>
        <label for="raytech-ai-file">Arquivo da fatura</label>
        <input data-file id="raytech-ai-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp">
        <p class="raytech-ai__hint">PDF, PNG, JPEG ou WebP de até 10 MiB.</p>
        <button data-send type="submit" disabled>Ler fatura</button>
      </form>
      <p data-status class="raytech-ai__status" role="status" aria-live="polite"></p>
      <button data-review type="button" class="raytech-ai__quiet" hidden>Revisar lançamentos</button>
    </section>`;
  const el=name=>root.querySelector('[data-'+name+']');
  const form=el('form'), input=el('file'), status=el('status'), review=el('review');
  let balance=null, busy=false, refreshing=false, requestId, selectedFile, result;

  function render(){
    const exhausted=balance?.remaining===0;
    el('count').textContent=balance ? String(balance.remaining) : '—';
    el('plan').textContent=balance ? 'Créditos '+(balance.plan==='free'?'Free':'Premium') : 'Créditos disponíveis';
    const renewal=el('renewal');
    renewal.hidden=balance?.plan!=='premium';
    renewal.textContent=renewal.hidden?'':'Próxima renovação em '+balance.nextRenewalDate.split('-').reverse().join('/');
    el('lock').hidden=!exhausted;
    el('upgrade').hidden=balance?.plan!=='free'||typeof onUpgrade!=='function';
    input.disabled=busy||Boolean(exhausted);
    el('send').disabled=busy||refreshing||!balance||exhausted||balance.busy||!input.files.length;
    el('send').textContent=busy?'Processando…':'Ler fatura';
    form.setAttribute('aria-busy',String(busy));
    el('refresh').disabled=busy||refreshing;
  }

  async function api(path,options={}){
    const token=await getIdToken();
    if(!token)throw Error('ACCESS_DENIED');
    const response=await fetcher(path,{...options,cache:'no-store',headers:{
      ...options.headers,authorization:'Bearer '+token,
    }});
    return {ok:response.ok,data:await response.json()};
  }

  async function refresh({announce=true}={}){
    if(refreshing)return;
    refreshing=true;render();
    try{
      const {ok,data}=await api('/v1/credits');
      if(!ok)throw Error(data.error);
      if(!['free','premium'].includes(data.plan)||!Number.isInteger(data.remaining)||
         data.remaining<0||data.remaining>(data.plan==='free'?2:15)||typeof data.busy!=='boolean'||
         (data.plan==='premium'&&!/^\d{4}-\d{2}-01$/.test(data.nextRenewalDate)))throw Error('UNAVAILABLE');
      balance=data;
      if(announce)status.textContent=data.busy?messages.ACTIVE_REQUEST:'';
    }catch(error){
      balance=null;
      const message=messages[error.message]??unavailable;
      status.textContent=announce||!status.textContent?message:status.textContent+' '+message;
    }finally{refreshing=false;render();}
  }

  input.addEventListener('change',()=>{
    selectedFile=input.files[0];requestId=undefined;result=undefined;review.hidden=true;
    status.textContent='';render();
  });
  el('refresh').addEventListener('click',()=>void refresh());
  el('upgrade').addEventListener('click',()=>onUpgrade?.());
  review.addEventListener('click',()=>onReview?.(result));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||refreshing||!balance||balance.busy||!balance.remaining)return;
    const file=input.files[0];
    if(!file||!types.includes(file.type)||!file.size){status.textContent=messages.INVALID_FILE;return;}
    if(file.size>maxBytes){status.textContent=messages.FILE_TOO_LARGE;return;}
    if(file!==selectedFile){selectedFile=file;requestId=undefined;}
    requestId??=crypto.randomUUID();
    busy=true;result=undefined;review.hidden=true;status.textContent='Lendo sua fatura…';render();
    try{
      const {ok,data}=await api('/v1/invoices',{method:'POST',
        headers:{'content-type':'application/json','x-request-id':requestId},
        body:JSON.stringify({feature:'invoice-ai',mimeType:file.type,data:await base64(file)}),
      });
      if(!ok){
        status.textContent=(messages[data.error]??unavailable)+(data.creditRefunded===true?' O crédito foi restituído.':'');
        if(data.creditRefunded===true)requestId=undefined;
      }else{
        result=data;review.hidden=typeof onReview!=='function';
        input.value='';selectedFile=undefined;requestId=undefined;
        const reconciliation=data.reconciliation;
        const reviewMessages={DIVERGENT:'O total da fatura diverge da soma calculada. Revise os valores.',
          INCOMPLETE:'Faltam dados para reconciliar o total. Revise a fatura.'};
        const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
        let totals='';
        if(reconciliation?.status==='DIVERGENT'&&Number.isSafeInteger(reconciliation.statementTotalCents)&&
           Number.isSafeInteger(reconciliation.calculatedTotalCents)){
          totals=' Total informado '+money.format(reconciliation.statementTotalCents/100)+
            ' · Total calculado '+money.format(reconciliation.calculatedTotalCents/100)+'.';
        }
        status.textContent=(reviewMessages[reconciliation?.status]??'Leitura concluída. Confira os lançamentos antes de adicioná-los.')+
          totals+
          (reconciliation?.warnings?.includes('POSSIBLE_DUPLICATES')?' Há possíveis duplicidades.':'');
      }
    }catch(error){status.textContent=messages[error.message]??unavailable;}
    finally{await refresh({announce:false});busy=false;render();}
  });
  return {refresh,ready:refresh()};
}
