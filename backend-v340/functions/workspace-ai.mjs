import {authorizePremium} from './policy.mjs';
import {extractInvoice} from './invoice.mjs';
import {createUsageStore} from './usage.mjs';
import {createOutcomeStore} from './outcome.mjs';
import {LAB_BUDGET} from './global-budget.mjs';
import {handleUsageAdmin} from './usage-admin.mjs';
export async function workspaceAiRequest(kind,req,{db,verifyToken}){
 const readPermissions=uid=>db.runTransaction(async tx=>{const [account,role]=await tx.getAll(db.collection('raytechV345Accounts').doc(uid),db.collection('raytechV345Roles').doc(uid));return {account:account.data(),role:role.data()};},{readOnly:true});
 if(kind==='authorize')return authorizePremium(req,{verifyToken,readPermissions});
 if(kind==='admin')return handleUsageAdmin(req,{db,verifyToken,workspace:true});
 if(kind!=='extract')throw Error('INVALID_ENDPOINT');
 return extractInvoice(req,{verifyToken,readPermissions,reserveUsage:createUsageStore(db,{budget:LAB_BUDGET,trackOutcomes:true,workspace:true}),finishOutcome:createOutcomeStore(db),provider:async({signal})=>{
 if(signal.aborted)throw Error('CANCELLED');
 return [{title:'Mercado fictício',date:'2026-11-01',installmentValue:125.90,isInstallment:false,currentInstallment:1,installments:1,totalAmount:125.90},{title:'Transporte fictício',date:'2026-11-01',installmentValue:35,isInstallment:false,currentInstallment:1,installments:1,totalAmount:35}];
 }});
}
