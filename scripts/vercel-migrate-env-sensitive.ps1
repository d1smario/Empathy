# Converte variabili Vercel in Sensitive SENZA cambiare valore (update/add, no delete).
# Prerequisiti: cd apps/web && npx vercel link -p empathy-pro-2-web && vercel whoami
#
# 1) Backup (root monorepo):
#      cd apps/web
#      npx vercel env pull ..\..\.env.vercel.migrate.local --environment=production --yes
#      npx vercel env pull ..\..\.env.vercel.migrate.preview.local --environment=preview --yes
# 2) Dry-run:  powershell -File scripts\vercel-migrate-env-sensitive.ps1 -DryRun
# 3) Esegui:   powershell -File scripts\vercel-migrate-env-sensitive.ps1
#
# Development: Vercel non supporta Sensitive -> update/add encrypted (stesso valore).

param(
  [switch]$DryRun,
  [string[]]$Names = @(),
  [string]$WebDir = "$PSScriptRoot\..\apps\web"
)

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$ProdEnvFile = Join-Path $RepoRoot ".env.vercel.migrate.local"
$PreviewEnvFile = Join-Path $RepoRoot ".env.vercel.migrate.preview.local"

$ErrorActionPreference = "Stop"

$SecretNames = @(
  "CRON_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GARMIN_OAUTH_PKCE_SECRET",
  "GARMIN_PULL_RUN_SECRET",
  "GARMIN_PUSH_WEBHOOK_SECRET",
  "GARMIN_OAUTH2_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "REPLICATE_API_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "USDA_API_KEY",
  "ANTHROPIC_API_KEY",
  "LOGMEAL_API_KEY"
)

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
    $val = $val.Trim("`r", "`n", " ")
    $val = $val -replace "[\r\n]+", ""
    $map[$key] = $val
  }
  return $map
}

function Invoke-VercelEnv([string]$SubCommand, [string]$Name, [string]$Environment, [string]$Value, [switch]$Sensitive) {
  Push-Location $RepoRoot
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $args = @("--cwd", "apps/web", "env", $SubCommand, $Name)
    if ($Environment) { $args += $Environment }
    $args += "--yes"
    if ($Sensitive) { $args += "--sensitive" }
    $args += @("--value", $Value)
    $out = & npx vercel @args 2>&1
    $code = $LASTEXITCODE
    $out | ForEach-Object { Write-Host $_ }
    return @{ Code = $code; Out = ($out | Out-String) }
  } finally {
    $ErrorActionPreference = $prevEap
    Pop-Location
  }
}

function Upsert-SensitiveEnv([string]$Name, [string]$Environment, [string]$Value) {
  Write-Host "-> $Name [$Environment]" -ForegroundColor Cyan
  if ($DryRun) { return }

  $res = Invoke-VercelEnv "update" $Name $Environment $Value -Sensitive
  if ($res.Code -eq 0) { return }

  if ($res.Out -match "already exists|Sensitive Environment Variable") {
    Write-Host "  gia presente/sensitive, skip." -ForegroundColor DarkGray
    return
  }

  Write-Host "  update fallito, provo add..." -ForegroundColor DarkYellow
  $res = Invoke-VercelEnv "add" $Name $Environment $Value -Sensitive
  if ($res.Code -ne 0 -and $res.Out -notmatch "already exists") {
    throw "vercel env add/update failed ($($res.Code)) for $Name [$Environment]"
  }
}

function Upsert-DevEnv([string]$Name, [string]$Value) {
  Write-Host "-> $Name [development] (encrypted)" -ForegroundColor DarkCyan
  if ($DryRun) { return }

  $res = Invoke-VercelEnv "update" $Name "development" $Value
  if ($res.Code -eq 0) { return }

  $res = Invoke-VercelEnv "add" $Name "development" $Value
  if ($res.Code -ne 0 -and $res.Out -notmatch "already exists") {
    throw "vercel env add/update failed ($($res.Code)) for $Name [development]"
  }
}

$prodMap = Read-DotEnv $ProdEnvFile
$previewMap = Read-DotEnv $PreviewEnvFile

if ($prodMap.Count -eq 0) {
  Write-Host "Manca backup: $ProdEnvFile"
  Write-Host "cd apps/web; npx vercel env pull ..\..\.env.vercel.migrate.local --environment=production --yes"
  exit 1
}

$targetNames = if ($Names.Count -gt 0) { $Names } else { $SecretNames }

Write-Host "Progetto: empathy-pro-2-web (apps/web/.vercel)"
Write-Host "Variabili: $($targetNames.Count)"
if ($DryRun) { Write-Host "[DRY-RUN]" -ForegroundColor Yellow }

foreach ($name in $targetNames) {
  if (-not $prodMap.ContainsKey($name)) {
    Write-Host "SKIP $name (assente nel backup production)" -ForegroundColor DarkYellow
    continue
  }
  $prodVal = $prodMap[$name]
  $previewVal = if ($previewMap.ContainsKey($name)) { $previewMap[$name] } else { $prodVal }

  Upsert-SensitiveEnv $name "production" $prodVal
  Upsert-SensitiveEnv $name "preview" $previewVal
  Upsert-DevEnv $name $prodVal
}

Write-Host ""
Write-Host "Completato. Redeploy production da dashboard Vercel." -ForegroundColor Green
Write-Host "Elimina .env.vercel.migrate*.local quando finito."
