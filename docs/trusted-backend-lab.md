# Etapa 19: backend confiavel experimental

Somente branch develop. Emulador Firestore porta 8091, projeto demo,
usuarios e financas ficticios. Usa Firebase Admin SDK no Node, separado
do navegador. Regras negam toda leitura e escrita direta de clientes
na colecao trustedFinanceLab. O Admin SDK ignora as regras, portanto
a autorizacao depende do backend.

Verificacao de identidade e **injetada**. Os testes usam tokens ficticios
('tokenA' e 'tokenB'), nao autenticacao Firebase real. Nunca reutilizar
o verificador de testes em producao: um endpoint real precisa verificar
Firebase ID token com Admin Auth, audience/issuer e revogacao conforme
politica adotada, limitar tamanho, autenticar chamadas e aplicar rate limits.

O backend valida payload V2, recalcula checksum SHA-256, verifica todos
os elos da cadeia antes de cada gravacao, recusa conflitos e escreve
revisao e recibo juntos na transacao. Auditoria confere recibos e hashes.
Clientes nao podem forjar recibos nem acessar diretamente os documentos
deste laboratorio.

LIMITES: hash sem assinatura nao prova autoria de escrita feita por
administrador comprometido; a cadeia nao e ancorada fora do banco.
Auditoria integral O(n) por operacao, inadequada para escala.
Recibos nao incluem payload completo, entao sua operationHash nao pode
ser recalculada a partir do recibo isoladamente. Nao ha endpoint HTTP,
verificacao real de Firebase ID tokens, rate limit, logs de auditoria
externos, nem integracao com aplicativo ou producao.
