export function budgetLevel(observed,budget){
 if(!Number.isFinite(observed)||observed<0||!(budget>0))return null;
 const percent=100*observed/budget;
 const thresholds=[[100,'critical','Crítico'],[75,'preventive','Limite preventivo atingido'],
  [50,'alert','Alerta'],[25,'attention','Atenção'],[0,'normal','Normal']];
 const [,level,label]=thresholds.find(([minimum])=>percent>=minimum);
 return {percent,width:Math.min(percent,100),level,label};
}
