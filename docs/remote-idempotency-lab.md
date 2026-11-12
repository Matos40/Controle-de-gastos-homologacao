# Recibos remotos e idempotencia, somente laboratorio

Branch develop; emulador Firestore porta 8090; dados ficticios.
Uma transacao le recibo, head e revisao antes de gravar. Um identificador
de operacao e seu hash vinculam a operacao ao recibo imutavel. A mesma
chave com hash diferente e rejeitada. Se o valor ja tiver sido aplicado,
um recibo pode ser gravado sem criar nova revisao. Historico e recibos
sao auditados e os dados financeiros continuam na ponte V2.

LIMITACOES: o recibo e uma prova operacional apenas sob o adaptador
honesto. As regras Firestore do emulador nao verificam a hash criptografica
do conteudo, nem validam integralmente campos aninhados. Nao ha backend
confiavel nem garantia contra cliente malicioso. Uma negacao de permissao
por corrida so e recuperada quando existe recibo; outras falhas nao sao
mascaradas. Nao ha uso em producao, UI ou rede real.
