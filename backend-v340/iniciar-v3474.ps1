$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 22 LTS.' }
  if ((node -p "process.versions.node.split('.')[0]") -ne '22') { throw 'Node.js 22 requerido.' }
  if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'Instale JDK 21.' }
  $javaVersion = (& cmd.exe /d /c 'java -version 2>&1' | Out-String)
  if ($javaVersion -notmatch 'version "21[.]') { throw 'Java JDK 21 requerido.' }
  foreach ($port in 19099,18080,15001,15003,4400,4500,9150) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Porta $port ocupada. Nenhum processo sera encerrado." }
  }
  $env:GCLOUD_PROJECT='demo-raytech-v340'
  $env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:19099'
  $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:18080'
  $env:GOOGLE_APPLICATION_CREDENTIALS=$null
  $env:FIREBASE_TOKEN=$null
  $env:CI='true'
  if (!(Test-Path 'workspace-v345/dist/index.html') -or !(Test-Path 'workspace-v345/dist-firestore.rules')) { throw 'Pacote incompleto. Extraia o ZIP oficial de homologacao.' }
  Push-Location functions
  try {
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependencias do backend.' }
  } finally { Pop-Location }
  & npx.cmd --yes firebase-tools@15.35.0 emulators:exec --config firebase-v3473.json --project demo-raytech-v340 --only auth,firestore,functions "node rc3474-session.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Laboratorio encerrado com erro.' }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
