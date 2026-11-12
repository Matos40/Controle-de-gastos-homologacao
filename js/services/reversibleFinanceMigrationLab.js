'use strict';
// Migracao reversivel de laboratorio. Nao acessa rede, Firebase, DOM ou disco.
// Envelope preserva byte a byte a representacao JSON canonica do snapshot.
const crypto=require('node:crypto');
const {assertSnapshot}=require('./financeConverterLab.js');
const {inspectLegacy}=require('./legacyCompatibilityAuditLab.js');
const {validateSnapshot,cents}=require('./productionDataContractLab.js');
class MigrationError extends Error{constructor(code){super(code);this.name='MigrationError';this.code=code;}}
const fail=code=>{throw new MigrationError(code);};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function stable(x){
 if(x===null||typeof x==='string'||typeof x==='boolean')return x;
 if(typeof x==='number'){if(!Number.isFinite(x))fail('invalid_json');return x;}
 if(Array.isArray(x))return x.map(stable);
 if(x&&typeof x==='object'&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)){
  const o=Object.create(null);
  for(const k of Object.keys(x).sort()){
   if(['__proto__','prototype','constructor'].includes(k))fail('unsafe_key');
   o[k]=stable(x[k]);
  }
  return o;
 }
 fail('invalid_json');
}
function encode(x){const raw=JSON.stringify(stable(x));if(Buffer.byteLength(raw,'utf8')>2*1024*1024)fail('too_large');return raw;}
function balances(s){
 const result={};let carry=0;
 for(const ym of Object.keys(s.months).sort()){
  const m=s.months[ym],sum=(a,key)=>(a||[]).reduce((v,e)=>v+Number(e[key]||0),0);
  const income=Number(m.salary||0)+sum(m.extraIncomes,'amount');
  const spent=sum(m.expenses,'amount')+sum(m.cardExpenses,'installmentValue');
  // Saldo carregado apenas de mes imediatamente anterior, como app atual.
  const [y,mo]=ym.split('-').map(Number);
  const previous=new Date(Date.UTC(y,mo-2,1));
  const prev=previous.getUTCFullYear()+'-'+String(previous.getUTCMonth()+1).padStart(2,'0');
  const value=income-spent+(own(result,prev)?result[prev]:0);
  if(!Number.isFinite(value))fail('invalid_balance');
  result[ym]=value;carry=value;
 }
 return result;
}
function migrate(source){
 try{assertSnapshot(source);}catch{fail('invalid_legacy_snapshot');}
 const raw=encode(source),snapshot=JSON.parse(raw);
 const inspection=inspectLegacy(snapshot);
 if(inspection.issues.some(x=>!['missing_salary','missing_extra_incomes','contract_rejected','legacy_installment_without_origin'].includes(x.code)&&!(x.code==='missing_or_invalid_collection'&&/\.extraIncomes$/.test(x.path)&&!Object.prototype.hasOwnProperty.call(snapshot.months[x.path.split('.')[1]],'extraIncomes'))))
  fail('requires_manual_review');
 const normalized=clone(snapshot);
 for(const m of Object.values(normalized.months)){
  if(!own(m,'salary'))m.salary=0;
  if(!own(m,'extraIncomes'))m.extraIncomes=[];
 }
 try{validateSnapshot(normalized);}catch{fail('incompatible_contract');}
 const before=balances(snapshot),after=balances(normalized);
 if(JSON.stringify(before)!==JSON.stringify(after))fail('balance_changed');
 const normalizedRaw=encode(normalized);
 return {format:'raytech-migration-lab',version:1,sourceHash:hash(raw),
  normalizedHash:hash(normalizedRaw),original:snapshot,normalized,
  beforeBalances:before,afterBalances:after,issues:inspection.issues};
}
function verify(plan){
 if(!plan||plan.format!=='raytech-migration-lab'||plan.version!==1||
 typeof plan.sourceHash!=='string'||typeof plan.normalizedHash!=='string'||
 !/^[a-f0-9]{64}$/.test(plan.sourceHash)||!/^[a-f0-9]{64}$/.test(plan.normalizedHash))
 fail('invalid_plan');
 if(hash(encode(plan.original))!==plan.sourceHash||
 hash(encode(plan.normalized))!==plan.normalizedHash)fail('tampered_plan');
 const rebuilt=migrate(plan.original);
 if(rebuilt.normalizedHash!==plan.normalizedHash||
 JSON.stringify(rebuilt.beforeBalances)!==JSON.stringify(plan.beforeBalances)||
 JSON.stringify(rebuilt.afterBalances)!==JSON.stringify(plan.afterBalances))
 fail('tampered_plan');
 return rebuilt;
}
function createSession(initial){
 const source=clone(initial);let current=source,revision=0;
 return {
  read(){return clone(current);},
  revision(){return revision;},
  apply(plan,expectedRevision){
   if(expectedRevision!==revision)fail('revision_conflict');
   const checked=verify(plan);
   if(hash(encode(current))!==checked.sourceHash)fail('source_conflict');
   current=clone(checked.normalized);revision++;
   return {status:'migrated',revision};
  },
  rollback(plan,expectedRevision){
   if(expectedRevision!==revision)fail('revision_conflict');
   const checked=verify(plan);
   if(hash(encode(current))!==checked.normalizedHash)fail('rollback_conflict');
   current=clone(checked.original);revision++;
   return {status:'rolled_back',revision};
  }
 };
}
module.exports={MigrationError,migrate,verify,createSession,balances};
