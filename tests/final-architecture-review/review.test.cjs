'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {risks,evaluateArchitecture,writeReport}=require('../../js/services/finalArchitectureReviewLab.js');
let n=0;
function test(name,fn){fn();n++;console.log('APROVADO:',name);}
const valid=()=>({scope:'laboratorio-local-develop',passedBatteries:8,totalBatteries:8,
 verifiedTests:173,expectedTests:173,results:Array.from({length:8},()=>({passed:true,exitCode:0}))});
const base=evaluateArchitecture();
test('12 controles revisados',()=>assert.equal(base.checks.length,12));
test('controles de codigo identificados',()=>assert.equal(base.checksPassed,true));
test('parecer sem relatorio nao aprova regressao',()=>assert.equal(base.regressionValidated,false));
test('parecer sem relatorio bloqueia deploy',()=>assert.equal(base.canDeploy,false));
test('parecer sem relatorio bloqueia sincronizacao',()=>assert.equal(base.canEnableRealSync,false));
test('decisao fixa nao pronta',()=>assert.equal(base.releaseDecision,'NOT_READY_FOR_PRODUCTION'));
test('riscos documentados',()=>assert.equal(risks.length,9));
test('riscos com identificadores unicos',()=>assert.equal(new Set(risks.map(x=>x.id)).size,9));
test('todos os riscos abertos',()=>assert(base.risks.every(x=>x.status==='open')));
test('risco critico de deploy',()=>assert(risks.some(x=>x.area==='deployment'&&x.severity==='critical')));
test('risco de revogacao de sessao',()=>assert(risks.some(x=>x.area==='auth')));
test('risco de limitacao distribuida',()=>assert(risks.some(x=>x.area==='abuse')));
test('risco de autenticidade do backup',()=>assert(risks.some(x=>x.area==='backup')));
test('risco de privacidade',()=>assert(risks.some(x=>x.area==='privacy')));
test('relatorio valido reconhecido',()=>assert.equal(evaluateArchitecture({regressionReport:valid()}).regressionValidated,true));
test('relatorio valido nao autoriza deploy',()=>assert.equal(evaluateArchitecture({regressionReport:valid()}).canDeploy,false));
test('contagem adulterada rejeitada',()=>assert.equal(evaluateArchitecture({regressionReport:{...valid(),verifiedTests:172}}).regressionValidated,false));
test('bateria reprovada rejeitada',()=>{const r=valid();r.results[2].passed=false;assert.equal(evaluateArchitecture({regressionReport:r}).regressionValidated,false);});
test('codigo de saida nao zero rejeitado',()=>{const r=valid();r.results[2].exitCode=1;assert.equal(evaluateArchitecture({regressionReport:r}).regressionValidated,false);});
test('escopo de producao rejeitado',()=>assert.equal(evaluateArchitecture({regressionReport:{...valid(),scope:'production'}}).regressionValidated,false));
test('relatorio vazio rejeitado',()=>assert.equal(evaluateArchitecture({regressionReport:{}}).regressionValidated,false));
test('controle ausente e detectado',()=>{const r=evaluateArchitecture({readFile:()=>''});assert.equal(r.checksPassed,false);});
test('gravacao bloqueia decisao insegura',()=>assert.throws(()=>writeReport('nao-gravar.json',{...base,canDeploy:true})));
test('relatorio local gravado sem credenciais',()=>{
 const file=path.join(os.tmpdir(),'raytech-stage32-test-'+process.pid+'.json');
 try{writeReport(file,base);const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(saved.releaseDecision,'NOT_READY_FOR_PRODUCTION');
 assert.equal(saved.canEnableRealSync,false);
 }finally{try{fs.unlinkSync(file);}catch{}}
});
console.log('RESULTADO: '+n+'/24 TESTES APROVADOS');
