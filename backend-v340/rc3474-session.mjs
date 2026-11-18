import {seed,profiles,password} from './functions/rc3474-seed.mjs';
import {assertLocalEmulators} from './functions/emulator-guard.mjs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
assertLocalEmulators();
await seed();
process.chdir(fileURLToPath(new URL('./workspace-v345/',import.meta.url)));
const {serve}=await import('./workspace-v345/serve.mjs');
const server=await serve();
const url='http://127.0.0.1:15003';
console.log('\nRaytech CG V34.7.4 - LABORATORIO LOCAL\n'+url);
for(const p of profiles)console.log(p+'@example.invalid');
console.log('Senha ficticia: '+password+'\nPressione ENTER para encerrar.');
if(process.platform==='win32'&&process.env.RAYTECH_RC_NO_BROWSER!=='1'){
 const browser=spawn('cmd.exe',['/d','/c','start','','http://127.0.0.1:15003'],{stdio:'ignore'});browser.on('error',()=>console.log('Abra o endereco manualmente.'));
}
let closing=false;
async function stop(){if(closing)return;closing=true;process.stdin.pause();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
process.stdin.resume();process.stdin.once('data',()=>void stop());process.stdin.once('end',()=>void stop());
