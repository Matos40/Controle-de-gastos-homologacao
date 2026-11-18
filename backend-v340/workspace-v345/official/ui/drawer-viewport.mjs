// Presentation only. Geometry uses layout-viewport coordinates, including visualViewport offsets.
export function availableDrawerHeight({top,viewportBottom,navTop=Infinity,gap=8}){
 return Math.max(0,Math.floor(Math.min(viewportBottom,navTop)-top-gap));
}
if(typeof window!=='undefined'){
 const drawer=document.getElementById('headerToolsDrawer');
 const nav=document.getElementById('raytechMobileNav');
 const header=document.querySelector('.raytech-header-shell');
 const mobile=matchMedia('(max-width:639px)');
 let frame=0;
 const update=()=>{
  frame=0;
  if(!drawer||drawer.classList.contains('hidden')||!mobile.matches){
   drawer?.style.removeProperty('--raytech-drawer-available');return;
  }
  const view=window.visualViewport;
  const viewportBottom=view?view.offsetTop+view.height:window.innerHeight;
  const navRect=nav?.getBoundingClientRect();
  const navTop=navRect&&navRect.height>0?navRect.top:Infinity;
  const height=availableDrawerHeight({top:drawer.getBoundingClientRect().top,viewportBottom,navTop});
  drawer.style.setProperty('--raytech-drawer-available',height+'px');
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 if(drawer){
  new MutationObserver(schedule).observe(drawer,{attributes:true,attributeFilter:['class']});
  if(typeof ResizeObserver!=='undefined'){
   const observer=new ResizeObserver(schedule);
   if(header)observer.observe(header);
   if(nav)observer.observe(nav);
  }
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('scroll',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  mobile.addEventListener('change',schedule);
  window.addEventListener('raytech-account-start',schedule);
  schedule();
 }
}
