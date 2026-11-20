import {mountIntegration} from './mount.mjs';

// This adapter is imported only by an experimental host with an approved session.
export function connectInvoiceWorkspace({root,experimentEnabled,auth,onAuthStateChanged,openApiKeyModal,fetcher,reauthenticate,simulateConfirmation,readCategories}){
 if(experimentEnabled!==true)return ()=>{};
 let activeUid=auth.currentUser?.uid;
 const integration=mountIntegration(root,{enabled:true,fetcher,reauthenticate,simulateConfirmation,readCategories,
  openApiKey:openApiKeyModal,
  async getIdToken(){
   const user=auth.currentUser;
   if(!user||user.uid!==activeUid)return null;
   const token=await user.getIdToken();
   return auth.currentUser?.uid===user.uid&&activeUid===user.uid?token:null;
  },
 });
 const unsubscribe=onAuthStateChanged(auth,user=>{
  if(user?.uid!==activeUid)integration.clear();
  activeUid=user?.uid;
 });
 return ()=>{unsubscribe();integration.clear();root.replaceChildren();};
}
