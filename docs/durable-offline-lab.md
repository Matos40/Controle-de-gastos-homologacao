# Laboratorio de checkpoint offline e reconciliacao

Somente develop. Emulador Firestore porta 8089, dados ficticios.
Checkpoint JSON em diretorio temporario do Node, gravado via arquivo
temporario e rename; SHA-256 detecta corrupcao acidental. A fila e
recuperada de disco apos reinicio simulado.

O checkpoint e salvo apos cada operacao confirmada. Se houver queda
depois da publicacao remota e antes do checkpoint, a retomada verifica
se o valor desejado ja existe e evita nova revisao. Exclusoes e parcelas
conflitantes sao bloqueadas, sem descartar pendencias.

**Limites criticos**: rename nao equivale a fsync duravel contra queda de
energia; checksum nao autentica dados nem impede adulteracao deliberada.
Nao existe ledger remoto de idempotencia: se o valor publicado for alterado
novamente antes da recuperacao, a operacao pode gerar conflito e exigir
intervencao. O teste de reinicio simula reabertura de arquivo, nao reinicio
do processo operacional. O algoritmo e conservador por registro inteiro,
nao faz merge por campo. Nao integrar a app real antes de backend
confiavel, armazenamento seguro, esquema validado e resolucao explicita.
