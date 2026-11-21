# V35.0 — 08.6.4.11 | Inicialização Node.js file-backed

**Causa identificada no ensaio remoto anterior:** o bootstrap temporário do Codex importou um módulo com caminho relativo a partir de `data:`, o que o Node não suporta (`ERR_UNSUPPORTED_RESOLVE_REQUEST`). A execução `raytech-ai-trial-worker-p8mjm` confirmou UID e identidade Cloud Run v2, mas terminou com exit 1 antes do canal privado. **Isto é falha do bootstrap, não de autenticação nem de IAM.**

## Contrato de implantação (sem executar recursos)
Usar `trial-launch-contract.json`, versionado nesta mesma pasta. O `Dockerfile` do bridge inclui os arquivos em `/app/experiments/smart-ai-server/cloud-run/bridge-runtime/`. No Cloud Run v2, definir **`command` e `args`**, sem `node -e`, `--input-type=module`, `data:`, `eval`, `bash -c` com import embutido, nem copiar módulos por stdin.

| Recurso | command | args[0] |
|---|---|---|
| Serviço controle privado | `node` | `/app/experiments/smart-ai-server/cloud-run/bridge-runtime/trial-control-runtime.mjs` |
| Worker sintético | `node` | `/app/experiments/smart-ai-server/cloud-run/bridge-runtime/trial-job-runtime.mjs` |
| Controller | `node` | `/app/experiments/smart-ai-server/cloud-run/bridge-runtime/trial-execution-approval.mjs` |

**Não utilizar o `CMD ["node","server.mjs"]` do Dockerfile para nenhuma das três peças:** ele serve ao bridge comercial isolado e não é entrypoint do ensaio. Não mudar main, serviço comercial nem o comando de outras imagens.

## Checagem prévia obrigatória, totalmente local
O GitHub Actions executa os testes de resolução ESM dos três entrypoints e os inicia dentro da **imagem Docker real**, com `--network none`. Sem configuração remota, worker e controller devem falhar **apenas** com as mensagens intencionais `TRIAL_WORKER_CONFIGURATION` e `TRIAL_SYNTHETIC_ONLY_REQUIRED`. Não aceitar `ERR_UNSUPPORTED_RESOLVE_REQUEST`, `ERR_MODULE_NOT_FOUND` ou sucesso inesperado.

Isto valida o empacotamento e o comando; **não prova acesso de rede privado, IAM ou execução remota**. O script efêmero do Codex não foi fornecido integralmente; sua eliminação de `data:` deve ser verificada no momento de construir a especificação do job. O Codex deve informar o comando/argumentos efetivos da definição do job, sem invocar uma execução para testá-los.

## Preservação
Nenhum Google Cloud foi alterado por este commit. O serviço experimental permanece **DISABLED** segundo a reversão informada pelo Codex; jobs removidos e IAM temporário revogado. Sem nova autorização do Owner, não recriar jobs, não conceder permissões e não reexecutar o ensaio. Sem Gemini, créditos, faturas reais, mudanças em produção, homologação, Finance Guard, Pub/Sub ou bancos financeiros. Não prometer custo incremental nulo enquanto cobrança não for apurada.
