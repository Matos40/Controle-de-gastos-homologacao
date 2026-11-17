export function cloudEntitlement({plan,role,access,blocked=false,verified=true}){
 if(!verified||blocked||access&&access.enabled!==true)return {plan,eligible:false,writeEnabled:false};
 const eligible=(plan==='premium'||role==='owner'&&access?.enabled===true||plan==null&&access?.enabled===true);
 return {plan,eligible,writeEnabled:eligible&&(!access||access.writeEnabled===true)};
}
