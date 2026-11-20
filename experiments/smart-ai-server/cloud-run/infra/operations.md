# Etapa 08.3.7 — Preparação operacional bloqueada

Projeto de computação proposto `raytech-ai-run-exp-v350`, região `us-central1`. O Firebase experimental `gen-lang-client-0593667072` permanece no Spark. Seu Firestore `(default)` segue em `southamerica-east1`. O ID do projeto de computação ainda deve ser confirmado como disponível. A preparação local não cria nem lista recursos automaticamente. Nenhuma configuração deste documento autoriza faturamento ou aplicação.

## Preparação executável, sem rede

Usar a partir de `experiments/smart-ai-server/cloud-run`. Montar um JSON local com `projectNumber`, `image`, `origin` e `secretVersion`. Para ensaio offline podem ser valores fictícios nos formatos exigidos. O número não é a conta de faturamento. A imagem deve apontar para um digest SHA-256 no registro proposto, e o segredo é apenas um número de versão. Não incorporar o conteúdo do segredo no arquivo.

```sh
node infra/prepare.mjs inputs.json ./prepared-local
node infra/trial.mjs --write ./synthetic-invoices
node infra/operational-cost.mjs
node --test infra/operations.test.mjs
```

O primeiro comando gera `backend.json`, `gateway.json` e `resources.json`. O backend e o gateway são renderizados com IAM de invocação ativo e as flags de aplicação desabilitadas. O backend tem ingresso interno. Ambos provisionam 1 vCPU, 512 MiB, mínimo 0, máximo 1 e concorrência 1 por serviço. CPU sob demanda e sem boost. O backend mantém prazo de aplicação de 30 s, compatibilidade de 10 MiB, créditos comerciais, limites de 30 tentativas por dia e 60 por mês e pausa de novas reservas. Ambos têm timeout de plataforma de 45 s. O trânsito autenticado pelo gateway tem prazo de 35 s.

## Caminho do aplicativo

1. O aplicativo experimental envia apenas o ID token Firebase da sua sessão em `Authorization`. O host do candidato pode fornecer ao componente um `fetcher` que aponta as três rotas relativas ao gateway aprovado. Nenhum segredo ou token de serviço vai para código do navegador.
2. O gateway aceita somente as rotas de leitura, saldo e administração, verifica a origem HTTPS exata e valida assinatura, emissor, destinatário e validade do ID token Firebase. Preflight não minta token de serviço. O gateway substitui qualquer header de serviço recebido do cliente.
3. O gateway usa sua identidade de runtime para obter um ID token de curta duração no metadata server, limitado à audiência do backend. Envia esse token em `X-Serverless-Authorization` e preserva o ID token Firebase original em `Authorization`. O backend revalida revogação, UID, plano, funções administrativas e cotas. A conta do gateway só recebe `roles/run.invoker` no backend experimental, sem acesso a Firestore ou Secrets.
4. Ambos ficam na região do projeto de computação. Para alcançar o backend interno pela URL padrão `run.app`, a revisão do gateway usa Direct VPC egress para todo tráfego, subnet com Private Google Access e rota padrão. Sem NAT, conector ou zona DNS na configuração escolhida. Conferir em ensaio futuro certificados Firebase, rota interna, audience, CORS e IAM. O ensaio local prova o contrato de HTTP e a separação dos tokens com identidades simuladas, sem comprovar o roteamento real da VPC.

