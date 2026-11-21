# Raytech CG V35.0 — Etapa 08.6.4.4: isolamento local do banco de controle

Base autorizada: `87e55c2b8bc2f448583d4916bf7d3fa2fc5f22b8`; somente branch experimental.

## Resultado candidato

- `trial-db-isolation.mjs` exige **projeto Firestore independente** e banco `(default)`. Rejeita explicitamente os IDs financeiros `gen-lang-client-0593667072`, `raytech-cg-producao`, `raytech-cg-homologacao` e o projeto de computação `raytech-3d`.
- A allowlist **de código** `APPROVED_REMOTE_CONTROL_PROJECTS` está deliberadamente **vazia**. O serviço remoto falha fechado até que o projeto de controle seja criado e seu ID seja fixado mediante nova autorização. Uma variável de ambiente não pode se autoaprovar como projeto confiável.
- Configuração agora usa `SMART_AI_TRIAL_CONTROL_FIRESTORE_PROJECT_ID` e `SMART_AI_TRIAL_CONTROL_FIRESTORE_DATABASE_ID=(default)`. O antigo `SMART_AI_TRIAL_FIRESTORE_PROJECT` não configura mais o serviço. O escopo do recurso de banco é construído sem aceitar caminhos arbitrários.
- `createIsolatedTrialRestStore` aponta exclusivamente para o projeto permitido; o adaptador disponibiliza ao handler somente a coleção `raytechLabTrialControlV350`, com transações CAS existentes. Nenhuma rota comercial, chave Gemini, saldo ou ledger foi alterado.
- Testes de configuração recusam projetos financeiros, bancos nomeados e IDs não aprovados. O Firestore Emulator exerce o CAS num projeto de controle **fictício separado**, com concorrência, cancelamento, reinício e recuperação.
- O bloqueio local de coleção oferece defesa adicional, **não substitui IAM**. É indispensável configurar e demonstrar no ensaio futuro que a identidade do serviço de controle não tem acesso ao banco financeiro, inclusive por meio de outras APIs do projeto.

## Alternativa sem faturamento

Proposta futura: um **novo projeto Firebase Spark isolado**, usando seu único banco `(default)`, caso a criação e a elegibilidade gratuitas sejam confirmadas no momento da autorização. Não ativar Blaze, não criar segundo banco no projeto financeiro e não adicionar billing accounts nesta etapa. Confirmar quotas e custos efetivos antes de qualquer criação futura.

### Permissões mínimas futuras

- Criar uma conta de serviço dedicada ao runtime de controle, sem papéis herdados nos projetos financeiros. Conceder somente o acesso transacional necessário ao banco isolado, com escopo por banco quando houver suporte; verificar operações de leitura, criação, atualização e concorrência; negar explicitamente acesso a projetos/bancos financeiros.
- Controlador e identidade **exclusiva por execução** do job recebem somente capacidade `run.invoker` no serviço privado de controle. Não dar Firestore direto ao job.
- Comprovar a identidade real do job por consulta independente à API administrativa do Cloud Run e amarrá-la ao ID da execução, não apenas a variáveis de ambiente.
- Manter ingress `internal`, IAM obrigatório, flag desativada por padrão, Finance Guard, Pub/Sub e todos os três bancos oficiais preservados.
- O escopo de Firestore IAM atribuído em nível de projeto pode conceder acesso a vários bancos dentro dele. Isolar em projeto próprio e testar negação aos bancos financeiros, sem presumir que uma coleção separada seja barreira de segurança.

## Próxima janela remota (NÃO autorizada)

Depois de autorização específica: confirmar viabilidade de projeto Spark isolado e permissão sem faturamento, aprovar ID do projeto no código, provisionar identidades estritamente mínimas, executar **somente despacho simulado** com zero Gemini, e reverter flags, IAM e revisões. Se houver cobrança potencial, permissões excessivas, ou falha de identidade da execução, parar antes da implantação.

**Esta entrega é estritamente local.** Nenhum projeto, banco, IAM, Cloud Run, Gemini, publicação ou merge foi criado/alterado.
