import {onRequest} from 'firebase-functions/v2/https';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {authorizePremium,ACCOUNT_COLLECTION,ROLE_COLLECTION} from './policy.mjs';
import {assertLocalEmulators,PROJECT} from './emulator-guard.mjs';
export const authorizePremiumFeature=onRequest({region:'us-central1',cors:false},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  assertLocalEmulators();
  const app=getApps()[0]??initializeApp({projectId:PROJECT});
  if(app.options.projectId!==PROJECT)throw Error('PROJECT_MISMATCH');
  const db=getFirestore(app);
  const result=await authorizePremium(req,{
   verifyToken:token=>getAuth(app).verifyIdToken(token,true),
   readPermissions:uid=>db.runTransaction(async tx=>{
    const [account,role]=await tx.getAll(db.collection(ACCOUNT_COLLECTION).doc(uid),db.collection(ROLE_COLLECTION).doc(uid));
    return {account:account.data(),role:role.data()};
   },{readOnly:true})
  });
  res.status(result.status).json(result.body);
 }catch{res.status(503).json({allowed:false});}
});

import {extractInvoice} from './invoice.mjs';
import {createOutcomeStore} from './outcome.mjs';
import {LAB_BUDGET} from './global-budget.mjs';
import {createUsageStore} from './usage.mjs';
import {simulatedGemini} from './gemini-provider.mjs';
export const extractPremiumInvoice=onRequest({region:'us-central1',cors:false,timeoutSeconds:30},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  assertLocalEmulators();
  const app=getApps()[0]??initializeApp({projectId:PROJECT});
  if(app.options.projectId!==PROJECT)throw Error('PROJECT_MISMATCH');
  const db=getFirestore(app);
  const result=await extractInvoice(req,{
   verifyToken:token=>getAuth(app).verifyIdToken(token,true),
   readPermissions:uid=>db.runTransaction(async tx=>{
    const [account,role]=await tx.getAll(db.collection(ACCOUNT_COLLECTION).doc(uid),db.collection(ROLE_COLLECTION).doc(uid));
    return {account:account.data(),role:role.data()};
   },{readOnly:true}),
   reserveUsage:createUsageStore(db,{budget:LAB_BUDGET,trackOutcomes:true}),
   finishOutcome:createOutcomeStore(db),
   provider:simulatedGemini
  });
  res.status(result.status).json(result.body);
 }catch{res.status(503).json({error:'UNAVAILABLE'});}
});

import {handleUsageAdmin} from './usage-admin.mjs';
export const usageAdmin=onRequest({region:'us-central1',cors:false,timeoutSeconds:30},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  assertLocalEmulators();
  const app=getApps()[0]??initializeApp({projectId:PROJECT});
  if(app.options.projectId!==PROJECT)throw Error('PROJECT_MISMATCH');
  const out=await handleUsageAdmin(req,{db:getFirestore(app),verifyToken:token=>getAuth(app).verifyIdToken(token,true)});
  res.status(out.status).json(out.body);
 }catch{res.status(503).json({error:'ADMIN_UNAVAILABLE'});}
});

import {workspaceAiRequest} from './workspace-ai.mjs';
const workspaceEndpoint=kind=>onRequest({region:'us-central1',cors:false,timeoutSeconds:30},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{assertLocalEmulators();const app=getApps()[0]??initializeApp({projectId:PROJECT});if(app.options.projectId!==PROJECT)throw Error('PROJECT_MISMATCH');
 const out=await workspaceAiRequest(kind,req,{db:getFirestore(app),verifyToken:token=>getAuth(app).verifyIdToken(token,true)});
 res.status(out.status).json(out.body);
 }catch{res.status(503).json({error:'UNAVAILABLE'});}
});
export const workspaceAuthorizeInvoice=workspaceEndpoint('authorize');
export const workspaceExtractInvoice=workspaceEndpoint('extract');
export const workspaceUsageAdmin=workspaceEndpoint('admin');
