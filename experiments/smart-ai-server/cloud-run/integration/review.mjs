const labels={RECONCILED:'Fatura reconciliada',DIVERGENT:'Divergência identificada',INCOMPLETE:'Informações insuficientes',INVALID:'Dados inválidos'};
const warnings={
 POSSIBLE_DUPLICATES:'Há possíveis lançamentos duplicados.',
 MISSING_STATEMENT_TOTAL:'O total informado não foi identificado.',
 MISSING_ENTRY_AMOUNT:'Há lançamentos sem valor identificado.',
};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money=value=>Number.isSafeInteger(value)?currency.format(value/100):'Não identificado';

export function mountReview(root,invoice,{confirm,cancel}){
 const entries=structuredClone(invoice.entries??[]).map(entry=>({...entry,selected:true,category:''}));
 const summary=invoice.reconciliation??{};
 root.innerHTML=`<section class="raytech-ai" aria-label="Revisão da fatura">
 <h2>Revisão da fatura</h2><p data-reconciliation></p><dl data-totals></dl><ul data-warnings></ul>
 <form><div data-entries></div><p role="status"></p>
 <button type="button" data-cancel>Cancelar revisão</button>
 <button type="submit">Confirmar simulação</button></form></section>`;
 root.querySelector('[data-reconciliation]').textContent=labels[summary.status]??labels.INVALID;
 for(const [label,value] of [['Total informado',summary.statementTotalCents],['Total calculado',summary.calculatedTotalCents],['Diferença',summary.differenceCents]]){
  const term=document.createElement('dt'),detail=document.createElement('dd');
  term.textContent=label;detail.textContent=money(value);root.querySelector('[data-totals]').append(term,detail);
 }
 for(const code of summary.warnings??[]){
  const item=document.createElement('li');item.textContent=warnings[code]??'Confira os dados identificados na fatura.';
  root.querySelector('[data-warnings]').append(item);
 }
 const form=root.querySelector('form'),status=form.querySelector('[role=status]');
 for(const [index,entry] of entries.entries()){
  const group=document.createElement('fieldset'),title=document.createElement('legend');
  title.textContent='Lançamento '+(index+1)+' · '+money(entry.amountCents);
  group.append(title);
  const fields=[['selected','Selecionar','checkbox'],['title','Descrição','text'],['date','Data','date'],
   ['amountCents','Valor em centavos','number'],['category','Categoria','text']];
  if(entry.kind==='INSTALLMENT')fields.push(['currentInstallment','Parcela atual','number'],['installments','Total de parcelas','number']);
  for(const [key,label,type] of fields){
   const wrapper=document.createElement('label'),input=document.createElement('input');
   wrapper.textContent=label;input.type=type;
   if(type==='checkbox')input.checked=true;else input.value=entry[key]??'';
   input.addEventListener('input',()=>{
    entry[key]=type==='checkbox'?input.checked:type==='number'?input.valueAsNumber:input.value;
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
