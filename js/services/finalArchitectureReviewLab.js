'use strict';
// Avaliacao final da arquitetura: somente leitura, sem rede ou Firebase.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const risks=Object.freeze([
 {id:'R01',severity:'critical',area:'deployment',issue:'Runtime e perimetro de producao nao definidos',
  mitigation:'Definir Cloud Run/Functions, TLS, IAM, isolamento, credenciais e deploy revisado',
  evidence:'Arquitetura de laboratorio sem manifesto de deploy aprovado'},
 {id:'R02',severity:'high',area:'auth',issue:'Revogacao de sessao nao integrada ao endpoint financeiro',
  mitigation:'Integrar politica de sessao com revogacao e testar expiracao, logout e contas bloqueadas',
  evidence:'httpFinanceLab usa parseBearer; backend valida token sem checkRevoked'},
 {id:'R03',severity:'high',area:'abuse',issue:'Rate limit em memoria e por token apresentado',
  mitigation:'Adicionar controles distribuidos e por usuario verificado, borda e quotas',
  evidence:'httpGuardsLab usa Map local e token antes da autenticacao'},
 {id:'R04',severity:'high',area:'backup',issue:'SHA-256 sem autenticidade ou criptografia',
  mitigation:'Assinar/autenticar backups, definir protecao de chaves e testes de restauracao',
  evidence:'backupRecoveryLab calcula hash sem segredo'},
 {id:'R05',severity:'high',area:'data',issue:'Backup isolado e sem validacao completa do modelo financeiro',
  mitigation:'Especificar esquema, migracoes, compatibilidade e restauracao transacional real',
  evidence:'createBackup verifica meses e mes selecionado, nao toda a semantica'},
 {id:'R06',severity:'high',area:'operations',issue:'Telemetria somente local e sem politica de incidentes',
  mitigation:'Definir logs seguros, metricas, alertas, retencao e resposta a incidentes',
  evidence:'httpTelemetryLab usa contadores em memoria'},
 {id:'R07',severity:'medium',area:'environment',issue:'MetadataLookupWarning intermitente no ambiente local',
  mitigation:'Isolar dependencia de metadados e investigar timeouts sem silenciar erros',
  evidence:'Relato de stack gcp-metadata/GoogleAuth na regressao anterior'},
 {id:'R08',severity:'high',area:'assurance',issue:'Faltam testes de carga, restauracao remota e revisao independente',
  mitigation:'Executar exercicios de falha, concorrencia, recuperacao e revisao externa',
  evidence:'Testes atuais usam emuladores e cenarios controlados'},
 {id:'R09',severity:'high',area:'privacy',issue:'Politica de dados financeiros e gestao de acesso ainda nao homologadas',
  mitigation:'Definir minimizacao, retencao, exclusao, segregacao e avaliacao LGPD',
  evidence:'Nao ha avaliacao operacional de dados reais neste laboratorio'}
]);
const allowed=new Set(['critical','high','medium','low']);
function evaluateArchitecture({readFile,regressionReport}={}){
 const read=readFile||((p)=>fs.readFileSync(path.join(root,p),'utf8'));
 const files={
  http:read('js/services/httpFinanceLab.js'),
  guards:read('js/services/httpGuardsLab.js'),
  session:read('js/services/httpSessionSecurityLab.js'),
  backup:read('js/services/backupRecoveryLab.js'),
  telemetry:read('js/services/httpTelemetryLab.js')
 };
 const checks=[
  {id:'C01',pass:files.http.includes('assertLab();'),detail:'HTTP exige emuladores locais'},
  {id:'C02',pass:files.http.includes('parseBearer(header,{allowUnsignedEmulator:true})'),detail:'Token sem assinatura permitido somente no laboratorio protegido por assertLab'},
  {id:'C03',pass:files.http.includes('createAuthenticatedBackend'),detail:'Backend autenticado presente'},
  {id:'C04',pass:files.http.includes('validate(action,data)'),detail:'Validacao HTTP presente'},
  {id:'C05',pass:files.http.includes('guards.acquire(token)'),detail:'Limitador local presente'},
  {id:'C06',pass:files.http.includes('telemetry.record'),detail:'Telemetria presente'},
  {id:'C07',pass:files.session.includes('checkRevoked=false'),detail:'Revogacao opcional nao ativada por padrao'},
  {id:'C08',pass:files.guards.includes('new Map()'),detail:'Rate limit em memoria identificado'},
  {id:'C09',pass:files.backup.includes("createHash('sha256')"),detail:'Checksum de backup identificado'},
  {id:'C10',pass:files.backup.includes('const next=verifyBackup(envelope)'),detail:'Verificacao antes da restauracao'},
  {id:'C11',pass:files.telemetry.includes('const counters=new Map()'),detail:'Metricas apenas em memoria'},
  {id:'C12',pass:risks.every(r=>allowed.has(r.severity)&&r.mitigation&&r.evidence),detail:'Riscos possuem severidade, mitigacao e evidencia'}
 ];
 const regression=regressionReport||null;
 const regressionValidated=!!regression&&regression.scope==='laboratorio-local-develop'&&
  regression.passedBatteries===8&&regression.totalBatteries===8&&
  regression.verifiedTests===173&&regression.expectedTests===173&&
  Array.isArray(regression.results)&&regression.results.length===8&&
  regression.results.every(r=>r.passed===true&&r.exitCode===0);
 const checksPassed=checks.every(c=>c.pass);
 return {
  schema:1,scope:'laboratorio-local-develop',generatedAt:new Date().toISOString(),
  checks,checksPassed,regressionValidated,
  regressionSource:regression?'report-local':'not-provided',
  risks:risks.map(r=>({...r,status:'open'})),
  releaseDecision:'NOT_READY_FOR_PRODUCTION',
  canDeploy:false,canEnableRealSync:false,
  note:regressionValidated?'Relatorio local coerente; nao constitui autorizacao de producao':
   'Relatorio da etapa 31 ausente ou inconsistente; nao constitui autorizacao de producao'
 };
}
function writeReport(file,report){
 if(!report||report.releaseDecision!=='NOT_READY_FOR_PRODUCTION'||report.canDeploy!==false||
  report.canEnableRealSync!==false)throw Error('Decisao de seguranca invalida');
 fs.writeFileSync(file,JSON.stringify(report,null,2),'utf8');
}
module.exports={risks,evaluateArchitecture,writeReport};
