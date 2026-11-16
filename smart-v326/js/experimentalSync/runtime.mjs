// Adapter-free scheduling for the isolated candidate. The host supplies lifecycle events.
import {canPoll,nextDelay,LIMITS} from './session.mjs';
export function createPollRuntime({session,environment,setTimer,clearTimer,now=Date.now,onError=()=>{}}){
 let timer=null,closed=false,failures=0;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
 const eligible=()=>!closed&&canPoll({...environment(),active:session.state().active,busy:session.state().busy});
 const schedule=(delay=LIMITS.minPollMs)=>{cancel();if(!eligible())return;timer=setTimer(async()=>{timer=null;if(!eligible())return;try{await session.tick({now:now()});failures=0;}catch(e){failures++;onError(String(e.code??e.message).split(':')[0]);}schedule(nextDelay(failures));},delay);};
 return {start:()=>schedule(),changed:()=>schedule(),pause:()=>{cancel();session.pause();},authChanged:()=>{cancel();session.sessionChanged();},close:()=>{closed=true;cancel();},pending:()=>timer!==null};
}
