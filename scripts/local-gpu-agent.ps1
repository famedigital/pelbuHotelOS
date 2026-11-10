#Requires -Version 5.1
<#
.SYNOPSIS
  Ensures Ollama is running locally and prints OpenAI-compatible endpoint hints for Cursor / Continue.

.NOTES
  Does not modify Hotel OS application code. Safe to run from repo root.
  API key for Ollama-compatible clients is typically a dummy value (e.g. "ollama").

  On Windows, `ollama` may be installed via WinGet portable package without being on PATH;
  this script searches common locations and prepends the directory to PATH for the session.
#>

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
  Write-Host "[local-gpu-agent] $Message"
}

function Get-OllamaExecutable {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
    "${env:ProgramFiles}\Ollama\ollama.exe",
    "${env:ProgramFiles(x86)}\Ollama\ollama.exe"
  )

  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) {
      return $p
    }
  }

  $pkgRoot = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
  if (Test-Path -LiteralPath $pkgRoot) {
    $found = Get-ChildItem -LiteralPath $pkgRoot -Directory -Filter "Ollama.Ollama*" -ErrorAction SilentlyContinue |
      ForEach-Object {
        $exe = Join-Path $_.FullName "ollama.exe"
        if (Test-Path -LiteralPath $exe) { $exe }
      } | Select-Object -First 1
    if ($found) {
      return $found
    }
  }

  return $null
}

# Refresh PATH so a standard install is found
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath"

$ollamaExe = Get-OllamaExecutable
if (-not $ollamaExe) {
  Write-Error @"
ollama.exe not found. Install Ollama (e.g. winget install Ollama.Ollama / Ollama.Ollama.Portable), open a new terminal, or add the install folder to PATH.
"@
}

$ollamaDir = Split-Path -Parent $ollamaExe
if ($env:Path -notlike "*$ollamaDir*") {
  $env:Path = "$ollamaDir;$env:Path"
}

Write-Info "Using: $ollamaExe"

try {
  $ver = & $ollamaExe --version 2>&1
  Write-Info "CLI: $ver"
}
catch {
  Write-Error "ollama failed to run: $($_.Exception.Message)"
}

$port = 11434
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  Write-Info "No listener on port $port; starting ollama serve in a hidden window."
  Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden | Out-Null
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) { break }
  }
}

if (-not $listener) {
  Write-Warning "Port $port still not listening. Start 'ollama serve' manually and re-run this script."
}
else {
  Write-Info "Ollama API listening on http://127.0.0.1:$port/v1 (OpenAI-compatible)."
}

Write-Host ""
Write-Host "--- Paste-friendly settings ---"
Write-Host "Base URL:    http://127.0.0.1:11434/v1"
Write-Host "API key:     ollama   (dummy; required by some UIs)"
Write-Host "Model:       qwen2.5-coder:3b"
Write-Host ""
Write-Host "Quick check: ollama ps"
Write-Host "GPU check:   nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv"
