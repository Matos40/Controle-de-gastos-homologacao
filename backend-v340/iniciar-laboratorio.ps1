$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 22 LTS antes de iniciar.' }
  if ((node -p "process.versions.node.split('.')[0]") -ne '22') { throw 'Este laboratorio requer Node.js 22.' }
  if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'Instale Java JDK 21 antes de iniciar.' }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm nao encontrado.' }
  foreach ($port in 19099,18080,15001,15002,4400,4500,9150) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($listener) { throw "Porta $port ocupada. Nenhum processo existente sera encerrado." }
  }
  $env:GCLOUD_PROJECT='demo-raytech-v340'
  $env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:19099'
  $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:18080'
  $env:RAYTECH_PRACTICAL='1'
  $env:CI='true'
  $env:GOOGLE_APPLICATION_CREDENTIALS=$null
  $env:FIREBASE_TOKEN=$null
  Push-Location functions
  try {
    $hash=(Get-FileHash package-lock.json -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne 'd46084ed8e33b2b6899ca0ad6b78dc9de3e53c26e4ba145c51f9fbd4c73f82b1') { throw 'Lockfile divergente.' }
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependencias.' }
  } finally { Pop-Location }
  Write-Host 'Iniciando apenas emuladores locais. Aguarde a abertura do navegador.'
  & npx.cmd --yes firebase-tools@15.35.0 emulators:exec --project demo-raytech-v340 --only auth,firestore,functions "node functions/practical-session.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Laboratorio encerrado com erro.' }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
