'use strict';
/* Ponte pura entre manifesto legado v1 e payload financeiro v2.
 * Nao usa Firestore, localStorage, DOM ou credenciais.
 * v1 e apenas importacao legada; novas exportacoes sao v2.
 */
const crypto=require('node:crypto');
const {decode}=require('./financeConverterLab.js');
const boundary=require('./deviceBoundaryLab.js');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const PRIVATE=new Set(['gemini_user_api_key','controle_gastos_pin_lock',
 'STORAGE_GEMINI_KEY','STORAGE_PIN_KEY','apiKey','geminiApiKey','pin','pinHash',
 'selectedMonth','interfacePreference','viewPreferences','devicePreferences']);
function json(v){
 const encoded=JSON.stringify(v);
 if(encoded===undefined)throw Error('JSON invalido.');
 const copy=JSON.parse(encoded);
 if(JSON.stringify(copy)!==encoded)throw Error('JSON inconsistente.');
 return copy;
}
function scan(v,path='root'){
 if(Array.isArray(v)){v.forEach((x,i)=>scan(x,path+'['+i+']'));return;}
 if(!isObject(v))return;
 for(const [k,x] of Object.entries(v)){
  if(PRIVATE.has(k))throw Error('Campo local ou sensivel: '+path+'.'+k);
  scan(x,path+'.'+k);
 }
}
function digest(payload){return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');}
function makeV2(snapshot){
 const shared=boundary.extract(snapshot);
 const result={version:2,schema:1,shared,checksum:digest(shared)};
 return json(result);
}
function checkV2(envelope){
 if(!isObject(envelope)||Object.keys(envelope).sort().join(',')!=='checksum,schema,shared,version'||
  envelope.version!==2||envelope.schema!==1||!isObject(envelope.shared)||
  !/^[a-f0-9]{64}$/.test(envelope.checksum))throw Error('Envelope v2 invalido.');
 const shared=json(envelope.shared);
 if(envelope.checksum!==digest(shared))throw Error('Checksum v2 divergente.');
 // Validar integralmente sem incluir preferencias locais.
 const months=Object.keys(shared.months||{}).sort();
 if(!months.length)throw Error('Sem meses.');
 boundary.assemble(shared,{selectedMonth:months[0]});
 return shared;
}
function fromLegacy(plan){
 if(!isObject(plan)||!isObject(plan.envelope)||!Array.isArray(plan.envelope.months)||
  !Array.isArray(plan.envelope.records)||typeof plan.checksum!=='string')
  throw Error('Plano legado invalido.');
 // Confere checksum historico do plano antes de converter.
 if(plan.checksum!==digest(plan.envelope))throw Error('Checksum legado divergente.');
 const restored=decode(plan.envelope);
 // Falhar fechado para qualquer metadado global ou sensivel.
 const v2=makeV2(restored);
 return {envelope:v2,legacySelectedMonth:restored.selectedMonth};
}
function importVersioned(input,preferences){
 if(!isObject(input))throw Error('Entrada invalida.');
 const version=input.version;
 let shared,source;
 if(version===2){shared=checkV2(input);source='v2';}
 else if(version===1){
  if(!isObject(input.plan))throw Error('Plano v1 ausente.');
  const converted=fromLegacy(input.plan);
  shared=checkV2(converted.envelope);
  source='legacy-v1';
 }else throw Error('Versao nao suportada.');
 const assembled=boundary.assemble(shared,preferences);
 return {...assembled,source,sharedChecksum:digest(shared)};
}
module.exports={makeV2,checkV2,fromLegacy,importVersioned,digest};
