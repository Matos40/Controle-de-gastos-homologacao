'use strict';
/* Laboratorio puro: nao le nem escreve storage, Firebase ou DOM.
 * selectedMonth permanece no formato legado apenas na montagem local.
 */
const {assertSnapshot}=require('./financeConverterLab.js');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const YM=/^\d{4}-(0[1-9]|1[0-2])$/;
const PRIVATE=new Set(['gemini_user_api_key','controle_gastos_pin_lock',
 'STORAGE_GEMINI_KEY','STORAGE_PIN_KEY','apiKey','geminiApiKey','pin','pinHash',
 'selectedMonth','interfacePreference','viewPreferences','devicePreferences']);
function clone(v){
 const s=JSON.stringify(v);
 if(s===undefined) throw Error('Dado nao serializavel.');
 const out=JSON.parse(s);
 if(JSON.stringify(out)!==s) throw Error('Dado JSON inconsistente.');
 return out;
}
function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
function scan(v,path='root'){
 if(Array.isArray(v)){v.forEach((x,i)=>scan(x,path+'['+i+']'));return;}
 if(!object(v))return;
 for(const [k,value] of Object.entries(v)){
  if(PRIVATE.has(k))throw Error('Campo local ou sensivel em payload: '+path+'.'+k);
  scan(value,path+'.'+k);
 }
}
function extract(db){
 assertSnapshot(db);
 const source=clone(db);
 // Compatibilidade: preserva metadados financeiros do mes sem alteracao.
 // Campos desconhecidos fora de months exigem revisao explicita.
 const extras=Object.keys(source).filter(k=>!['months','selectedMonth'].includes(k));
 if(extras.length)throw Error('Metadados globais nao classificados: '+extras.join(','));
 scan(source.months,'months');
 return {schema:1,months:source.months};
}
function local(input){
 if(!object(input))throw Error('Preferencias locais invalidas.');
 const month=input.selectedMonth;
 if(typeof month!=='string'||!YM.test(month))throw Error('Mes local invalido.');
 const view=own(input,'viewPreferences')?clone(input.viewPreferences):{};
 if(!object(view))throw Error('Visualizacao invalida.');
 const keys=Object.keys(input).filter(k=>!['selectedMonth','viewPreferences'].includes(k));
 if(keys.length)throw Error('Preferencias locais desconhecidas: '+keys.join(','));
 return {selectedMonth:month,viewPreferences:view};
}
function assemble(shared,preferences){
 if(!object(shared)||shared.schema!==1||!object(shared.months))throw Error('Payload compartilhado invalido.');
 const p=local(preferences);
 const copy=clone(shared);
 if(Object.keys(copy).some(k=>!['schema','months'].includes(k)))throw Error('Campo extra no payload.');
 scan(copy.months,'months');
 const months=copy.months;
 const ym=own(months,p.selectedMonth)?p.selectedMonth:Object.keys(months).sort().at(-1);
 if(!ym||!YM.test(ym))throw Error('Sem mes disponivel.');
 const result={selectedMonth:ym,months};
 assertSnapshot(result);
 return {snapshot:result,viewPreferences:p.viewPreferences,
  usedFallback:ym!==p.selectedMonth};
}
function audit(db,preferences){
 const shared=extract(db);
 const restored=assemble(shared,preferences);
 return {shared,restored,sourceUnchanged:JSON.stringify(db)===JSON.stringify(clone(db))};
}
module.exports={extract,assemble,local,audit};
