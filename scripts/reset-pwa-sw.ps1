# Reset Service Worker + cache HTTP per i browser principali (Windows).
# Lascia intatti cookie / login (la sessione Supabase resta valida).
#
# Uso (da PowerShell nella root del repo):
#   powershell -ExecutionPolicy Bypass -File scripts/reset-pwa-sw.ps1
#
# Effetto:
#   1. Chiude Chrome / Edge.
#   2. Cancella la cartella `Service Worker` (tutti i siti — i SW si riregistrano alla prossima visita).
#   3. Cancella la cache HTTP (Cache + Code Cache).
#   4. Riapre il calendario di Empathy Pro 2 sul venerdi' 2026-05-29.
#
# DOPO la prima volta: il nuovo SW (commit 7cf7bfb) ha skipWaiting/clientsClaim,
# quindi i deploy successivi si auto-attivano senza altre pulizie manuali.

param(
  [string]$Url = "https://empathy-pro-2-web.vercel.app/training/calendar?day=2026-05-29"
)

$ErrorActionPreference = "Continue"

Write-Host "==> Chiudo Chrome ed Edge..." -ForegroundColor Cyan
Get-Process -Name "chrome", "msedge" -ErrorAction SilentlyContinue | ForEach-Object {
  try { $_ | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Seconds 2

$browserProfiles = @(
  @{ Name = "Chrome"; Root = "$env:LOCALAPPDATA\Google\Chrome\User Data" },
  @{ Name = "Edge";   Root = "$env:LOCALAPPDATA\Microsoft\Edge\User Data" }
)

foreach ($bp in $browserProfiles) {
  if (-not (Test-Path $bp.Root)) {
    Write-Host "   $($bp.Name): non trovato (OK, lo salto)" -ForegroundColor DarkGray
    continue
  }
  Write-Host "==> $($bp.Name) -> pulisco Service Worker e cache HTTP" -ForegroundColor Cyan
  $profilesDirs = @(Get-ChildItem -Path $bp.Root -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "Default" -or $_.Name -like "Profile *" })
  foreach ($pd in $profilesDirs) {
    $targets = @("Service Worker", "Cache", "Code Cache")
    foreach ($t in $targets) {
      $full = Join-Path $pd.FullName $t
      if (Test-Path $full) {
        try {
          Get-ChildItem -Path $full -Recurse -Force -ErrorAction SilentlyContinue |
            Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
          Write-Host "     pulito: $($pd.Name)\$t" -ForegroundColor DarkGray
        } catch {
          Write-Host "     skip   : $($pd.Name)\$t (in uso)" -ForegroundColor DarkYellow
        }
      }
    }
  }
}

Write-Host "==> Riapro: $Url" -ForegroundColor Green

$chromePaths = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$edgePaths = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$opened = $false
foreach ($p in $chromePaths) {
  if (Test-Path $p) { Start-Process -FilePath $p -ArgumentList $Url; $opened = $true; break }
}
if (-not $opened) {
  foreach ($p in $edgePaths) {
    if (Test-Path $p) { Start-Process -FilePath $p -ArgumentList $Url; $opened = $true; break }
  }
}
if (-not $opened) {
  Write-Host "   Nessun browser noto trovato — apro con il default OS" -ForegroundColor Yellow
  Start-Process $Url
}

Write-Host "Fatto. Da ora in poi i deploy si auto-aggiornano senza altre pulizie." -ForegroundColor Green
