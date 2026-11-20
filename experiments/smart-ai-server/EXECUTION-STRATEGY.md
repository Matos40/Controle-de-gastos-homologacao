# V35.0 — Estratégia de execução Smart AI

Aprovada pelo usuário em 19/11/2026. Complemento normativo ao plano de execução, após 08.3.2 (ff53ead). Workers Free encerrado; Cloud Run candidato, sem autorização de faturamento.

## Política comercial aprovada
- Cadastro automático Free; 2 créditos de experimentação por conta, concedidos uma única vez, sem renovação ou reposição por reinstalação/logout.
- Premium ativo: 15 créditos por mês civil, renovação no primeiro dia, não acumulativos. Usar fuso America/Bahia como padrão de implementação a validar. Cancelamento retorna ao Free ao fim do período contratado, preservando histórico de experimentação.
- Um crédito por arquivo PDF ou imagem extraído com sucesso, independentemente do número de lançamentos; limite 10 MiB. Extração não implica lançamento financeiro automático.
- Máximo de duas tentativas admitidas em janela móvel de 60 segundos por UID, ambos os planos; uma operação simultânea por UID. Limitar também falhas e consumo global configurável.
- Reserva atômica antes da chamada externa; confirmação ou restituição idempotente conforme resultado; proteção contra replay, concorrência, duplicatas e troca de mês durante reserva. Autorização, plano, relógio e saldo verificados pelo servidor; cliente não escreve cotas.
- Interface candidata mostra saldo e cadeado após esgotamento; Free oferece CTA Premium; Premium informa próxima renovação. Smart Admin AI acompanha volumes, falhas, conversões e limites globais sem registrar conteúdo financeiro bruto.
- Chave API existente preservada até decisão de política comercial definitiva; não disponibilizar rota alternativa que burle cotas do Smart AI gerenciado.

## Ordem de execução
1. Inventariar contratos existentes e adaptar apenas lacunas da política; testes sintéticos de cadastro, renovação, cancelamento, concorrência, idempotência, falhas, limites e isolamento.
2. Etapa 08.3.3: portar entrada para container Node.js isolado, preferindo transporte JSON validado como controle inicial; preservar núcleo, autenticação, revogação, auditoria e limite de arquivo. Executar testes locais e CI; preparar estimativa de custos considerando novos Free, Premium, falhas, Gemini, Firestore, CPU e rede. Configurar limites e interrupção operacional; alertas de orçamento não são teto rígido.
3. Preparar interface candidata e indicadores administrativos em homologação isolada, sem publicação. Validar integração antes de solicitar autorização específica de faturamento e ensaio remoto Cloud Run.
4. Etapa 08.4 permanece bloqueada até aprovação dos resultados.

## Restrições
Preservar produção, homologação publicada, Firebase Spark, três bancos, Chave API existente e ponto de restauração. Não habilitar faturamento, serviços pagos, merge ou publicação. Separar projeto experimental do Firebase oficial. Dados exclusivamente fictícios. Registrar commits, testes e evidências reais; não declarar execução não verificada.

## Critério econômico
Hipótese de uso típico: três arquivos por assinante/mês; não tratar como medição real. Planejar também cenário máximo de 15 e picos de novos Free (2 cada). Falhas podem gerar custo mesmo com restituição de crédito.

## Adendo aprovado — Smart Security Guard e Smart AI Finance Guard
Aprovado após a preparação operacional 08.3.7 (base c89036da69fe6b4424ec53908a279feaa710f7ba). Gate obrigatório antes do provisionamento; não autoriza faturamento, serviços pagos, alterações IAM remotas ou implantação.

- Security Guard: autorização por UID e função confiável no servidor; proteger Owner e impedir autoelevação, manipulação de plano e saldo e escrita direta indevida. Validar token, revogação e permissão a cada operação sensível; exigir autenticação recente via auth_time verificado (janela candidata de 5 minutos), não mero refresh do token. Revalidar na transação, proteger contra replay e alterações concorrentes; reforçar limitação de requisições inválidas e custo de gateway. Auditoria minimizada sem tokens, faturas ou credenciais; testes negativos e isolamento. Não alterar IAM ou regras remotas nesta fase.
- Finance Guard: orçamento experimental proposto R$ 10/mês, avisos 25% e 50%, suspensão automática aos 75% (R$ 7,50), alerta crítico aos 100%. Preparar recepção autenticada de notificações de orçamento Pub/Sub, validação de projeto, orçamento, moeda e período, deduplicação e tratamento de mensagens atrasadas/fora de ordem. Separar estimativa operacional de faturamento observado. A pausa financeira deve ser persistente, impedir novas reservas em transação, permitir liquidar as existentes e não ser anulada por mudança de mês, mensagem atrasada ou reinício. Reativação exclusiva do Owner com autenticação recente, auditoria e revisão do risco financeiro. Preparar procedimento de bloqueio do gateway e backend e canal de recuperação independente do serviço suspenso; não conceder IAM amplo ao aplicativo. Alertas podem atrasar e não constituem limite rígido; custos residuais continuam possíveis. Não desligar faturamento automaticamente nem apagar dados.
- Preservar os 66 testes aprovados e executar testes sintéticos, Firestore Emulator, CI e build Docker; simular eventos de faturamento sem provisionar Pub/Sub ou serviços remotos. Documentar custos adicionais, permissões mínimas e limites de proteção antes de pedir autorização financeira específica.
- Preservar produção, homologação publicada, Firebase Spark, três bancos, Chave API, ponto de restauração V34.7.4.5. Não fazer merge, publicação ou iniciar 08.4.
