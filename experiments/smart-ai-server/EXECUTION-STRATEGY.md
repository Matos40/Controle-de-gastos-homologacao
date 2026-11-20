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
