'use strict';
// Runner local somente leitura. Nunca inicia Firebase fora dos emuladores.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'../..');
const dep=process.env.RAYTECH_SAFE_NODE_MODULES;
if(!dep||!path.isAbsolute(dep)||!fs.existsSync(path.join(dep,'firebase','package.json'))||
 !fs.existsSync(path.join(dep,'firebase-admin','package.json'))){
 console.error('Defina RAYTECH_SAFE_NODE_MODULES para a pasta node_modules do ambiente corrigido.');
 process.exit(2);
}
const suites=[
 ['remote-idempotency','tests/emulator-remote-idempotency', 'remote.test.cjs',8090,null,19],
 ['durable-offline','tests/emulator-durable-offline','durable.test.cjs',8089,null,16],
 ['trusted-backend','tests/emulator-trusted-backend','backend.test.cjs',8091,null,22],
 ['authenticated-backend','tests/emulator-authenticated-backend','auth.test.cjs',8092,9098,20],
 ['security-audit','tests/emulator-security-audit','audit.test.cjs',8093,9099,22]
];
const projectIds={
 'remote-idempotency':'demo-raytech-regression-remote-idempotency',
 'durable-offline':'demo-raytech-regression-durable-offline',
 'trusted-backend':'demo-raytech-regression-trusted-backend',
 'authenticated-backend':'demo-raytech-cg-auth-backend',
 'security-audit':'demo-raytech-cg-security'
};
const selected=process.argv.slice(2);
if(selected.some(s=>!suites.some(x=>x[0]===s))){
 console.error('Suite desconhecida. Opcoes: '+suites.map(x=>x[0]).join(', '));process.exit(2);
}
const run=suites.filter(s=>!selected.length||selected.includes(s[0]));
const results=[];
for(const [name,dir,file,port,auth,count] of run){
 const cfg=path.join(root,dir,'firebase.json');
 const parsed=JSON.parse(fs.readFileSync(cfg,'utf8'));
 if(parsed.emulators.firestore.host!=='127.0.0.1'||parsed.emulators.firestore.port!==port||
  (auth&&(parsed.emulators.auth.host!=='127.0.0.1'||parsed.emulators.auth.port!==auth)))
  throw Error('Configuracao insegura: '+name);
 const project=projectIds[name];
 const env={...process.env,NODE_PATH:dep,
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:'+port,
  GOOGLE_CLOUD_PROJECT:project,
  GCLOUD_PROJECT:project,
  NODE_OPTIONS:[process.env.NODE_OPTIONS||'', '--trace-warnings'].filter(Boolean).join(' ')};
 if(auth)env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:'+auth;
 else delete env.FIREBASE_AUTH_EMULATOR_HOST;
 // Evitar credenciais externas no teste; a verificacao de ID token usa emulador.
 delete env.GOOGLE_APPLICATION_CREDENTIALS;
 const testFile=path.join(root,dir,file);
 console.log('\n=== '+name+' ===');
 let r;
 if(process.platform==='win32'){
  // Windows .cmd necessita de um unico argumento de comando para emulators:exec.
  // Um arquivo .cmd temporario evita a redivisao de argumentos por shell:true.
  const cmdFile=path.join(os.tmpdir(),'raytech-regression-'+process.pid+'-'+name+'.cmd');
  const quote=s=>'"'+s.replace(/"/g,'""')+'"';
  const inner='node '+quote(testFile);
  const commandLine='call firebase emulators:exec --config '+quote(cfg)+
   ' --only '+(auth?'auth,firestore':'firestore')+
   ' --project '+project+' '+quote(inner);
  fs.writeFileSync(cmdFile,'@echo off\r\n'+commandLine+'\r\n','utf8');
  try{
   r=spawnSync('cmd.exe',['/d','/c',cmdFile],{cwd:root,env,encoding:'utf8',
    maxBuffer:16*1024*1024,timeout:180000,windowsHide:true,shell:false});
  }finally{try{fs.unlinkSync(cmdFile);}catch{}}
 }else{
  r=spawnSync('firebase',['emulators:exec','--config',cfg,'--only',
   auth?'auth,firestore':'firestore','--project',project,
   'node '+JSON.stringify(testFile)],{cwd:root,env,encoding:'utf8',
   maxBuffer:16*1024*1024,timeout:180000,windowsHide:true,shell:false});
 }
 const output=(r.stdout||'')+'\n'+(r.stderr||'');
 process.stdout.write(output);
 const expected='RESULTADO: '+count+'/'+count+' TESTES APROVADOS';
 const ok=r.status===0&&output.includes(expected)&&output.includes('Script exited successfully (code 0)');
 const warning=output.includes('MetadataLookupWarning');
 const stack=output.split(/\r?\n/).filter(line=>
  /MetadataLookupWarning|metadata.*lookup|google-auth-library|gcp-metadata|google-gax|ETIMEDOUT|trace-warnings/i.test(line)).slice(0,30);
 results.push({name,expected:count,passed:ok,exitCode:r.status,signal:r.signal||null,
  metadataWarning:warning,warningEvidence:stack,error:r.error?String(r.error):null});
 if(!ok)console.error('BATERIA NAO VALIDADA: '+name);
}
const summary={date:new Date().toISOString(),runtime:process.version,
 dependencyFolder:dep,results,passed:results.filter(x=>x.passed).length,total:results.length,
 warningNote:'Aviso de metadados nao equivale a falha de autenticacao; stack requer analise.'};
const out=path.join(root,'raytech-regression-security-report.json');
fs.writeFileSync(out,JSON.stringify(summary,null,2));
console.log('\nRELATORIO LOCAL: '+out);
console.log('RESULTADO REGRESSAO: '+summary.passed+'/'+summary.total+' BATERIAS VALIDADAS');
if(summary.passed!==summary.total)process.exitCode=1;