O gateway começará privado. O eventual acesso do navegador a um ingresso público protegido pela autenticação Firebase no próprio gateway exige aprovação específica para a mudança de IAM de entrada. O backend continua interno e autenticado por IAM. Tráfego público inválido pode consumir CPU do gateway mesmo quando é negado pelo aplicativo. [Rede privada do Cloud Run](https://docs.cloud.google.com/run/docs/securing/private-networking) · [Autenticação entre serviços](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)

## Inventário e ordem de aplicação após aprovação específica

1. Confirmar o ID disponível e número do projeto, a conta de faturamento experimental em BRL, responsáveis pelas notificações, origem HTTPS e autorização expressa de gasto. Habilitar exclusivamente as APIs enumeradas em `resources.plan.json`. Nenhum comando desta seção foi executado.
2. Preparar subnet `raytech-ai-exp-us-central1` com Private Google Access na rede `raytech-ai-exp-vpc`. As operações futuras são `gcloud compute networks create` em modo custom e `gcloud compute networks subnets create` com `--enable-private-ip-google-access`, CIDR e região do plano. Não reutilizar VPC de ambientes oficiais.
3. Criar as identidades descritas. Aplicar a proposta `permissions.json` apenas ao Firebase experimental para o runtime. Ela inclui `datastore.entities.list`. Conceder leitura da versão Gemini apenas no segredo individual ao runtime. O gateway não recebe acesso a esse segredo. Usar Artifact Registry Docker `raytech-smart-ai` na mesma região, com tags imutáveis e retenção inicial em simulação. Gerar e registrar o digest da imagem antes de preparar os manifestos.
4. Configurar métrica e canal de e-mail de Cloud Monitoring. Criar o alerta de orçamento restrito ao projeto de computação nas quatro faixas de **25%, 50%, 75% e 100%** de **R$ 10,00**. O plano mantém notificações para responsáveis IAM e um canal de e-mail a confirmar. Usar conta cuja moeda seja BRL. A proposta é apenas de alerta, sem bloqueio ou desativação automática por gasto. Pode haver atraso na apuração. [API de Budgets](https://docs.cloud.google.com/billing/docs/reference/budget/rest/v1/billingAccounts.budgets)
5. Após autorização, a aplicação preparada usa `gcloud run services replace prepared-local/backend.json --project raytech-ai-run-exp-v350 --region us-central1` e o mesmo comando para `gateway.json`. Conferir no ambiente bloqueado os IDs, digest, flag, versão do Secret e IAM. Somente uma revisão de ensaio posterior autorizada pode habilitar o tráfego e a execução. Registrar os manifestos, revisões, IAM e estados anteriores antes de alterar o tráfego.

## Estimativa mensal operativa

Preços oficiais consultados em 19/11/2026, em USD, antes de franquias. Os cenários mantêm as premissas da 08.3.6 e adicionam um segundo Cloud Run com 1 vCPU e 512 MiB, duração da requisição do backend mais 0,5 s por chamada legítima, 20/100 chamadas rejeitadas com 0,2 s, e 1/4 MiB de logs. A linha VPC é uma sensibilidade para eventual tráfego tarifado entre zonas a US$ 0,01/GiB. A rota PGA pode não incorrer nesse custo. A projeção de logs aplica US$ 0,50/GiB antes da franquia aplicável, sem exportação ou retenção extra.

| Componente | Típico, 44 tentativas | Pressão máxima, 60 admitidas |
| --- | ---: | ---: |
| Backend, modelo 08.3.6 com Gemini comparativo pago, rede, registro e segredo | US$ 0,12707 | US$ 0,43296 |
| Gateway Cloud Run | US$ 0,01188 | US$ 0,05443 |
| Sensibilidade de transferência Direct VPC | US$ 0,00021 | US$ 0,00785 |
| Ingestão Logging bruta | US$ 0,00049 | US$ 0,00195 |
| **Total bruto modelado** | **US$ 0,13965** | **US$ 0,49720** |

O modelo não antecipa a fatura, câmbio, tributos, custos fixos de serviços opcionais, incidentes ou consumo externo às premissas. Não inclui Cloud NAT, IP estático, DNS gerenciado, balanceador, conector VPC, Cloud Armor ou exportação de logs, que não fazem parte da configuração escolhida. O Firestore fica no Spark e está sujeito às franquias e cotas do projeto experimental. Monitoramento nativo e alertas propostos não incluem métricas personalizadas com cobrança por volume. [Cloud Run](https://cloud.google.com/run/pricing) · [Rede e balanceamento](https://cloud.google.com/vpc/network-pricing) · [Logging e Monitoring](https://cloud.google.com/stackdriver/pricing)

| Alternativa | Custos adicionais e compatibilidade |
| --- | --- |
| **Gateway Cloud Run + Direct VPC/PGA** | Modelo escolhido para validar localmente. CPU, memória e requisições do segundo serviço, sem conector ou balanceador fixo. Precisa verificar rede e plano de acesso público após autorização. |
| **API Gateway gerenciado** | Preço de chamadas de US$ 0 até 2 milhões/mês, depois US$ 3/milhão na faixa seguinte, mais rede aplicável. A autenticação do API Gateway sozinha não torna o tráfego aceito no ingresso interno do Cloud Run. Mantendo essa restrição, seria necessário outro salto privado compatível. [Preços](https://cloud.google.com/api-gateway/pricing) · [Ingresso interno](https://docs.cloud.google.com/run/docs/securing/private-networking) |
| **Application Load Balancer externo** | Uma regra a US$ 0,025/h custa cerca de US$ 18,25 em 730 h, além de tráfego e serviços opcionais. A ligação direta ao Cloud Run exigiria ingresso interno com balanceador, diferente do ingresso estritamente interno solicitado. [Preços](https://cloud.google.com/vpc/network-pricing) |

## Ensaios remotos preparados, execução bloqueada

O gerador local produz oito faturas fictícias, PNG e PDF em **100 KiB, 500 KiB, 2 MiB e 10 MiB**, com um lançamento conhecido e preenchimento sintético. O manifesto inclui SHA-256 e tamanho do envelope JSON. Os tamanhos não representam complexidade visual. Após autorização e provisionamento, confirmar hashes e executar os oito casos de forma serial, respeitando duas tentativas por UID em janela móvel de 60 segundos, plano, créditos e limites globais. Usar contas sintéticas suficientes. Registrar para cada chamada revisão, MIME, bytes, HTTP, latência, CPU, memória, tokens, operações Firestore e resultado comparado aos campos conhecidos. Usar tokens só em memória, sem log de cabeçalhos, corpo ou chaves. Verificar separadamente tamanho acima do limite, duplicidade, sessão revogada, papel indevido e emergência. Nenhum caso foi enviado remotamente nesta etapa.

## Desativação e encerramento

1. Pausar novas reservas pelo Owner. Aguardar a janela de processamento e reconciliar reservas pendentes. Registrar uso e auditoria sem conteúdo de fatura.
2. Restaurar tráfego para a revisão bloqueada, ou reaplicar os manifestos locais com as flags falsas. Confirmar falha fechada e retirar invocação do frontend e do gateway. Preservar a revisão anterior, o Firebase experimental, o histórico e os pontos de restauração.
3. Somente com autorização separada, encerrar recursos do projeto de computação isolado. Remover na ordem gateway e backend, políticas e alertas, permissões dedicadas, versões e imagens não referenciadas, subnet e VPC, e verificar itens ainda faturáveis antes de encerrar faturamento do projeto isolado. Não remover credenciais, sites ou bancos dos ambientes oficiais. Desativar aplicação e excluir recursos são operações distintas.
