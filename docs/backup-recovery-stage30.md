# Etapa 30: backup, recuperacao e integridade (laboratorio)

Escopo: branch develop. Sem Firestore real, sem API publica, sem sincronizacao,
sem escrita no armazenamento do navegador ou em arquivos de usuario.

## Implementado
- backupRecoveryLab.js: pacote JSON com format/version/algorithm/checksum/payload.
- SHA-256 sobre JSON canonico (chaves ordenadas) e limite de 2 MiB.
- Validacao de formato, versao e checksum antes da restauracao.
- Restauracao atomica em memoria com revisao esperada (compare-and-swap).
- Erros tipados e rejeicao de valores invalidos, referencias circulares e
  chaves perigosas.
- Sem token, senha, chave API ou identificadores de usuario nos metadados do pacote.

## Limites de seguranca
SHA-256 detecta corrupcao mas NAO autentica a origem; um atacante pode alterar
o conteudo e recalcular o checksum. Nao e criptografia nem substitui assinatura
digital, controle de acesso, validacao completa de schema ou backup externo.
A restauracao e apenas em memoria e nao esta integrada ao app ou ao Firestore.
A estrutura minima do snapshot nao valida todas as regras financeiras; etapas
futuras devem integrar o validador de dominio antes de restaurar dados reais.

## Teste
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\backup-recovery\backup.test.cjs

Meta: 26/26 aprovados. Apos isso, executar regressao das etapas 23, 24 e 26
com emuladores; nenhuma mudanca foi feita nas rotas HTTP nesta etapa.
