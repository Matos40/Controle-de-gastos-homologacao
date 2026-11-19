# Smart AI Server — Etapa 08.3

Prova experimental isolada para documentos fictícios. O Cloudflare Worker local autentica o UID no emulador Firebase Authentication, valida a fatura, reserva cota em transação no emulador Firestore, consulta o provedor e registra o desfecho por UID e ID da solicitação. O limite é de 2 MiB por arquivo e 30 segundos por requisição. As cotas experimentais são 3/minuto, 20/dia e 100/mês por UID, com teto global de até 100/dia. O Worker recusa chamadas sem autorização ou reserva válida e não repete chamadas ao provedor.

O diretório `legacy/` preserva política, validação de faturas, controle de uso, orçamento global, registro de desfecho, administração de uso, provedor, orquestração, funções originais e proteção dos emuladores. O Worker usa a interface REST do Firestore e não carrega o Admin SDK. O fluxo reutiliza a política e os mecanismos de reserva e desfecho. As funções legadas permanecem em referência e o Admin SDK é usado nos testes locais.

## Reprodução local

1. Neste diretório, execute `npm ci` e `npm test`.
2. No primeiro terminal, execute `npm run dev -- --ip 127.0.0.1 --port 8787`.
3. No segundo terminal, execute `firebase emulators:exec --only auth,firestore --project demo-raytech-v340 "npm run test:emulator"`. Use uma instância limpa dos emuladores e mantenha o Worker na configuração local padrão.

A simulação é a configuração padrão. O projeto e os destinos dos emuladores são fixados pelo Worker. Tokens de emulador não têm assinatura válida em produção. Este Worker é um protótipo local e não deve ser publicado em um endpoint remoto.

Para o cenário opcional com Gemini, confirme no AI Studio que a chave pertence a projeto experimental independente, no nível gratuito, sem faturamento e com cota disponível para `gemini-3.1-flash-lite`. Configure localmente `PROVIDER=gemini-local`, `GEMINI_CONFIRMED_FREE_DAILY_LIMIT` e o segredo `RAYTECH_GEMINI_API_KEY` através do arquivo local ignorado `.dev.vars`. Inicie o Worker com esse ambiente, habilite `RAYTECH_RUN_REAL_GEMINI=1` no terminal dos testes e execute apenas o cenário real em emuladores limpos com `firebase emulators:exec --only auth,firestore --project demo-raytech-v340 "node --test --test-name-pattern=Gemini emulator.test.mjs"`. Guarde a chave apenas no armazenamento local autorizado. O cenário envia exclusivamente o PDF sintético gerado pelo próprio teste.

## Evidências locais

- 127 testes unitários e de regressão aprovados. A suíte integrada aprovou 3 cenários com o provedor simulado. A suíte legada aprovou 7 cenários nos emuladores.
- A integração cobriu perfis autorizados, bloqueio, revogação, isolamento por UID, duplicidade concorrente, persistência do desfecho, cota individual e global e rejeição de arquivos acima do limite. Na disputa pelo mesmo identificador, apenas uma requisição foi aceita.
- Nesta execução, cada solicitação sintética aceita registrou 21 subrequisições, 21 leituras de documentos solicitadas pela interface REST e 12 gravações confirmadas. As leituras solicitadas são contagem do adaptador local e não representam faturamento verificado no Firestore.
- As cinco amostras admitidas concluíram com sucesso no provedor simulado. Amostras de 5 e 10 MiB receberam HTTP 413.

| Amostra | Cliente | Worker |
| --- | ---: | ---: |
| PNG, 68 bytes | 73 ms | 70 ms |
| PDF, 100 KiB | 76 ms | 71 ms |
| PDF, 500 KiB | 86 ms | 81 ms |
| PDF, 1 MiB | 101 ms | 95 ms |
| PDF, 2 MiB | 91 ms | 81 ms |

Os tempos são de relógio, medidos localmente.

## Teste com Gemini real

Uma chamada ao Gemini 3.1 Flash-Lite processou um PDF fictício de 100 KiB com HTTP 200. O projeto separado foi confirmado como gratuito no AI Studio, com cota exibida de 500 solicitações/dia e gasto de R$ 0 neste teste. O Worker limitou o ensaio a uma chamada. Firebase Authentication e Firestore executaram nos emuladores locais.

| Medição | Resultado |
| --- | ---: |
| Tempo total no cliente | 4.136 ms |
| Tempo no Worker local | 4.129 ms |
| Latência do Gemini | 3.798 ms |
| Tokens de entrada informados | 610 |
| Tokens de saída informados | 89 |
| Subrequisições | 22 |
| Leituras Firestore solicitadas | 21 |
| Gravações Firestore confirmadas | 12 |
| Campos corretos no PDF | 4/4 |

Os quatro campos foram estabelecimento, data, valor e parcelas. O cenário passou uma vez com uma amostra sintética. O resultado não estima a precisão em faturas variadas. A imagem foi testada com o provedor simulado.

O fluxo é viável em laboratório com as restrições testadas. As 22 subrequisições observadas na chamada real ficam abaixo do limite de 50 do Workers Free. A viabilidade remota permanece inconclusiva. CPU por requisição e memória não puderam ser medidas nesta configuração, e a autenticação e as transações foram exercitadas em emuladores. Nenhum Worker remoto foi publicado. Os ambientes oficiais, o plano Spark e o ponto de restauração foram preservados. [Limites do Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/)
