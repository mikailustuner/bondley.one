# Hesaplamalar (calculations) tablosunu manuel doldurma - PowerShell

param(
    [string]$Date = "",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptPath "populate-calculations.py"

$args = @()
if ($Date) { $args += "--date", $Date }
if ($DryRun) { $args += "--dry-run" }

$pythonCmd = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } elseif (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
& $pythonCmd $pythonScript $args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
