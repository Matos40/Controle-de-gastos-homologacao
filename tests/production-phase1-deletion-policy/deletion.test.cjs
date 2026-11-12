'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {marker,validateMarkers,nextCandidate,plan}=require('../../js/services/installmentDeletionPolicyLab.js');
const src=fs.readFileSync(path.resolve(__dirname,'../../js/services/storageService.js'),'utf8');
const state=fs.readFileSync(path.resolve(__dirname,'../../js/state.js'),'utf8');
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('APROVADO:',name);};
const err=(fn,code)=>assert.throws(fn,e=>e.code===code);
const item=(id='a',origin='orig',n=1,total=3)=>({id,title:'Notebook',isInstallment:true,installmentOriginId:origin,currentInstallment:n,installments:total,installmentValue:100});
const clone=x=>JSON.parse(JSON.stringify(x));
function extract(source,name){
 const start=source.indexOf('function '+name+'(');
 if(start<0)throw Error('missing real function: '+name);
 const brace=source.indexOf('{',start);let depth=0;
 for(let i=brace;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return source.slice(start,i+1);}
 throw Error('unclosed real function: '+name);
}
function real(mode,deleted=[],cards=[item()],current=[]){
 const db={selectedMonth:'2026-11',months:{'2026-10':{salary:100,expenses:[],cardExpenses:clone(cards)},
 '2026-11':{salary:100,expenses:[],cardExpenses:clone(current),deletedInstallmentOrigins:clone(deleted)}}};
 if(mode==='create')delete db.months['2026-11'];
 const ctx={db,Date,Math,console,document:{getElementById(){return null;}},setTimeout(){},
 saveDatabase(){},renderAll(){},showToast(){},formatMonthYear(x){return x;},
 inferCategoryFromTitle(){return 'outros';}};
 vm.createContext(ctx);
 vm.runInContext([extract(state,'getPreviousMonthYM'),extract(src,'ensureMonthExists'),
 extract(src,'syncFromPreviousMonth'),'var appDb=db;',
 'function getCurrentMonthData(){return db.months[db.selectedMonth];}'].join('\n'),ctx,{timeout:1500});
 vm.runInContext(mode==='create'?"ensureMonthExists('2026-11')":'syncFromPreviousMonth(false)',ctx,{timeout:1500});
 return db.months['2026-11'].cardExpenses;
}
test('marcador valido',()=>assert.equal(marker('orig',2),'orig:2'));
test('origem vazia rejeitada',()=>err(()=>marker('',2),'invalid_marker'));
test('origem com dois pontos rejeitada',()=>err(()=>marker('a:b',2),'invalid_marker'));
test('origem com barra rejeitada',()=>err(()=>marker('a/b',2),'invalid_marker'));
test('numero zero rejeitado',()=>err(()=>marker('a',0),'invalid_marker'));
test('numero fracionario rejeitado',()=>err(()=>marker('a',1.5),'invalid_marker'));
test('marcadores validos',()=>assert.equal(validateMarkers(['a:2','b:3']).length,2));
test('marcador duplicado rejeitado',()=>err(()=>validateMarkers(['a:2','a:2']),'invalid_markers'));
test('marcador malformado rejeitado',()=>err(()=>validateMarkers(['a:0']),'invalid_markers'));
test('colecao de marcadores invalida rejeitada',()=>err(()=>validateMarkers('a:2'),'invalid_markers'));
test('proxima parcela calculada',()=>assert.equal(nextCandidate(item()).number,2));
test('parcela final nao avanca',()=>assert.equal(nextCandidate(item('a','orig',3)),null));
test('sequencia invalida rejeitada',()=>err(()=>nextCandidate(item('a','orig',4)),'invalid_sequence'));
test('origem legada ambigua rejeitada',()=>{const c=item();delete c.installmentOriginId;err(()=>nextCandidate(c),'ambiguous_legacy_origin');});
test('item nao parcelado ignorado',()=>assert.equal(nextCandidate({isInstallment:false}),null));
test('cria parcela legitima',()=>assert.equal(plan([item()],'2026-11').created,1));
test('bloqueia somente parcela marcada',()=>assert.equal(plan([item()],'2026-11',['orig:2']).decisions[0].action,'skip_deleted'));
test('outra parcela nao e bloqueada',()=>assert.equal(plan([item()],'2026-11',['orig:3']).created,1));
test('outra origem nao e bloqueada',()=>assert.equal(plan([item()],'2026-11',['other:2']).created,1));
test('evita parcela ja existente',()=>assert.equal(plan([item()],'2026-11',[],[item('new','orig',2)]).decisions[0].action,'skip_existing'));
test('duas parcelas existentes rejeitadas',()=>err(()=>plan([item()],'2026-11',[],[item('x','orig',2),item('y','orig',2)]),'duplicate_target'));
test('origem duplicada na fonte rejeitada',()=>err(()=>plan([item(),item('b')],'2026-11'),'duplicate_source'));
test('duas origens independentes',()=>assert.equal(plan([item(),item('b','other')],'2026-11',['orig:2']).created,1));
test('mes invalido rejeitado',()=>err(()=>plan([item()],'2026-13'),'invalid_month'));
test('fonte invalida rejeitada',()=>err(()=>plan({},'2026-11'),'invalid_collection'));
test('nao altera fonte',()=>{const cards=[item()],before=clone(cards);plan(cards,'2026-11');assert.deepEqual(cards,before);});
test('sincronizacao real respeita marcador no destino',()=>assert.equal(real('sync',['orig:2']).length,0));
test('sincronizacao real insere parcela sem marcador',()=>assert.equal(real('sync').length,1));
test('sincronizacao real evita duplicacao',()=>assert.equal(real('sync',[],[item()],[item('new','orig',2)]).length,1));
test('criacao real avanca parcela',()=>assert.equal(real('create').length,1));
test('criacao real nao consulta marcador do mes de destino ausente',()=>{
 // Divergencia conhecida: sem mes criado nao existe lista de destino a consultar.
 assert.equal(real('create',['orig:2']).length,1);
});
test('politica proposta permite marcador externo do mes destino',()=>assert.equal(plan([item()],'2026-11',['orig:2']).created,0));
test('marcador do mes anterior nao deve bloquear automaticamente o destino',()=>assert.equal(plan([item()],'2026-11',[]).created,1));
test('sem criar depois de exclusao no mesmo mes',()=>assert.equal(plan([item()],'2026-11',['orig:2']).created,0));
test('parcela tres nao e bloqueada por exclusao da dois',()=>assert.equal(plan([item('a','orig',2)],'2026-12',['orig:2']).created,1));
test('sem origem nao inventa identidade',()=>{const c=item();delete c.installmentOriginId;err(()=>plan([c],'2026-11'),'ambiguous_legacy_origin');});
console.log('RESULTADO: '+passed+'/36 TESTES APROVADOS');
