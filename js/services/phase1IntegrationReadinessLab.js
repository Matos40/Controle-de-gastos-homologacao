'use strict';
// Auditoria de compatibilidade read-only. Sem rede, DOM, storage ou mutacao.
const {validateSnapshot,sanitizeSyncPayload}=require('./productionDataContractLab.js');
const {migrate,verify,createSession,balances}=require('./reversibleFinanceMigrationLab.js');
const {syntheticHistory,fingerprint,auditRoundTrip}=require('./financeIntegrityE2ELab.js');
const {plan}=require('./installmentDeletionPolicyLab.js');
const {memoryDisk,open}=require('./installmentPersistenceRecoveryLab.js');
const {createBackup,verifyBackup}=require('./backupRecoveryLab.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const {isDeepStrictEqual}=require('node:util');
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function check(fn){try{return {ok:true,value:fn()};}catch(e){return {ok:false,error:e.code||e.message};}}
const RISKS=Object.freeze([
 {id:'I01',severity:'HIGH',status:'BLOCKED',subject:'Schema de exclusoes',criterion:'Definir contrato versionado para tombstones por mes destino e testar conversao bidirecional sem perdas'},
 {id:'I02',severity:'HIGH',status:'BLOCKED',subject:'Parcelas legadas sem origem',criterion:'Migrar ou isolar origens ambiguas sem inventar identificadores e comprovar nao duplicacao'},
 {id:'I03',severity:'HIGH',status:'BLOCKED',subject:'Backup autenticado',criterion:'Autenticar origem e integridade do backup, alem de SHA-256, com gestao de chaves'},
 {id:'I04',severity:'HIGH',status:'BLOCKED',subject:'Backup financeiro completo',criterion:'Restaurar todas as colecoes e metadados financeiros, tombstones e saldos em testes de ida e volta'},
 {id:'I05',severity:'HIGH',status:'BLOCKED',subject:'Persistencia real',criterion:'Testar gravacao atomica, reinicio, falhas e recuperacao no armazenamento real em ambiente isolado'},
 {id:'I06',severity:'HIGH',status:'BLOCKED',subject:'Regras reais de exclusao',criterion:'Definir semantica aprovada e validar criacao automatica, sincronizacao e exclusao na UI real'},
 {id:'I07',severity:'HIGH',status:'BLOCKED',subject:'Isolamento e autorizacao',criterion:'Vincular identidade autenticada a cada operacao de leitura, escrita, backup e restauracao'},
 {id:'I08',severity:'MEDIUM',status:'BLOCKED',subject:'Escopo do contrato financeiro',criterion:'Validar campos de parcelas, fixos, investimentos, saldo e exclusoes, nao apenas ID e valor'},
 {id:'I09',severity:'HIGH',status:'BLOCKED',subject:'Rollback duravel',criterion:'Testar rollback apos crash, concorrencia e restauracao remota, com trilha de auditoria'},
 {id:'I10',severity:'HIGH',status:'BLOCKED',subject:'Governanca de dados',criterion:'Definir LGPD, retencao, exclusao, monitoramento e resposta a incidentes'}
]);
function audit(snapshot=syntheticHistory()){
 const input=clone(snapshot);
 const contract=check(()=>validateSnapshot(input));
 const migration=check(()=>{const p=migrate(input);verify(p);const s=createSession(input);s.apply(p,0);const after=s.read();s.rollback(p,1);return {sameOriginal:isDeepStrictEqual(s.read(),input),sameBalances:isDeepStrictEqual(balances(input),balances(after)),sameFingerprint:isDeepStrictEqual(fingerprint(input),fingerprint(after))};});
 const roundTrip=check(()=>auditRoundTrip(input).months);
 const backup=check(()=>{const recovered=verifyBackup(createBackup(input));return isDeepStrictEqual(fingerprint(recovered),fingerprint(input));});
 const sanitized=check(()=>sanitizeSyncPayload(input));
 const sample={selectedMonth:'2026-10',months:{'2026-10':{cardExpenses:[{id:'c',title:'Notebook',isInstallment:true,installmentOriginId:'orig',currentInstallment:1,installments:3,installmentValue:100}]}},deletions:{}};
 const deletion=check(()=>{
  const disk=memoryDisk(sample),s=open(disk);s.mark('2026-11','orig',2);s.recreate('2026-11','2026-10');
  const restored=open(disk);return {preserved:restored.read().deletions['2026-11'][0]==='orig:2',blocked:restored.read().months['2026-11'].cardExpenses.length===0};
 });
 const schemaBridge=check(()=>sanitizeSyncPayload({...input,deletions:{'2026-12':['orig:2']}}));
 const legacyCard=check(()=>{const c={id:'old',title:'Legado',isInstallment:true,currentInstallment:1,installments:3,installmentValue:100};return plan([c],'2026-11');});
 const verdict='NOT_READY_FOR_INTEGRATION';
 return {verdict,contract,migration,roundTrip,backup,sanitized,deletion,schemaBridge,legacyCard,
 risks:RISKS.map(x=>({...x})),riskCount:RISKS.length};
}
module.exports={RISKS,audit};
