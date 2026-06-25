$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$envFile = Join-Path $root ".env.local"
if (Test-Path $envFile) {
	Get-Content -LiteralPath $envFile | ForEach-Object {
		$line = $_.Trim()
		if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
			return
		}

		$name, $value = $line.Split("=", 2)
		$name = $name.Trim()
		$value = $value.Trim().Trim('"').Trim("'")
		if ($name) {
			Set-Item -Path "Env:$name" -Value $value
		}
	}
}

$env:DEEMIX_SERVER_PORT = "6596"
$env:DEEMIX_DATA_DIR = Join-Path $root "config"
$env:DEEMIX_MUSIC_DIR = Join-Path $root "downloads"

New-Item -ItemType Directory -Force -Path $env:DEEMIX_DATA_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $env:DEEMIX_MUSIC_DIR | Out-Null

corepack pnpm --dir "$root\packages\webui" dev
