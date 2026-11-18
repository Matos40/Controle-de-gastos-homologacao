import {canPoll,LIMITS} from '../experimentalSync/session.mjs';

const transientCodes = new Set([
  'unavailable', 'deadline-exceeded', 'aborted', 'resource-exhausted', 'internal',
  'auth/network-request-failed', 'EXPERIMENTAL_OFFLINE', 'PRODUCTION_OFFLINE',
  'EXPERIMENTAL_BUSY', 'PRODUCTION_LOCAL_BUSY', 'PRODUCTION_LOCAL_CHANGED',
]);

export function syncFailure(error, online = true) {
  const code = String(error?.code ?? error?.message ?? error).replace(/^firestore\//, '');
  if (!online || code === 'EXPERIMENTAL_OFFLINE' || code === 'PRODUCTION_OFFLINE') return {code, kind:'offline'};
  if (code === 'EXPERIMENTAL_BUDGET_EXHAUSTED') return {code, kind:'budget'};
  return {code, kind:transientCodes.has(code) ? 'transient' : 'persistent'};
}

// The session remains the sole owner of transport budgets and the durable journal.
export function createEventRuntime({session,environment,setTimer,clearTimer,now=Date.now,
  onError=()=>{},delay=1500,idleDelay=()=>LIMITS.minPollMs,eventOnly=false,onRenew=async()=>false}){
  let timer=null, due=Infinity, closed=false, running=false, dirty=false;
  let failures=0, backoffUntil=0, blocked=false, connectionEpoch=0;
  const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;due=Infinity;};
  const eligible=()=>!closed&&!blocked&&canPoll({...environment(),...session.state()});
  const waiting=()=>{
    const st=session.state(), env=environment();
    return !closed&&st.budgetWaiting&&!st.busy&&env.visible&&env.online&&env.unlocked&&env.bound;
  };
  function fail(error) {
    if(closed)return;
    const failure=syncFailure(error,environment().online);
    cancel();
    if(failure.kind==='budget'){dirty=true;}
    else if(failure.kind==='persistent'){blocked=true;dirty=false;}
    else {
      dirty=true;
      if(failure.kind==='transient') {
        failures++;
        const base=failure.code==='resource-exhausted'?60000:2000;
        backoffUntil=now()+Math.min(300000,base*2**Math.min(failures-1,8));
      }
    }
    onError({...failure,persistent:failure.kind==='persistent'||failure.kind==='transient'&&failures>=5});
    changed();
  }
  function renewal(){
    if(!waiting()||running)return;
    cancel();
    const at=Date.parse(session.state().budgetDay+'T00:00:00Z')+86400000;
    const ms=Math.max(1000,Math.min(86400000,at-now()+1000));
    timer=setTimer(async()=>{
      timer=null;due=Infinity;
      if(!waiting())return;
      running=true;
      try{if(await onRenew()){dirty=true;backoffUntil=0;failures=0;}}
      catch(e){fail(e);}
      finally{
        running=false;
        if(waiting())timer=setTimer(()=>{timer=null;changed();},Math.max(60000,backoffUntil-now()));
        else changed();
      }
    },ms);
  }
  function schedule(ms){
    if(!eligible()||running){if(waiting())renewal();return;}
    const at=Math.max(now()+ms,backoffUntil);
    if(timer!==null&&due<=at)return;
    cancel();due=at;
    timer=setTimer(async()=>{
      timer=null;due=Infinity;
      if(!eligible()){
        if(!closed&&session.state().busy)timer=setTimer(()=>{timer=null;changed();},250);
        return;
      }
      running=true;
      const urgent=dirty, epoch=connectionEpoch;
      dirty=false;
      try{
        const result=await session.tick({manual:urgent,now:now()});
        if(result?.status==='offline'||result?.status==='idle'&&urgent)dirty=true;
        else {failures=0;backoffUntil=0;}
      }catch(e){
        // A request from the previous connection can fail after the online event.
        // Its failure must not delay the recovery probe on the new connection.
        if(epoch!==connectionEpoch && ['offline','transient'].includes(syncFailure(e).kind))dirty=true;
        else fail(e);
      }finally{running=false;changed();}
    },Math.max(0,at-now()));
  }
  function changed(){
    if(!eligible()){cancel();if(waiting())renewal();return;}
    if(dirty)schedule(delay);
    else if(!eventOnly)schedule(Math.max(LIMITS.minPollMs,idleDelay()));
    else cancel();
  }
  function signal({local=false}={}){
    if(closed||blocked)return;
    dirty=true;
    if(local&&eventOnly&&!running&&eligible()&&now()>=backoffUntil)cancel();
    schedule(delay);
  }
  function reconnect(){
    if(closed||blocked)return;
    connectionEpoch++;
    failures=0;backoffUntil=0;
    cancel();
    signal();
  }
  return {
    start:()=>{if(eventOnly)signal();else changed();},changed,signal,fail,reconnect,
    retry:()=>{blocked=false;reconnect();},
    pause:()=>{cancel();dirty=false;session.pause();},
    close:()=>{closed=true;cancel();},pending:()=>timer!==null,
  };
}
