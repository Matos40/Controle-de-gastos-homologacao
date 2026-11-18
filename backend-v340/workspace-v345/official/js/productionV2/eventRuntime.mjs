import {canPoll,nextDelay,LIMITS} from '../experimentalSync/session.mjs';
// Events are wake-up hints only; every operation goes through the existing verified session.
export function createEventRuntime({session,environment,setTimer,clearTimer,now=Date.now,onError=()=>{},delay=1500,idleDelay=()=>LIMITS.minPollMs,eventOnly=false,onRenew=async()=>false}){
 let timer=null,due=Infinity,closed=false,running=false,dirty=false,failures=0,backoffUntil=0;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;due=Infinity;};
 const eligible=()=>!closed&&canPoll({...environment(),...session.state()});
 const waiting=()=>{const st=session.state(),env=environment();return !closed&&st.budgetWaiting&&!st.busy&&env.visible&&env.online&&env.unlocked&&env.bound;};
 const idle=()=>Math.max(LIMITS.minPollMs,idleDelay());
 function renewal(){if(!waiting()||running)return;cancel();const at=Date.parse(session.state().budgetDay+'T00:00:00Z')+86400000;const ms=Math.max(1000,Math.min(86400000,at-now()+1000));timer=setTimer(async()=>{timer=null;due=Infinity;if(!waiting())return;running=true;try{if(await onRenew()){dirty=true;backoffUntil=0;}}catch(e){onError(String(e.code??e.message));}finally{running=false;if(waiting()){timer=setTimer(()=>{timer=null;changed();},60000);}else changed();}},ms);}
 function schedule(ms){if(!eligible()||running){if(waiting())renewal();return;}const at=Math.max(now()+ms,backoffUntil);if(timer!==null&&due<=at)return;cancel();due=at;timer=setTimer(async()=>{timer=null;due=Infinity;if(!eligible()){if(!closed&&session.state().busy)timer=setTimer(()=>{timer=null;changed();},250);return;}running=true;const urgent=dirty;dirty=false;try{const r=await session.tick({manual:urgent,now:now()});if(r?.status==='idle'&&urgent)dirty=true;failures=0;backoffUntil=0;}catch(e){failures++;dirty=true;const code=String(e.code??e.message);backoffUntil=now()+(/LOCAL_BUSY|EXPERIMENTAL_BUSY|LOCAL_CHANGED|PRODUCTION_OFFLINE|EXPERIMENTAL_OFFLINE/.test(code)?3000:nextDelay(failures));onError(String(e.code??e.message).split(':')[0]);}finally{running=false;changed();}},Math.max(0,at-now()));}
 function changed(){if(!eligible()){cancel();if(waiting())renewal();return;}if(dirty)schedule(delay);else if(!eventOnly)schedule(idle());else cancel();}
 function signal({local=false}={}){if(closed)return;dirty=true;if(local&&eventOnly&&!running&&eligible()&&now()>=backoffUntil)cancel();schedule(delay);}
 return {start:()=>{if(eventOnly)signal();else changed();},changed,signal,retry:()=>{if(closed)return;backoffUntil=0;dirty=true;cancel();schedule(delay);},pause:()=>{cancel();dirty=false;session.pause();},close:()=>{closed=true;cancel();},pending:()=>timer!==null};
}
