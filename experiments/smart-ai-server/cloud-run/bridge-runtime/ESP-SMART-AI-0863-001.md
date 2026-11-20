# RAYTECH CG V35.0 SERVER-ONLY
## ESP-SMART-AI-0863-001 — Preparação do Ensaio Remoto Privado Autenticado

### AUTORIZAÇÃO E ESCOPO

O Owner autorizou a preparação técnica local da Etapa 08.6.3.

A autorização contempla:
- Análise dos componentes experimentais existentes.
- Preparação de código e contratos de diagnóstico.
- Testes locais com serviços simulados.
- Planejamento operacional e estimativa de custos.
- Documentação das operações remotas necessárias.

**Não autoriza implantação remota, alterações IAM, exposição pública, ativação de serviços ou chamadas reais ao Gemini.**

Esta especificação está sendo reapresentada para conferência da implementação local já realizada.

**Não reinicie o desenvolvimento e não descarte alterações válidas.**

### 1. REFERÊNCIAS

- Repositório: Matos40/Controle-de-gastos-homologacao.
- Branch: feature/smart-ai-server-v350-poc.
- Commit de referência: 8b9991db70e05ffeeac1826c6f80c5821b8e32f2.
- Baseline: 128 testes anteriores.
- Requisitos UX01 a UX80.
- Requisitos SEC-01 a SEC-10.
- Requisitos REM-01 a REM-15.
- Projeto Cloud Run: raytech-3d.
- Número: 761761828111.
- Região: us-central1.
- Firebase experimental: gen-lang-client-0593667072.
- Relatório anterior: RESULTADOS-0862.md.

O Codex informou que a preparação atual possui 131 testes aprovados. Preserve essa implementação e confira a rastreabilidade dos três testes adicionais.

### 2. CLIENTE INTERNO AUTORIZADO

Determine se existe um recurso experimental previamente autorizado capaz de invocar a ponte privada.

Verifique somente:

- Localização de rede.
- Conectividade privada.
- Identidade de execução.
- Capacidade de obter token Google IAM.
- Audiência correta.
- Permissões mínimas.
- Impacto financeiro.
- Possível interferência nas funções atuais.

Não considere um recurso automaticamente autorizado apenas por estar no mesmo projeto.

**Priorize reutilização segura.**

Caso não exista recurso adequado, prepare a alternativa de cliente temporário isolado, com:

- Acesso não público.
- Identidade própria.
- `roles/run.invoker` exclusivamente na ponte.
- Nenhuma chave JSON.
- Nenhuma permissão financeira ou administrativa desnecessária.
- Execução limitada.
- Desligamento e reversão documentados.

Não provisione o cliente nesta etapa.

### 3. DIAGNÓSTICO PRIVADO

Prepare mecanismo autenticado de diagnóstico para validar futuramente:

Cliente interno → Ponte → Gateway → Backend.

Requisitos:

- IAM obrigatório nas fronteiras pertinentes.
- Validação Firebase nas operações que exigirem identidade comercial.
- Separação entre token Firebase e token Google IAM.
- Validação de audiência e identidade.
- Rejeição de cabeçalhos falsificados.
- Resposta sintética e sanitizada.
- Nenhuma chamada Gemini.
- Nenhuma reserva ou consumo de créditos.
- Nenhuma gravação financeira.
- Nenhuma alteração de cotas comerciais.
- Nenhuma modificação do Finance Guard.
- Ausência de proxy genérico.

Qualquer nova rota deverá especificar método, autorização, formato de resposta, efeitos permitidos e condição de ativação.

O diagnóstico deverá permanecer desabilitado por padrão e separado da extração real.

Não habilite a flag geral do gateway para viabilizá-lo.

O diagnóstico local já implementado em `private-diagnostic.mjs` deverá ser reaproveitado e confrontado com esses requisitos, identificando expressamente quais verificações são somente simuladas e quais ainda dependerão do ambiente remoto.

### 4. AUTENTICAÇÃO

Prepare cenários de verificação para:

- Token Firebase válido.
- Token Firebase expirado.
- Token Firebase revogado.
- Usuário desabilitado.
- Token de outro projeto.
- Token IAM inválido.
- Audiência IAM incorreta.
- Identidade IAM não autorizada.
- Cabeçalhos adulterados.
- Owner autorizado.
- Admin autorizado.
- Free comum sem acesso administrativo.
- Premium comum sem acesso administrativo.
- Reautenticação crítica com até cinco minutos.
- Reautenticação crítica expirada.

Não utilize contas oficiais.

Não registre tokens ou credenciais.

Não atribua privilégios administrativos com base no plano comercial.

### 5. TIMEOUTS, IDEMPOTÊNCIA E RECONCILIAÇÃO

Preserve os limites vigentes:

- Ponte: 30 segundos.
- Gateway: contêiner com timeout de 45 segundos e prazo interno de 35 segundos.
- Backend: contêiner com timeout de 45 segundos e prazo de aplicação de 30 segundos.

Prepare testes para:

1. Resposta concluída normalmente.
2. Timeout da ponte enquanto o backend continua.
3. Desconexão do cliente.
4. Liquidação após desconexão.
5. Falha confirmada com restituição legítima.
6. Reserva pendente.
7. Recuperação após expiração da reserva.
8. Consulta pelo mesmo `requestId`.
9. Repetição idempotente da operação.
10. Tentativa indevida de repetir com novo identificador.

**Timeout não significa falha confirmada.**

Enquanto o estado não for reconciliado:

