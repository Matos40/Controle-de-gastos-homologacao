# Raytech CG | Fase 1 | I07 isolamento de usuarios (laboratorio)

Escopo: Node CommonJS, usuarios, sessoes, backups e armazenamento inteiramente sinteticos em memoria.
Nao usa Firebase real, emuladores, navegador, HTTP, chaves reais ou producao.

## Controles experimentais
- Identidade de sessao vinculada a UID, token opaco de laboratorio.
- Checagem de autenticacao e propriedade em TODAS as operacoes: inicializar, ler, escrever, backup e restaurar.
- Expiracao e revogacao verificadas antes de qualquer leitura/escrita.
- Estado e revisao separados por UID.
- Backup HMAC-SHA256 com chave por usuario e ownerUid no envelope externo.
- Restauracao exige UID do envelope, chave do proprio usuario e revisao atual.
- Auditoria basica por UID e tipo de acao; sem dados financeiros.
- Falhas de autorizacao nao devem alterar o estado.

## Limitacoes e riscos abertos
- Tokens e identidades sao artificiais, sem assinatura criptografica, autenticacao real ou revogacao distribuida.
- Nao valida verificacao Firebase ID token, sessao HTTP, regras Firestore ou infraestrutura de producao.
- Backup autenticado nao e criptografado. ownerUid externo nao e autenticado pelo HMAC;
  sua verificacao e controle de roteamento adicional, nao substitui vinculo
  criptografico do proprietario ao payload. Um envelope copiado e relabelado
  e rejeitado quando as chaves por UID forem realmente distintas.
- Restaura snapshot anterior sem protecao de tombstones I05; integrar politica de
  rollback de exclusoes antes de qualquer uso real.
- Testes locais nao substituem testes E2E com Auth/Firestore Emulators nem auditoria independente.
- Nao atualizar gate de producao com base somente neste laboratorio.

## Testes
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-authz-i07\authz.test.cjs
```
Meta: 47/47, ainda nao executados pelo usuario.
Historico confirmado antes desta bateria: 1164.
Gate NOT_READY_FOR_INTEGRATION e NOT_READY_FOR_PRODUCTION.
