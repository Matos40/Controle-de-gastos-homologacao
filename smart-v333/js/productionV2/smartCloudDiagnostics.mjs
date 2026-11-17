export function startupMessage(stage,error){
 const code=String(error?.code||error?.message||'UNKNOWN').replace(/^firestore\//,'');
 if(code==='permission-denied')return stage==='profile'?'Perfil Google autenticado, mas acesso ao perfil Free negado pelo Firestore (PROFILE_PERMISSION).':'Google autenticado, mas leitura financeira negada pelo Firestore (CLOUD_PERMISSION). Confira a regra raytechSmartCloudV332.';
 if(code==='unavailable'||code==='deadline-exceeded'||code==='FIRST_CLOUD_LOGIN_REQUIRES_NETWORK')return 'Conexão com Firebase indisponível. Reconecte e tente novamente ('+stage+').';
 if(stage==='scripts')return 'Não foi possível carregar os arquivos do painel (PANEL_LOAD). Atualize a página.';
 if(stage==='cloud')return 'Não foi possível confirmar os dados na nuvem (CLOUD_INIT: '+code.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)+').';
 return 'Inicialização interrompida ('+stage+': '+code.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)+').';
}
