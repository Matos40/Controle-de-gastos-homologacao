# 08.6.4.12 — Sonda Cloud Run de leitura única

## Contexto
A última execução remota foi interrompida antes do controlador e despacho por HTTP 403 na invocação do serviço privado. O operador suspendeu a rodada seguinte porque o worker tradicional `trial-job-runtime.mjs` aguarda autorização e prossegue até despacho. Não reutilizá-lo para a verificação de acesso.

## Entry point isolado
`trial-auth-probe.mjs` faz exatamente uma chamada à rota privada `/internal/smart-ai/trial-control`, com `POST {"action":"read"}`. Ela verifica antes a conta efetiva pelo metadata server, obtém ID token com `aud` igual à origem HTTPS, verifica consistência local do JWT (aud/email/sub/validade) e envia o mesmo token como `X-Serverless-Authorization` e `X-Raytech-Trial-Proof`. **A assinatura criptográfica deve ser verificada pelo Cloud Run/serviço, não pelo simples parse local do JWT.**

A única resposta de sucesso permitida é HTTP 200 e JSON exatamente `{"state":null}`. Isso confirma uma leitura autenticada sem documento previamente existente. Se já existir estado, o executor falha fechado. Nada chama `cas`, `late-claim`, controlador, Gemini, API financeira, Firestore de escrita, ou retries.

A conta autorizada é fixa: `raytech-ai-control-job-08645@raytech-3d.iam.gserviceaccount.com`. Exigir todas as envs:
- `SMART_AI_TRIAL_PROBE_ONLY=true` e `SMART_AI_TRIAL_SYNTHETIC_ONLY=true`
- `GOOGLE_CLOUD_PROJECT=raytech-3d`, `CLOUD_RUN_JOB=raytech-ai-trial-worker`, `CLOUD_RUN_EXECUTION` efetivo
- `SMART_AI_TRIAL_JOB_SUB` (subject numérico verificado contra ID token, e validado novamente pelo serviço)
- `SMART_AI_TRIAL_CONTROL_ENDPOINT=https://<URL do serviço>/internal/smart-ai/trial-control`
- `SMART_AI_TRIAL_CONTROL_AUDIENCE=https://<URL do serviço>` exatamente igual à origem
- `SMART_AI_TRIAL_ABSOLUTE_DEADLINE` futuro.

O contrato `trial-launch-contract.json` inclui `workerProbe`, como **modo alternativo do mesmo job worker**, NÃO um quarto recurso: `node /app/experiments/smart-ai-server/cloud-run/bridge-runtime/trial-auth-probe.mjs`. Não utilizar `node --eval`, `data:` ou um executável diferente.

## Escopo operacional
Esta alteração é **apenas de código na branch experimental**. A sondagem remota continua exigindo autorização específica do Owner. Não iniciar controlador. Um resultado HTTP 200 deve ser confrontado com revisão/execução da API Cloud Run, porque o corpo atual não inclui identificador de revisão; não atribuir revisão por inferência. Se HTTP 403 persistir, relatar status sem inventar se a causa foi IAM, ingress ou token. Logs não devem conter JWT nem bearer.

Uma passagem no CI executa o entrypoint com `--network none` e sem env (deve parar em `TRIAL_PROBE_CONFIGURATION`); testes unitários simulam identidade e canal privado com **uma leitura e zero gravações**. Não comprova permissão IAM efetiva, roteamento interno nem faturamento. Preservar serviço remoto DISABLED, jobs removidos, IAM revogado, `raytech-budget-push` ACTIVE, produção, homologação e bancos financeiros.
