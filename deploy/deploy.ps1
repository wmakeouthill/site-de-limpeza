<#
Deploy do site Falcao Limpeza na VM Oracle: builda as imagens nesta maquina (a VM tem 1 GB de RAM),
manda por scp e sobe o deploy/compose.yaml. Mesmo modelo do deploy da Falcon Advocacia.

  .\deploy\deploy.ps1                # build + envio + up (1a vez e atualizacoes)
  .\deploy\deploy.ps1 -Setup         # DuckDNS apontando para a VM + nginx do host + certificado
  .\deploy\deploy.ps1 -FrontendOnly  # so o site: nao builda nem envia o backend

Le .env.production (fora do git): config do app (.env.example) + VPS_HOST, VPS_USER, VPS_SSH_KEY,
VPS_APP_DIR e, opcionais, CERTBOT_EMAIL, DUCK_DNS_TOKEN. No servidor ele vira $VPS_APP_DIR/.env.
O dominio sai de PUBLIC_SITE_BASE_URL; se for *.duckdns.org, o -Setup instala o atualizador do DuckDNS.
Trocou o dominio? Ajuste PUBLIC_SITE_BASE_URL/CORS_ORIGINS/CMS_FRONTEND_URL, rode -Setup e depois o deploy
(o dominio entra no build do frontend).
#>
param(
    [switch]$Setup,
    [switch]$FrontendOnly,
    [string]$EnvFile = '.env.production'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Fail([string]$msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }
function Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not (Test-Path $EnvFile)) { Fail "$EnvFile nao encontrado (modelo: .env.example + VPS_*)." }
$cfg = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') { $cfg[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"') }
}
$required = 'VPS_HOST', 'VPS_USER', 'VPS_SSH_KEY', 'VPS_APP_DIR', 'PUBLIC_SITE_BASE_URL',
    'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'CMS_SESSION_SECRET', 'CMS_ALLOWED_EMAILS'
$missing = $required | Where-Object { -not $cfg[$_] }
if ($missing) { Fail "Faltando em ${EnvFile}: $($missing -join ', ')" }
if ($cfg['CMS_SESSION_SECRET'].Length -lt 32) { Fail "CMS_SESSION_SECRET precisa de 32+ caracteres." }
if ($cfg['POSTGRES_PASSWORD'] -notmatch '^[A-Za-z0-9]+$') { Fail "POSTGRES_PASSWORD so com [A-Za-z0-9]: ela entra crua na DATABASE_URL." }

$siteUrl = $cfg['PUBLIC_SITE_BASE_URL'].TrimEnd('/')
$domain = ([Uri]$siteUrl).Host
$isDuck = $domain -like '*.duckdns.org'
$appDir = $cfg['VPS_APP_DIR']
$target = "$($cfg['VPS_USER'])@$($cfg['VPS_HOST'])"
$sshOpts = @('-C', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-i', $cfg['VPS_SSH_KEY'])

function Invoke-Remote([string]$script) {
    # base64 evita briga de aspas entre PowerShell, ssh e bash.
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($script -replace "`r", '')))
    & ssh @sshOpts $target "echo $b64 | base64 -d | bash -e"
    if ($LASTEXITCODE -ne 0) { Fail "comando remoto falhou (exit $LASTEXITCODE)" }
}

function Send-File([string]$local, [string]$remote) {
    & scp @sshOpts $local "${target}:$remote"
    if ($LASTEXITCODE -ne 0) { Fail "scp falhou: $local" }
}

