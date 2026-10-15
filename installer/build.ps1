# Gera o instalador Windows do Integra CRM: installer\output\IntegraCRM-Setup-<versão>.exe
#
#   powershell -ExecutionPolicy Bypass -File installer\build.ps1
#
# O que vai dentro do .exe (nada precisa estar instalado na máquina de destino):
#   runtime\   Node.js portátil (só o node.exe)
#   app\       CRM compilado (Next.js "standalone")
#   whatsapp\  serviço do WhatsApp (Python + Neonize empacotado com PyInstaller)
#   template\  banco SQLite limpo, só com o usuário do suporte (admin@crm.index)
#   migrations\ migrações do banco — aplicadas pelo launcher ao atualizar
#   launcher\  sobe/para tudo sem janela de console
#
# Pré-requisitos só NESTA máquina (a de build): Node + npm, Python 3.13 e o
# Inno Setup 6 (instalado sozinho via winget se faltar).

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = Split-Path -Parent $PSScriptRoot
$Build = Join-Path $PSScriptRoot ".build"
$Stage = Join-Path $Build "stage"
$NodeMajor = "24"

function Step($message) { Write-Host "`n==> $message" -ForegroundColor Cyan }
function Run($exe, [string[]]$arguments) {
  & $exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "Falhou: $exe $($arguments -join ' ')" }
}

Set-Location $Root
New-Item -ItemType Directory -Force $Build | Out-Null
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force $Stage | Out-Null

# Versão do instalador = versão atual do changelog (src/lib/changelog.ts).
$changelog = Get-Content (Join-Path $Root "src\lib\changelog.ts") -Raw
$Version = [regex]::Match($changelog, 'version:\s*"([^"]+)"').Groups[1].Value
if (-not $Version) { $Version = "1.0" }
Write-Host "Versão: $Version"

# Licença/atualizações: sem o "Configurar" do Integra Publicador o
# instalador sai sem controle remoto (nada trava e não atualiza sozinho).
$remoteConfig = Get-Content (Join-Path $PSScriptRoot "launcher\remote-config.json") -Raw | ConvertFrom-Json
if (-not $remoteConfig.publicKey) {
  Write-Host "AVISO: controle remoto não configurado (rode o Integra Publicador > Configurar). Este instalador não terá licença nem atualização automática." -ForegroundColor Yellow
}

# --- 1. Node.js portátil -------------------------------------------------
Step "Node.js $NodeMajor portátil"
$nodeCache = Join-Path $Build "node"
$nodeExeCached = Join-Path $nodeCache "node.exe"
if (-not (Test-Path $nodeExeCached)) {
  $base = "https://nodejs.org/dist/latest-v$NodeMajor.x"
  $sums = (Invoke-WebRequest "$base/SHASUMS256.txt" -UseBasicParsing).Content
  $line = ($sums -split "`n") | Where-Object { $_ -match "node-v[\d.]+-win-x64\.zip$" } | Select-Object -First 1
  $expectedHash, $zipName = $line.Trim() -split "\s+"
  $zipPath = Join-Path $Build $zipName
  Invoke-WebRequest "$base/$zipName" -OutFile $zipPath -UseBasicParsing
  if ((Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLower() -ne $expectedHash.ToLower()) {
    throw "Hash do Node.js não confere — download corrompido."
  }
  $extract = Join-Path $Build "node-extract"
  if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }
  Expand-Archive $zipPath $extract
  New-Item -ItemType Directory -Force $nodeCache | Out-Null
  Copy-Item (Get-ChildItem $extract -Recurse -Filter node.exe | Select-Object -First 1).FullName $nodeExeCached
  Remove-Item -Recurse -Force $extract, $zipPath
}
New-Item -ItemType Directory -Force (Join-Path $Stage "runtime") | Out-Null
Copy-Item $nodeExeCached (Join-Path $Stage "runtime\node.exe")

# --- 2. CRM compilado (Next.js standalone) ---------------------------------
Step "Compilando o CRM (Next.js standalone)"
$env:BUILD_INSTALLER = "1"
$env:NEXT_TELEMETRY_DISABLED = "1"
try {
  Run "npx.cmd" @("next", "build")
} finally {
  Remove-Item Env:BUILD_INSTALLER
}
$distDir = Join-Path $Root ".next-installer"
$app = Join-Path $Stage "app"
Copy-Item -Recurse (Join-Path $distDir "standalone") $app
Copy-Item -Recurse (Join-Path $distDir "static") (Join-Path $app ".next-installer\static")
Copy-Item -Recurse (Join-Path $Root "public") (Join-Path $app "public")
# Nunca levar .env/banco desta máquina pro instalador (segredos e dados reais).
Get-ChildItem $app -Force -Recurse -Include ".env*", "*.db", "*.db-journal" | Remove-Item -Force

