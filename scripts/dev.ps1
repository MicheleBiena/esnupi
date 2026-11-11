param([int]$Port = 5173)
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = Join-Path $taskRoot '.tools\node_modules\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $taskNode)) {
    $taskNode = (Get-Command node -ErrorAction Stop).Source
}
Push-Location -LiteralPath $taskRoot
try {
    & $taskNode 'node_modules/vite/bin/vite.js' --host 127.0.0.1 --port $Port --strictPort
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
