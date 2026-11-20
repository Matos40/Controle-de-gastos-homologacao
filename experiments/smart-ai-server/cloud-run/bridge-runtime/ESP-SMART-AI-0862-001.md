# RAYTECH CG V35.0 SERVER-ONLY
## Etapa 08.6.2 — Private Remote Deployment

Execute esta especificação somente após autorização expressa do Owner para as operações remotas delimitadas abaixo.

### 1. Referências

- Repositório: Matos40/Controle-de-gastos-homologacao.
- Branch: feature/smart-ai-server-v350-poc.
- Commit inicial: 632d587357fa1ea6c1d344e8e9ce8871eeea08a8.
- GitHub Actions: 44814645559.
- Artefato server-only: 14668859095.
- Imagem candidata da ponte: 14668122829.
- Baseline: 128 testes aprovados.
- Especificação anterior: ESP-SMART-AI-0861-001.
- Documento operacional: experiments/smart-ai-server/cloud-run/bridge-runtime/OPERACAO-0861.md.

Registre a nova especificação como ESP-SMART-AI-0862-001.

Preserve UX01 a UX80, SEC-01 a SEC-10 e REM-01 a REM-15.

Não reabra o refinamento visual nem repita auditorias concluídas.

### 2. Escopo

Preparar e implantar exclusivamente a ponte autenticada experimental privada, utilizando a infraestrutura já existente.

O objetivo desta etapa é:

- Confirmar a identidade dedicada.
- Conceder permissões mínimas.
- Implantar o candidato desabilitado.
- Validar a comunicação privada entre serviços.
- Realizar um primeiro ensaio privado de infraestrutura e identidade.
- Preparar os testes funcionais remotos da Etapa 08.6.3.

Não habilitar Gemini real.

Não expor a ponte publicamente.

Não publicar o aplicativo oficial.

### 3. Ambientes autorizados

Cloud Run:

- Projeto: raytech-3d.
- Número: 761761828111.
- Identificação: Raytech Smart AI Cloud Run.
- Região: us-central1.

Firebase experimental:

- Projeto: gen-lang-client-0593667072.
- Plano Spark.
- Sem associação de faturamento.

Não acessar ou modificar os projetos oficiais raytech-cg-producao e raytech-cg-homologacao.

### 4. Verificação remota inicial

Realize inventário objetivo, exclusivamente dos recursos necessários:

- Gateway experimental existente.
- Backend interno existente.
- Identidades de serviço.
- Políticas IAM pertinentes.
- Revisões ativas.
- Digest das imagens.
- Estado das flags de extração.
- Estado do receptor financeiro.
- Orçamento existente.
- Última observação financeira autêntica disponível.
- Configuração de rede.
- Quotas e limites pertinentes.

Não transforme a verificação em nova auditoria abrangente.

Confirme que o commit inicial corresponde à referência aprovada.

Caso exista divergência material ou recurso inesperado, interrompa somente as operações afetadas e informe o impedimento.

### 5. Identidade dedicada

Verifique a disponibilidade do identificador:

raytech-smart-ai-bridge

Caso não exista, crie a identidade dedicada exclusivamente no projeto raytech-3d, dentro da autorização concedida.

Caso exista, confirme sua finalidade e permissões antes de reutilizá-la.

Não reutilize uma identidade incompatível ou excessivamente privilegiada.

Não gere arquivos JSON de conta de serviço.

Utilize autenticação gerenciada pelo ambiente Cloud Run.

### 6. IAM mínimo

Conceda à identidade dedicada exclusivamente:

- roles/run.invoker no serviço gateway experimental específico.
- Permissão mínima necessária à consulta de usuário Firebase para verificar revogação e bloqueio, conforme o Firebase Admin SDK e o projeto experimental.

Para a segunda permissão, valide a suficiência de firebaseauth.users.get e utilize papel personalizado restrito quando tecnicamente suportado.

Não faça concessões por confiança em mocks.

Não substitua uma permissão específica por Editor, Owner ou Firebase Admin genérico.

