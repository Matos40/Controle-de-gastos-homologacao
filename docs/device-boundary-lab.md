# Separacao por dispositivo: laboratorio

Somente `develop`. Modulo Node-only sem Firebase, DOM ou localStorage.

A aplicacao atual usa `selectedMonth` dentro de `appDb` e o conversor
financeiro legado requer este campo. O laboratorio cria um payload
compartilhavel apenas com `months` e reconstrói um snapshot local com
`selectedMonth` escolhido por dispositivo.

- `extract` recusa campos globais nao classificados e campos sensiveis
  conhecidos em qualquer profundidade de `months`.
- `assemble` recebe preferencias de visualizacao locais e nao as envia.
- Gemini e PIN nao sao copiados nem usados pelo laboratorio. Seus valores
  devem continuar sob gerenciamento local separado e seguro.
- Um mes local ausente usa o ultimo mes disponivel apenas na montagem local,
  sem alterar o payload compartilhado.

**Limites**: a lista de campos sensiveis nao substitui classificacao de
schema nem validação de dados pessoais desconhecidos. O protocolo de migração
anterior ainda armazena `selectedMonth` no manifesto e não foi alterado.
Este laboratorio nao implementa sincronizacao real nem armazenamento local
de preferencias. Antes da integracao, sera necessario versionar o envelope
compartilhado e migrar o contrato legado do manifesto.