- Marcar resultado como desconhecido.
- Consultar a operação pelo `requestId` original.
- Não repetir automaticamente com novo identificador.
- Não restituir crédito por inferência.
- Não duplicar processamento.
- Preservar a recuperação segura de reservas.

Não alterar os timeouts dos serviços existentes sem autorização.

### 6. FINANCE GUARD

Preserve:

- Orçamento mensal de R$ 10,00.
- Alerta em 25%.
- Alerta em 50%.
- Suspensão preventiva em 75%.
- Alerta crítico em 100%.
- Suspensão persistente.
- Reativação autorizada e auditada.
- Observação financeira autêntica.
- Bloqueio seguro sem observação vigente.
- Receptor Pub/Sub ativo.
- Liquidação e restituição de operações já admitidas.

O diagnóstico não poderá alterar o faturamento, mesmo quando os dados forem simulados.

Não fabrique eventos financeiros para desbloquear operações.

### 7. SEGURANÇA

Preserve integralmente a distribuição server-only.

Não reintroduza:

- Chave API pessoal.
- Leitor Gemini direto.
- Fallback automático.
- Token IAM no navegador.
- Credenciais privilegiadas.
- Rotas administrativas sem autorização.
- Conteúdo sensível no cache do PWA.

CORS e App Check não substituem autenticação IAM ou autorização comercial.

Não abra ingresso público.

Não contrate Cloud Armor ou balanceador.

A proteção distribuída contra tráfego abusivo anterior à autenticação permanece pendente de decisão antes de qualquer exposição pública.

### 8. TESTES LOCAIS

Preserve os 128 testes anteriores e os três novos informados nesta preparação.

Utilize:

- Firestore Emulator.
- Cliente interno simulado.
- IAM simulado.
- Firebase Authentication simulado.
- Gateway simulado.
- Backend simulado.
- Documentos e perfis fictícios.
- Testes de timeout.
- Testes de autorização negativa.

Não apresente mocks como evidência de autenticação remota real.

Não execute chamadas Gemini.

Não grave dados financeiros reais.

Não repita suítes extensas sem necessidade; execute as regressões que comprovem as alterações finais e preserve a integridade do conjunto aprovado.

### 9. ALTERNATIVAS E CUSTOS

Documente duas opções:

**A — Reutilização de cliente interno existente.**

**B — Cliente temporário isolado.**

Para cada uma, apresente:

- Recursos adicionais.
- Identidade utilizada.
- Permissões IAM.
- CPU e memória.
- Duração máxima.
- Quantidade de chamadas.
- Custo bruto estimado.
- Custos auxiliares.
- Procedimento de desligamento.
- Procedimento de reversão.

As estimativas informadas nesta preparação são:

- Job temporário de 60 segundos: US$ 0,00114 de computação.
- Uma chamada de dez segundos em cada um dos três serviços: aproximadamente US$ 0,00076 adicionais.

Trate esses valores como estimativas, não como cobrança confirmada ou garantia de custo total.

Não habilite faturamento no Firebase experimental.

### 10. ENTREGA E RASTREABILIDADE

Confronte a implementação já realizada com todos os requisitos desta especificação.

Entregue:

1. ESP-SMART-AI-0863-001.
2. Matriz de requisitos atendidos e pendentes.
3. Arquitetura mínima recomendada.
4. Comparação entre cliente existente e temporário.
5. Contrato do diagnóstico privado.
6. Matriz de autenticação positiva e negativa.
7. Estratégia de timeout e reconciliação.
8. Estimativa de custos.
9. IAM mínimo necessário.
10. Procedimento de implantação futura.
11. Procedimento de reversão.
12. Lista explícita de operações remotas que dependem de autorização.
13. Evidências dos 131 testes informados.
14. Evidências de preservação das proteções anteriores.

Se houver lacunas na implementação atual, corrija exclusivamente aquelas que possam ser resolvidas localmente.

Se houver requisito que dependa de implantação remota, classifique-o como pendente e não tente simulá-lo como concluído.

Realize commit exclusivamente na branch experimental autorizada após validar o estado atual e eventuais alterações locais não commitadas.

Execute GitHub Actions quando houver alterações versionadas.

Não execute operações remotas nesta etapa.

### 11. RESTRIÇÕES ABSOLUTAS

Preserve:

- Produção V34.7.4.5.
- Homologação publicada.
- Três bancos financeiros.
- Núcleo financeiro.
- Firebase experimental Spark.
- Backup criptografado.
- Domínios e DNS.
- Security Guard.
- Finance Guard.
- 128 testes originais e os três adicionais.
- UX01 a UX80.
- SEC-01 a SEC-10.
- REM-01 a REM-15.
- Mecanismo de restauração legado.
- Receptor financeiro e reservas existentes.

Não realize:

- Alterações remotas de IAM.
- Criação remota de serviços ou jobs.
- Exposição pública.
- Chamadas Gemini reais.
- Gravações financeiras reais.
- Alterações de faturamento.
- Migrações.
- Merge.
- Publicação em homologação.
- Publicação em produção.

### RESULTADO ESPERADO

Concluir a preparação local da 08.6.3 aproveitando o trabalho já executado, corrigindo somente lacunas comprovadas e deixando definido o menor conjunto de operações remotas necessário ao primeiro ensaio autenticado privado.

Não repetir o planejamento.

Não reabrir o refinamento visual.

Não solicitar nova autorização para alterações locais já autorizadas.

Não iniciar a execução remota antes de autorização específica do Owner.