Não conceda acesso direto ao Firestore ou Secret Manager à ponte quando não necessário.

Não conceda invocação ampla no projeto.

Preserve os bindings existentes entre gateway e backend.

Caso sejam necessárias permissões adicionais fora do escopo explícito, documente e solicite autorização específica.

### 7. Diretório administrativo

Verifique os índices necessários à pesquisa por nome, e-mail e UID no Firebase experimental.

Preserve:

- Projeção mínima.
- Paginação.
- Limites de frequência.
- Autorização administrativa.
- Proteção contra enumeração.
- Cursor autenticado ou validado conforme o contrato existente.

Reutilize índices existentes quando suficientes.

Crie exclusivamente os índices indispensáveis expressamente autorizados pelo escopo desta etapa, caso sua necessidade seja comprovada e sejam compatíveis com Spark.

Não publique regras amplas.

Não realize carga massiva de usuários.

Não utilize usuários oficiais.

Não habilite faturamento do Firebase.

### 8. Implantação da ponte

Utilize o artefato candidato validado pelo GitHub Actions.

Verifique a integridade do artefato e registre o digest efetivamente implantado.

Prepare o serviço Cloud Run dedicado à ponte:

- Região us-central1.
- 1 vCPU.
- 512 MiB.
- Instâncias mínimas: zero.
- Instâncias máximas: uma.
- Concorrência: uma.
- Timeout inicial: 30 segundos.
- Ingresso privado compatível com o ensaio autorizado.
- IAM obrigatório.
- Flag operacional desabilitada por padrão.

Não permita allUsers.

Não permita allAuthenticatedUsers.

Não desabilite a verificação IAM.

Não exponha o serviço à internet para utilização de navegadores comuns.

Não crie balanceador externo.

Não contrate Cloud Armor.

Não altere os serviços gateway e backend além das permissões estritamente autorizadas.

Documente os recursos necessários para armazenar e implantar a imagem, incluindo possíveis custos.

### 9. Comunicação privada

Valide o trajeto:

Cliente experimental autorizado → Ponte → Gateway IAM → Backend interno.

Confirme:

- Identidade gerenciada da ponte.
- Audiência do token IAM.
- Autorização de invocação.
- Token Firebase separado do token Google.
- Rejeição de chamadas não autorizadas.
- Rejeição de audiência incorreta.
- Rejeição de cabeçalhos adulterados.
- Impossibilidade de invocação direta não autorizada do backend.

Utilize um cliente controlado compatível com o ingresso privado.

Não amplie o ingresso para corrigir problemas de roteamento.

Caso seja necessária infraestrutura adicional, apresente o impedimento e a alternativa de menor custo, sem contratação automática.

### 10. Firebase Authentication real experimental

Utilize exclusivamente identidades do Firebase experimental.

Valide a comunicação com o Firebase Admin SDK utilizando autenticação gerenciada.

Confirme a capacidade de verificação de usuário bloqueado e token revogado, sem revelar credenciais.

Não revogue sessões oficiais.

Caso seja indispensável criar ou revogar uma identidade descartável para o ensaio privado, utilize somente uma identidade experimental especificamente identificada e autorizada, sem afetar o Owner ou outras contas existentes.

Não apresente tokens, segredos ou informações pessoais nos relatórios.

Preserve auth_time de até cinco minutos para operações críticas.

### 11. Primeiro ensaio privado

Realize somente um conjunto limitado de ensaios de infraestrutura, autenticação e comunicação.

Não realize testes de carga volumosos.

Não consuma créditos Gemini.

Não habilite as flags de extração real do gateway ou backend.

Não execute lançamento financeiro.

Quando necessário, habilite temporariamente somente o transporte privado experimental, com o provedor real desabilitado e dentro do escopo autorizado.

Ao concluir, retorne a ponte ao estado desabilitado.

Registre as evidências anteriores e posteriores.

Os testes funcionais completos com extração simulada permanecerão reservados à Etapa 08.6.3.

### 12. Finance Guard

Preserve integralmente:

