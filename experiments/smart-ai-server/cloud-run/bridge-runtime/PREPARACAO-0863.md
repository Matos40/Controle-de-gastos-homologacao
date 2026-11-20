# 08.6.3 · Preparação local do ensaio privado

Base 8b9991db70e05ffeeac1826c6f80c5821b8e32f2. Escopo conferido contra ESP-SMART-AI-0863-001 e RESULTADOS-0862.md.

## Contrato local

- Sondagem GET /v1/credits em loopback. Sem upload, reserva, gravação ou retentativa automática. Saída limitada a classe, status e latência. HTTP 401/403 representa recusa. HTTP 404 é insuficiente para distinguir ingresso de rota ausente. HTTP 503 representa indisponibilidade, inclusive flag desligada. HTTP 200 exige JSON e saldo coerente com o plano.
- Firebase e IAM continuam distintos. A suíte injeta um verificador e uma identidade sintéticos no bridge real e verifica os dois cabeçalhos no transporte simulado. A aplicação ou a sondagem não registra token ou saldo.
- Timeout de extração tem resultado desconhecido até consultar estado por requestId. Pendente aguarda liquidação. Resultado terminal atualiza saldo. Uma reserva só pode ser restituída pelos contratos transacionais existentes, inclusive recuperação após expiração. Não criar outro requestId como retentativa automática.

## Cliente interno mínimo proposto

Preferir cliente já autorizado no projeto raytech-3d, em us-central1, com rota pela VPC experimental e Private Google Access. Se nenhum existir, propor um job temporário de execução única, uma tarefa, concorrência 1, zero retentativas e imagem fixada por digest. Usar identidade de sonda dedicada com roles/run.invoker somente na ponte. Preservar a identidade da ponte com invocação somente no gateway e firebaseauth.users.get no Firebase experimental. Preservar o gateway com invocação somente no backend. Nenhuma nova concessão e nenhum recurso remoto foram aplicados nesta preparação.

## Diagnóstico privado e autorização posterior

1. Confirmar flags desligadas, ingresso interno e receptor financeiro ativo. Fazer uma sondagem negativa de origem ou credencial e uma sondagem de leitura autorizada. O cliente usa token Google com audiência da ponte e o token Firebase experimental fica em Authorization. Nunca registrar cabeçalhos.
2. A revisão atual com flag desligada retorna 503. A cadeia positiva exige um modo diagnóstico privado somente leitura, separado das flags de extração. A proposta é permitir créditos com autenticação e revogação existentes, mantendo invoices desabilitado e preservando publicação e consumo Pub/Sub. Autorizar esse modo e qualquer revisão remota separadamente. A sondagem local incluída não é um cliente remoto.
3. Antes de qualquer ensaio simulado de extração, aprovar a janela e um provedor isolado explicitamente simulado. Injetar perda de resposta com uma única solicitação sintética, reconciliar a reserva pelo mesmo requestId e confirmar nenhuma reserva pendente. Testar rejeição por IAM, revogação e papéis com identidades experimentais descartáveis. Nenhum teste usa um token oficial ou uma chamada Gemini.

## Custos e reversão

