export function mountAdmin({api,role,uid}){
 const host=document.getElementById('smartAdminHost'),open=document.getElementById('smartAdminOpen');
 let alive=true;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn)=>{const n=el('button',text,'admin-action');n.type='button';n.addEventListener('click',fn);return n;};
 const close=()=>{host.hidden=true;host.replaceChildren();};
 const load=async()=>{host.hidden=false;host.replaceChildren(el('h2','Raytech CG • Smart Admin'),button('Fechar',close),el('p',role==='owner'?'Owner':'Admin'));const status=el('p','Carregando…');host.append(status);
 try{if(!await api.role())throw Error('ADMIN_DENIED');const accounts=await api.list(),audit=await api.audit();if(!alive||host.hidden)return;status.textContent='Até 100 contas exibidas • '+accounts.length+' registros • '+accounts.filter(a=>!a.blocked).length+' ativos • '+accounts.filter(a=>a.plan==='premium').length+' Premium';
 for(const a of accounts){const row=el('div','','admin-row');row.append(el('span',a.uid),el('span',a.plan+' | '+(a.blocked?'Bloqueado':'Ativo')));if(a.uid!==uid){const change=async patch=>{if(!confirm('Confirmar alteração da conta '+a.uid+'?'))return;try{await api.change(a.uid,patch);if(alive)await load();}catch{status.textContent='Alteração recusada pelo servidor ou indisponível.';}};row.append(button(a.plan==='free'?'Tornar Premium':'Tornar Free',()=>change({plan:a.plan==='free'?'premium':'free',blocked:a.blocked})),button(a.blocked?'Reativar':'Bloquear',()=>change({plan:a.plan,blocked:!a.blocked})));}host.append(row);}
 host.append(el('h3','Auditoria • últimos 100 registros'));for(const a of audit)host.append(el('p',String(a.actor)+' → '+String(a.target)+' | '+a.beforePlan+' → '+a.afterPlan+' | bloqueio '+a.beforeBlocked+' → '+a.afterBlocked+' | '+(a.at?.toDate?.().toLocaleString('pt-BR')||'')));
 }catch{status.textContent='Acesso administrativo não autorizado ou conexão indisponível.';}};
 open.hidden=false;open.addEventListener('click',load);return ()=>{alive=false;open.hidden=true;open.removeEventListener('click',load);close();};
}
