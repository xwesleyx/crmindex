# Gera o Integra Publicador (programa do fornecedor, NÃO vai para os
# clientes): installer\output\IntegraPublicador.exe
#
#   powershell -ExecutionPolicy Bypass -File installer\publisher\build-publicador.ps1
#
# É o publicador.js empacotado junto com o Node num único .exe ("single
# executable application" do próprio Node — precisa do Node 25.5 ou mais novo
# nesta máquina). O .exe roda sozinho, sem Node instalado.

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Build = Join-Path $Root "installer\.build\publicador"
$Output = Join-Path $Root "installer\output"
New-Item -ItemType Directory -Force $Build, $Output | Out-Null

$exe = Join-Path $Output "IntegraPublicador.exe"
$config = @{
  main = (Join-Path $PSScriptRoot "publicador.js")
  output = $exe
  disableExperimentalSEAWarning = $true
} | ConvertTo-Json
$configFile = Join-Path $Build "sea-config.json"
Set-Content -Path $configFile -Value $config -Encoding utf8

& node --build-sea $configFile
if ($LASTEXITCODE -ne 0) { throw "Falhou ao gerar o IntegraPublicador.exe (precisa do Node 25.5+)." }

Write-Host "`nPronto: $exe" -ForegroundColor Green
