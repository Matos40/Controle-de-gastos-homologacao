export function operatorRole(record){return record?.active===true&&['owner','admin'].includes(record.role)?record.role:null;}
export function accountChange(actor,target,before,patch){
 if(!actor||!target||actor===target||!before||before.uid!==target)throw Error('ADMIN_TARGET');
 if(!['free','premium'].includes(patch.plan)||typeof patch.blocked!=='boolean')throw Error('ADMIN_INVALID');
 if(before.plan===patch.plan&&before.blocked===patch.blocked)throw Error('ADMIN_NO_CHANGE');
 return {actor,target,beforePlan:before.plan,afterPlan:patch.plan,beforeBlocked:before.blocked,afterBlocked:patch.blocked};
}
