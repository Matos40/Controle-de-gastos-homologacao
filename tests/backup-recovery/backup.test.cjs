'use strict';
const assert=require('node:assert/strict');
const {createBackup,verifyBackup,parseBackup,createRestoreLab,BackupLabError}=
 require('../../js/services/backupRecoveryLab.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('APROVADO:',name);}
const snapshot={selectedMonth:'2026-11',months:{'2026-11':{
 salary:3000,expenses:[{id:'a',value:100}],cardExpenses:[],extraIncomes:[]}}};
const clone=x=>JSON.parse(JSON.stringify(x));
const backup=createBackup(snapshot);
const bad=(mutate)=>{const b=clone(backup);mutate(b);return b;};
const fails=(fn,code)=>assert.throws(fn,e=>e instanceof BackupLabError&&e.code===code);
test('formato versionado',()=>assert.equal(backup.format,'raytech-finance-lab'));
test('versao de backup',()=>assert.equal(backup.version,1));
test('algoritmo SHA-256',()=>assert.equal(backup.algorithm,'sha256'));
test('checksum hexadecimal',()=>assert.match(backup.checksum,/^[a-f0-9]{64}$/));
test('backup valido verificavel',()=>assert.deepEqual(verifyBackup(backup),snapshot));
test('JSON exportado importavel',()=>assert.deepEqual(parseBackup(JSON.stringify(backup)),snapshot));
test('ordem de chaves nao altera checksum',()=>{
 const s={months:snapshot.months,selectedMonth:'2026-11'};
 assert.equal(createBackup(s).checksum,backup.checksum);
});
test('mutacao de salario detectada',()=>fails(()=>verifyBackup(bad(b=>b.payload.months['2026-11'].salary=9999)),'checksum_mismatch'));
test('mutacao de despesa detectada',()=>fails(()=>verifyBackup(bad(b=>b.payload.months['2026-11'].expenses[0].value=9999)),'checksum_mismatch'));
test('checksum adulterado detectado',()=>fails(()=>verifyBackup(bad(b=>b.checksum='0'.repeat(64))),'checksum_mismatch'));
test('versao incompatível rejeitada',()=>fails(()=>verifyBackup(bad(b=>b.version=2)),'invalid_backup'));
test('algoritmo desconhecido rejeitado',()=>fails(()=>verifyBackup(bad(b=>b.algorithm='md5')),'invalid_backup'));
test('campo inesperado rejeitado',()=>fails(()=>verifyBackup(bad(b=>b.token='secret')),'invalid_backup'));
test('JSON truncado rejeitado',()=>fails(()=>parseBackup('{"format":'),'invalid_json'));
test('JSON nao objeto rejeitado',()=>fails(()=>parseBackup('null'),'invalid_backup'));
test('backup gigante rejeitado',()=>fails(()=>parseBackup('x'.repeat(2*1024*1024+1025)),'backup_too_large'));
test('snapshot sem meses rejeitado',()=>fails(()=>createBackup({selectedMonth:'2026-11'}),'invalid_snapshot'));
test('snapshot com mes ausente rejeitado',()=>fails(()=>createBackup({selectedMonth:'2026-11',months:{}}),'invalid_snapshot'));
test('numero nao finito rejeitado',()=>fails(()=>createBackup({...snapshot,months:{'2026-11':{salary:Infinity}}}),'invalid_data'));
test('referencia circular rejeitada',()=>{
 const s=clone(snapshot);s.self=s;
 fails(()=>createBackup(s),'invalid_data');
});
test('chave perigosa rejeitada',()=>{
 const s=clone(snapshot);s.months['2026-11'].expenses[0]['constructor']='attack';
 fails(()=>createBackup(s),'invalid_data');
});
test('restauracao atomica valida',()=>{
 const store=createRestoreLab({selectedMonth:'2026-10',months:{'2026-10':{salary:1}}});
 assert.deepEqual(store.restore(backup,{expectedRevision:0}),{status:'restored',revision:1});
 assert.deepEqual(store.read(),snapshot);
});
test('restauracao corrompida nao altera estado',()=>{
 const store=createRestoreLab(snapshot),before=store.read();
 fails(()=>store.restore(bad(b=>b.payload.selectedMonth='2026-10'),{expectedRevision:0}),'checksum_mismatch');
 assert.deepEqual(store.read(),before);assert.equal(store.revision(),0);
});
test('conflito de revisao nao sobrescreve',()=>{
 const store=createRestoreLab(snapshot);
 fails(()=>store.restore(backup,{expectedRevision:1}),'revision_conflict');
 assert.equal(store.revision(),0);
});
test('leitura retorna copia isolada',()=>{
 const store=createRestoreLab(snapshot),read=store.read();
 read.months['2026-11'].salary=9999;
 assert.equal(store.read().months['2026-11'].salary,3000);
});
test('backup nao depende de objeto original',()=>{
 const source=clone(snapshot),b=createBackup(source);
 source.months['2026-11'].salary=9999;
 assert.equal(verifyBackup(b).months['2026-11'].salary,3000);
});
console.log('RESULTADO: '+passed+'/26 TESTES APROVADOS');