if ($Setup) {
    if ($isDuck) {
        if (-not $cfg['DUCK_DNS_TOKEN']) { Fail "Faltando DUCK_DNS_TOKEN em $EnvFile" }
        $sub = $domain -replace '\.duckdns\.org$', ''
        Step "DuckDNS: $domain -> IP da VM"
        # Sem ip= o DuckDNS usa o IP de quem chama (a VM). Cron a cada 5 min, como os outros de /opt/duckdns.
        Invoke-Remote @"
sudo mkdir -p /opt/duckdns
sudo tee /opt/duckdns/$sub.sh >/dev/null <<'EOF'
#!/bin/sh
curl -fsS -m 20 -o /opt/duckdns/$sub.log "https://www.duckdns.org/update?domains=$sub&token=$($cfg['DUCK_DNS_TOKEN'])&ip="
EOF
sudo chmod 700 /opt/duckdns/$sub.sh
(sudo crontab -l 2>/dev/null | grep -v '# $sub`$' || true; echo '*/5 * * * * /opt/duckdns/$sub.sh >/dev/null 2>&1 # $sub') | sudo crontab -
sudo /opt/duckdns/$sub.sh
test "`$(cat /opt/duckdns/$sub.log)" = OK || { echo 'DuckDNS recusou: confira DUCK_DNS_TOKEN e o subdominio'; exit 1; }
for _ in `$(seq 1 30); do getent ahostsv4 $domain | grep -q '^$($cfg['VPS_HOST']) ' && exit 0; sleep 5; done
echo 'DNS ainda nao aponta para $($cfg['VPS_HOST']); rode -Setup de novo em alguns minutos'
exit 1
"@
    }

    Step "nginx + certificado para $domain"
    # DuckDNS nao ganha www; dominio real ganha www redirecionando para o canonico.
    $names = if ($isDuck) { $domain } else { "$domain www.$domain" }
    $certDomains = ($names -split ' ' | ForEach-Object { "-d $_" }) -join ' '
    $certEmail = if ($cfg['CERTBOT_EMAIL']) { "-m $($cfg['CERTBOT_EMAIL'])" } else { '--register-unsafely-without-email' }
    $nginx = (Get-Content deploy/nginx.conf -Raw -Encoding UTF8) -replace '__SERVER_NAMES__', $names -replace '__DOMAIN__', $domain -replace "`r", ''
    $nginxB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($nginx))
    Invoke-Remote @"
echo $nginxB64 | base64 -d | sudo tee /etc/nginx/sites-available/falcao-limpeza >/dev/null
sudo ln -sf /etc/nginx/sites-available/falcao-limpeza /etc/nginx/sites-enabled/falcao-limpeza
sudo nginx -t
sudo systemctl reload nginx
# O certbot do snap traz o plugin nginx e é o do timer de renovação; um certbot de pip no PATH pode não ter.
CB=/snap/bin/certbot; [ -x "`$CB" ] || CB=certbot
sudo "`$CB" --nginx $certDomains --non-interactive --agree-tos $certEmail --redirect
"@
    Write-Host "`n[OK] HTTPS ativo: $siteUrl" -ForegroundColor Green
    exit 0
}

Step "build das imagens"
$images = @('falcao-limpeza-frontend:latest')
if (-not $FrontendOnly) {
    & docker build -t falcao-limpeza-backend:latest backend
    if ($LASTEXITCODE -ne 0) { Fail "build do backend" }
    $images += 'falcao-limpeza-backend:latest'
}
& docker build -f deploy/frontend.Dockerfile --build-arg "PUBLIC_SITE_BASE_URL=$siteUrl" -t falcao-limpeza-frontend:latest .
if ($LASTEXITCODE -ne 0) { Fail "build do frontend" }

Step "envio para $target"
$tar = Join-Path ([IO.Path]::GetTempPath()) 'falcao-limpeza-images.tar'
& docker save -o $tar @images
if ($LASTEXITCODE -ne 0) { Fail "docker save" }
Invoke-Remote "mkdir -p '$appDir'"
Send-File $tar /tmp/falcao-limpeza-images.tar
Send-File deploy/compose.yaml "$appDir/compose.yaml"
Send-File $EnvFile "$appDir/.env"
Remove-Item $tar

Step "subindo"
Invoke-Remote @"
docker load -i /tmp/falcao-limpeza-images.tar
rm -f /tmp/falcao-limpeza-images.tar
cd '$appDir'
chmod 600 .env
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
for _ in {1..30}; do curl -fsS -o /dev/null http://127.0.0.1:4321/ && exit 0; sleep 2; done
echo 'frontend nao respondeu em 60s'
docker compose logs --tail 50
exit 1
"@

Write-Host "`n[OK] no ar: $siteUrl" -ForegroundColor Green
Write-Host "1o acesso ao CMS (define a senha de cada e-mail de CMS_ALLOWED_EMAILS):"
Write-Host "  ssh -t -i $($cfg['VPS_SSH_KEY']) $target `"cd $appDir && docker compose exec backend uv run --no-sync python -m app.cli set-password <email>`""
