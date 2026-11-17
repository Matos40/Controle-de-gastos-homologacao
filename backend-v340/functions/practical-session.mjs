import {spawn,execFile} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {assertLocalEmulators} from './emulator-guard.mjs';
assertLocalEmulators();
if(process.env.RAYTECH_PRACTICAL!=='1')throw Error('PRACTICAL_ONLY');
const child=spawn(process.execPath,['functions/admin-panel-server.mjs'],{stdio:'inherit'});
const closed=once(child,'exit');
let stopping=false;
function stop(){if(!stopping){stopping=true;child.kill();}}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
let rl;
try{
 let ready=false;
 for(let i=0;i<120&&!stopping&&child.exitCode===null;i++){
  try{const r=await fetch('http://127.0.0.1:15002/api/lab-enabled',{signal:AbortSignal.timeout(500)});if(r.ok&&(await r.json()).enabled){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 if(!ready)throw Error('LAB_START_FAILED');
 if(process.platform==='win32')execFile('rundll32.exe',['url.dll,FileProtocolHandler','http://127.0.0.1:15002/app'],()=>{});
 console.log('Raytech CG: http://127.0.0.1:15002/app');
 console.log('Pressione ENTER para encerrar os emuladores com seguranca.');
 rl=createInterface({input:process.stdin,output:process.stdout});
 await Promise.race([once(rl,'line'),closed]);
}finally{rl?.close();stop();await closed;}
