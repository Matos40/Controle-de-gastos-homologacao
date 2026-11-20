# ESP-SMART-AI-0862-001 · Execução e evidências

## Identificação e integridade

- Projeto de computação raytech-3d, número 761761828111, us-central1. Firebase experimental gen-lang-client-0593667072 sem faturamento.
- Base aprovada 632d587357fa1ea6c1d344e8e9ce8871eeea08a8. Workflow 44814645559, artefato 14668122829.
- SHA-256 recalculado do ZIP 2c7fd0f594892f64a299accc87ed6cd7f854292ff0fb35ab4eb89650b79b5e99. SHA-256 do arquivo interno 7ad73d429e1c030e6383057efa603ae0be46c8fa1f27287dea256c3c986021bd.
- Digest OCI confirmado no índice, no arquivo de manifesto, no Artifact Registry e na configuração Cloud Run: sha256:52b1904cfcef0e5749e1f2fa8ac1c2d9d09e487443cb6403e6755d8e1f2d0fc6. A imagem foi carregada sem rebuild no repositório existente.

## IAM e implantação

| Identidade | Escopo | Concessão verificada |
|---|---|---|
| raytech-smart-ai-bridge@raytech-3d.iam.gserviceaccount.com | Serviço raytech-smart-ai-gateway-exp | roles/run.invoker |
| Mesma identidade | Projeto gen-lang-client-0593667072 | projects/gen-lang-client-0593667072/roles/raytechBridgeAuthLookup, somente firebaseauth.users.get |

A conta e o papel personalizados foram criados após consultas NOT_FOUND. Nenhuma chave de conta de serviço foi criada. A ponte não recebeu acesso Firestore, Secret Manager ou binding no backend. Consultas sintéticas dos campos nameKey, emailKey e uid do diretório retornaram HTTP 200. Nenhum índice foi criado e nenhuma conta foi gravada por essas consultas.

Revisão raytech-smart-ai-bridge-exp-00001-ptd, 100% do tráfego, ingresso interno, IAM obrigatório e ausência de allUsers e allAuthenticatedUsers. Cloud Run v2 confirmou zero instâncias mínimas, máximo uma. Concorrência 1, 1 vCPU, 512 MiB, timeout 30 s, SMART_AI_BRIDGE_ENABLED=false. Gateway e backend mantiveram 00006-hqq e 00006-5q5, timeouts de 45 s e flags de extração desabilitadas. O receptor financeiro permaneceu habilitado e a assinatura raytech-budget-push ativa.

## Ensaios e limites

| Verificação | Resultado |
|---|---|
| Sondagem externa anônima da ponte | HTTP 404, 0,878 s, ingresso interno |
| Sondagem externa anônima do gateway | HTTP 403, 0,664 s, acesso recusado |
| Sondagem externa anônima do backend | HTTP 404, 0,427 s, ingresso interno |
| Regressões locais da ponte | 6/6, incluindo rejeição de audiência e principal incompatíveis e cabeçalhos forjados, usando transporte simulado |
| Verificação real de tokens Firebase, revogação, Owner e trajeto autenticado interno | Pendente. Não foi identificado cliente interno autorizado e a revisão aprovada da ponte, o gateway e a extração permaneceram desligados. Não foi criada identidade de usuário descartável. |

As sondagens medem o tempo externo até a recusa, não latência de aplicação. A telemetria da revisão registrou uma inicialização de 1.100,821 ms, duas amostras de CPU com média de 0,97% e duas de memória com média de 13,28%, cerca de 68 MiB da capacidade configurada. São amostras do estado desabilitado, sem tráfego autenticado de aplicação. Não há medição de latência da cadeia ou de chamadas Auth pela ponte.

## Finance Guard e custos

A leitura após a implantação em 20/11/2026 às 18:09:55 UTC−3 confirmou três documentos de cotas e zero reservas pendentes. O Finance Guard mostrava R$ 0,00 observados em 2026-11, sem suspensão, com atualização em 20/11 às 20:49:34 UTC. Isso não é apuração do custo incremental da operação. Sem valor de faturamento atribuível à implantação nesta leitura.

O manifesto OCI soma cerca de 0,257 GiB antes de deduplicação. A US$ 0,10/GiB-mês, a ordem de grandeza bruta de armazenamento é US$ 0,026/mês, antes da franquia compartilhada e de camadas reutilizadas. O custo efetivo depende das regras da conta, retenção e uso. Não houve nova infraestrutura de rede ou tráfego volumoso. As estimativas de execução de 08.6.1 continuam condicionais. [Artifact Registry](https://cloud.google.com/artifact-registry/pricing) · [Cloud Run](https://cloud.google.com/run/pricing)

## Timeouts e próximo passo

A ponte aplica um prazo de 30 s que inclui autenticação e encaminhamento. O gateway tem limite interno de 35 s e o backend tem prazo de aplicação de 30 s com contêineres de 45 s. Uma chamada que demore próximo do limite pode ser interrompida na ponte antes de o backend confirmar ou restituir. Um timeout do cliente deve ser tratado como resultado desconhecido. Não repetir com novo identificador nem restituir por inferência a partir do timeout. O contrato atual prevê recuperação da reserva após sua janela e proteção para repetição do mesmo identificador. Antes de habilitar extração, validar com um simulador controlado o encadeamento de deadlines, a liquidação após desconexão e a recuperação de reservas. Nenhum timeout foi alterado nos serviços existentes.

Uma futura Etapa 08.6.3 depende de autorização específica para usar um cliente experimental já aprovado com rota VPC e invocação restrita na ponte, ou provisionar um cliente temporário isolado quando indispensável. A etapa também precisa de um caminho de diagnóstico privado com o provedor real desabilitado. O gateway atual recusa toda a superfície quando sua flag está desligada. Não ativar essa flag para contornar a limitação sem separar e aprovar o diagnóstico. A proteção distribuída anterior à autenticação segue pendente antes de qualquer entrada pública.

Reversão em caso de autorização. Confirmar que a ponte está desabilitada e que não há operações pendentes. Remover somente os bindings desta etapa no gateway e no Firebase experimental. Manter o receptor Pub/Sub, as revisões anteriores e os dados. Eliminar o artefato ou a identidade recém-criada exige decisão separada de retenção. Nenhuma reversão foi necessária nesta verificação.
