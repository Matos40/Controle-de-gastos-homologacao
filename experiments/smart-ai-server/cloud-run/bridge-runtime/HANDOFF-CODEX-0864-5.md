# Raytech CG V35.0 — Handoff mínimo ao Codex: 08.6.4.5

**Base**: branch `feature/smart-ai-server-v350-poc`, commit `7ffd5e0c6ba39f53efec80f5ba170c88b9262523` (CI `44844849056`: SUCCESS). Não modificar branch oficial, produção, homologação publicada, três bancos financeiros ou ledger experimental. **0 Gemini neste passo.**

## O que já está feito pela Íris via GitHub (não refazer)
- Runtime privado isolado, desabilitado por padrão: `trial-control-runtime.mjs`.
- Validação que exige outro projeto com banco `(default)`, com allowlist REMOTA deliberadamente vazia: `trial-db-isolation.mjs`.
- CAS, cancelamento, reconciliação e recuperação testados com Firestore Emulator. Nenhuma permissão remota foi testada.
- O Dockerfile existente inicia `server.mjs`, **não** `trial-control-runtime.mjs`: caso seja autorizado um serviço separado, utilizar entrypoint explicitamente separado; não modificar a rota ou o serviço comercial.

## Sua tarefa agora: sondagem curta, somente em leitura
1. Identificar o projeto de computação `raytech-3d` (região `us-central1`) e o projeto financeiro experimental `gen-lang-client-0593667072`. Não alterar recursos.
2. Conferir se é possível criar **outro projeto Firebase Spark sem billing**, com um único banco Firestore `(default)`, acessado pelo Cloud Run experimental por identidade própria. Consultar quotas e restrições reais da conta/projeto; não presumir elegibilidade.
3. Se não for possível usar Spark, estimar o caminho **Blaze com banco nomeado ou novo projeto isolado**, informando os serviços que podem cobrar, a configuração de orçamento/alertas e o custo incremental provável. O orçamento desejado para o experimento é **R$ 30/mês**, referência operacional, não teto garantido. **Não habilitar billing** nesta sondagem.
4. Determinar o mínimo de IAM: identidade do controle com operações Firestore somente no projeto/banco isolado; identidade distinta de controlador; identidade exclusiva do job apenas com `roles/run.invoker` no serviço privado. Verificar que nenhum desses principais tenha permissões herdadas no projeto financeiro. Testar negação **somente por leituras não mutáveis ou análise de IAM**; nunca experimentar escritas reais no ledger.
5. Confirmar maneira de obter por API administrativa do Cloud Run o ID da execução e sua service account efetiva, validando exclusividade antes do despacho. Variáveis informadas pelo próprio job não são evidência independente.
6. Relatar em formato breve: **(a) Spark viável? (b) projeto/ID recomendado (sem criá-lo) (c) permissões estritamente necessárias (d) Blaze necessário? custo provável (e) impedimento concreto, se houver**.

## Gate de autorização
**Não criar projeto, banco, SA, IAM, Cloud Run, job, chave, binding, configuração de billing, nem iniciar Gemini**, nesta sondagem. Se for preciso criar algo, apresentar a menor sequência de operações e aguardar autorização explícita. Não fazer merge nem publicar. Não utilizar arquivos de credenciais pessoais.

## Após a sondagem
1. **Íris (GitHub)**: após criação e validação remota autorizadas, fixará o ID do projeto real na `APPROVED_REMOTE_CONTROL_PROJECTS`, fará commit e executará testes/CI. Não alterar a allowlist por variável de ambiente.
2. **Codex (Google Cloud)**: exclusivamente quando autorizado, criará/configurará recursos privados mínimos, verificará IAM efetivo, executará **um despacho simulado sem Gemini**, bloqueará novas admissões e restaurará estado desabilitado; entregará as evidências.
3. **Primeiro Gemini real**: autorização separada, documento integralmente sintético, limites de uso/financeiros ativos, zero lançamentos financeiros automáticos.

## Restrições absolutas
Preservar Finance Guard, tópico Pub/Sub `raytech-budget-push` ACTIVE, reservas, créditos Free/Premium, banco financeiro experimental, produção, homologação e os três bancos oficiais. Nunca enfraquecer IAM para acelerar a prova. Erro HTTP 503 não comprova ausência de execução: reconciliar pelo identificador original.
