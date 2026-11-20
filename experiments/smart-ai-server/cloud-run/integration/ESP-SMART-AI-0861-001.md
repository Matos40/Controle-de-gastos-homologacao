# RAYTECH CG V35.0 SERVER-ONLY
## Etapa 08.6.1 — Secure Remote Integration Foundation

### 1. Contexto e baseline

A Etapa 08.5.4 foi aprovada pelo Owner, incluindo:

- Testes práticos dos créditos Free e Premium.
- Correção BUG-0853-01.
- Organização visual do Smart AI Monitor.
- Sete testes financeiros.
- Distribuição experimental server-only.

Encerre o refinamento visual.

Não proponha novas alterações estéticas sem defeito concreto.

Referências:

- Repositório: Matos40/Controle-de-gastos-homologacao.
- Branch: feature/smart-ai-server-v350-poc.
- Commit inicial: cad1b7546af96cd581b74774234a085af7396918.
- GitHub Actions: 44802813575.
- Artefato anterior: 14662190994.
- Baseline: 122 testes aprovados.
- Requisitos UX01 a UX80.
- Requisitos SEC-01 a SEC-10.
- Especificação ESP-SMART-AI-0854-001.
- Produção protegida: V34.7.4.5.
- Commit oficial protegido: 121cca799aa7072094c668697249214b899e86d5.

Registre a nova especificação como ESP-SMART-AI-0861-001.

### 2. Objetivo

Preparar efetivamente a integração remota autenticada do Raytech CG V35.0 com o Smart AI Server.

Nesta subetapa, implemente exclusivamente código, configuração candidata, testes locais e documentação operacional na branch experimental.

Não implante serviços remotos.

Não altere IAM remotamente.

Não utilize Gemini real.

Não grave dados financeiros reais.

### 3. Infraestrutura existente

Preserve:

- Projeto Cloud Run: raytech-3d.
- Número do projeto: 761761828111.
- Identificação: Raytech Smart AI Cloud Run.
- Região: us-central1.
- Firebase experimental: gen-lang-client-0593667072.
- Firebase experimental no plano Spark.
- Gateway existente protegido por IAM.
- Backend existente com ingresso interno.
- Direct VPC e Private Google Access já configurados.

Reaproveite a infraestrutura experimental anteriormente validada.

Não recrie componentes funcionais sem justificativa técnica.

Não utilize os projetos Firebase oficiais de produção ou homologação publicada.

Não associe faturamento ao Firebase experimental.

### 4. REM-01 — Intermediário autenticado

Prepare o intermediário responsável pela comunicação entre a interface Raytech CG e o gateway protegido.

O intermediário deverá:

- Receber requisições autenticadas do aplicativo.
- Validar a identidade do usuário.
- Aplicar proteção inicial contra abuso.
- Verificar formato, tamanho e método das requisições.
- Encaminhar somente operações expressamente permitidas.
- Utilizar identidade de serviço dedicada para invocação do gateway.
- Preservar o contexto autenticado do usuário.
- Retornar respostas sanitizadas.

Não implemente um proxy genérico que aceite destinos, métodos ou caminhos arbitrários.

Não permita que o navegador informe o endereço interno do backend.

Utilize uma lista explícita de operações autorizadas.

Não encaminhe cabeçalhos privilegiados enviados pelo cliente sem validação.

### 5. REM-02 — Autenticação Firebase

Prepare a integração com Firebase Authentication experimental.

Valide:

- Assinatura do token.
- Emissor.
- Audiência.
- UID.
- Validade temporal.
- Projeto Firebase autorizado.
- Conta bloqueada.
- Revogação.
- Claims administrativas.
- Identidade Owner.
- Autenticação recente para ações críticas.

Utilize a verificação de revogação conforme os mecanismos oficiais do Firebase Admin SDK.

A reautenticação recente deverá considerar auth_time, não apenas a emissão de um token atualizado.

Preserve a janela máxima de cinco minutos para operações críticas.

Não aceite UID, plano ou papel administrativo fornecidos pelo frontend como fonte de autoridade.

Na ausência de validação confiável, rejeite a requisição.

Não implemente fallback que aceite tokens não verificados.

### 6. REM-03 — Identidade de serviço dedicada

Prepare a configuração candidata de uma conta de serviço exclusiva para o intermediário.

Identificador sugerido:

raytech-smart-ai-bridge

