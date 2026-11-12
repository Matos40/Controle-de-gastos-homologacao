# Laboratorio de revisoes financeiras no emulador

Branch develop, porta 8087, usuarios e dados ficticios. Nenhuma conexao
com Firebase de producao.

Uma unica referencia autoritativa `state/head` por usuario aponta para
a ultima revisao. A publicacao usa transacao Firestore, compara a base
(numero e checksum) e cria uma revisao imutavel com incremento do head.
Reenvios identicos retornam `unchanged`; bases divergentes retornam
`conflict`, sem merge nem sobrescrita silenciosa. `recover` le a
revisao atual; `history` verifica o encadeamento de revisoes.

O payload e produzido pelo adaptador V2: selectedMonth, visualizacao,
chave Gemini e PIN nao sao enviados. Preferencias sao aplicadas apenas
na reconstrucao local.

LIMITACOES: as regras do emulador garantem propriedade, imutabilidade e
incremento do head, mas nao verificam criptograficamente checksum, nao
validam campos sensiveis aninhados, nem exigem que a revisao apontada
exista em todos os caminhos de escrita. Um cliente malicioso pode
contornar o adaptador. Antes de producao, backend confiavel deve
validar o schema e a cadeia e publicar head/revisao de modo atomico.
Nao ha conciliacao automatica de conflitos, sincronizacao real,
migracao dos planos V2 anteriores, nem tratamento de offline.

Correcao do laboratorio: o documento head usa o caminho valido
`users/{uid}/financeRevisionLab/control/state/head` (seis segmentos).
A colecao de revisoes continua em `users/{uid}/financeRevisionLab/revisions`.

Segunda correcao de paridade: colecao de revisoes em
`users/{uid}/financeRevisionLab/control/state/revisions` (sete segmentos).

Caminho definitivo da colecao: `users/{uid}/financeRevisionLab/control/revisions` (cinco segmentos). O caminho intermediario com `control/state/revisions` nao deve ser usado.
