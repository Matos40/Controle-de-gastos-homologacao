# Etapa 08.3.6 — Infraestrutura Cloud Run experimental

**Aplicação bloqueada.** O repositório contém um manifesto declarativo com placeholders, proposta de IAM e monitoramento, modelo de custos e testes locais. O workflow só executa testes e build Docker local ao runner. A autorização de aplicação está marcada como falsa e o container inicia com todos os endpoints Smart AI desabilitados. Nenhum projeto de computação, repositório de imagens, serviço, versão de segredo, política IAM ou alerta é criado nesta etapa.

## Isolamento e controles

- O manifesto Knative v1 especifica IAM de invocação ativo, ingresso interno, 1 vCPU, 512 MiB, mínimo 0, máximo 1 no serviço e na revisão, concorrência 1, CPU sob demanda, sem boost e timeout de plataforma de 45 s. O handler aplica o prazo de 30 s e preserva o limite de 10 MiB.
- O identificador de computação deve ser um projeto isolado na família `raytech-ai-run-exp-*`, distinto de `gen-lang-client-0593667072`. Somente este último é aceito para Firebase. A identidade de runtime obtém tokens de curta duração pelo servidor de metadados e confere o e-mail da conta dedicada. O backend Cloud Run dispensa chaves estáticas do Firebase.
- O papel customizado proposto permite consultar a conta para revogação e ler, criar e atualizar documentos experimentais. `datastore.entities.list` é necessário para `runQuery`, a busca de UID por prefixo. O papel se aplica ao projeto Firebase experimental. As Firebase Security Rules não restringem o acesso por IAM do servidor.
- O Secret Manager fornece exclusivamente a chave Gemini experimental. O manifesto referencia uma versão numérica imutável. Conceder leitura apenas no segredo individual à conta de runtime. Nenhuma credencial de produção, homologação ou do Worker anterior deve ser copiada. Não conceder Owner, Editor, Admin do Firebase ou acesso a outros segredos à identidade de runtime.
- CORS aceita uma origem HTTPS exata, com rotas, métodos e cabeçalhos enumerados. Não aceita curinga, origem nula ou cookies cross-origin. O futuro gateway, ainda a provisionar, precisa alcançar o ingresso interno e enviar seu ID token do Cloud Run em `X-Serverless-Authorization` e preservar o bearer Firebase em `Authorization`. A identidade do gateway recebe apenas `roles/run.invoker` no serviço. Preflight é permitido pela origem, sem afrouxar o IAM do Cloud Run. [Autenticação serviço a serviço](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)
- As reservas limitam a concorrência por UID, impõem a janela móvel, os créditos comerciais, o teto global de 30 tentativas por dia e 60 por mês e a opção de reduzir esses tetos ou suspender novas reservas. Falhas também consomem o orçamento de tentativas. A suspensão não impede a liquidação nem a recuperação. Limite de instâncias, controles de admissão e alertas operacionais não constituem teto rígido de cobrança, pois há custos fora das extrações admitidas.

## Telemetria

