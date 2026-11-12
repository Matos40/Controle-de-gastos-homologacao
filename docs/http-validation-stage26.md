# Etapa 26: validacao de entradas HTTP e erros tipados

Implementado apenas na branch develop e no endpoint HTTP de laboratorio.
Sem modificacao de main, frontend, deploy ou sincronizacao real.

## Mudancas
- Novo modulo js/services/httpInputValidationLab.js.
- Fronteira POST aceita apenas campos definidos na raiz.
- Operacoes exigem chave, mes, tipo, precondicao, valor e ID quando aplicavel.
- Salario exige numero finito; registros exigem ID consistente.
- Snapshots exigem mes selecionado e colecoes basicas.
- Limite de profundidade/quantidade de nos e bloqueio de chaves perigosas.
- Erros de entrada HTTP 400 com codigo estavel; erros Firebase Auth 401
  pelo codigo auth/; demais erros 422 sem mensagem interna.
- Modulo financeiro trustedFinanceBackendLab.js nao alterado.

## Limites
Validacao HTTP ainda nao e schema financeiro completo. O conversor
financeiro segue validando o modelo de negocio. A classificacao de
erros ainda nao e um contrato final para producao. Nao habilitar deploy.

## Testes
20 novos cenarios negativos e de compatibilidade com inicializacao,
operacao e auditoria validas. Apos passar, repetir etapas 23 e 24.

CMD Windows:
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
set NODE_PATH=C:\Users\dasle\raytech-firebase-seguranca\node_modules
set FIRESTORE_EMULATOR_HOST=127.0.0.1:8094
set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9100
firebase emulators:exec --config tests\emulator-http-finance\firebase.json --only auth,firestore --project demo-raytech-cg-http-lab "node tests\emulator-http-validation\validation.test.cjs"

Meta: 20/20, exit code 0. Regressao das etapas 23 e 24 obrigatoria
antes de considerar etapa 26 concluida.
