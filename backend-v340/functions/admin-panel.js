const $=id=>document.getElementById(id);
let token='',cursor=null,rows=[],selected=null,busy=false,epoch=0;
const status=x=>$('status').textContent=x;
function clearView(){rows=[];cursor=null;selected=null;$('rows').replaceChildren();$('metrics').replaceChildren();$('editor').hidden=true;$('next').disabled=true;}
async function api(body){
 if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('Painel disponível somente em localhost.');
 if(!token)throw Error('Informe o token do emulador.');
 const response=await fetch('/api/usageAdmin',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(30000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Falha na consulta');return data;
}
function render(){
 const query=$('search').value.trim().toLowerCase();$('rows').replaceChildren();
 for(const r of rows.filter(x=>x.uid.toLowerCase().includes(query))){
  const tr=document.createElement('tr');
  for(const v of [r.uid,r.plan+(r.blocked?' · bloqueado':''),r.used.minute+'/'+r.limits.minute,r.used.day+'/'+r.limits.day,r.used.month+'/'+r.limits.month,r.reached.join(', ')||'Não']){const td=document.createElement('td');td.textContent=v;tr.append(td);}
  const td=document.createElement('td'),button=document.createElement('button');button.textContent='Editar';button.addEventListener('click',()=>edit(r));td.append(button);tr.append(td);$('rows').append(tr);
 }
}
function edit(row){selected=row;$('target').textContent=row.uid;for(const k of ['minute','day','month'])$(k).value=row.limits[k];$('editor').hidden=false;}
async function perform(fn){if(busy)return;busy=true;const generation=epoch;try{await fn(()=>generation===epoch);}catch(e){if(generation===epoch){clearView();status(e.message);}}finally{busy=false;}}
async function page(after,active){const data=await api({action:'list',after});if(!active())return;rows=data.rows;cursor=data.next;$('next').disabled=!cursor;$('metrics').replaceChildren();for(const [label,value] of [['Minuto (página)',data.totals.minute],['Dia (página)',data.totals.day],['Mês (página)',data.totals.month],['No limite (página)',data.totals.atLimit]]){const a=document.createElement('article');a.className='metric';a.textContent=label;const b=document.createElement('strong');b.textContent=value;a.append(b);$('metrics').append(a);}render();status('Consulta concluída.');}
$('load').onclick=()=>perform(async active=>{token=$('token').value.trim();$('token').value='';clearView();await page(null,active);});
$('logout').onclick=()=>{epoch++;token='';$('token').value='';clearView();status('Sessão local limpa.');};
$('search').oninput=render;
$('next').onclick=()=>perform(active=>page(cursor,active));
$('lookup').onclick=()=>perform(async active=>{const d=await api({action:'get',uid:$('search').value.trim()});if(active())edit(d.row);});
$('form').onsubmit=e=>{e.preventDefault();if(!selected)return;perform(async active=>{const limits=Object.fromEntries(['minute','day','month'].map(k=>[k,Number($(k).value)]));await api({action:'set',uid:selected.uid,limits,expectedVersion:selected.version});if(!active())return;$('editor').hidden=true;selected=null;await page(null,active);if(active())status('Limites atualizados.');});};
