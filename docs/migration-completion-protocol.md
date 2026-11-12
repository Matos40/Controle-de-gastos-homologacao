# Protocolo experimental de conclusão da migração

Ambiente: `develop`, dados fictícios, emulador Firestore na porta 8085.
Não altera regras existentes nem código de produção.

Estados:
- `not_started`: nenhum documento do plano presente;
- `in_progress`: alguns ou todos os documentos presentes, sem marcador auditado;
- `interrupted`: resultado transitório de falha durante `run`, não documento remoto;
- `conflict`: documento existente diverge do plano;
- `audited`: documentos presentes, auditoria integral e marcador final imutável.

A finalização verifica o snapshot com `audit()`, relê documentos em transação
e cria marcador imutável. Retomadas não sobrescrevem documentos anteriores.
A regra Firestore restringe dono, formato e imutabilidade do marcador.

Limitações de segurança: regras do emulador não conseguem provar que um cliente
executou a auditoria. Um cliente autenticado malicioso pode tentar criar um
marcador com dados falsos, pois as regras apenas validam formato e existência
do manifesto. Para produção, finalização deve ocorrer em backend confiável,
com validação de conteúdo e vinculação criptográfica do snapshot.
O laboratório usa coleções compartilhadas por usuário e não suporta múltiplos
planos conflitantes nem snapshots atualizáveis. Estado `interrupted` não é
persistido; estado remoto após falha deve ser reavaliado por `state()`.