Confirme disponibilidade do identificador antes da futura implantação.

A identidade deverá possuir exclusivamente as permissões necessárias.

Prepare a concessão restrita de invocação no gateway específico.

Não conceda:

- Owner do projeto.
- Editor do projeto.
- Acesso administrativo genérico.
- Acesso desnecessário ao Firestore.
- Acesso direto ao Secret Manager quando não necessário.
- Permissão de invocação indiscriminada de serviços.

Utilize credenciais de execução gerenciadas pelo ambiente Cloud Run e tokens de identidade com audiência correta.

Não gere arquivos JSON de contas de serviço.

Não coloque credenciais IAM no navegador.

Nesta subetapa, documente e prepare a configuração, sem efetuar concessões remotas.

### 7. REM-04 — Comunicação entre serviços

Preserve a arquitetura:

Navegador → Intermediário autenticado → Gateway protegido por IAM → Backend interno → Gemini.

Separe:

- Token Firebase do usuário.
- Token de identidade IAM do serviço chamador.
- Autorização comercial.
- Autorização administrativa.

Valide a audiência dos tokens de serviço.

Garanta que o backend não confie exclusivamente em cabeçalhos de identidade arbitrários.

Preserve ou prepare o mecanismo de propagação autenticada do contexto do usuário.

Mantenha o backend com ingresso interno.

Conserve as restrições de rede existentes.

Prepare testes para:

- Chamador não autorizado.
- Token IAM inválido.
- Audiência incorreta.
- Cabeçalhos adulterados.
- Identidade de serviço incompatível.
- Tentativa de invocação direta do backend.

Não declare o trajeto privado de ponta a ponta validado remotamente nesta subetapa.

### 8. REM-05 — Exposição de rede controlada

O navegador do usuário precisará futuramente alcançar uma interface HTTPS.

Reconheça explicitamente que esse ponto de entrada poderá ser alcançável pela internet, embora suas operações devam exigir autenticação válida.

Não confunda:

- Endpoint HTTPS alcançável pela internet.
- Operação autorizada do aplicativo.
- Serviço interno protegido por IAM.

Prepare a estratégia de implantação experimental futura do intermediário.

Mantenha gateway e backend protegidos.

Compare opções compatíveis com a infraestrutura existente e o orçamento de R$ 10,00.

Apresente custos incrementais e limitações.

Não introduza serviços pagos adicionais sem autorização.

Não exponha nenhum endpoint nesta subetapa.

### 9. REM-06 — Proteção distribuída contra abuso

Preserve o Security Guard.

Prepare controles que não dependam exclusivamente da memória de uma instância.

Valide:

- Duas tentativas por janela móvel de 60 segundos por UID.
- Uma operação simultânea por UID.
- Limite global de 30 tentativas diárias.
- Limite global de 60 tentativas mensais.
- Controle de requisições inválidas.
- Controle de tráfego não autenticado.
- Limitação de tamanho do corpo.
- Limite máximo de arquivo de 10 MiB.
- Proteção contra duplicação.
- Idempotência.
- Repetições indevidas.
- Expiração e recuperação de reservas.

Preserve operações atômicas nos controles comerciais.

Avalie o consumo do Firestore experimental decorrente desses mecanismos.

Não utilize o Firestore ilimitadamente para registrar cada requisição maliciosa.

Prepare proteção anterior às operações de banco sempre que possível.

Não confie exclusivamente em CORS, App Check ou cabeçalhos de origem para autorização.

Documente os limites da proteção contra tráfego abusivo antes da futura exposição.

### 10. REM-07 — Créditos e autorização comercial

Preserve integralmente:

Free:

- Dois créditos vitalícios.
- Sem renovação automática.

Premium:

- Quinze créditos mensais.
- Renovação no primeiro dia do mês.
- Fuso America/Bahia.
- Sem acumulação.

O servidor continuará responsável pelo saldo, reserva, liquidação e restituição.

Não debite créditos apenas pela abertura da janela ou seleção de arquivo.

Reserve crédito de maneira atômica antes da operação admitida.

Liquide somente após extração válida.

Restitua créditos em falhas confirmadas, conforme o contrato existente.

Contabilize tentativas nos limites globais conforme a política aprovada.

Não permita contornar limites por novas abas, dispositivos, requisições simultâneas ou manipulação do navegador.

Utilize somente perfis e saldos fictícios durante os testes locais.

### 11. REM-08 — Finance Guard