- Orçamento mensal de R$ 10,00.
- Alertas de 25%, 50%, 75% e 100%.
- Suspensão preventiva aos 75%.
- Estado persistente de suspensão.
- Reativação autorizada.
- Auditoria.
- Receptor financeiro independente.
- Liquidação e restituição de operações já admitidas.

Não fabrique observações financeiras.

Não limpe históricos financeiros.

Não zere custos ou suspensões.

Não trate ausência de observação financeira como autorização.

Não utilize eventos fictícios para desbloquear o processamento real.

Caso a observação financeira vigente esteja indisponível, confirme o bloqueio seguro.

### 13. Segurança contra abuso

Preserve os controles locais da ponte e os controles comerciais distribuídos no backend.

Documente explicitamente a proteção distribuída anterior à autenticação ainda pendente.

Não habilite acesso público sob a justificativa de que os limites comerciais já existem.

A proteção comercial de extrações não substitui a proteção contra custos gerados por tráfego inválido que alcance a infraestrutura.

A solução para exposição futura deverá ser avaliada antes da autorização de acesso por navegadores comuns.

### 14. Custos e evidências

Registre:

- Custos incrementais estimados.
- Consumo de CPU.
- Memória.
- Latência.
- Inicializações a frio, quando observáveis.
- Chamadas de autenticação.
- Tráfego.
- Logs.
- Recursos adicionais utilizados.
- Situação observada do faturamento, quando disponível.

Não declare custo zero definitivo com base apenas em relatório ainda não atualizado.

Preserve os limites comerciais e operacionais existentes.

Não contrate serviços adicionais ou planos pagos.

### 15. Reversão e suspensão

Mantenha procedimento de reversão documentado.

Em caso de falha:

- Desabilite a ponte.
- Preserve gateway e backend protegidos.
- Preserve o receptor financeiro.
- Preserve a liquidação de operações previamente admitidas.
- Preserve o ponto de restauração.
- Reverta exclusivamente as alterações desta etapa quando autorizado e necessário.

Não exclua identidades ou recursos preexistentes.

Não limpe bancos ou caches oficiais.

### 16. Validação e entrega

Preserve os 128 testes anteriores.

Acrescente somente regressões necessárias às alterações realizadas.

Execute GitHub Actions para as alterações versionadas.

Registre:

- Commit inicial e final.
- Identidade dedicada efetivamente utilizada.
- Matriz IAM aplicada.
- Índices verificados ou criados.
- Configuração do serviço.
- Revisão Cloud Run.
- Digest da imagem.
- Evidências do ensaio privado.
- Resultados de autorização negativa.
- Situação das flags após os testes.
- Estado do receptor financeiro.
- Custos observados e estimados.
- Pendências da integração remota.
- Procedimento de reversão.

Não revele segredos ou tokens.

Prepare a próxima instrução para a Etapa 08.6.3 — Remote End-to-End Simulation.

### 17. Restrições absolutas

Preserve:

- Produção V34.7.4.5.
- Homologação publicada.
- Ponto de restauração oficial.
- Três bancos existentes.
- Núcleo financeiro.
- Backup criptografado.
- Domínios próprios e DNS.
- Firebase Spark.
- 128 testes anteriores.
- UX01 a UX80.
- SEC-01 a SEC-10.
- REM-01 a REM-15.
- Security Guard.
- Finance Guard.
- Orçamento mensal de R$ 10,00.
- Suspensão aos 75%.
- Dois créditos Free vitalícios.
- Quinze créditos Premium mensais.
- Limites globais de 30 tentativas diárias e 60 mensais.
- Distribuição server-only.

Não realize:

- Chamadas reais ao Gemini.
- Exposição pública.
- Contratação de Cloud Armor.
- Criação de balanceador externo.
- Alterações de faturamento.
- Associação de faturamento ao Firebase experimental.
- Permissões IAM amplas.
- Gravações financeiras reais.
- Migrações.
- Merge em branches oficiais.
- Publicação em homologação.
- Publicação em produção.

Execute exclusivamente as operações expressamente autorizadas.

Não avance para a Etapa 08.6.3 sem autorização específica.