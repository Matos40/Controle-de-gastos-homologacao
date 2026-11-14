/* Strict synthetic snapshot boundary. No access to browser storage. */
const marker="raytech-financial-test-v1";
export function blank(ym){return {selectedMonth:ym,months:{[ym]:{salary:0,budgetLimit:0,extraIncomes:[],expenses:[],cardExpenses:[],deletedInstallmentOrigins:[],closed:false,closedAt:null}}};}
export function validatePayload(payload){
  const fail=()=>{throw Error("INVALID_TEST_DATA: utilize descrições com a palavra Teste e valores válidos.");};
  const obj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
  const keys=(x,allowed,required=allowed)=>obj(x)&&Object.keys(x).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(x,k));
  const ym=x=>typeof x==="string"&&/^(20[0-9]{2})-(0[1-9]|1[0-2])$/.test(x);
  const date=x=>typeof x==="string"&&/^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(x);
  const money=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=10000000&&Math.abs(x*100-Math.round(x*100))<0.0001;
  const id=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
  const name=x=>typeof x==="string"&&x.length<=100&&/\bteste\b/i.test(x)&&!/[\x00-\x1f<>&"'`\\]/.test(x);
  const cat=x=>["moradia","alimentacao","transporte","compras","lazer","saude","investimentos","outros"].includes(x);
  if(typeof payload!=="string"||payload.length>180000)fail();
  const d=JSON.parse(payload);
  if(!keys(d,["selectedMonth","months"])||!ym(d.selectedMonth)||!obj(d.months)||!Object.hasOwn(d.months,d.selectedMonth)||Object.keys(d.months).length>24)fail();
  for(const [month,m] of Object.entries(d.months)){
    if(!ym(month)||!keys(m,["salary","budgetLimit","extraIncomes","expenses","cardExpenses","deletedInstallmentOrigins","closed","closedAt"],["salary","budgetLimit","extraIncomes","expenses","cardExpenses","closed","closedAt"])||!money(m.salary)||!money(m.budgetLimit)||typeof m.closed!=="boolean"||!(m.closedAt===null||(typeof m.closedAt==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.closedAt))))fail();
    for(const k of ["expenses","cardExpenses","extraIncomes"]){if(!Array.isArray(m[k])||m[k].length>200)fail();const seen=new Set();for(const x of m[k]){
      if(!obj(x)||!id(x.id)||seen.has(x.id)||!date(x.date))fail();seen.add(x.id);
      if(k==="expenses"){
        if(!keys(x,["id","title","category","amount","type","date","paid"])||!name(x.title)||!cat(x.category)||!money(x.amount)||!["fixed","one-time"].includes(x.type)||typeof x.paid!=="boolean")fail();
      }else if(k==="extraIncomes"){
        if(!keys(x,["id","description","amount","date"])||!name(x.description)||!money(x.amount))fail();
      }else{
        if(!keys(x,["id","installmentOriginId","title","category","isInstallment","installmentValue","totalAmount","installments","currentInstallment","date","paid"],["id","title","category","isInstallment","installmentValue","totalAmount","installments","currentInstallment","date","paid"])||!name(x.title)||!cat(x.category)||typeof x.isInstallment!=="boolean"||typeof x.paid!=="boolean"||!money(x.installmentValue)||!money(x.totalAmount)||!Number.isInteger(x.installments)||!Number.isInteger(x.currentInstallment)||x.installments<1||x.installments>120||x.currentInstallment<1||x.currentInstallment>x.installments||(x.isInstallment?(!id(x.installmentOriginId)||x.installments<2):(x.installments!==1||x.currentInstallment!==1))||Math.abs(x.totalAmount-x.installmentValue*x.installments)>0.011)fail();
      }
    }}
    const tomb=m.deletedInstallmentOrigins??[];if(!Array.isArray(tomb)||tomb.length>500||new Set(tomb).size!==tomb.length||!tomb.every(x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}:[1-9][0-9]{0,2}$/.test(x)))fail();
  }return d;
}
export function validId(x){return typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);}
export function validateEnvelope(s){
  if(!s||Object.keys(s).sort().join("|")!=="lastOperationId|marker|payload|receipts|revision"||s.marker!==marker||!Number.isInteger(s.revision)||s.revision<1||s.revision>500||!s.receipts||typeof s.receipts!=="object"||Array.isArray(s.receipts)||Object.keys(s.receipts).length!==s.revision||!validId(s.lastOperationId)||!Object.hasOwn(s.receipts,s.lastOperationId))throw Error("INVALID_ENVELOPE");
  const revs=new Set();for(const [k,v] of Object.entries(s.receipts)){if(!validId(k)||typeof v!=="string"||!/^[1-9][0-9]{0,2}:[0-9a-f]{64}$/.test(v))throw Error("INVALID_RECEIPT");const n=Number(v.split(":")[0]);if(n>s.revision||revs.has(n))throw Error("INVALID_RECEIPT");revs.add(n);}
  if(!s.receipts[s.lastOperationId].startsWith(s.revision+":"))throw Error("INVALID_RECEIPT");
  validatePayload(s.payload);return s;
}
export function apply(old,q,hash){
  if(old)validateEnvelope(old);if(!q||!validId(q.id)||!Number.isInteger(q.expectedRevision)||q.expectedRevision<0||q.expectedRevision>=500||typeof hash!=="string"||!/^[0-9a-f]{64}$/.test(hash))throw Error("INVALID_COMMAND");
  validatePayload(q.payload);const receipt=(q.expectedRevision+1)+":"+hash;
  if(old&&Object.hasOwn(old.receipts,q.id)){if(old.receipts[q.id]!==receipt)throw Error("ID_REUSE");return {state:old,replay:true};}
  if((old?.revision??0)!==q.expectedRevision)throw Error("CONFLICT");
  const s={marker,revision:q.expectedRevision+1,lastOperationId:q.id,payload:q.payload,receipts:{...(old?.receipts??{}),[q.id]:receipt}};validateEnvelope(s);return {state:s,replay:false};
}