Preserve:

- Orçamento mensal de R$ 10,00.
- Alertas de 25%, 50%, 75% e 100%.
- Suspensão preventiva aos 75%.
- Bloqueio persistente após reinicializações.
- Persistência da suspensão durante a mudança de mês, conforme política aprovada.
- Reativação expressa pelo Owner autorizado.
- Reautenticação recente.
- Auditoria.
- Nova suspensão diante de evento financeiro válido posterior.

Não permita que o intermediário contorne o Finance Guard.

Na ausência de observação financeira autêntica e válida para o mês vigente, preserve a política de bloqueio seguro.

Permita a liquidação ou restituição de operações já admitidas, conforme seus contratos, sem admitir novas extrações bloqueadas.

Mantenha a recepção dos eventos financeiros independente da disponibilidade do leitor.

Preserve o mecanismo Pub/Sub autenticado existente.

Não trate o orçamento como teto rígido de cobrança.

Diferencie custos observados, estimados e simulados.

Não utilize eventos fictícios para desbloquear extrações reais.

### 12. REM-09 — Transporte frontend

Reaproveite a interface aprovada na Etapa 08.5.4.

Prepare um adaptador de transporte remoto para o Smart AI.

Preserve:

- Modal original Escanear Fatura com IA.
- Card de créditos.
- Barra roxa de 6 px.
- Disponibilidade.
- Informação de renovação.
- Upload.
- Arrastar e soltar.
- Colagem de imagens.
- Revisão manual.
- Smart Admin.
- Smart AI Monitor.

Não introduza novas modalidades de extração.

Não reintroduza Chave API pessoal.

Não inclua fallback direto para Gemini.

Mantenha o modo remoto desabilitado por padrão.

Utilize configuração experimental confiável para selecionar o transporte.

Não permita que uma flag local conceda autorização ou ative processamento real.

Teste:

- Sessão expirada.
- Perda de conexão.
- Timeout.
- Serviço indisponível.
- Créditos esgotados.
- Suspensão.
- Limite global atingido.
- Resposta inválida.
- Falha de autenticação.

Não apresente informações financeiras ou de disponibilidade desatualizadas como se fossem válidas.

### 13. REM-10 — Privacidade das faturas

Prepare o tratamento seguro dos documentos.

Valide:

- Tipo permitido.
- Assinatura de arquivo.
- Tamanho máximo.
- Formato.
- Requisições malformadas.
- Limites de processamento.
- Tratamento de conteúdo não confiável.

Não grave faturas permanentemente sem necessidade aprovada.

Não registre conteúdo de faturas em logs.

Não registre tokens, credenciais ou dados financeiros pessoais.

Não utilize URLs públicas para documentos privados.

Mantenha documentos e respostas sensíveis fora do cache do PWA.

Preserve a revisão obrigatória.

Utilize somente arquivos sintéticos nesta etapa.

### 14. REM-11 — Pesquisa administrativa

Prepare a integração remota da pesquisa administrativa existente.

Preserve a interface unificada.

Valide:

- Pesquisa por nome.
- Pesquisa por e-mail.
- Pesquisa por UID.
- Paginação.
- Minimização dos dados retornados.
- Autorização administrativa.
- Proteção contra enumeração.
- Limitação de frequência.

Prepare os índices estritamente necessários.

Estime o consumo de leituras e gravações.

Não publique índices ou regras Firestore nesta subetapa.

Não utilize dados de usuários oficiais.

### 15. REM-12 — CSP e PWA

Prepare a política CSP candidata compatível com o futuro intermediário e os serviços Firebase autorizados.

Preserve:

- Autenticação.
- Sincronização.
- PWA.
- Recursos estáticos.
- Funcionamento offline.

Não permita acesso direto ao Gemini pelo aplicativo.

Não utilize curingas desnecessários.

Não armazene em cache:

- Tokens.
- Sessões.
- Faturas.
- Respostas de extração sensíveis.
- Rotas administrativas autenticadas.
- Segredos.

Preserve SEC-01 a SEC-10.

Inspecione a distribuição final.

Garanta que o leitor legado e os módulos de recuperação continuem ausentes do pacote server-only.

Não modifique a CSP oficial.

### 16. REM-13 — Controle operacional e custos

Preserve as configurações existentes de gateway e backend:

