const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const initial = {selectedMonth:'2026-11',months:{'2026-11':{salary:1000,expenses:[],cardExpenses:[],extraIncomes:[]}}};
  const memory = new Map([['controle_gastos_multimonth_v3',JSON.stringify(initial)]]);
  const messages = [];
  let confirmAction = null;
  let failWrites = false;
  let workbook = {SheetNames:[],Sheets:{}};
  const context = vm.createContext({
    console,Date,Math,setTimeout,Uint8Array,
    document:{getElementById:()=>null},
    renderAll:()=>{},showToast:(message,type)=>messages.push({message,type}),
    showModal:(title,description,callback)=>{confirmAction=callback;},
    localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>{if(failWrites)throw Error('QuotaExceededError');memory.set(k,v);}},
    FileReader:class {
      readAsText(file){this.onload({target:{result:file.text}});}
      readAsArrayBuffer(){this.onload({target:{result:new ArrayBuffer(0)}});}
    },
    XLSX:{read:()=>workbook,utils:{sheet_to_json:sheet=>sheet.rows||[]}}
  });
  for(const path of ['js/state.js','js/services/storageService.js','js/services/excelService.js'])
    vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
  vm.runInContext('loadDatabase()',context);
  return {
    memory,messages,run:code=>vm.runInContext(code,context),
    setWorkbook:value=>{workbook=value;},confirm:()=>confirmAction?.(),
    hasConfirmation:()=>Boolean(confirmAction),failWrites:()=>{failWrites=true;}
  };
}

test('cancelar importacao JSON nao altera armazenamento',()=>{
  const t=fixture(),before=t.memory.get('controle_gastos_multimonth_v3');
  t.run('handleJsonImport({target:{files:[{text:JSON.stringify({selectedMonth:"2026-12",months:{"2026-12":{salary:2,expenses:[],cardExpenses:[]}}})}],value:"arquivo"}})');
  assert.equal(t.hasConfirmation(),true);
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
});

test('JSON corrompido nao solicita confirmacao nem altera dados',()=>{
  const t=fixture(),before=t.memory.get('controle_gastos_multimonth_v3');
  t.run('handleJsonImport({target:{files:[{text:"{invalido"}],value:"arquivo"}})');
  assert.equal(t.hasConfirmation(),false);
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
  assert.ok(t.messages.some(m=>m.type==='error'));
});

test('falha de gravacao restaura estado anterior e nao informa sucesso',()=>{
  const t=fixture(),before=t.memory.get('controle_gastos_multimonth_v3');
  t.run('handleJsonImport({target:{files:[{text:JSON.stringify({selectedMonth:"2026-12",months:{"2026-12":{salary:2,expenses:[],cardExpenses:[]}}})}],value:"arquivo"}})');
  t.failWrites();
  t.confirm();
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
  assert.equal(t.run('appDb.selectedMonth'),'2026-11');
  assert.ok(t.messages.some(m=>m.type==='error'));
  assert.ok(!t.messages.some(m=>m.type==='success'));
});

test('Excel com backup integral corrompido nao importa outras abas',()=>{
  const t=fixture(),before=t.memory.get('controle_gastos_multimonth_v3');
  t.setWorkbook({SheetNames:['Backup restauracao','Despesas gerais'],Sheets:{
    'Backup restauracao':{rows:[{JSON:'{invalido'}]},
    'Despesas gerais':{rows:[{'Descrição':'Conta ficticia','Valor':500}]}
  }});
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
  assert.equal(t.hasConfirmation(),false);
  assert.ok(t.messages.some(m=>m.type==='error'));
});

test('cancelar restauracao de Excel valido preserva dados atuais',()=>{
  const t=fixture(),before=t.memory.get('controle_gastos_multimonth_v3');
  t.setWorkbook({SheetNames:['Backup restauracao'],Sheets:{
    'Backup restauracao':{rows:[{JSON:JSON.stringify({selectedMonth:'2026-12',months:{'2026-12':{salary:10,expenses:[],cardExpenses:[]}}})}]}
  }});
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.hasConfirmation(),true);
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
});

test('importacao convencional Excel reverte alteracoes se gravacao falhar',()=>{
  const t=fixture(),before=t.memory.get('controle_gastos_multimonth_v3');
  t.setWorkbook({SheetNames:['Despesas gerais'],Sheets:{
    'Despesas gerais':{rows:[{'Descrição':'Despesa nova','Valor':250}]}
  }});
  t.failWrites();
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),0);
  assert.ok(t.messages.some(m=>m.type==='error'));
  assert.ok(!t.messages.some(m=>m.type==='success'));
});

test('importacao convencional Excel valida dados antes de gravar e preserva base original',()=>{
  const t=fixture();
  t.setWorkbook({SheetNames:['Despesas gerais'],Sheets:{
    'Despesas gerais':{rows:[{'Descrição':'Despesa nova','Valor':250}]}
  }});
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),1);
  assert.equal(JSON.parse(t.memory.get('controle_gastos_multimonth_v3')).months['2026-11'].expenses[0].amount,250);
  assert.ok(t.messages.some(m=>m.type==='success'));
});

test('Excel sem lancamentos validos nao altera armazenamento',()=>{
  const t=fixture(),before=t.memory.get('controle_gastos_multimonth_v3');
  t.setWorkbook({SheetNames:['Despesas gerais'],Sheets:{
    'Despesas gerais':{rows:[{'Descrição':'','Valor':250}]}
  }});
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.memory.get('controle_gastos_multimonth_v3'),before);
  assert.ok(!t.messages.some(m=>m.type==='success'));
});

test('Excel preserva lancamentos distintos com mesmo titulo e valores diferentes',()=>{
  const t=fixture();
  t.setWorkbook({SheetNames:['Despesas gerais'],Sheets:{
    'Despesas gerais':{rows:[
      {'Descrição':'Mercado','Valor':100},
      {'Descrição':'Mercado','Valor':200}
    ]}
  }});
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),2);
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),2);
});

test('Excel preserva duas linhas identicas e nao duplica ao reimportar',()=>{
  const t=fixture();
  t.setWorkbook({SheetNames:['Despesas gerais'],Sheets:{
    'Despesas gerais':{rows:[
      {'Descrição':'Cafe','Valor':20},
      {'Descrição':'Cafe','Valor':20}
    ]}
  }});
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),2);
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),2);
});

test('Excel nao confunde despesa manual com linha importada de mesmo titulo',()=>{
  const t=fixture();
  t.run('appDb.months["2026-11"].expenses.push({id:"manual1",title:"Cafe",amount:20,date:"2026-11-10",type:"one-time"});saveDatabase()');
  t.setWorkbook({SheetNames:['Despesas gerais'],Sheets:{
    'Despesas gerais':{rows:[{'Descrição':'Cafe','Valor':20}]}
  }});
  t.run('handleExcelImport({target:{files:[{}],value:"arquivo"}})');
  assert.equal(t.run('appDb.months["2026-11"].expenses.length'),2);
});
