# Raytech CG: etapa 25, auditoria pre-producao do HTTP

## Evidencia existente
- Etapa 22: cinco baterias, 99/99, executadas em duas rodadas no ambiente isolado.
- Etapa 23: 20/20 casos aprovados segundo log enviado. Nao foi exibida a linha final de exit code 0.
- Etapa 24: 20/20 casos aprovados segundo log enviado. Nao foi exibida a linha final de exit code 0.
- MetadataLookupWarning: gcp-metadata -> google-auth-library -> google-gax, ETIMEDOUT.
  Origem do aviso rastreada; causa raiz do timeout nao comprovada.
- O total historico de 409 testes e baseado nas contagens informadas; nao significa
  409 casos executados em uma unica regressao ou homologacao de producao.

## Resultado: NAO PRONTO PARA PRODUCAO

### P0, bloqueadores
1. Nao existe runtime real separado e validado. O modulo exige
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8094 e FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9100.
   Esta restricao deve permanecer no laboratorio, nunca removida para deploy
   por simples troca de variaveis.
2. Falta modelo de ameacas, configuracao segura de credenciais, IAM minimo,
   TLS, isolamento de ambiente e procedimento de implantacao/reversao.

### P1, requisitos antes de exposicao HTTP
3. Validacao de schema na fronteira HTTP e erros tipados (atualmente ha
   validacao basica; excecoes classificadas por regex sobre mensagem).
4. Limites de taxa e concorrencia, timeout de requisicao, controles contra
   clientes lentos, politica de CORS/CSRF conforme modelo de autenticacao.
5. Politica de tokens revogados/expirados, verificacao de issuer/audience
   em ambiente real, App Check conforme modelo de ameacas e gestao de sessoes.
6. Observabilidade sem dados pessoais: logs estruturados, metricas, alertas,
   rastreabilidade e limites de retencao.
7. Backup, restauracao, recuperacao de desastre, testes de migracao,
   versao de schema, quota/custos e rollback.
8. Testes de abuso e fuzzing de entradas; carga e falhas reais de rede.

### P2, melhorias
9. Resolucao do MetadataLookupWarning (timeout ao consultar metadados).
10. Documentar limites de 128 KiB e versionamento da API.

## Verificacoes estaticas
tests/preproduction-http-audit/audit.test.cjs contem 24 verificacoes
de presenca de controles e referencias a testes ja existentes.
Essas verificacoes sao limitadas: nao provam resistencia contra ataques,
nem certificam seguranca de producao.

CMD Windows:
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\preproduction-http-audit\audit.test.cjs

Meta: 24/24 e exit code 0. Sem Firebase, sem rede, sem emuladores.
Nao publicar, nao integrar ao frontend, nao alterar main.