- 1 vCPU.
- 512 MiB.
- Mínimo de zero instâncias.
- Máximo de uma instância por serviço.
- Concorrência configurada igual a um.
- Timeout de 30 segundos.

Não altere remotamente essas configurações.

Prepare configurações candidatas conservadoras para o intermediário, dimensionadas segundo os testes.

Avalie:

- CPU e memória.
- Latência.
- Inicialização a frio.
- Tráfego.
- Firestore.
- Autenticação.
- Logs.
- Secret Manager.
- Rede.
- Eventuais serviços adicionais.

Apresente cenários de custo estimado, distinguindo franquias gratuitas, custos potenciais e limitações.

Não prometa custo zero.

Prepare um procedimento emergencial que permita suspender novas extrações sem impedir operações essenciais de liquidação ou a recepção de eventos financeiros.

### 17. REM-14 — Validação local

Preserve os 122 testes anteriores.

Acrescente regressões necessárias aos requisitos REM-01 a REM-13.

Utilize:

- Firestore Emulator.
- Identidades fictícias.
- Transporte simulado.
- Provedor Gemini simulado.
- Arquivos sintéticos.
- Testes de navegador.
- Testes de concorrência.
- Testes de autorização negativa.
- Build Docker.
- Distribuição isolada.

Valide o fluxo de ponta a ponta em ambiente local:

1. Login experimental.
2. Identidade validada.
3. Consulta de créditos.
4. Seleção de documento.
5. Admissão comercial.
6. Reserva.
7. Processamento simulado.
8. Liquidação ou restituição.
9. Atualização do saldo.
10. Revisão financeira.
11. Confirmação simulada.

Não grave nos três bancos existentes.

Não repita os seis ensaios reais com Gemini anteriormente aprovados.

Não reabra as quatro falhas legadas de cache sem nova evidência concreta.

Não reabra o refinamento visual.

Trate eventuais verificações mobile e de sincronização remanescentes dentro das regressões necessárias.

### 18. REM-15 — Entrega e preparação da implantação

Realize commit exclusivamente na branch experimental autorizada.

Execute GitHub Actions.

Apresente:

- Commit inicial e final.
- Resultado da suíte automatizada.
- Especificação ESP-SMART-AI-0861-001.
- Matriz REM-01 a REM-15.
- Preservação UX01 a UX80.
- Preservação SEC-01 a SEC-10.
- Configuração candidata do intermediário.
- Proposta de identidade dedicada.
- Matriz de permissões IAM mínimas.
- Estratégia de exposição HTTPS autenticada.
- Estratégia de proteção distribuída.
- Política CSP candidata.
- Estimativa de custos incrementais.
- Procedimento de suspensão emergencial.
- Procedimento de reversão.
- Pendências reais para implantação.
- Artefato experimental.

Prepare uma instrução operacional objetiva para a futura Etapa 08.6.2.

Identifique precisamente as operações remotas que dependerão de autorização específica do Owner.

Não execute essas operações.

### 19. Restrições absolutas

Preserve integralmente:

- Produção V34.7.4.5.
- Homologação publicada.
- Ponto oficial de restauração.
- Três bancos existentes.
- Núcleo financeiro.
- Firebase Spark.
- Domínios próprios e DNS.
- Backup criptografado da Calculadora 3D.
- 122 testes anteriores.
- UX01 a UX80.
- SEC-01 a SEC-10.
- Security Guard.
- Finance Guard.
- Orçamento de R$ 10,00.
- Suspensão preventiva aos 75%.
- Limites comerciais.
- Distribuição server-only.
- Identidade visual aprovada.

Não realize:

- Exposição pública de serviços.
- Implantação remota.
- Concessões IAM remotas.
- Alterações de faturamento.
- Chamadas reais ao Gemini.
- Ativação de extrações reais.
- Alterações nos projetos oficiais.
- Lançamentos financeiros reais.
- Migrações.
- Merge.
- Publicação em homologação.
- Publicação em produção.

Mantenha a extração real desabilitada no gateway e backend.

Não interrompa o receptor financeiro existente.

### 20. Resultado esperado

Entregar uma fundação de integração remota autenticada implementada, testada localmente e preparada para futura implantação controlada.

O próximo passo deverá ser a autorização específica da Etapa 08.6.2.

Execute as operações locais e versionadas autorizadas de maneira objetiva.

Não substitua implementação por planejamento excessivo.

Não repita auditorias concluídas.

Não avance autonomamente para operações remotas.