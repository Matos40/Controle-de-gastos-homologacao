'use strict';
const assert=require('node:assert/strict');
const {normalizeSnapshot}=require('../js/services/preMigrationLab.js');
const bridge=require('../js/services/versionedBoundaryBridgeLab.js');
let passed=0;
function check(label,fn){fn();passed++;console.log('APROVADO:',label);}
const db={selectedMonth:'2026-11',months:{
 '2026-10':{salary:5000,expenses:[{id:'e1',amount:120,title:'Luz'}],cardExpenses:[],extraIncomes:[]},
 '2026-11':{salary:5300,expenses:[],cardExpenses:[{id:'c1',installmentValue:250,installments:6,currentInstallment:2}],extraIncomes:[]}}};
const plan=normalizeSnapshot(db,'bridge');
const prefs={selectedMonth:'2026-10',viewPreferences:{compact:true}};
check('exportacao v2 usa versao explicita',()=>assert.equal(bridge.makeV2(db).version,2));
check('v2 nao carrega mes selecionado',()=>assert.equal(JSON.stringify(bridge.makeV2(db)).includes('selectedMonth'),false));
check('v2 nao carrega visualizacao',()=>assert.equal(JSON.stringify(bridge.makeV2(db)).includes('compact'),false));
check('checksum v2 corresponde ao payload',()=>{const x=bridge.makeV2(db);assert.equal(x.checksum,bridge.digest(x.shared));});
check('conversao legado v1 preserva financeiro',()=>assert.deepStrictEqual(bridge.fromLegacy(plan).envelope.shared.months,db.months));
check('legado v1 preserva mes apenas como informacao de origem',()=>assert.equal(bridge.fromLegacy(plan).legacySelectedMonth,'2026-11'));
check('legado importado respeita mes local',()=>assert.equal(bridge.importVersioned({version:1,plan},prefs).snapshot.selectedMonth,'2026-10'));
check('v2 importado respeita mes local',()=>assert.equal(bridge.importVersioned(bridge.makeV2(db),prefs).snapshot.selectedMonth,'2026-10'));
check('dois dispositivos usam mesmo checksum',()=>{const x=bridge.makeV2(db);assert.equal(bridge.importVersioned(x,prefs).sharedChecksum,bridge.importVersioned(x,{selectedMonth:'2026-11'}).sharedChecksum);});
check('mes local inexistente recebe fallback',()=>assert.equal(bridge.importVersioned(bridge.makeV2(db),{selectedMonth:'2026-12'}).snapshot.selectedMonth,'2026-11'));
check('checksum adulterado e rejeitado',()=>{const x=bridge.makeV2(db);x.checksum='a'.repeat(64);assert.throws(()=>bridge.checkV2(x),/Checksum/);});
check('salario adulterado sem checksum novo e rejeitado',()=>{const x=bridge.makeV2(db);x.shared.months['2026-10'].salary=1;assert.throws(()=>bridge.checkV2(x),/Checksum/);});
check('chave Gemini injetada em registro e rejeitada',()=>{const x=structuredClone(db);x.months['2026-10'].expenses[0].gemini_user_api_key='segredo';assert.throws(()=>bridge.makeV2(x),/sensivel/);});
check('PIN injetado em mes e rejeitado',()=>{const x=structuredClone(db);x.months['2026-10'].pinHash='hash';assert.throws(()=>bridge.makeV2(x),/sensivel/);});
check('metadados globais inesperados sao rejeitados',()=>assert.throws(()=>bridge.makeV2({...db,apiKey:'segredo'}),/nao classificados/));
check('preferencias locais nao entram no payload v2',()=>{const x=bridge.makeV2(db);const r=bridge.importVersioned(x,prefs);assert.deepStrictEqual(r.viewPreferences,{compact:true});assert.equal(JSON.stringify(x).includes('compact'),false);});
check('checksum legado adulterado e rejeitado',()=>{const x=structuredClone(plan);x.checksum='a'.repeat(64);assert.throws(()=>bridge.fromLegacy(x),/Checksum/);});
check('legado com dados sensiveis rejeitado',()=>{const x=structuredClone(db);x.months['2026-10'].pin='1234';const p=normalizeSnapshot(x,'bridge');assert.throws(()=>bridge.fromLegacy(p),/sensivel/);});
check('versao desconhecida e rejeitada',()=>assert.throws(()=>bridge.importVersioned({version:3},prefs),/Versao/));
check('campos extras no envelope v2 rejeitados',()=>{const x=bridge.makeV2(db);x.selectedMonth='2026-10';assert.throws(()=>bridge.checkV2(x),/invalido/);});
check('snapshot original nao e alterado',()=>{const x=structuredClone(db);bridge.makeV2(db);bridge.fromLegacy(plan);assert.deepStrictEqual(db,x);});
check('parcelas e valores preservados',()=>assert.deepStrictEqual(bridge.importVersioned(bridge.makeV2(db),prefs).snapshot.months['2026-11'].cardExpenses,db.months['2026-11'].cardExpenses));
console.log('RESULTADO: '+passed+'/22 TESTES APROVADOS');