export function operationStatus(confirmed,q){if(confirmed&&Object.hasOwn(confirmed.receipts,q.id))return "recorded";const rev=confirmed?.revision??0;return rev===q.expectedRevision?"ready":rev>q.expectedRevision?"conflict":"future";}
export function checkSuccessor(previous,next){if(!previous)return;if(!next||next.revision<previous.revision)throw Error("REVISION_ROLLBACK");for(const [id,receipt] of Object.entries(previous.receipts)){if(next.receipts[id]!==receipt)throw Error("RECEIPT_DIVERGENCE");}if(next.revision===previous.revision&&(next.payload!==previous.payload||next.lastOperationId!==previous.lastOperationId))throw Error("REVISION_DIVERGENCE");}
export function validateRecovery(pack,uid){if(!pack||Object.keys(pack).sort().join("|")!=="format|operation|sha256|uid"||pack.format!=="raytech-test-recovery-v1"||pack.uid!==uid||typeof pack.sha256!=="string"||!/^[0-9a-f]{64}$/.test(pack.sha256))throw Error("RECOVERY_FORMAT");const q=pack.operation;if(!q||Object.keys(q).sort().join("|")!=="expectedRevision|id|payload"||!validId(q.id)||!Number.isInteger(q.expectedRevision)||q.expectedRevision<0||q.expectedRevision>=500)throw Error("RECOVERY_OPERATION");validatePayload(q.payload);return q;}
export function recoveryPackage(uid,q,sha256){const pack={format:"raytech-test-recovery-v1",uid,operation:q,sha256};validateRecovery(pack,uid);return pack;}

