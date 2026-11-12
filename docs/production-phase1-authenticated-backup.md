# Fase 1 | I03 | Backup financeiro autenticado (laboratorio)

## Escopo
Exclusivamente develop, em memoria e com dados sinteticos. Nao altera
main, funcoes reais, Firebase, backups reais ou sincronizacao.

## Protocolo experimental
Envelope: format=raytech-auth-backup-lab, version=1,
algorithm=HMAC-SHA256, keyId, payload={kind,finance}, tag.
Tag HMAC-SHA256 cobre todos os campos do envelope exceto a propria tag,
com separacao de dominio. Chave externa Buffer de no minimo 32 bytes;
nao fica no envelope. Verificacao usa timingSafeEqual.
Protege integridade e autenticidade apenas enquanto a chave permanece
secreta e confiavel. NAO criptografa dados, nao garante confidencialidade.

## Legado
Backups raytech-finance-lab v1 SHA-256 sao aceitos SOMENTE com
explicitConsent=true e retornam trust=UNAUTHENTICATED_LEGACY,
mayRestore=false. Conversao para backup autenticado exige chave externa
e consentimento, mas nao comprova a autenticidade historica do legado.
Nao aceita automaticamente outros formatos reais JSON/XLSX.

## Recuperacao
createRestoreSession implementa restore de snapshots autenticados,
revisionamento otimista e rollback em memoria. V3 pode ser autenticado
e verificado, mas restore V3 e bloqueado nesta sessao experimental
ate definir aplicacao segura de tombstones futuros.

## Limites e riscos remanescentes
- HMAC nao e criptografia de conteudo nem assinatura assimetrica.
- Gestao, rotacao, recuperacao e armazenamento seguro de chaves nao
  foram implementados. Perder a chave impede verificar o backup.
- Um invasor que obtenha a chave pode forjar envelopes validos.
- Nenhuma protecao contra replay alem da revisao em memoria.
- SHA-256 do legado nao autentica a origem.
- Nao ha persistencia real, validacao de todo o esquema financeiro,
  autenticacao de usuario, isolamento, LGPD ou auditoria independente.
- I03 tem prototipo verificavel, nao esta resolvido para producao.

## Testes
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-auth-backup\auth-backup.test.cjs
```
Meta 51/51; ainda nao executados no ambiente local do usuario.
Historico confirmado anterior: 981 testes.
Gate: NOT_READY_FOR_INTEGRATION / NOT_READY_FOR_PRODUCTION.
