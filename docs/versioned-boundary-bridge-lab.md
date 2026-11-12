# Ponte versionada v1 -> v2 (laboratorio isolado)

A ponte e pura, Node-only, sem Firebase nem localStorage. `version:1`
aceita planos gerados por `normalizeSnapshot`, validando seu checksum
historico e reconstruindo o snapshot com `decode`. `version:2`
transporta apenas `shared: {schema:1,months}`, com checksum SHA-256.

A selecao de mes e preferencias de visualizacao sao injetadas localmente
durante a montagem; chave Gemini e PIN nao entram no transporte. Campos
globais nao classificados sao bloqueados.

IMPORTANTE: a migracao antiga ainda persiste `selectedMonth` no manifesto.
Este laboratorio nao reescreve manifestos existentes nem cria colecoes
Firestore v2. `legacySelectedMonth` e apenas metadado retornado em memoria
pela conversao, nunca incluido no payload compartilhado.

Checksum SHA-256 sem segredo nao autentica o emissor: um cliente malicioso
pode recalcular o checksum. Antes de producao sao necessarios backend
confiavel, regras versionadas, tratamento de conflitos e testes no emulador.
A politica de bloqueio por nomes conhecidos nao equivale a uma classificacao
completa de dados privados; revisar schema antes de sincronizacao real.
