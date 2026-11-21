# V35.0 — Etapa 08.6.4.5: evidência relatada de isolamento remoto e pin local

Data informada pelo Owner: 21/11/2026 (fuso Bahia); evidências produzidas pelo Codex no Google Cloud, **não verificadas diretamente pelo conector GitHub**.

## Relatório remoto recebido

- Criado Firestore Native `projects/raytech-3d/databases/ai-control-v350`, em `us-central1`. Banco `(default)` de `raytech-3d` preservado em `nam5`.
- Criadas as identidades `raytech-ai-control-svc`, `raytech-ai-controller` e `raytech-ai-control-job-08645`. Somente a primeira recebeu papel `raytechAiControlTxnV350`, com condição exata `resource.name == "projects/raytech-3d/databases/ai-control-v350"`.
- Teste usando a identidade de controle: criar, ler, atualizar documento integralmente sintético; duas tentativas CAS concorrentes tiveram um êxito e uma rejeição, revisão final 1. Identificador sintético informado: `phase-a-synthetic-ca20893f-719e-4311-b0dc-85f54d266256`.
- Bancos protegidos: `raytech-3d/(default)`, `gen-lang-client-0593667072/(default)` e os projetos de produção/homologação retornaram HTTP 403 e `PERMISSION_DENIED` nas tentativas somente leitura com IDs fictícios e abertura de transações read-only; nenhum documento real foi consultado.
- **Ressalva:** o verificador remoto terminou com exit code **1** porque não interpretou os corpos HTTP 403 das leituras. Portanto, **não registrar o verificador como PASSED**. Os status 403 foram relatados separadamente. Antes de uma implantação, ajustar somente o parsing/status da validação remota para produzir relatório machine-verifiable, mantendo zero leitura de dados reais.
- Vinculação temporária `iam.serviceAccounts.getAccessToken` na identidade de controle revogada às 00:08:14 de 21/11/2026 (Bahia), segundo o relatório. Sem credenciais expostas.
- `raytech-budget-push` permaneceu ACTIVE; nenhuma implantação Cloud Run, job, chamada Gemini, alteração de faturamento, IAM comercial ou merge.

## Decisão local de GitHub

O recurso **exato** acima foi fixado na `APPROVED_REMOTE_CONTROL_DATABASES`, somente na branch experimental, conforme compromisso anterior de atualizar o código depois de evidências IAM. A lista contém exatamente um banco; `(default)` e bancos financeiros seguem recusados.

**Isto NÃO ativa o serviço remoto:** `SMART_AI_TRIAL_CONTROL_ENABLED` deve continuar ausente/falso nas revisões Cloud Run. Ainda não existe implantação autorizada do serviço privado nem do job. A allowlist é uma seleção de banco, não autorização para execução.

O CI cobre regressões, isolamento do adaptador e emulador; não comprova IAM remoto. Para próximo ensaio, é indispensável autorização específica do Owner, serviço privado separado com ingress interno, verificação da identidade real por API Cloud Run e zero Gemini. Se qualquer negação efetiva for duvidosa, abortar sem ampliar IAM.

Custos: banco nomeado Blaze pode cobrar pelas operações; manter orçamento de referência R$ 30/mês e alertas. Não inferir teto rígido.
