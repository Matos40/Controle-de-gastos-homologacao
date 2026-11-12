# Etapa 22 - regressao de seguranca e diagnostico de metadados

Escopo: somente develop, sem escrita em main ou sincronizacao real.
O runner tests/regression-security/run.cjs usa NODE_PATH de um ambiente
separado, exige firebase e firebase-admin nesse diretorio, valida as
portas locais e executa sequencialmente cinco baterias criticas via
firebase emulators:exec. Executa Node com --trace-warnings, captura
avisos e grava relatorio JSON local. A execucao nao foi realizada
pelo assistente: somente a publicacao do codigo foi concluida.

Comando no Prompt de Comando (Windows):
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
set RAYTECH_SAFE_NODE_MODULES=C:\Users\dasle\raytech-firebase-seguranca\node_modules
node tests\regression-security\run.cjs

Prerequisitos: firebase-tools CLI disponivel no PATH, Node 22 e Java
para Firestore Emulator. O runner usa 'firebase.cmd' no Windows.
As cinco baterias somam 99 testes (19+16+22+20+22).
O relatorio gerado e raytech-regression-security-report.json
na raiz local. Nao versionar relatorios com dados ambientais.

Diagnostico MetadataLookupWarning:
- O aviso foi observado mesmo com @grpc/grpc-js 1.14.7, logo nao
  esta demonstrado que a vulnerabilidade gRPC o cause.
- A origem exata nao foi identificada: a stack de --trace-warnings
  e a evidencia necessaria.
- O Firebase Admin SDK / Google Auth pode consultar metadados de
  credenciais e project ID; isso e uma hipotese, nao diagnostico.
- O runner remove GOOGLE_APPLICATION_CREDENTIALS do processo filho
  e fixa projectId demo, hosts dos emuladores e portas. Nao desabilita
  avisos e nao usa credenciais de producao.
- Se o warning persistir, examinar warningEvidence do relatorio.
  Nao ocultar erros e nao adicionar hacks de rede.

Seguranca:
- O Firebase Authentication Emulator aceita tokens de teste e
  NAO deve ser usado em producao.
- 'npm audit: 0 vulnerabilities' foi reportado pelo usuario no
  ambiente corrigido, mas nao substitui revisao de aplicacao.
- Nao rodar npm audit fix --force.
- Runner nao altera dependencias, Firestore real ou codigo de producao.
- O runner nao prova recuperacao de falhas reais de transporte nem
  verifica o encerramento normal de testes fora das cinco baterias.
- Se algum teste falhar, corrigir somente no develop apos analisar
  o relatorio e repetir a bateria.
