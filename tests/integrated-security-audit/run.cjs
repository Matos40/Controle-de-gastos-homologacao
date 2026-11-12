'use strict';
// Etapa 31: auditoria local. Nenhuma operacao em producao ou sincronizacao real.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const dep=process.env.RAYTECH_SAFE_NODE_MODULES;
if(!dep||!path.isAbsolute(dep)||
 !fs.existsSync(path.join(dep,'firebase','package.json'))||
 !fs.existsSync(path.join(dep,'firebase-admin','package.json'))){
 console.error('ERRO: defina RAYTECH_SAFE_NODE_MODULES com node_modules isolado e corrigido.');
 process.exit(2);
}
const local=[
 ['preproduction-audit','tests/preproduction-http-audit/audit.test.cjs',24],
 ['session-security','tests/http-session-security/session.test.cjs',23],
 ['http-guards','tests/http-guards/guards.test.cjs',20],
 ['http-telemetry','tests/http-telemetry/telemetry.test.cjs',20],
 ['backup-recovery','tests/backup-recovery/backup.test.cjs',26]
];
const emulator=[
 ['http-auth','tests/emulator-http-finance/http.test.cjs',20],
 ['http-resilience','tests/emulator-http-resilience/resilience.test.cjs',20],
 ['http-validation','tests/emulator-http-validation/validation.test.cjs',20]
];
const cfg=path.join(root,'tests/emulator-http-finance/firebase.json');
const conf=JSON.parse(fs.readFileSync(cfg,'utf8'));
if(conf.emulators.firestore.host!=='127.0.0.1'||conf.emulators.firestore.port!==8094||
 conf.emulators.auth.host!=='127.0.0.1'||conf.emulators.auth.port!==9100)
 throw Error('CONFIGURACAO INSEGURA: emuladores fora do loopback esperado.');
const project='demo-raytech-cg-http-lab';
const env={...process.env,NODE_PATH:dep,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8094',
 FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9100',GOOGLE_CLOUD_PROJECT:project,
 GCLOUD_PROJECT:project};
delete env.GOOGLE_APPLICATION_CREDENTIALS;
const results=[];
function execute(name,file,count,emulated){
 let r;
 if(!emulated){
  r=spawnSync(process.execPath,[path.join(root,file)],{
   cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 }else if(process.platform==='win32'){
  const cmdFile=path.join(os.tmpdir(),'raytech-audit31-'+process.pid+'-'+name+'.cmd');
  const quote=s=>'"'+s.replace(/"/g,'""')+'"';
  const inner='node '+quote(path.join(root,file));
  const command='call firebase emulators:exec --config '+quote(cfg)+
   ' --only auth,firestore --project '+project+' '+quote(inner);
  fs.writeFileSync(cmdFile,'@echo off\r\n'+command+'\r\n','utf8');
  try{r=spawnSync('cmd.exe',['/d','/c',cmdFile],{
   cwd:root,env,encoding:'utf8',timeout:240000,maxBuffer:16*1024*1024,windowsHide:true});
  }finally{try{fs.unlinkSync(cmdFile);}catch{}}
 }else{
  r=spawnSync('firebase',['emulators:exec','--config',cfg,'--only','auth,firestore',
   '--project',project,'node '+JSON.stringify(path.join(root,file))],{
   cwd:root,env,encoding:'utf8',timeout:240000,maxBuffer:16*1024*1024});
 }
 const output=(r.stdout||'')+'\n'+(r.stderr||'');
 process.stdout.write('\n=== '+name+' ===\n'+output);
 const expected='RESULTADO: '+count+'/'+count+' TESTES APROVADOS';
 const ok=r.status===0&&output.includes(expected)&&
  (!emulated||output.includes('Script exited successfully (code 0)'));
 const result={name,expectedTests:count,passed:ok,exitCode:r.status,
  metadataWarning:output.includes('MetadataLookupWarning'),
  timedOut:!!r.error&&r.error.code==='ETIMEDOUT'};
 results.push(result);
 if(!ok)console.error('FALHA NA BATERIA: '+name);
}
for(const [n,f,c] of local)execute(n,f,c,false);
for(const [n,f,c] of emulator)execute(n,f,c,true);
const passed=results.filter(r=>r.passed);
const report={
 schema:1,scope:'laboratorio-local-develop',date:new Date().toISOString(),
 project,results,passedBatteries:passed.length,totalBatteries:results.length,
 verifiedTests:passed.reduce((n,r)=>n+r.expectedTests,0),
 expectedTests:results.reduce((n,r)=>n+r.expectedTests,0),
 releaseDecision:'NOT_READY_FOR_PRODUCTION',
 outstandingRisks:[
  'Nao existe infraestrutura de producao, TLS, IAM e politicas de deploy revisadas.',
  'Rate limit em memoria nao protege ambientes distribuidos.',
  'Verificacao de revogacao de sessao nao esta integrada ao HTTP financeiro.',
  'Backup da etapa 30 nao autentica origem e nao esta integrado ao app.',
  'Logs e metricas sao locais, sem persistencia ou observabilidade de producao.',
  'MetadataLookupWarning exige investigacao de ambiente.',
  'Falta auditoria externa, teste de carga, recuperacao real e plano de incidentes.'
 ]
};
const outputPath=path.join(root,'raytech-stage31-audit-report.json');
fs.writeFileSync(outputPath,JSON.stringify(report,null,2),'utf8');
console.log('\nRELATORIO LOCAL: '+outputPath);
console.log('RESULTADO AUDITORIA 31: '+passed.length+'/'+results.length+' BATERIAS VALIDADAS');
console.log('TESTES VERIFICADOS: '+report.verifiedTests+'/'+report.expectedTests);
console.log('DECISAO: '+report.releaseDecision);
if(passed.length!==results.length)process.exitCode=1;
