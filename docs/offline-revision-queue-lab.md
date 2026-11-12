# Laboratorio offline + revisoes financeiras

Branch develop, emulador Firestore porta 8088. Nenhuma producao.

Fila em JSON serializavel, com chaves idempotentes, precondicoes por
registro e comparacao de tres vias: valor esperado offline, valor atual
remoto e valor desejado. Alteracoes independentes em registros distintos
podem ser aplicadas sequencialmente. Mudancas no mesmo registro ou campo
salarial geram conflito sem sobrescrita automatica. A publicacao usa
o controle transacional de revisoes ja testado.

**Limites**: persistencia e simulada por serializacao JSON; nenhum
localStorage, IndexedDB ou mecanismo de gravacao duravel foi ligado.
Um encerramento inesperado entre publicacao e confirmacao local pode
ser recuperado pelo teste de valor ja aplicado, mas a deduplicacao
por chave nao e garantida entre reinstalacoes ou alteracoes subsequentes.
Nao ha merge automatico de exclusoes concorrentes, tratamento completo
de falhas de rede, UI de resolucao ou criptografia da fila.
Nao habilitar sincronizacao real sem backend confiavel, regras completas,
idempotencia duravel e auditoria de conflitos.
