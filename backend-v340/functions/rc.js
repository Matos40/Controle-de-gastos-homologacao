const $=id=>document.getElementById(id);let token='',allowed=false,busy=false,epoch=0,lastId=null;
const status=text=>$('status').textContent=text;
function sync(){ $('extract').disabled=!allowed||busy;$('retry').disabled=!allowed||busy||!lastId;$('login').disabled=busy; }
function clearReview(){ $('review').replaceChildren();$('result').hidden=true; }
function reset(){epoch++;token='';allowed=false;lastId=null;$('token').value='';clearReview();status('');$('access').textContent='Desconectado';sync();}
async function api(endpoint,body,id){if(location.hostname!=='127.0.0.1'||location.port!=='15002')throw Error('Somente laboratório local');const res=await fetch('/api/'+endpoint,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',...(id?{'x-request-id':id}:{})},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(30000)});return {status:res.status,data:await res.json()};}
async function run(fn){if(busy)return;busy=true;const gen=epoch;sync();try{await fn(()=>gen===epoch);}catch{if(gen===epoch){allowed=false;clearReview();status('Serviço indisponível. Verifique o acesso novamente.');}}finally{busy=false;sync();}}
$('login').onclick=()=>run(async active=>{token=$('token').value.trim();$('token').value='';allowed=false;lastId=null;clearReview();status('');const r=await api('authorizePremiumFeature',{feature:'invoice-ai'});if(!active())return;allowed=r.status===200&&r.data.allowed===true;$('access').textContent=allowed?'Acesso autorizado':'Acesso negado';if(!allowed)token='';});
$('logout').onclick=reset;
const payload=()=>({feature:'invoice-ai',mimeType:'application/pdf',data:btoa('%PDF-1.4\n% synthetic Raytech RC\n%%EOF\n')});
function extract(repeat){return run(async active=>{clearReview();if(!repeat)lastId=crypto.randomUUID();const r=await api('extractPremiumInvoice',payload(),lastId);if(!active())return;if(r.status!==200){if([401,403].includes(r.status)){allowed=false;$('access').textContent='Acesso negado';}status(({409:'Requisição duplicada.',429:'Cota atingida.',403:'Acesso negado.',401:'Sessão inválida.'})[r.status]||'Processamento indisponível.');return;}if(!r.data.simulated||!r.data.requiresReview||!Array.isArray(r.data.items))throw Error('Invalid result');for(const item of r.data.items){const li=document.createElement('li');li.textContent=[item.title,item.date,item.installmentValue===null?'Valor desconhecido':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(item.installmentValue)].join(' · ');$('review').append(li);}$('result').hidden=false;status('Extração simulada concluída.');});}
$('extract').onclick=()=>extract(false);$('retry').onclick=()=>extract(true);
$('confirm').onclick=()=>{clearReview();status('Revisão confirmada somente nesta sessão. Nenhum lançamento salvo.');};
$('discard').onclick=()=>{clearReview();status('Revisão descartada.');};
sync();

let selecting=false;
fetch('/api/lab-enabled',{cache:'no-store'}).then(r=>r.json()).then(x=>{$('lab-profiles').hidden=!x.enabled;}).catch(()=>{});
$('lab-select').onclick=async()=>{if(selecting||busy)return;selecting=true;const generation=epoch;$('lab-select').disabled=true;try{
 const role=$('lab-role').value;
 const r=await fetch('/api/lab-profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Perfil indisponível');const u=await r.json();if(generation!==epoch)return;
 $('lab-identity').textContent=role.toUpperCase()+' · '+u.uid;$('token').value=u.token;$('login').click();
 }catch{if(generation===epoch)$('lab-identity').textContent='Não foi possível selecionar o perfil.';}finally{selecting=false;$('lab-select').disabled=false;}};
$('logout').addEventListener('click',()=>{$('lab-identity').textContent='';});