export function validateQueued(q){if(!q||!validId(q.id)||!Number.isInteger(q.expectedRevision)||q.expectedRevision<0||q.expectedRevision>=500)throw Error("INVALID_QUEUE");validatePayload(q.payload);if(Object.hasOwn(q,"parentId")){if(Object.keys(q).sort().join("|")!=="expectedRevision|id|parentId|payload"||!(q.expectedRevision===0?q.parentId==="":validId(q.parentId))||q.parentId===q.id)throw Error("INVALID_PARENT");}else if(Object.keys(q).sort().join("|")!=="expectedRevision|id|payload")throw Error("INVALID_QUEUE");return q;}
export function queueStatus(confirmed,rows){
  const rev=confirmed?.revision??0, parent=confirmed?.lastOperationId??"";
  if(!rows.length)return {kind:"empty",revision:rev,parent};
  const ids=new Set();for(const q of rows){validateQueued(q);if(ids.has(q.id))throw Error("DUPLICATE_ID");ids.add(q.id);}
  const sorted=[...rows].sort((a,b)=>a.expectedRevision-b.expectedRevision||a.id.localeCompare(b.id));
  const first=sorted[0];
  if(confirmed&&Object.hasOwn(confirmed.receipts,first.id))return {kind:"recorded",first};
  if(first.expectedRevision!==rev||Object.hasOwn(first,"parentId")&&first.parentId!==parent)return {kind:"conflict",first};
  if(!Object.hasOwn(first,"parentId")&&sorted.length>1)return {kind:"conflict",first};
  let previous=first;
  for(const q of sorted.slice(1)){if(q.expectedRevision!==previous.expectedRevision+1||q.parentId!==previous.id)return {kind:"conflict",first};previous=q;}
  return {kind:"ready",first,tail:previous,revision:previous.expectedRevision+1,parent:previous.id};
}
export function assertParent(remote,q){validateQueued(q);if(remote&&Object.hasOwn(remote.receipts,q.id))return;if(Object.hasOwn(q,"parentId")&&(remote?.lastOperationId??"")!==q.parentId)throw Error("CONFLICT");}
export function appendQueued(confirmed,rows,view,payload,id){const plan=queueStatus(confirmed,rows);if(!["empty","ready"].includes(plan.kind)||rows.length>=16||plan.revision>=500||view.revision!==plan.revision||view.parent!==plan.parent)throw Error("QUEUE_BLOCKED");if(rows.length&& !Object.hasOwn(plan.first,"parentId"))throw Error("LEGACY_PENDING");const q={id,expectedRevision:plan.revision,parentId:plan.parent,payload};validateQueued(q);if(!queueFits(rows,q))throw Error("QUEUE_CAPACITY");return q;}
export function makeQueueBackup(uid,rows){return {format:"raytech-test-queue-v1",uid,operations:rows.map(validateQueued)};}
export function readQueueBackup(pack,uid){if(!pack||Object.keys(pack).sort().join("|")!=="format|operations|uid"||pack.format!=="raytech-test-queue-v1"||pack.uid!==uid||!Array.isArray(pack.operations)||pack.operations.length<1||pack.operations.length>16)throw Error("RECOVERY_FORMAT");const ids=new Set();return pack.operations.map(q=>{validateQueued(q);if(ids.has(q.id))throw Error("DUPLICATE_ID");ids.add(q.id);return q;});}