Uma tarefa de job de 1 vCPU e 512 MiB com 60 s faturáveis em us-central1 ficaria na ordem de US$ 0,00114 antes da franquia, usando US$ 0,000018 por vCPU-s e US$ 0,000002 por GiB-s. Uma requisição de 10 s por serviço, em três serviços com faturamento por requisição, acrescentaria aproximadamente US$ 0,00076 brutos. Exclui armazenamento, rede, logs, Auth, Firestore e partidas adicionais acima da hipótese. O custo observado só pode ser apurado após o ensaio autorizado. O orçamento não garante teto. [Preços do Cloud Run](https://cloud.google.com/run/pricing)

Reversão futura. Suspender novas admissões, aguardar liquidação ou recuperação e conferir zero reservas pendentes. Desativar somente o modo de diagnóstico temporário e restaurar a revisão desabilitada. Revogar apenas o binding temporário de invocação e encerrar o cliente temporário, se criados e autorizados. Preservar o receptor Pub/Sub, o histórico financeiro, os demais bindings e os bancos. Não limpar caches nem logs.

## Matriz de rastreabilidade

| Seção | Resultado e evidência |
|---|---|
| 2 · Cliente | O inventário 08.6.2 não identificou cliente interno autorizado. Nenhum workload é aprovado só por pertencer ao projeto. Revalidação de VPC, Private Google Access, identidade, audiência, custo e interferência deverá ocorrer antes da escolha remota. |
| 3 · Diagnóstico | GET /internal/smart-ai/diagnostic, sem body, query ou destinos do cliente. Handler candidato isolado e desabilitado por padrão. Exige principal vindo do transporte autenticado e token Firebase validado em cada salto simulado. Sucesso 200 contém exclusivamente status, modo e provedor none. Respostas 401, 403, 404, 405, 502 e 503 são sanitizadas. Zero operações de banco, reserva e provedor nesse handler. Nenhum entrypoint remoto monta esta rota. |
| 4 · Autenticação | Os testes de bridge 08.6.1 verificam integração com verifyIdToken(token,true) e rejeições locais. O novo teste separado verifica a fronteira confiável, recusa principal inesperado, tentativa direta ao backend e descarte de cabeçalhos adulterados. Validação IAM real permanece pendente. |
| 5 · Reconciliar | Contrato fixa UUID original, lê status por adaptador e recusa UUID diferente. Testes antigos preservam restituição confirmada, idempotência e expiração. Novo teste comercial simula desconexão e verifica pendência, bloqueio de novo ID durante a reserva e liquidação posterior. Os tempos reais 30/35/30 e 45 dos contêineres continuam para o ensaio futuro. |
| 6 · Finance Guard | Diagnóstico não acessa o ledger financeiro. Testes comerciais e Firestore Emulator cobrem bloqueio, concorrência, reativação e liquidação. Orçamento, observação, Pub/Sub e configurações remotas não sofreram mudanças. |
| 7 · Segurança | Distribuição e política de cache continuam sob os testes server-only existentes. O código do diagnóstico está fora da lista estática e não contém autodetecção de serviço remoto. |
| 8 · Testes | Três testes preservados de sondagem, estados do ledger e timeout/má resposta. Acrescentados testes de três saltos, ID fixo e desconexão com liquidação comercial. |
| 9–10 · Entrega | Opções abaixo, autorização e reversão acima. Evidências locais e CI registradas separadamente. |

## Matriz de autenticação

| Caso | Evidência local | Pendente remoto |
|---|---|---|
| Firebase válido, expirado, revogado, usuário desabilitado e outro projeto | bridge-runtime.test.mjs verifica parâmetros do SDK e recusa com fixtures. | Certificados, verificação e revogação reais no Firebase experimental. |
| IAM inválido, audiência incorreta e principal incompatível | bridge-runtime.test.mjs verifica audiência e identidade gerenciada em resposta simulada. private-diagnostic.test.mjs verifica principal autenticado injetado e tentativa direta indevida. | Verificação de assinatura do token Google, audiência e bindings efetivos na fronteira Cloud Run. |
| Cabeçalhos adulterados | Testes da ponte e do diagnóstico descartam cabeçalhos privilegiados do cliente. | Confirmar propagação na cadeia real em ingresso privado. |
| Owner e Admin, Free e Premium comuns | Testes comerciais validam papel e reautenticação. Navegador valida que plano comum não eleva privilégios. | Confirmar claims assinadas e papéis em identidades experimentais. |
| Autenticação crítica recente ou expirada | Testes da ponte e do backend validam auth_time com relógio controlado, inclusive rejeição de 301 s. | Validar renovação de token e reautenticação pessoal em conta descartável autorizada. |

## Comparativo de execução

| Critério | A · Cliente existente | B · Job isolado |
|---|---|---|
| Recursos e identidade | Sem provisionamento adicional se houver cliente aprovado. Identidade, CPU e memória precisam ser verificadas. Evitar workloads financeiros. | Job de tarefa única, 1 vCPU, 512 MiB, timeout 60 s, zero retentativas, VPC e imagem por digest. Identidade dedicada, sem chave JSON. |
| IAM | Somente invocação na ponte, condicionada à aprovação da identidade existente. | roles/run.invoker apenas na ponte, nenhuma permissão Firestore, Auth administrativo ou financeira. |
| Limite de chamadas | Propor uma chamada positiva e até três negativas, sem repetição automática. | Mesmo limite, numa execução. |
| Custo | Aproximadamente US$ 0,00076 para uma chamada de 10 s por salto. Cliente, métricas, rede e Auth dependem da configuração verificada. | Aproximadamente US$ 0,00114 para 60 s de job, mais US$ 0,00076 para uma chamada de 10 s por salto. Franquias e custos auxiliares variam. |
| Desligamento e reversão | Encerrar a sondagem e restaurar a revisão desabilitada. Remover somente binding temporário que tiver sido autorizado. | Mesmo procedimento e desativação do job. Retenção ou remoção de job e identidade dependem da autorização e das evidências. |

A autorização posterior precisa cobrir a verificação do cliente e das rotas reais, o eventual job e identidade dedicados, bindings estritos, ativação temporária de revisões de diagnóstico verificadas, identidades descartáveis quando indispensáveis, ensaio simulado limitado e reversão. Toda operação remota continua pendente.
