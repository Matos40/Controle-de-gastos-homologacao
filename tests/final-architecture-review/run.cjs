'use strict';
// Parecer somente leitura; nao inicia emuladores, nao usa credenciais ou rede.
const fs=require('node:fs');
const path=require('node:path');
const {evaluateArchitecture,writeReport}=require('../../js/services/finalArchitectureReviewLab.js');
const root=path.resolve(__dirname,'../..');
const previous=path.join(root,'raytech-stage31-audit-report.json');
let report=null;
if(fs.existsSync(previous)){
 try{report=JSON.parse(fs.readFileSync(previous,'utf8'));}
 catch{console.error('AVISO: relatorio da etapa 31 invalido');}
}
const result=evaluateArchitecture({regressionReport:report});
const out=path.join(root,'raytech-stage32-architecture-report.json');
writeReport(out,result);
console.log('RELATORIO LOCAL: '+out);
console.log('CONTROLES: '+result.checks.filter(c=>c.pass).length+'/'+result.checks.length);
console.log('REGRESSAO ETAPA 31: '+(result.regressionValidated?'VALIDADA':'NAO VALIDADA'));
console.log('RISCOS ABERTOS: '+result.risks.length);
console.log('DECISAO: '+result.releaseDecision);
if(!result.checksPassed||!result.regressionValidated)process.exitCode=1;