`monitoring.json` especifica as métricas nativas de latência, CPU, memória, requisições e instâncias e o filtro de logs estruturados. A aplicação registra duração observada, CPU e RSS do processo, códigos HTTP e contagens de I/O. CPU do processo inclui atividade concorrente do runtime, e RSS é uma amostra, não o pico do container. Contagens do adaptador não equivalem a unidades faturadas do Firestore. Métricas Gemini só aparecem quando há metadados na resposta. `latencyMs` é o tempo observado na chamada Gemini. O log não inclui corpo, tokens de autenticação, chaves, UID ou resultado da fatura. A coleta e os alertas de nuvem ainda não foram ativados. [Métricas Cloud Run](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z#gcp-run)

## Estimativa operacional

Modelo reproduzível em `node infra/cost.mjs` para o eventual serviço em `us-central1` a preços consultados em 19/11/2026. Valores em USD antes de franquias do Cloud Run, Gemini, Secret Manager, Artifact Registry e rede. O Firestore experimental permanece Spark e é assumido dentro da franquia. Estimativas não são medições de Cloud Run nem uma previsão de fatura.

| Premissa mensal | Típico | Pressão máxima simulada |
| --- | ---: | ---: |
| Novos Free / Premium | 8 / 8 | 8 / 8 |
| Arquivos por Premium | 3 | 15 |
| Demanda de tentativas incluindo falhas | 44 | 150 |
| Tentativas admitidas pelo teto | 44 | 60 |
| Tempo ativo por extração | 8 s | 30 s |
| Tokens Gemini entrada / saída incluindo raciocínio por tentativa | 1.200 / 300 | 3.000 / 1.200 |
| Egress orçado por tentativa | 0,5 MiB | 13,4 MiB |
| Leituras / gravações Firestore das extrações | 1.320 / 880 | 3.600 / 1.200 |
| Cloud Run | US$ 0,00996 | US$ 0,05060 |
| Gemini Standard pago, cenário comparativo | US$ 0,03300 | US$ 0,15300 |
| Rede, usando US$ 0,19/GiB como hipótese tarifária | US$ 0,00408 | US$ 0,14918 |
| Secret Manager e Artifact Registry | US$ 0,08003 | US$ 0,08018 |
| Subtotal bruto modelado | **US$ 0,1271** | **US$ 0,4330** |

A projeção aplica 1 vCPU a US$ 0,000024/vCPU-s, 0,5 GiB a US$ 0,0000025/GiB-s e US$ 0,40/milhão de requisições, incluindo 100 ou 200 chamadas de controle. A referência Gemini paga é US$ 0,25/milhão de tokens de entrada e US$ 1,50/milhão de saída. Reserva US$ 0,06/mês para uma versão de segredo e US$ 0,03/10.000 acessos, e 0,2 GiB-mês para imagens a US$ 0,10/GiB-mês. O egress é uma hipótese de categoria tarifária, não confirmação de cobrança para o caminho ao Gemini. Partidas frias, retries, expansão de índices, chamadas de controle ao Firestore, gateway, armazenamento adicional, ingestão de logs e impostos podem alterar o total. O orçamento não autoriza contratar nenhum serviço. [Cloud Run](https://cloud.google.com/run/pricing) · [Gemini](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite) · [Firestore](https://cloud.google.com/firestore/pricing) · [Secret Manager](https://cloud.google.com/secret-manager/pricing) · [Artifact Registry](https://cloud.google.com/artifact-registry/pricing) · [Rede](https://cloud.google.com/vpc/network-pricing)

## Procedimento reversível para uma futura autorização

1. Confirmar por escrito projeto de computação, faturamento autorizado, região, origem experimental e identidade do gateway. Manter o projeto Firebase separado no Spark. Conferir que o manifesto ainda desabilita o aplicativo e validar a lista de recursos da proposta sem aplicá-la.
2. Após autorização específica, criar exclusivamente a identidade e o papel propostos. Provisionar a versão do segredo via mecanismo seguro, fora do repositório e do terminal de logs, e compilar a imagem validada. Preencher os placeholders com o número do projeto isolado, o digest da imagem e a versão do segredo. Registrar revisão, digest, IAM, manifesto anterior e política de tráfego.
3. Somente depois, aplicar o manifesto no projeto de computação e região explícitos com a aprovação obtida. Validar o estado bloqueado, a autenticação do gateway, a origem CORS e o HTTP 503 inicial. Habilitar apenas em nova revisão de ensaio com tráfego restrito e usar contas e faturas fictícias.
4. Para desativar, suspender primeiro novas reservas pelo Owner e confirmar que as operações em andamento terminaram ou entraram no mecanismo de recuperação. Restaurar a revisão anterior ou reaplicar o manifesto com a flag desativada, verificar HTTP 503 e retirar a permissão de invocação do gateway experimental. Não apagar Firestore, auditoria ou segredo durante rollback. Autorizar separadamente a retirada dos recursos experimentais se decidida.

## Verificação local

Executar a partir de `experiments/smart-ai-server`:

```sh
node --test cloud-run/infra/infra.test.mjs
firebase emulators:exec --only auth,firestore --project demo-raytech-v340 'node cloud-run/infra/integration.firestore.mjs'
```

O ensaio HTTP usa o handler e o servidor candidatos com Firestore Emulator, autenticação substituída por identidades sintéticas e provedor Gemini simulado. Ele verifica saldo, extração, falha com restituição, consulta administrativa, pausa e ausência de conteúdo confidencial em telemetria. A suíte Chromium/WebKit cobre a interface do leitor e do painel com dados fictícios.
