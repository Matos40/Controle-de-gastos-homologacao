const labels={RECONCILED:'Fatura reconciliada',DIVERGENT:'Divergência identificada',INCOMPLETE:'Informações insuficientes',INVALID:'Dados inválidos'};
const warnings={
 POSSIBLE_DUPLICATES:'Há possíveis lançamentos duplicados.',
 MISSING_STATEMENT_TOTAL:'O total informado não foi identificado.',
 MISSING_ENTRY_AMOUNT:'Há lançamentos sem valor identificado.',
};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money=value=>Number.isSafeInteger(value)?currency.format(value/100):'Não identificado';

export function parseReais(value){
 const match=value.trim().replace(/\s/g,'').replace('−','-').match(/^(-)?(?:R\$)?(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/);
 if(!match)return null;
 const cents=Number(match[2].replaceAll('.','')+(match[3]??'').padEnd(2,'0'));
 return Number.isSafeInteger(cents)?(match[1]?-cents:cents):null;
}

export function mountReview(root,invoice,{confirm,cancel,categories=[]}){
 const entries=structuredClone(invoice.entries??[]).map(entry=>({...entry,selected:true,category:''}));
 const summary=invoice.reconciliation??{};
 root.innerHTML=`<section class="raytech-ai" aria-label="Revisão da fatura">
 <h2>Revisão da fatura</h2><p data-reconciliation></p><dl data-totals></dl><p>Total selecionado <output aria-live="polite" data-selected></output></p><ul data-warnings></ul>
 <form><div data-entries></div><p role="status"></p>
 <button type="button" data-cancel>Cancelar revisão</button>
 <button type="submit">Confirmar simulação</button></form></section>`;
 root.querySelector('[data-reconciliation]').dataset.state=summary.status;
 root.querySelector('[data-reconciliation]').textContent=labels[summary.status]??labels.INVALID;
 for(const [label,value] of [['Total informado',summary.statementTotalCents],['Total calculado',summary.calculatedTotalCents],['Diferença',summary.differenceCents]]){
  const term=document.createElement('dt'),detail=document.createElement('dd');
  term.textContent=label;detail.textContent=money(value);root.querySelector('[data-totals]').append(term,detail);
 }
 for(const code of summary.warnings??[]){
  const item=document.createElement('li');item.textContent=warnings[code]??'Confira os dados identificados na fatura.';
  root.querySelector('[data-warnings]').append(item);
 }
 const total=()=>{
  const rows=entries.filter(row=>row.selected);
  const sum=rows.every(row=>Number.isSafeInteger(row.amountCents))?rows.reduce((value,row)=>value+row.amountCents,0):null;
  root.querySelector('[data-selected]').textContent=money(sum);
 };
 total();
 const form=root.querySelector('form'),status=form.querySelector('[role=status]');
 for(const [index,entry] of entries.entries()){
  const group=document.createElement('fieldset'),title=document.createElement('legend');
  title.textContent='Lançamento '+(index+1)+' · '+money(entry.amountCents);
  title.classList.toggle('credit',entry.amountCents<0);
  group.append(title);
  const fields=[['selected','Selecionar','checkbox'],['title','Descrição','text'],['date','Data','date'],
   ['amountCents','Valor (R$)','text'],['category','Categoria','select']];
  if(entry.kind==='INSTALLMENT')fields.push(['currentInstallment','Parcela atual','number'],['installments','Total de parcelas','number']);
  for(const [key,label,type] of fields){
   const wrapper=document.createElement('label'),input=document.createElement(type==='select'?'select':'input');
   wrapper.textContent=label;
   if(type==='select'){
    for(const category of ['',...categories]){
     const option=document.createElement('option');option.value=category;option.textContent=category||'Selecione';input.append(option);
    }
   }else input.type=type;
   if(type==='checkbox')input.checked=true;
   else if(key==='amountCents'){
    input.inputMode='decimal';
    const format=()=>{if(Number.isSafeInteger(entry.amountCents))input.value=money(entry.amountCents);};
    format();input.addEventListener('blur',format);
   }else input.value=entry[key]??'';
   input.addEventListener('input',()=>{
    entry[key]=key==='amountCents'?parseReais(input.value):type==='checkbox'?input.checked:type==='number'?input.valueAsNumber:input.value;
    title.textContent='Lançamento '+(index+1)+' · '+money(entry.amountCents);
    title.classList.toggle('credit',entry.amountCents<0);total();
    status.textContent='';
   });
   wrapper.append(input);group.append(wrapper);
  }
  root.querySelector('[data-entries]').append(group);
 }
 root.querySelector('[data-cancel]').onclick=()=>{root.replaceChildren();cancel();};
 form.onsubmit=async event=>{
  event.preventDefault();
  const selected=entries.filter(entry=>entry.selected);
  if(!selected.length||selected.some(entry=>!entry.title||!entry.date||!Number.isSafeInteger(entry.amountCents)||
   (['REFUND','CREDIT','DISCOUNT'].includes(entry.kind)?entry.amountCents>=0:entry.amountCents<=0)||
   (entry.kind==='INSTALLMENT'&&(!Number.isInteger(entry.currentInstallment)||entry.currentInstallment<1||
    !Number.isInteger(entry.installments)||entry.installments<2||entry.installments>120||entry.currentInstallment>entry.installments)))){
   status.textContent='Selecione lançamentos e confira os campos, valores e parcelas.';return;
  }
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{await confirm(structuredClone(selected));root.replaceChildren();cancel('Simulação confirmada. Nenhum lançamento foi gravado.');}
  catch{status.textContent='Não foi possível confirmar a simulação.';submit.disabled=false;}
 };
}
