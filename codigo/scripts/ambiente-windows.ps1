param(
    [ValidateSet('Preparar', 'Iniciar', 'Verificar', 'Demonstrar', 'Tipos')]
    [string]$Acao = 'Preparar'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

function Test-HydroNode24 {
    param([string]$File)
    if (-not $File -or -not (Test-Path -LiteralPath $File -PathType Leaf)) { return $null }
    try {
        $version = (& $File -p 'process.versions.node' 2>$null | Out-String).Trim()
        $result = $LASTEXITCODE
        $npm = Join-Path (Split-Path -Parent $File) 'node_modules/npm/bin/npm-cli.js'
        if ($result -eq 0 -and $version -match '^24\.\d+\.\d+$' -and (Test-Path -LiteralPath $npm)) {
            return [pscustomobject]@{ Node = $File; Npm = $npm; Version = $version }
        }
    } catch { }
    return $null
}

function Find-HydroNode24 {
    param([string]$ToolsDirectory)
    $candidates = @()
    if (Test-Path -LiteralPath $ToolsDirectory) {
        $candidates += @(Get-ChildItem -LiteralPath $ToolsDirectory -Directory -Filter 'node-v24.*-win-*' | ForEach-Object { Join-Path $_.FullName 'node.exe' })
    }
    $candidates += @(Get-Command node.exe -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if ($base) { $candidates += Join-Path $base 'nodejs/node.exe' }
    }
    foreach ($file in ($candidates | Select-Object -Unique)) {
        $found = Test-HydroNode24 -File $file
        if ($found) { return $found }
    }
    return $null
}

function Test-HydroCloudflared {
    param([string]$File)
    if (-not $File -or -not (Test-Path -LiteralPath $File -PathType Leaf)) { return $null }
    try {
        $version = (& $File --version 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $version -match '^cloudflared version ') {
            return [pscustomobject]@{ File = $File; Version = $version }
        }
    } catch { }
    return $null
}

function Find-HydroCloudflared {
    param([string]$ToolsDirectory)
    $candidates = @(Join-Path $ToolsDirectory 'cloudflared.exe')
    $candidates += @(Get-Command cloudflared.exe -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($base) { $candidates += Join-Path $base 'cloudflared/cloudflared.exe' }
    }
    foreach ($file in ($candidates | Select-Object -Unique)) {
        $found = Test-HydroCloudflared -File $file
        if ($found) { return $found }
    }
    return $null
}

function Get-HydroWindowsArchitecture {
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    switch ($architecture) {
        'AMD64' { return 'x64' }
        'ARM64' { return 'arm64' }
        default { throw 'Este preparador precisa de Windows de 64 bits (x64 ou ARM64).' }
    }
}

function Get-HydroToolPath {
    param([string]$ToolsDirectory, [string]$Relative)
    $base = [IO.Path]::GetFullPath($ToolsDirectory)
    $target = [IO.Path]::GetFullPath((Join-Path $base $Relative))
    $separator = [IO.Path]::DirectorySeparatorChar
    if (-not $target.StartsWith($base.TrimEnd($separator) + $separator, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Caminho de ferramenta invalido.'
    }
    return $target
}

function Save-HydroDownload {
    param([string]$Url, [string]$Destination, [string]$ExpectedHash)
    if ($ExpectedHash -notmatch '^[a-fA-F0-9]{64}$') { throw 'A fonte oficial nao forneceu um SHA-256 valido.' }
    $address = [Uri]$Url
    if ($address.Scheme -ne 'https' -or $address.Host -notin @('nodejs.org', 'github.com')) {
        throw 'Endereco de download fora das fontes oficiais permitidas.'
    }
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force
    Write-Host ('Baixando: ' + $Url)
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination -TimeoutSec 240
    if ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $ExpectedHash) {
        throw 'A integridade do download nao confere. Nenhuma ferramenta desse arquivo foi executada. Tente novamente.'
    }
}

function Install-HydroNode24 {
    param([string]$ToolsDirectory)
    $architecture = Get-HydroWindowsArchitecture
    $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 30
    $release = $releases | Where-Object { $_.version -match '^v24\.\d+\.\d+$' -and $_.files -contains "win-$architecture-zip" } | Select-Object -First 1
    if (-not $release) { throw 'Nao foi encontrada uma distribuicao oficial Node.js 24 para este Windows.' }
    $version = [string]$release.version
    $name = "node-$version-win-$architecture.zip"
    $baseUrl = "https://nodejs.org/dist/$version"
    $checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt" -TimeoutSec 30).Content
    $pattern = '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($name) + '\s*$'
    $match = [regex]::Match([string]$checksums, $pattern)
    if (-not $match.Success) { throw 'O arquivo de verificacao oficial nao identifica o ZIP do Node.js.' }
    $archive = Get-HydroToolPath $ToolsDirectory "downloads/$name"
    Save-HydroDownload -Url "$baseUrl/$name" -Destination $archive -ExpectedHash $match.Groups[1].Value
    # The verified Node ZIP extracts into its own versioned directory; no existing installation is removed.
    Expand-Archive -LiteralPath $archive -DestinationPath $ToolsDirectory -Force
    $executable = Get-HydroToolPath $ToolsDirectory "node-$version-win-$architecture/node.exe"
    $node = Test-HydroNode24 -File $executable
    if (-not $node) { throw 'O Node.js 24 baixado nao iniciou corretamente neste Windows.' }
    return $node
}

function Install-HydroCloudflared {
    param([string]$ToolsDirectory)
    $architecture = Get-HydroWindowsArchitecture
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest' -Headers @{ 'User-Agent' = 'HydroPulse-Setup' } -TimeoutSec 30
    $name = if ($architecture -eq 'arm64' -and @($release.assets | Where-Object { $_.name -eq 'cloudflared-windows-arm64.exe' }).Count) { 'cloudflared-windows-arm64.exe' } else { 'cloudflared-windows-amd64.exe' }
    $asset = $release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if (-not $asset) { throw 'A publicacao oficial nao oferece o executavel cloudflared para este Windows.' }
    $expected = $null
    if ($asset.PSObject.Properties.Name -contains 'digest' -and $asset.digest -match '^sha256:([a-fA-F0-9]{64})$') {
        $expected = $Matches[1]
    } else {
        $match = [regex]::Match([string]$release.body, [regex]::Escape($name) + ':\s*([a-fA-F0-9]{64})')
        if ($match.Success) { $expected = $match.Groups[1].Value }
    }
    if (-not $expected) { throw 'A publicacao oficial nao forneceu o SHA-256 do cloudflared.' }
    $url = [string]$asset.browser_download_url
    if (-not $url.StartsWith('https://github.com/cloudflare/cloudflared/releases/download/')) { throw 'Endereco inesperado para o cloudflared.' }
    $download = Get-HydroToolPath $ToolsDirectory "downloads/$name"
    Save-HydroDownload -Url $url -Destination $download -ExpectedHash $expected
    $executable = Get-HydroToolPath $ToolsDirectory 'cloudflared.exe'
    Copy-Item -LiteralPath $download -Destination $executable -Force
    $cloud = Test-HydroCloudflared -File $executable
    if (-not $cloud) { throw 'O cloudflared baixado nao iniciou neste Windows. No ARM64, o binario x64 exige suporte de emulacao do Windows.' }
    return $cloud
}

function Initialize-HydroTools {
    param([string]$ProjectRoot, [switch]$AllowDownload)
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json'))) { throw 'Extraia o ZIP inteiro, mantendo a pasta codigo e os arquivos CMD.' }
    $toolsDirectory = Join-Path $ProjectRoot '.runtime/ferramentas'
    $node = Find-HydroNode24 -ToolsDirectory $toolsDirectory
    if (-not $node) {
        if (-not $AllowDownload) { throw 'Node.js 24 nao encontrado. Execute PREPARAR_DEPENDENCIAS.cmd primeiro.' }
        Write-Host '[1/3] Preparando Node.js 24 local para este projeto...'
        $node = Install-HydroNode24 -ToolsDirectory $toolsDirectory
    }
    Write-Host ('Node.js: ' + $node.Version)
    $cloud = Find-HydroCloudflared -ToolsDirectory $toolsDirectory
    if (-not $cloud) {
        if (-not $AllowDownload) { throw 'cloudflared nao encontrado. Execute PREPARAR_DEPENDENCIAS.cmd primeiro.' }
        Write-Host '[2/3] Preparando cloudflared local para este projeto...'
        $cloud = Install-HydroCloudflared -ToolsDirectory $toolsDirectory
    }
    Write-Host $cloud.Version
    # Apply paths only to this process and its children, without replacing other projects' runtimes.
    $env:PATH = (Split-Path -Parent $node.Node) + ';' + (Split-Path -Parent $cloud.File) + ';' + $env:PATH
    $env:HYDROPULSE_CLOUDFLARED = $cloud.File
    return [pscustomobject]@{ Node = $node.Node; Npm = $node.Npm; Cloudflared = $cloud.File }
}

function Invoke-HydroWindows {
    param([string]$Action, [string]$ProjectRoot)
    $tools = Initialize-HydroTools -ProjectRoot $ProjectRoot -AllowDownload:($Action -eq 'Preparar')
    Push-Location -LiteralPath $ProjectRoot
    try {
        switch ($Action) {
            'Preparar' {
                Write-Host '[3/3] Instalando as dependencias do app e da API. Aguarde...'
                & $tools.Node $tools.Npm run setup
                if ($LASTEXITCODE -ne 0) { throw 'A instalacao das dependencias falhou. Confira o erro acima, a internet e execute o preparador novamente.' }
                Write-Host 'Tudo preparado. Agora execute INICIAR_APRESENTACAO.cmd.'
            }
            'Iniciar' {
                if (-not (Test-Path -LiteralPath 'server/node_modules/tsx')) { throw 'As dependencias da API ainda nao estao prontas. Execute PREPARAR_DEPENDENCIAS.cmd.' }
                & $tools.Node scripts/presentation.mjs
                if ($LASTEXITCODE -ne 0) { throw 'A API ou o tunel encerrou com erro. Confira a mensagem acima.' }
            }
            'Verificar' { Write-Host 'Ferramentas encontradas. Nenhuma instalacao foi executada.' }
            'Demonstrar' {
                & $tools.Node $tools.Npm run demo:idempotency
                if ($LASTEXITCODE -ne 0) { throw 'A demonstracao de idempotencia nao terminou. Confira o erro acima.' }
            }
            'Tipos' {
                & $tools.Node $tools.Npm run typecheck
                if ($LASTEXITCODE -ne 0) { throw 'A verificacao de tipos encontrou um problema. Confira o erro acima.' }
            }
        }
    } finally { Pop-Location }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        $projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
        Invoke-HydroWindows -Action $Acao -ProjectRoot $projectRoot
        exit 0
    } catch {
        Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
        Write-Host 'As ferramentas baixadas ficam em codigo/.runtime/ferramentas. Nenhum Node.js de outro projeto foi removido.'
        exit 1
    }
}
