import {inspectPayload,LEGACY_LIMITS} from './model.mjs';
import {normalizeCardState,reconstructOrigins,auditEquivalence} from './legacyPhase2.mjs';
import {databaseKey,isV2Workspace} from './cleanWorkspace.mjs';
const labels=Object.freeze({
  "DB_ABSENT": "Banco local ausente",
  "PAYLOAD_LIMIT": "Banco acima do limite de tamanho",
  "INVALID_JSON": "Formato JSON inválido",
  "ROOT_SCHEMA": "Estrutura principal desconhecida",
  "SELECTED_MONTH": "Mês selecionado inválido",
  "MONTH_LIMIT": "Quantidade de meses acima do limite",
  "MONTH_FORMAT": "Formato de mês inválido",
  "MONTH_SCHEMA": "Campos mensais não reconhecidos",
  "MONTH_MONEY": "Salário ou orçamento fora do formato",
  "MONTH_CLOSED": "Estado de fechamento incompatível",
  "ENTRY_ARRAY": "Lista de lançamentos inválida",
  "ENTRY_LIMIT": "Quantidade de lançamentos acima do limite",
  "ENTRY_SCHEMA": "Registro inválido",
  "ENTRY_ID": "Identificador incompatível",
  "DUPLICATE_ID": "Identificador duplicado",
  "DATE_FORMAT": "Formato de data incompatível",
  "LEGACY_CALENDAR_DAY": "Dia de calendário legado preservado",
  "EXPENSE_SCHEMA": "Campos de despesa incompatíveis",
  "TEXT_FORMAT": "Texto fora do formato seguro",
  "CATEGORY": "Categoria desconhecida",
  "ENTRY_MONEY": "Valor monetário fora do formato",
  "EXPENSE_STATE": "Estado de despesa incompatível",
  "INCOME_SCHEMA": "Campos de receita incompatíveis",
  "CARD_SCHEMA": "Campos de cartão incompatíveis",
  "CARD_STATE": "Estado de cartão incompatível",
  "INSTALLMENT_NUMBER": "Numeração de parcelas incompatível",
  "INSTALLMENT_ORIGIN": "Origem de parcela ausente ou ambígua",
  "DUPLICATE_INSTALLMENT": "Parcela repetida na mesma série",
  "LEGACY_CARD_TOTAL": "Total legado de cartão preservado sem recálculo",
  "CARD_TOTAL": "Total de cartão divergente",
  "DELETION_MARKS": "Marcas de exclusão incompatíveis",
  "DELETED_INSTALLMENT_PRESENT": "Parcela presente e marcada como excluída",
  "DEFAULT_FIELDS": "Campos opcionais antigos preenchidos em cópia",
  "CATEGORY_INFERRED": "Categoria preenchida conforme regra do aplicativo antigo",
  "ORIGIN_RECOVERED": "Origem de primeira parcela recuperada",
  "CONVERSION_ERROR": "Conversão não realizada",
  "CARD_PAID_NORMALIZED": "Estado de pagamento equivalente ao V1",
  "CARD_INSTALLMENT_NORMALIZED": "Estado de parcelamento equivalente ao V1",
  "EMPTY_ORIGIN_NORMALIZED": "Origem vazia em compra à vista tratada",
  "ORIGIN_AMBIGUOUS_GROUP": "Série sem vínculo inequívoco",
  "ORIGIN_DELETION_ALIAS": "Marca de exclusão usa origem alternativa",
  "ORIGIN_DELETION_COLLISION": "Origem proposta coincide com parcela excluída",
  "ORIGIN_UNEXPLAINED_GAP": "Sequência tem intervalo sem comprovação",
  "CARD_UNKNOWN_FIELDS": "Campos adicionais de cartão não reconhecidos",
  "CARD_PAID_TYPE": "Tipo do campo paid incompatível",
  "CARD_INSTALLMENT_TYPE": "Tipo do campo isInstallment incompatível",
  "FINANCIAL_EQUIVALENCE": "Equivalência financeira não comprovada"
});
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function inferCategoryFromTitle(title) {
      const t = (title || '').toLowerCase();
      if (t.includes('uber') || t.includes('shell') || t.includes('combust') || t.includes('gasolina') || t.includes('99')) return 'transporte';
      if (t.includes('luz') || t.includes('água') || t.includes('agua') || t.includes('fibra') || t.includes('claro') || t.includes('net') || t.includes('aluguel') || t.includes('condom')) return 'moradia';
      if (t.includes('shopee') || t.includes('shein') || t.includes('mercadolivre') || t.includes('loja') || t.includes('roupa')) return 'compras';
      if (t.includes('growth') || t.includes('farm') || t.includes('drogaria') || t.includes('medico') || t.includes('saude')) return 'saude';
      if (t.includes('mercado') || t.includes('organico') || t.includes('ifood') || t.includes('padaria') || t.includes('restaurante') || t.includes('santana')) return 'alimentacao';
      if (t.includes('villa cabana') || t.includes('cinema') || t.includes('netflix') || t.includes('spotify')) return 'lazer';
      return 'outros';
    }
