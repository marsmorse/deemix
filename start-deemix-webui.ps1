$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:DEEMIX_SERVER_PORT = "6596"
$env:DEEMIX_DATA_DIR = Join-Path $root "config"
$env:DEEMIX_MUSIC_DIR = Join-Path $root "downloads"

New-Item -ItemType Directory -Force -Path $env:DEEMIX_DATA_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $env:DEEMIX_MUSIC_DIR | Out-Null

corepack pnpm --dir "$root\packages\webui" dev
