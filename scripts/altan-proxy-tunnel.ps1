<#
.SYNOPSIS
  Túnel de proxy residencial para Altán RNU (Windows / PowerShell).

.DESCRIPTION
  Abre un SOCKS5 *reverse* en el VPS que sale a internet por la IP residencial de
  ESTA máquina (Windows). El worker (Docker en el VPS) enruta solo los portales de
  Altán por él vía MONITOR_PROXY_URL=socks5h://172.28.0.1:1080, saltando el 403 del
  WAF que bloquea la IP del datacenter.

  Requiere el cliente OpenSSH de Windows 10/11 (ssh.exe, ya incluido).

.EXAMPLE
  .\altan-proxy-tunnel.ps1
  .\altan-proxy-tunnel.ps1 -VpsHost 1.2.3.4 -VpsUser root -SshKey C:\Users\yo\.ssh\id_ed25519
#>
param(
  [string]$VpsHost  = "89.167.63.182",  # IP pública del VPS
  [string]$VpsUser  = "root",           # usuario SSH
  [string]$BindAddr = "172.28.0.1",     # gateway fijo de la red Docker del worker
  [int]   $BindPort = 1080,
  [string]$SshKey   = ""                 # opcional: ruta a llave privada
)

$keyArgs = @()
if ($SshKey -ne "") { $keyArgs = @("-i", $SshKey) }

Write-Host "Abriendo túnel SOCKS reverse ${BindAddr}:${BindPort} en ${VpsUser}@${VpsHost}"
Write-Host "Salida a internet por la IP de ESTA máquina (residencial). Ctrl+C para cerrar."

while ($true) {
  ssh -N `
      -o ExitOnForwardFailure=yes `
      -o ServerAliveInterval=30 `
      -o ServerAliveCountMax=3 `
      -o StrictHostKeyChecking=accept-new `
      @keyArgs `
      -R "${BindAddr}:${BindPort}" `
      "${VpsUser}@${VpsHost}"
  Write-Host "[túnel caído; reintentando en 5s...]" -ForegroundColor Yellow
  Start-Sleep -Seconds 5
}
