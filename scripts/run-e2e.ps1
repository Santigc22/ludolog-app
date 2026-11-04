$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repositoryRoot "apps/web"
$nodePath = (Get-Command node.exe).Source
$apiEntry = Join-Path $repositoryRoot "apps/api/dist/server.js"
$nextEntry = Join-Path $repositoryRoot "node_modules/next/dist/bin/next"

$env:NODE_ENV = "test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:API_PORT = "3001"
$env:WEB_ORIGIN = "http://localhost:3000"
$env:NEXT_PUBLIC_API_URL = "http://localhost:3001/api/v1"

$apiProcess = $null
$webProcess = $null

function Wait-ForHttp([string]$Url, [System.Diagnostics.Process]$Process) {
  for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
    if ($Process.HasExited) {
      throw "Server process exited before becoming ready: $Url"
    }

    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    }
    catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timed out waiting for server: $Url"
}

try {
  $apiProcess = Start-Process -FilePath $nodePath `
    -ArgumentList $apiEntry `
    -WorkingDirectory $repositoryRoot `
    -WindowStyle Hidden `
    -PassThru
  Wait-ForHttp "http://localhost:3001/api/v1/health" $apiProcess

  $env:NODE_ENV = "production"
  $webProcess = Start-Process -FilePath $nodePath `
    -ArgumentList $nextEntry, "start", "-p", "3000" `
    -WorkingDirectory $webRoot `
    -WindowStyle Hidden `
    -PassThru
  Wait-ForHttp "http://localhost:3000" $webProcess

  $env:PLAYWRIGHT_EXTERNAL_SERVERS = "1"
  & npx.cmd playwright test
  exit $LASTEXITCODE
}
finally {
  foreach ($process in @($webProcess, $apiProcess)) {
    if ($null -ne $process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
      $process.WaitForExit()
    }
  }
}