// Only additive transformations; original bytes remain in memory, never returned by previewLocal.
export function convertLegacy(raw){
 const changes=new Map(),add=code=>changes.set(code,(changes.get(code)||0)+1);
 const fail=(code)=>({compatible:false,issues:[{code,count:1}],warnings:[]});
 if(typeof raw!=='string')return fail('DB_ABSENT');
 if(raw.length>LEGACY_LIMITS.payload)return fail('PAYLOAD_LIMIT');
 let db;try{db=JSON.parse(raw);}catch{return fail('INVALID_JSON');}
 if(!object(db)||!object(db.months))return fail('ROOT_SCHEMA');
 const original=structuredClone(db);
 try{
 const cards=[];
 for(const [month,m] of Object.entries(db.months)){
  if(!object(m))continue;
  for(const [k,v] of Object.entries({deletedInstallmentOrigins:[],closed:false,closedAt:null,budgetLimit:0,extraIncomes:[]})){
   if(!Object.hasOwn(m,k)){m[k]=v;add('DEFAULT_FIELDS');}
  }
  for(const k of ['expenses','cardExpenses']){
   if(!Array.isArray(m[k]))continue;
   for(const x of m[k]){if(!object(x))continue;if(!Object.hasOwn(x,'category')&&typeof x.title==='string'){x.category=inferCategoryFromTitle(x.title);add('CATEGORY_INFERRED');}
    if(k==='cardExpenses'){normalizeCardState(x,add);if(x.isInstallment===true)cards.push({month,x});}
   }
  }
 }
 reconstructOrigins(db,cards,add);
 const payload=JSON.stringify(db),report=inspectPayload(payload);
 const warnings=[...report.warnings,...[...changes].map(([code,count])=>({code,count}))];
 if(report.issues.length)return {compatible:false,issues:report.issues,warnings};
 const audit=auditEquivalence(original,db);if(!audit.equivalent)return {compatible:false,issues:[{code:'FINANCIAL_EQUIVALENCE',count:1}],warnings};
 return {compatible:true,payload,original:raw,issues:[],warnings,audit,months:Object.keys(db.months).length,entries:Object.values(db.months).reduce((n,m)=>n+m.expenses.length+m.cardExpenses.length+m.extraIncomes.length,0)};
 }catch{return fail('CONVERSION_ERROR');}
}
// Reversal applies only to the exact initial conversion, not subsequent financial edits.
export function reverseLegacy(conversion,payload){
 if(!conversion?.compatible||typeof conversion.original!=='string'||payload!==conversion.payload)throw Error('PRODUCTION_REVERSAL_MISMATCH');
 const verified=convertLegacy(conversion.original);
 if(!verified.compatible||verified.payload!==payload)throw Error('PRODUCTION_REVERSAL_MISMATCH');
 return conversion.original;
}
const describe=items=>items.map(({code,count})=>(labels[code]??(code.startsWith('CARD_MISSING_')?'Campo obrigatório de cartão ausente':'Incompatibilidade identificada'))+' ['+code+']: '+count).join('; ');
export function prepareLocal(raw){
 const {original,...r}=convertLegacy(raw);
 if(!r.compatible)r.reason=describe(r.issues)+'. O banco original não foi alterado.';
 return r;
}
export function previewLocal(raw){const {payload,...summary}=prepareLocal(raw);return summary;}
export function bindPreview(document,storage,key=databaseKey(globalThis.location?.search??'')){
 const button=document.getElementById('productionV2Preview'),status=document.getElementById('productionV2PreviewStatus');
 if(!button||!status)return;
 if(key===null){button.disabled=true;status.textContent='Endereço de banco inválido.';return;}
 button.addEventListener('click',()=>{
  if(document.getElementById('pinLockOverlay')&&!document.getElementById('pinLockOverlay').classList.contains('hidden'))return;
  try{
   const raw=storage.getItem(key),p=previewLocal(raw);
   if(isV2Workspace(globalThis.location?.search??'')&&inspectPayload(raw).issues.length){
    status.textContent='Banco V2 incompatível. '+describe(inspectPayload(raw).issues)+'. Nenhuma alteração realizada.';return;
   }
   const warnings=p.warnings?.length?' Avisos: '+describe(p.warnings)+'.':'';
   status.textContent=(p.compatible?'Compatível: '+p.months+' mês(es), '+p.entries+' lançamento(s). Equivalência financeira conferida. Nenhum dado enviado.':p.reason)+warnings;
  }catch{status.textContent='Não foi possível ler o banco local. Nenhuma alteração realizada.';}
 });
}
if(typeof document!=='undefined')bindPreview(document,(globalThis.raytechStorage??globalThis.localStorage));
