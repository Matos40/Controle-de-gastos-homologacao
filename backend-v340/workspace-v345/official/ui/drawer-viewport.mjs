// Presentation only: portal the EXISTING drawer on mobile, never duplicate controls.
export function availableDrawerHeight({top,viewportBottom,navTop=Infinity,gap=8}){
 return Math.max(0,Math.floor(Math.min(viewportBottom,navTop)-top-gap));
}
if(typeof window!=='undefined'){
 const drawer=document.getElementById('headerToolsDrawer');
 const header=document.querySelector('.raytech-header-shell');
 const account=document.getElementById('smartAccountApp');
 const mobile=matchMedia('(max-width:639px)');
 const close=document.getElementById('mobileDrawerClose');
 if(drawer && header && account){
  const anchor=document.createComment('raytech-options-original-position');
  drawer.before(anchor);
  const content=drawer.querySelector('.raytech-options-grid');
  let frame=0,portal=false;
  const restore=()=>{
   if(!portal)return;
   portal=false;
   drawer.classList.remove('raytech-mobile-portal');
   anchor.after(drawer);
   document.documentElement.classList.remove('raytech-drawer-open');
   drawer.removeAttribute('aria-modal');
   drawer.setAttribute('role','region');
   for(const prop of ['--drawer-top','--drawer-left','--drawer-width','--raytech-drawer-available'])drawer.style.removeProperty(prop);
  };
  const update=()=>{
   frame=0;
   const visible=!drawer.classList.contains('hidden')&&!account.hidden;
   if(!visible||!mobile.matches){
    if(account.hidden && !drawer.classList.contains('hidden'))window.closeHeaderDrawer?.();
    restore();return;
   }
   if(!portal){
    portal=true;
    // Keep the drawer inside the authenticated account container; move it outside
    // the sticky header, whose backdrop-filter establishes a fixed containing block.
    account.append(drawer);
    drawer.classList.add('raytech-mobile-portal');
    document.documentElement.classList.add('raytech-drawer-open');
    drawer.setAttribute('role','region');
    content.scrollTop=0;
   }
   const v=window.visualViewport;
   drawer.style.setProperty('--drawer-top',(v?.offsetTop??0)+'px');
   drawer.style.setProperty('--drawer-left',(v?.offsetLeft??0)+'px');
   drawer.style.setProperty('--drawer-width',(v?.width??window.innerWidth)+'px');
   drawer.style.setProperty('--raytech-drawer-available',(v?.height??window.innerHeight)+'px');
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const observer=new MutationObserver(schedule);
  observer.observe(drawer,{attributes:true,attributeFilter:['class']});
  observer.observe(account,{attributes:true,attributeFilter:['hidden','inert']});
  close.addEventListener('click',()=>{window.closeHeaderDrawer?.();document.getElementById('headerToolsToggleBtn')?.focus({preventScroll:true});});
  window.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  mobile.addEventListener('change',schedule);
  window.addEventListener('raytech-account-start',schedule);
  schedule();
 }
}
