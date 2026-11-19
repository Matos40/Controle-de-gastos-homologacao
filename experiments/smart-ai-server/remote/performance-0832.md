# Etapa 08.3.2 — Desempenho do Smart AI Server

Uma rodada em 19 de novembro de 2026. Base `e1463b0918324e645f0dc41c796dca56b5c6f557`. Worker existente `raytech-smart-ai-0831`, versão de ensaio `a296f669-9f5a-4ae4-b881-117000a03050`. Firebase Spark `gen-lang-client-0593667072` e Gemini 3.1 Flash-Lite no nível gratuito. Custo incorrido de R$ 0,00. [Implantações experimentais](https://dash.cloudflare.com/df0c0fd15d45da803181a3d836a7b266/workers/services/view/raytech-smart-ai-0831/production/deployments)

## Diagnóstico

`node remote/profile.mjs` mede CPU média do processo Node para cada operação isolada. Em uma amostra de 10 MiB, concatenação e conversão da entrada levaram 7,00 ms, conversão e parse JSON 9,35 ms, expressão de Base64 8,60 ms, decodificação 2,35 ms, recodificação com comparação 6,25 ms e montagem do JSON do provedor 19,50 ms. Os trechos sobrepostos não devem ser somados. A validação de assinatura de arquivo e a verificação RSA aquecida ficaram abaixo da resolução deste ensaio local. Isso não estima o custo criptográfico de um isolate frio nem o tempo de CPU no Cloudflare.

## Otimização

O endpoint experimental passou a aceitar PDF, PNG, JPEG ou WebP binário com `Content-Length` exato de até 10 MiB. A leitura preenche um único buffer, aplica a validação de assinatura existente e envia um JSON incremental para o Gemini por um stream de tamanho conhecido. O Base64 obrigatório do Gemini inline é produzido uma vez, em blocos alinhados de três bytes. A entrada binária elimina a conversão do envelope de entrada, o parse de JSON com o documento inteiro, a decodificação e a recodificação de verificação. O corpo inteiro ainda é recebido antes do envio ao provedor para validar MIME, estrutura, tamanho e EOF antes da reserva e da chamada externa.

A autenticação, as consultas de revogação, a revalidação da autorização, as reservas atômicas, os limites, a auditoria e a proteção contra duplicatas usam os mesmos caminhos. O transporte JSON original continuou disponível. Avaliamos a API de arquivos do Gemini como alternativa arquitetural, porém ela adicionaria uma sessão de upload e armazenamento temporário do documento no provedor. Somente a opção binária com Gemini inline foi implementada nesta rodada. [Métodos de entrada do Gemini](https://ai.google.dev/gemini-api/docs/file-input-methods)

## Evidência remota

| Caso | Transporte | HTTP | CPU | Cliente | Subrequisições | Ray ID |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| PDF 100 KiB na 08.3.1 | JSON | 200 | 51 ms | 5,97 s | 24 | `a5d160ddb86bf1c5-GRU` |
| PDF 100 KiB na 08.3.2 | Binário | 200 | 26 ms | 4,81 s | 24 | `a5d2f560fa600ed6-GRU` |
| PNG 12.527 bytes na 08.3.2 | Binário | 200 | 13 ms | 3,92 s | 22 | `a5d2f57f0cf60ed6-GRU` |
| PDF 10 MiB na 08.3.1 | JSON | 200 | 480 ms | 9,28 s | 22 | `a5d16161a8b5f1c5-GRU` |
| PDF 10 MiB na 08.3.2 | Binário | 504 | 92 ms | 28,91 s | — | `a5d2f597aa4a0ed6-GRU` |
| PDF 10 MiB na 08.3.2, controle | JSON | 200 | — | 6,20 s | 24 | `a5d2f8c308284849-GRU` |

Os 92 ms pertencem a uma tentativa que atingiu o prazo da extração. O valor não mede uma extração binária concluída. O painel da versão exibiu mediana de 13,6 ms no momento da consulta. A correlação individual usou `cpuTimeMs` e Ray ID. [Observabilidade](https://dash.cloudflare.com/df0c0fd15d45da803181a3d836a7b266/workers/services/view/raytech-smart-ai-0831/production/observability/events)

O PDF de 100 KiB e o PNG retornaram todas as linhas fictícias esperadas. As chamadas bem-sucedidas registraram 21 leituras solicitadas e 12 gravações confirmadas. Token malformado recebeu HTTP 401 (`a5d2f555794d0ed6-GRU`) e 10 MiB + 1 byte recebeu HTTP 413 (`a5d2f5572d74a507-GRU`). Todos os 37 testes focados passaram. SHA-256 do bundle gerado localmente pelo Wrangler: `6994a6533fa6415922b7aad8a8cc79bbeb0352291bd841ccbf219dc9d139adac`.

## Decisão

O PDF de 100 KiB consumiu aproximadamente 49% menos CPU e ainda superou o teto de 10 ms. Até o PNG bem-sucedido ficou acima do teto e a nova rota para 10 MiB expirou. A rodada refutou o critério de operação sustentada com margem. O controle JSON de 10 MiB funcionou, mas sucesso isolado no Free não equivale a capacidade sustentada. A tentativa gratuita foi encerrada nesta rodada. [Limites do Workers Free](https://developers.cloudflare.com/workers/platform/limits/)

| Alternativa | Custo e requisitos | Adequação técnica |
| --- | --- | --- |
| Cloudflare Workers Paid | Mínimo de US$ 5/mês por conta, com cotas incluídas de requisições e CPU e cobrança por excedentes | Reaproveitaria o Worker e Secrets. CPU padrão de 30 s, configurável até 5 min por invocação HTTP, e 128 MB por isolate. Exigiria validar estabilidade de 10 MiB e manter o prazo da aplicação explícito. |
| Google Cloud Run | Requer faturamento ativo. A cobrança por uso depende de região, modo de faturamento, recursos alocados, requisições e rede. Há franquia, porém não há garantia de custo zero. | Container Node com CPU, memória e concorrência configuráveis e possibilidade de identidade de serviço sem chave estática. Limite HTTP/1 de 32 MiB. Exigiria portar o ponto de entrada e medir partidas frias, latência, consumo e custo. |

[Preços do Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) · [Preços do Cloud Run](https://cloud.google.com/run/pricing) · [Limites do Cloud Run](https://docs.cloud.google.com/run/quotas) · [Requisito de faturamento do Cloud Run](https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service)

Nenhum serviço pago foi habilitado. O limite histórico, a Chave API da aplicação, as interfaces publicadas, os bancos oficiais e o ponto de restauração foram preservados. A Etapa 08.4 não foi iniciada.
