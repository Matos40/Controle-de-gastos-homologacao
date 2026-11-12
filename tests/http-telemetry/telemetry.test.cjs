'use strict';
const assert=require('node:assert/strict');
const {createHttpTelemetryLab}=require('../../js/services/httpTelemetryLab.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('APROVADO:',name);}
const events=[];
const telemetry=createHttpTelemetryLab({sink:event=>events.push(event)});
test('sucesso HTTP 200',()=>assert.equal(telemetry.record({action:'audit',status:200}).outcome,'success'));
test('HTTP 400 classificado',()=>assert.equal(telemetry.record({action:'submit',status:400}).outcome,'client_error'));
test('HTTP 401 classificado',()=>assert.equal(telemetry.record({action:'audit',status:401}).outcome,'auth_error'));
test('HTTP 403 classificado',()=>assert.equal(telemetry.record({action:'audit',status:403}).outcome,'auth_error'));
test('HTTP 429 classificado',()=>assert.equal(telemetry.record({action:'submit',status:429}).outcome,'throttled'));
test('HTTP 503 classificado',()=>assert.equal(telemetry.record({action:'submit',status:503}).outcome,'busy'));
test('HTTP 500 classificado',()=>assert.equal(telemetry.record({action:'submit',status:500}).outcome,'server_error'));
test('HTTP 408 classificado',()=>assert.equal(telemetry.record({action:'initialize',status:408}).outcome,'client_error'));
test('acao desconhecida normalizada',()=>assert.equal(telemetry.record({action:'secret-action',status:200}).action,'unknown'));
test('status invalido normalizado',()=>assert.equal(telemetry.record({action:'audit',status:999}).status,500));
test('duracao negativa normalizada',()=>assert.equal(telemetry.record({action:'audit',status:200,durationMs:-100}).durationMs,0));
test('duracao excessiva limitada',()=>assert.equal(telemetry.record({action:'audit',status:200,durationMs:99999999}).durationMs,3600000));
test('duracao NaN normalizada',()=>assert.equal(telemetry.record({action:'audit',status:200,durationMs:NaN}).durationMs,0));
test('campos permitidos apenas',()=>assert.deepEqual(Object.keys(events[0]),['event','action','status','outcome','durationMs']));
test('evento imutavel',()=>assert(Object.isFrozen(events[0])));
test('contadores acumulam',()=>assert(telemetry.snapshot().some(x=>x.key==='audit:200'&&x.count>=2)));
test('snapshot imutavel',()=>assert(Object.isFrozen(telemetry.snapshot())));
test('sink com falha nao quebra operacao',()=>assert.equal(createHttpTelemetryLab({sink:()=>{throw Error('private');}}).record({status:200}).status,200));
test('sink invalido rejeitado',()=>assert.throws(()=>createHttpTelemetryLab({sink:123})));
test('dados sensiveis ignorados',()=>{
 const t=createHttpTelemetryLab({sink:e=>events.push(e)});
 const event=t.record({action:'submit',status:400,token:'secret-token',uid:'private-uid',
  email:'private@example.test',body:{salary:1000},ip:'127.0.0.1',error:'private'});
 const str=JSON.stringify(event);
 for(const secret of ['secret-token','private-uid','private@example.test','salary','127.0.0.1','private'])
  assert(!str.includes(secret));
});
console.log('RESULTADO: '+passed+'/20 TESTES APROVADOS');
