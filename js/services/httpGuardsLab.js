'use strict';
// Guardas em memoria EXCLUSIVAMENTE para o laboratorio local.
// Nao e limitador distribuido e nao substitui protecao de borda.
function createHttpGuards(options={}){
 const maxConcurrent=options.maxConcurrent??32;
 const maxPerWindow=options.maxPerWindow??120;
 const windowMs=options.windowMs??60000;
 const now=options.now??Date.now;
 if(!Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||
  !Number.isSafeInteger(maxPerWindow)||maxPerWindow<1||
  !Number.isSafeInteger(windowMs)||windowMs<1||typeof now!=='function')
  throw Error('Configuracao de guarda invalida');
 let active=0;
 const buckets=new Map();
 function acquire(identity){
  if(typeof identity!=='string'||!identity)throw Error('Identidade invalida');
  const time=now();
  // Remover buckets expirados para nao reter identificadores indefinidamente.
  for(const [k,b] of buckets)if(time-b.start>=windowMs)buckets.delete(k);
  let bucket=buckets.get(identity);
  if(!bucket){bucket={start:time,count:0};buckets.set(identity,bucket);}
  if(bucket.count>=maxPerWindow)return {ok:false,status:429,error:'rate_limited'};
  if(active>=maxConcurrent)return {ok:false,status:503,error:'server_busy'};
  bucket.count++;active++;
  let released=false;
  return {ok:true,release(){
   if(released)return;
   released=true;active--;
  }};
 }
 return {acquire,stats:()=>({active,buckets:buckets.size})};
}
module.exports={createHttpGuards};