# Engine nativo do Prisma (o rastreio do Next às vezes não leva).
$engineName = "query_engine-windows.dll.node"
$engineTarget = Join-Path $app "node_modules\.prisma\client"
if (-not (Test-Path (Join-Path $engineTarget $engineName))) {
  New-Item -ItemType Directory -Force $engineTarget | Out-Null
  Copy-Item (Join-Path $Root "node_modules\.prisma\client\*") $engineTarget -Recurse -Force
}

# --- 3. Banco limpo (só o admin) --------------------------------------------
Step "Banco de dados limpo (só o usuário do suporte)"
$templateDir = Join-Path $Stage "template"
New-Item -ItemType Directory -Force $templateDir | Out-Null
$templateDb = Join-Path $Build "template.db"
Remove-Item -Force -ErrorAction SilentlyContinue $templateDb, "$templateDb-journal"
$env:DATABASE_URL = "file:" + ($templateDb -replace "\\", "/")
$env:ADMIN_EMAIL = "admin@crm.index"
$env:ADMIN_PASSWORD = "123@qwe"
$env:ADMIN_NAME = "Administrador"
try {
  # Pelas migrações (não db push): o banco já sai com o registro delas, e o
  # launcher sabe o que falta aplicar quando uma versão nova for instalada.
  Run "npx.cmd" @("prisma", "migrate", "deploy")
  Run "npx.cmd" @("tsx", "prisma/seed.ts")
} finally {
  Remove-Item Env:DATABASE_URL, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_NAME
}
Copy-Item $templateDb (Join-Path $templateDir "crm.db")
Copy-Item -Recurse (Join-Path $Root "prisma\migrations") (Join-Path $Stage "migrations")

# --- 4. Serviço do WhatsApp (PyInstaller) -----------------------------------
Step "Empacotando o serviço do WhatsApp"
$pyEnv = Join-Path $Build "pyenv"
$py = Join-Path $pyEnv "Scripts\python.exe"
if (-not (Test-Path $py)) { Run "python" @("-m", "venv", $pyEnv) }
Run $py @("-m", "pip", "install", "--quiet", "--upgrade", "pip")
Run $py @("-m", "pip", "install", "--quiet", "-r", (Join-Path $Root "whatsapp-service\requirements.txt"), "pyinstaller")
$pyDist = Join-Path $Build "pydist"
Run $py @(
  "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir",
  "--name", "whatsapp-service",
  "--paths", (Join-Path $Root "whatsapp-service"),
  "--collect-all", "neonize",
  "--collect-submodules", "uvicorn",
  "--hidden-import", "python_multipart",
  "--hidden-import", "multipart",
  "--distpath", $pyDist,
  "--workpath", (Join-Path $Build "pywork"),
  "--specpath", $Build,
  (Join-Path $PSScriptRoot "whatsapp\run_service.py")
)
Copy-Item -Recurse (Join-Path $pyDist "whatsapp-service") (Join-Path $Stage "whatsapp")

# --- 5. Launcher e ícone -----------------------------------------------------
Step "Launcher"
Copy-Item -Recurse (Join-Path $PSScriptRoot "launcher") (Join-Path $Stage "launcher")
Copy-Item (Join-Path $Root "src\app\favicon.ico") (Join-Path $Stage "icon.ico")
# Versão instalada — o atualizador (launcher\updater.js) compara com a publicada.
Set-Content -Path (Join-Path $Stage "version.txt") -Value $Version -NoNewline -Encoding ascii

# --- 6. Instalador (Inno Setup) ---------------------------------------------
Step "Gerando o instalador"
$iscc = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) {
  Write-Host "Inno Setup não encontrado — instalando via winget..."
  Run "winget" @("install", "--id", "JRSoftware.InnoSetup", "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements")
  $iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $iscc) { throw "Inno Setup instalado mas ISCC.exe não encontrado." }
}
Run $iscc @("/Qp", "/DAppVersion=$Version", (Join-Path $PSScriptRoot "IntegraCRM.iss"))

$output = Join-Path $PSScriptRoot "output\IntegraCRM-Setup-$Version.exe"

# Novidades desta versão (do changelog) ao lado do .exe — o Integra
# Publicador usa no aviso "Nova versão disponível" dos clientes.
$notesFile = Join-Path $PSScriptRoot "output\IntegraCRM-Setup-$Version.json"
Run "npx.cmd" @("tsx", (Join-Path $PSScriptRoot "publisher\release-notes.ts"), $notesFile)

Write-Host "`nPronto: $output" -ForegroundColor Green
Write-Host ("Tamanho: {0:N0} MB" -f ((Get-Item $output).Length / 1MB))