export function canonical(x){if(x===null||typeof x!=="object")return JSON.stringify(x);if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";}
export function backupPack(payload,sha256){validatePayload(payload);if(typeof sha256!=="string"||!/^[0-9a-f]{64}$/.test(sha256))throw Error("BACKUP_HASH");return {format:"raytech-synthetic-backup-v1",payload,sha256};}
export function validateBackupPack(p){if(!p||Object.keys(p).sort().join("|")!=="format|payload|sha256"||p.format!=="raytech-synthetic-backup-v1")throw Error("Somente backups fictícios gerados nesta homologação.");return backupPack(p.payload,p.sha256);}
export function packRows(p){validateBackupPack(p);const chunks=p.payload.match(/[\s\S]{1,24000}/g);return [["Formato","SHA-256","Parte","Total","JSON"],...chunks.map((chunk,i)=>[p.format,p.sha256,i+1,chunks.length,chunk])];}
export function readPackRows(rows){if(!Array.isArray(rows)||rows.length<2||rows.length>9||canonical(rows[0])!==canonical(["Formato","SHA-256","Parte","Total","JSON"]))throw Error("Planilha fictícia inválida.");const parts=rows.slice(1),hash=parts[0]?.[1];let payload="";for(let i=0;i<parts.length;i++){const x=parts[i];if(!Array.isArray(x)||x.length!==5||x[0]!=="raytech-synthetic-backup-v1"||x[1]!==hash||x[2]!==i+1||x[3]!==parts.length||typeof x[4]!=="string"||x[4].length<1||x[4].length>24000)throw Error("Partes da planilha divergentes ou incompletas.");payload+=x[4];}return backupPack(payload,hash);}
export function mergeImport(currentPayload,incomingPayload){
 const current=validatePayload(currentPayload),incoming=validatePayload(incomingPayload),out=JSON.parse(currentPayload),stats={months:0,added:0,duplicates:0,skippedDeleted:0,filled:0,kept:0},conflicts=[];
 const equal=(a,b)=>canonical(a)===canonical(b),parcel=x=>x.isInstallment?x.installmentOriginId+":"+x.currentInstallment:null;
 const withoutId=x=>{const y={...x};delete y.id;return y;};
 for(const [ym,im] of Object.entries(incoming.months)){
  if(!Object.hasOwn(out.months,ym)){out.months[ym]=JSON.parse(JSON.stringify(im));stats.months++;stats.added+=im.expenses.length+im.extraIncomes.length+im.cardExpenses.length;const seen=new Set();for(const c of im.cardExpenses){const k=parcel(c);if(k&&(seen.has(k)||(im.deletedInstallmentOrigins??[]).includes(k)))conflicts.push(ym+" · parcela incoerente "+k);if(k)seen.add(k);}continue;}
  const m=out.months[ym],oldTomb=new Set(m.deletedInstallmentOrigins??[]),incomingTomb=new Set(im.deletedInstallmentOrigins??[]);
  for(const key of ["salary","budgetLimit"]){if(m[key]===im[key])continue;if(im[key]===0){stats.kept++;continue;}if(m[key]===0&&m.expenses.length+m.cardExpenses.length+m.extraIncomes.length===0&&!m.closed){m[key]=im[key];stats.filled++;}else conflicts.push(ym+" · "+(key==="salary"?"salário":"orçamento")+" divergente");}
  if(m.closed!==im.closed||m.closedAt!==im.closedAt)stats.kept++;
  for(const key of incomingTomb)if(m.cardExpenses.some(c=>parcel(c)===key))conflicts.push(ym+" · exclusão de parcela contradiz lançamento atual "+key);
  const tomb=new Set([...oldTomb,...incomingTomb]);if(tomb.size||Object.hasOwn(m,"deletedInstallmentOrigins")||Object.hasOwn(im,"deletedInstallmentOrigins"))m.deletedInstallmentOrigins=[...tomb];
  for(const k of ["expenses","cardExpenses","extraIncomes"]){
    const byId=new Map(m[k].map(x=>[x.id,x])),byParcel=new Map();
    if(k==="cardExpenses"){for(const x of m[k]){const p=parcel(x);if(p){if(byParcel.has(p)||tomb.has(p))conflicts.push(ym+" · parcela atual incoerente "+p);byParcel.set(p,x);}}}
    for(const item of im[k]){
      const old=byId.get(item.id),p=k==="cardExpenses"?parcel(item):null;
      if(old){if(equal(old,item))stats.duplicates++;else conflicts.push(ym+" · ID divergente "+item.id);continue;}
      if(p&&tomb.has(p)){stats.skippedDeleted++;continue;}
      if(p&&byParcel.has(p)){if(equal(withoutId(byParcel.get(p)),withoutId(item)))stats.duplicates++;else conflicts.push(ym+" · parcela divergente "+p);continue;}
      const copy=JSON.parse(JSON.stringify(item));m[k].push(copy);byId.set(copy.id,copy);if(p)byParcel.set(p,copy);stats.added++;
    }
  }
 }
 if(!conflicts.length)validatePayload(JSON.stringify(out));
 return {payload:JSON.stringify(out),stats,conflicts,changed:canonical(current)!==canonical(out)};
}
export function validateUndo(j,uid,view,parent,revision){if(!j||j.format!=="raytech-import-undo-v1"||j.uid!==uid||j.operationId!==parent||j.revision!==revision||j.after!==view||!validId(parent)||typeof j.sha256!=="string"||!/^[0-9a-f]{64}$/.test(j.sha256))throw Error("Reversão indisponível: revisão mudou.");validatePayload(j.before);validatePayload(j.after);return j;}
export function snapshotDiff(remotePayload,localPayload){const a=validatePayload(remotePayload),b=validatePayload(localPayload),out=[];for(const ym of [...new Set([...Object.keys(a.months),...Object.keys(b.months)])].sort()){const x=a.months[ym],y=b.months[ym];if(!x||!y){out.push(ym+" · mês apenas "+(x?"no servidor":"na fila"));continue;}for(const k of ["salary","budgetLimit","closed","closedAt","deletedInstallmentOrigins"])if(canonical(x[k]??null)!==canonical(y[k]??null))out.push(ym+" · "+k+" divergente");for(const k of ["expenses","cardExpenses","extraIncomes"]){const ax=new Map(x[k].map(v=>[v.id,v])),by=new Map(y[k].map(v=>[v.id,v]));for(const id of new Set([...ax.keys(),...by.keys()])){const u=ax.get(id),v=by.get(id);if(canonical(u??null)!==canonical(v??null))out.push(ym+" · "+(v?.title??v?.description??u?.title??u?.description??id)+" · "+(!u?"só na fila":!v?"só no servidor":"valores divergentes"));}}}return out;}
export function queueFits(rows,next){return rows.length<16&&rows.reduce((n,q)=>n+encodeQueue(q).length,0)+encodeQueue(next).length<=1250000;}

export function dictionary(){return ['"selectedMonth":','"months":','"salary":','"budgetLimit":','"extraIncomes":','"expenses":','"cardExpenses":','"deletedInstallmentOrigins":','"closed":','"closedAt":','"id":','"title":','"description":','"category":','"amount":','"type":','"date":','"paid":','"installmentOriginId":','"isInstallment":','"installmentValue":','"totalAmount":','"installments":','"currentInstallment":','"one-time"','"fixed"','"alimentacao"','"moradia"','"compras"','"investimentos"','false','true','null'];}
export function encodeQueue(q){validateQueued(q);const plain=JSON.stringify(q);if(!Object.hasOwn(q,"parentId"))return plain;let p=q.payload.replace(/[\uE000-\uE0FF]/g,ch=>"\uE0FF"+ch);dictionary().forEach((word,i)=>{p=p.split(word).join(String.fromCharCode(0xE000+i));});const compact=JSON.stringify(["rtq1",q.id,q.expectedRevision,q.parentId,p]);return compact.length<plain.length?compact:plain;}
export function decodeQueue(raw){if(typeof raw!=="string"||raw.length>400000)throw Error("QUEUE_ENCODING");const data=JSON.parse(raw);if(!Array.isArray(data))return validateQueued(data);if(data.length!==5||data[0]!=="rtq1"||typeof data[4]!=="string")throw Error("QUEUE_ENCODING");const dict=dictionary();let payload="";for(let i=0;i<data[4].length;i++){const c=data[4][i],v=c.charCodeAt(0);if(v===0xE0FF){const next=data[4][++i];if(!next||!/[\uE000-\uE0FF]/.test(next))throw Error("QUEUE_ENCODING");payload+=next;}else if(v>=0xE000&&v<0xE0FF){if(v-0xE000>=dict.length)throw Error("QUEUE_ENCODING");payload+=dict[v-0xE000];}else payload+=c;if(payload.length>180000)throw Error("QUEUE_ENCODING");}return validateQueued({id:data[1],expectedRevision:data[2],parentId:data[3],payload});}
export function sameQueued(raw,q){return raw!==null&&canonical(decodeQueue(raw))===canonical(q);}
export function legacyFixture(kind){if(!["json","excel"].includes(kind))throw Error("LEGACY_FIXTURE");const ym="2026-12",d=blank(ym),m=d.months[ym];m.expenses.push({id:"rc1_legacy_"+kind+"_1",title:"Legado "+kind.toUpperCase()+" Teste",category:"outros",amount:27.25,type:"one-time",date:ym+"-10",paid:false},{id:"rc1_legacy_"+kind+"_2",title:"Legado "+kind.toUpperCase()+" Teste",category:"outros",amount:27.25,type:"one-time",date:ym+"-10",paid:false});return d;}
export function validateLegacyFixture(payload){const d=validatePayload(payload);if(!["json","excel"].some(k=>canonical(d)===canonical(legacyFixture(k))))throw Error("Backup legado não corresponde a uma fixture fictícia RC1. Arquivos reais continuam bloqueados.");return JSON.stringify(d);}
export function legacyRows(d){const p=validateLegacyFixture(JSON.stringify(d)),chunks=p.match(/[\s\S]{1,30000}/g);return [["Formato","Versão","Parte","Total","JSON"],...chunks.map((x,i)=>["RAYTECH_BACKUP",1,i+1,chunks.length,x])];}
export function readLegacyRows(rows){if(!Array.isArray(rows)||rows.length<2||rows.length>7||canonical(rows[0])!==canonical(["Formato","Versão","Parte","Total","JSON"]))throw Error("LEGACY_ROWS");let p="";for(let i=1;i<rows.length;i++){const x=rows[i];if(!Array.isArray(x)||x.length!==5||x[0]!=="RAYTECH_BACKUP"||x[1]!==1||x[2]!==i||x[3]!==rows.length-1||typeof x[4]!=="string"||!x[4]||x[4].length>30000)throw Error("LEGACY_ROWS");p+=x[4];}return validateLegacyFixture(p);}
export function conflictBranches(rows){const ids=new Set(rows.map(q=>q.id)),parents=new Set(rows.map(q=>q.parentId).filter(id=>ids.has(id)));return rows.filter(q=>!parents.has(q.id)).sort((a,b)=>a.expectedRevision-b.expectedRevision||a.id.localeCompare(b.id));}

export function mergeThreeWay(basePayload,localPayload,remotePayload){
 const b=validatePayload(basePayload),l=validatePayload(localPayload),r=validatePayload(remotePayload),out=JSON.parse(remotePayload),conflicts=[];
 const eq=(a,b)=>canonical(a??null)===canonical(b??null),keys=x=>Object.keys(x).sort(),fail=path=>conflicts.push(path);
 const choose=(a,x,y,path)=>{if(eq(x,a))return y;if(eq(y,a)||eq(x,y))return x;fail(path);return y;};
 if(!eq(keys(b.months),keys(l.months))||!eq(keys(b.months),keys(r.months)))return {payload:null,conflicts:["Estrutura de meses mudou"]};
 const groups=db=>{const map=new Map();for(const [ym,m] of Object.entries(db.months)){for(const c of m.cardExpenses){if(!c.isInstallment)continue;const k=c.installmentOriginId,arr=map.get(k)??[];arr.push([ym,c]);map.set(k,arr);}for(const t of m.deletedInstallmentOrigins??[]){const k=t.split(":")[0],arr=map.get(k)??[];arr.push([ym,t]);map.set(k,arr);}}for(const arr of map.values())arr.sort((x,y)=>canonical(x).localeCompare(canonical(y)));return map;};
 const [gb,gl,gr]=[b,l,r].map(groups);for(const k of new Set([...gb.keys(),...gl.keys(),...gr.keys()])){const a=gb.get(k)??[],x=gl.get(k)??[],y=gr.get(k)??[];if(!eq(a,x)&&!eq(a,y)&&!eq(x,y))fail("Série de parcelas "+k);}
 for(const ym of keys(b.months)){
  const a=b.months[ym],x=l.months[ym],y=r.months[ym],m=out.months[ym];
  if(a.closed!==x.closed||a.closed!==y.closed||a.closedAt!==x.closedAt||a.closedAt!==y.closedAt){fail(ym+" · fechamento de mês");continue;}
  if(a.closed&&(!eq(a,x)||!eq(a,y))){fail(ym+" · mês fechado");continue;}
  for(const k of ["salary","budgetLimit"])m[k]=choose(a[k],x[k],y[k],ym+" · "+k);
  const ta=new Set(a.deletedInstallmentOrigins??[]),tl=new Set(x.deletedInstallmentOrigins??[]),tr=new Set(y.deletedInstallmentOrigins??[]);
  if([...ta].some(t=>!tl.has(t)||!tr.has(t)))fail(ym+" · remoção de marca de exclusão");
  const tomb=new Set([...tr,...tl]);if(tomb.size||Object.hasOwn(m,"deletedInstallmentOrigins"))m.deletedInstallmentOrigins=[...tomb];
  for(const k of ["expenses","cardExpenses","extraIncomes"]){
   const [aa,xx,yy]=[a,x,y].map(m=>new Map(m[k].map(i=>[i.id,i])));m[k]=[];
   for(const id of new Set([...yy.keys(),...xx.keys(),...aa.keys()])){
    const av=aa.get(id),lv=xx.get(id),rv=yy.get(id);
    if(!av&&/^(exp_sync_|exp_inherited_|card_sync_|card_inherited_)/.test(id))fail(ym+" · lançamento herdado "+id);
    const v=choose(av,lv,rv,ym+" · "+k+" · "+id);if(v!==undefined)m[k].push(v);
    if(k==="cardExpenses"&&av?.isInstallment&&!v&&!tomb.has(av.installmentOriginId+":"+av.currentInstallment))fail(ym+" · exclusão de parcela sem marca "+id);
   }
  }
  const origins=new Set();for(const c of m.cardExpenses){if(!c.isInstallment)continue;const k=c.installmentOriginId+":"+c.currentInstallment;if(origins.has(k)||tomb.has(k))fail(ym+" · parcela duplicada ou excluída "+k);origins.add(k);}
 }
 if(conflicts.length)return {payload:null,conflicts:[...new Set(conflicts)]};
 const payload=JSON.stringify(out);try{validatePayload(payload);}catch{return {payload:null,conflicts:["Limites ou integridade financeira incompatíveis"]};}
 return {payload,conflicts:[]};
}
export function linearConflict(rows){if(!rows.length)return null;const sorted=[...rows].sort((a,b)=>a.expectedRevision-b.expectedRevision||a.id.localeCompare(b.id));for(let i=0;i<sorted.length;i++){const q=validateQueued(sorted[i]);if(!Object.hasOwn(q,"parentId")||!q.expectedRevision||i&&(q.parentId!==sorted[i-1].id||q.expectedRevision!==sorted[i-1].expectedRevision+1))return null;}return {first:sorted[0],tail:sorted[sorted.length-1],rows:sorted};}
export function reconcileCandidate(remote,rows,proof,hash,id){if(!remote||!proof||!validId(id))return {payload:null,conflicts:["Revisão-base ausente"]};validateEnvelope(remote);const chain=linearConflict(rows);if(!chain)return {payload:null,conflicts:["Fila não linear ou base inicial ausente"]};const first=chain.first;if(remote.revision<=first.expectedRevision||remote.revision>=500||rows.some(q=>Object.hasOwn(remote.receipts,q.id)))return {payload:null,conflicts:["Revisão ou recibos incompatíveis"]};if(proof.operationId!==first.id||proof.parentId!==first.parentId||proof.revision!==first.expectedRevision||remote.receipts[first.parentId]!==first.expectedRevision+":"+hash)return {payload:null,conflicts:["Revisão-base não comprovada"]};const result=mergeThreeWay(proof.payload,chain.tail.payload,remote.payload);if(!result.payload)return result;return {...result,operation:{id,expectedRevision:remote.revision,parentId:remote.lastOperationId,payload:result.payload}};}
export function proofMatches(q,proof){return !!proof&&proof.operationId===q.id&&proof.parentId===q.parentId&&proof.revision===q.expectedRevision&&typeof proof.payload==="string";}
