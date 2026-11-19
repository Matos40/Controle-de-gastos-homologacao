# Validação remota — Etapa 08.3.1

## Ambiente e procedência

- Prova local aprovada em `606d1ff49e3aa49d15f32563f135124d21246251`. Candidato remoto em `a21cb4141d8dfb23f517abba4db397eef55c53b0`.
- Worker `raytech-smart-ai-0831`, versão ativa `2eca4de3-479c-4a18-877b-826fe8dc6bec`, no Workers Free. [Implantações](https://dash.cloudflare.com/df0c0fd15d45da803181a3d836a7b266/workers/services/view/raytech-smart-ai-0831/production/deployments)
- Endpoint HTTPS `/v1/invoices`, com autenticação obrigatória e URLs de prévia desativadas. [Endpoint experimental](https://raytech-smart-ai-0831.dasletras.workers.dev/v1/invoices)
- SHA-256 do bundle gerado antes do upload: `b200ab94f1962de36f3c31cb221dbb3d1eaf33df1c3647ce63efd271e686a87f`.
- Firebase Spark em `gen-lang-client-0593667072`, Authentication por e-mail e senha para duas contas fictícias e Firestore Standard `(default)` em `southamerica-east1`, com acesso direto do cliente bloqueado. [Projeto experimental](https://console.firebase.google.com/project/gen-lang-client-0593667072/overview)
- A conta de serviço dedicada recebeu apenas `firebaseauth.users.get`, `datastore.databases.get` e `datastore.entities.get/create/update`. Sua chave privada foi gerada em memória e enviada como Secret do Worker. O IAM recebeu apenas o certificado público. O Secret do Gemini foi configurado com a chave do projeto experimental gratuito.
- O consentimento OAuth do Wrangler foi aprovado. O cofre Windows recusou a persistência da sessão (erro 5) e `wrangler whoami` segue sem sessão. A implantação ocorreu pela API oficial, com token temporário limitado a Workers Scripts na conta e mantido em memória durante as operações. Os processos locais com credenciais foram encerrados após o ensaio.

## Resultados observados em 19 de novembro de 2026

Chamadas reais ao Gemini 3.1 Flash-Lite com faturas inteiramente fictícias. A latência do cliente inclui toda a requisição. CPU vem dos eventos de invocação, correlacionados pelo Ray ID. Campos vazios indicam ausência de uma medição individual correlacionada.

| Amostra | HTTP | Cliente (ms) | Gemini (ms) | CPU (ms) | Subrequisições | Linhas esperadas corretas | Ray ID |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| PDF 100 KiB, uma compra | 200 | 5970 | 2091 | 51 | 24 | 1/1 | `a5d160ddb86bf1c5-GRU` |
| PNG 12.527 bytes, duas compras | 200 | 7209 | 4752 | — | 22 | 2/2 | `a5d16102de46f1c5-GRU` |
| PDF 2 MiB, uma compra | 200 | 7912 | 5175 | — | 22 | 1/1 | `a5d1612fffe8f1c5-GRU` |
| PDF 10 MiB, uma compra e preenchimento sintético | 200 | 9278 | 6078 | 480 | 22 | 1/1 | `a5d16161a8b5f1c5-GRU` |
| PDF 500 KiB, duas compras | 200 | 18307 | 15163 | — | 24 | 2/2 | `a5d1643e3b4cc65f-GRU` |

O Cloudflare exibiu CPU agregada P50 de 12,84 ms, P90 de 58,45 ms e P99 de 241 ms. Memória agregada P50 de 2,78 MB, P90 de 43,49 MB e P99 de 45,36 MB. Não houve correlação de memória por amostra. Cada execução bem-sucedida registrou 21 leituras solicitadas e 12 gravações confirmadas pelo adaptador. As coleções de orçamento global, desfecho e uso também foram confirmadas no Console do Firestore. [Métricas do Worker](https://dash.cloudflare.com/df0c0fd15d45da803181a3d836a7b266/workers/services/view/raytech-smart-ai-0831/production/metrics)

## Autenticação, isolamento e transações

- Duas identidades sintéticas obtiveram tokens ID reais do Firebase do projeto autorizado. Ausência de token, token malformado e token emitido antes da desativação da conta receberam HTTP 401.
- Após troca de senha da segunda conta fictícia, o token antigo recebeu HTTP 401 (`a5d164b41f29c65f-GRU`). O token novo foi aceito.
- Na primeira disputa com o mesmo UID e ID, uma chamada recebeu HTTP 409 e a outra recebeu HTTP 502 de processamento. O replay recebeu HTTP 409. Em outra conta, o mesmo ID recebeu HTTP 200 (`a5d161b83d00f1c5-GRU`).
- Na repetição de concorrência com token novo, uma extração recebeu HTTP 200 (`a5d164b73abe402c-GRU`) e a duplicata recebeu HTTP 409 (`a5d164b75eaa0cf0-GRU`). O replay recebeu HTTP 409. Isso comprova que apenas uma solicitação concorrente avançou para processamento bem-sucedido naquele UID e ID.

## Parecer

O fluxo remoto funcionou com Firebase real, Firestore e Gemini gratuito, a R$ 0,00. **O candidato atual não é viável para operação estável no Workers Free.** O PDF sintético de 10 MiB coube no transporte e retornou HTTP 200, mas consumiu 480 ms de CPU. A amostra de 100 KiB também superou os 10 ms de referência. A documentação Cloudflare descreve tolerância ocasional do runtime, portanto HTTP 200 não garante capacidade sustentada. Subrequisições observadas de 22 a 24 ficaram abaixo de 50. A memória agregada não indicou atingir 128 MB na amostra observada. [Limites oficiais Workers Free](https://developers.cloudflare.com/workers/platform/limits/)

Nenhuma alteração foi feita ao limite histórico da aplicação, à produção, à homologação publicada, aos bancos existentes ou ao ponto de restauração V34.7.4.5. A Etapa 08.4 permanece fora do escopo.
