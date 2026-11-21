# Raytech CG V35.0 — 08.6.4.6: vínculo de execução Cloud Run v2 (código local)

Base: `c2d0acf2f63299cfb549d25d12ded1d358d6c342`. Branch experimental, sem alterações no Google Cloud.

## Bloqueio corrigido
Anteriormente `verifyApproval` era somente um callback injetável em testes e o processo job não possuía prova durável. Agora:
1. O controlador, **executando com identidade `raytech-ai-controller@raytech-3d.iam.gserviceaccount.com`**, exige uma aprovação **pinned pelo operador**, com ID/UID da execução, job, identidade, requestId/runId, prazo e endpoint. Não usa dados apresentados pelo job como autoridade.
2. `trial-execution-approval.mjs` consulta **GET** `https://run.googleapis.com/v2/projects/raytech-3d/locations/us-central1/jobs/{jobName}/executions/{executionId}` com access token da identidade do controlador. Confirma nome completo, job pai, UID imutável, `template.serviceAccount`, taskCount=1, parallelism=1, createTime, e ausência de conclusão/cancelamento/falha. A consulta retorna erro fechado ante 403, 404, API indisponível ou divergência.
3. Somente após consulta aprovada o controlador grava **no Firestore isolado via o canal privado** a prova de execução na transição CAS `provisioning -> initializing`. Um segundo controlador não consegue reemitir a aprovação.
4. O job verifica sua identidade efetiva pelo metadata server, **lê o vínculo persistido** e compara todos os campos do manifesto antes de obter o gate. `verifyApproval` opcional vira apenas validação adicional, nunca substitui a prova do banco. O canal também recusa CAS sem prova vinculada.
5. A admissão final continua garantida por CAS `authorized -> executing`: duas tentativas concorrentes produzem uma aceitação. Cancelamento, prazo e rollback continuam obrigatórios.

## Operação futura (somente com nova autorização remota)
- Operador coleta UID real pelo Cloud Run API e o fixa em `SMART_AI_TRIAL_OPERATOR_APPROVAL_JSON` no ambiente **exclusivo do controlador**. JSON não deve vir do job; configurar com identificadores sintéticos, prazo curto e URL Cloud Run privada real.
- Executar `trial-execution-approval.mjs` sob a identidade `raytech-ai-controller` com `SMART_AI_TRIAL_CONTROLLER_ENABLED=true`, `SMART_AI_TRIAL_CONTROLLER_IDENTITY` explícito, `GOOGLE_CLOUD_PROJECT=raytech-3d`; requer somente `run.executions.get` restrito ao job/execução e `roles/run.invoker` restrito ao serviço de controle. Nenhum acesso Firestore direto para controlador.
- Serviço de controle já exige `SMART_AI_TRIAL_JOB_NAME`, `SMART_AI_TRIAL_EXECUTION_ID`, identidades e valores corretos de run/solicitação. Iniciar `trial-control-runtime.mjs` **separadamente** do bridge comercial; o Dockerfile existente ainda inicia `server.mjs` por padrão.
- O job inicia com `createBoundTrialJob` e aguarda **somente a prova durável**, no máximo 120 segundos ou o deadline absoluto. Não confiar em variáveis do próprio job, nem em callbacks simulados.
- O orquestrador `createControlledTrial` exige `ops.verifyExecution` que chame o controlador para **gravar a aprovação** antes de devolver o manifesto. Simplesmente retornar um objeto sem prova persistida será rejeitado.
- **Não existe ainda autorização de implantação** nesta etapa, nem comprovação remota deste novo código. CI valida apenas testes sintéticos/Firestore Emulator.

**Importante:** a aprovação de código, o vínculo administrativo e a execução remota são três coisas distintas. Fase A: 8 negações HTTP 403 registradas pelo Codex, código de saída zero; IAM temporário removido. Nenhuma nova concessão Cloud Run foi aplicada.

Proibido: Gemini, faturamento novo, créditos comerciais, merges, publicação, produção, homologação, bancos financeiros ou alteração do tópico `raytech-budget-push`.
