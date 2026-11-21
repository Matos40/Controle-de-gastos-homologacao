# Raytech CG V35.0 — 08.6.4.7: ambiente privado mínimo do controlador

Base local: `10d6fb27539bc97f3cddf81f481c957f58376232`; branch `feature/smart-ai-server-v350-poc`. Fase A aprovada pelo Owner (8 negações HTTP 403, verificador exit 0). **Nenhuma operação Google Cloud autorizada por este arquivo.**

## Dependência concreta
O adaptador `trial-execution-approval.mjs` exige o metadata server e identidade `raytech-ai-controller@raytech-3d.iam.gserviceaccount.com`. As identidades do serviço de controle e do job de trabalho são distintas; elas não devem assumir o papel de controlador.

**Recurso adicional mínimo, dependente de autorização expressa do Owner:** um **Cloud Run Job controlador, de uma única tarefa**, na região `us-central1` e projeto `raytech-3d`, usando a conta de serviço existente `raytech-ai-controller`. Não criar um segundo serviço HTTP sempre ativo.

- Reaproveitar imagem isolada do commit aprovado, mas executar especificamente `node trial-execution-approval.mjs`, não o CMD `server.mjs` do bridge comercial.
- Conceder à conta `raytech-ai-controller` somente `run.executions.get` para a execução do job de trabalho, mais `roles/run.invoker` apenas no serviço privado de controle. Se a primeira permissão não puder ser restringida sem conceder escopo amplo, **não ampliar automaticamente**.
- A conta de serviço do controlador não recebe Firestore; obtém token pelo metadata server e grava somente pelo endpoint autenticado privado.
- Operador coleta `executionId` + UID da execução real da API administrativa e fornece a aprovação fixa `SMART_AI_TRIAL_OPERATOR_APPROVAL_JSON` **ao job controlador**, nunca pelo job de trabalho. Alterações por execução exigem permissão `run.jobs.runWithOverrides` no job controlador; conceder temporariamente à conta operadora **somente se o Owner autorizar**.
- Verificar a conectividade de Cloud Run Jobs para serviço com ingresso `internal`. O tráfego de origem Cloud Run pode exigir roteamento pela VPC; não abrir o serviço publicamente. Se exigir nova VPC, Direct VPC egress ou conector, interromper e solicitar autorização específica de infraestrutura e custos.
- Iniciar o job de trabalho com documento de controle ainda fechado; iniciar em seguida o job controlador com manifesto fixado; ele consulta Cloud Run v2, vincula UID real ao estado no banco via canal privado, e encerra. O job de trabalho aguarda a aprovação **até 120 segundos, sempre limitado pelo deadline absoluto**. CAS continua garantindo apenas um despacho.
- Desativar canal a `DISABLED`, revogar IAM temporário, confirmar `raytech-budget-push` ACTIVE e preservar todos os bancos. Zero Gemini, zero créditos Free/Premium, nenhum documento real, zero merge/publicação.

## Escopo e parada
São necessárias **três peças experimentais**: (1) serviço de controle privado, (2) job de trabalho, (3) job controlador temporário. A autorização anterior mencionava explicitamente apenas serviço + um job; **a terceira peça requer autorização separada do Owner**.

Código local só reduz chance de falha por sincronismo, não valida IAM, acesso por VPC, criação, execução ou custos remotos. Não afirmar ensaio concluído até o relatório da execução.
