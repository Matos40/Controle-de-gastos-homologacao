# Etapa 28: seguranca de credenciais e sessoes (laboratorio)

Escopo: develop, HTTP local e emuladores. Sem publicacao, sem sincronizacao real.

- HTTP agora exige Bearer com formato de tres segmentos JWT, sem espacos ou caracteres estranhos.
- Credenciais invalidas recebem 401 com erro generico unauthorized, sem ecoar o token.
- Modulo isolado httpSessionSecurityLab.js valida claims de sessao (uid, iat, exp, auth_time)
  e fornece verificador opcional via Firebase Admin SDK com checkRevoked configuravel.
- IMPORTANTE: validacao adicional de claims e checkRevoked NAO estao conectados ao
  fluxo HTTP financeiro nesta etapa. O backend HTTP continua usando verifyIdToken
  pelo emulatorAuthBackendLab.js; a verificacao de revogacao em producao exige
  planejamento de latencia e tratamento de indisponibilidade.
- Estrutura de JWT NAO autentica tokens: somente verifyIdToken do Admin SDK autentica.
- Nao adicionar tokens a logs, codigo, repositorio ou arquivos de teste.
- Sem garantia de resistencia a ataques distribuidos ou deploy em producao.

## Testes
node tests\\http-session-security\\session.test.cjs
Meta: 21/21, exit code 0.

Depois repetir regressao HTTP 23, 24 e 26 usando emuladores conforme
docs/http-guards-stage27.md.
