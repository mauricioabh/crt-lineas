#!/usr/bin/env bash
#
# Túnel de proxy residencial para Altán RNU (macOS / Linux / Git Bash / WSL).
#
# Abre un SOCKS5 *reverse* en el VPS que sale a internet por la IP residencial de
# ESTA máquina. El worker (Docker) enruta solo los portales de Altán por él vía
# `MONITOR_PROXY_URL=socks5h://172.28.0.1:1080`, saltando el 403 del WAF que
# bloquea la IP del datacenter.
#
# Requisitos en el VPS (ya configurados):
#   - sshd: `GatewayPorts clientspecified`
#   - docker-compose.worker.yml con red fija 172.28.0.0/16 (gateway 172.28.0.1)
#   - UFW: allow from 172.28.0.0/16 to any port 1080
#
# Uso:
#   ./altan-proxy-tunnel.sh                # usa valores por defecto de abajo
#   VPS_HOST=1.2.3.4 VPS_USER=root ./altan-proxy-tunnel.sh
#
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.167.63.182}"   # IP pública del VPS
VPS_USER="${VPS_USER:-root}"            # usuario SSH del VPS
BIND_ADDR="${BIND_ADDR:-172.28.0.1}"    # gateway fijo de la red Docker del worker
BIND_PORT="${BIND_PORT:-1080}"
SSH_KEY="${SSH_KEY:-}"                   # opcional: ruta a llave privada

KEY_ARG=()
[ -n "$SSH_KEY" ] && KEY_ARG=(-i "$SSH_KEY")

echo "Abriendo túnel SOCKS reverse ${BIND_ADDR}:${BIND_PORT} en ${VPS_USER}@${VPS_HOST}"
echo "Salida a internet por la IP de ESTA máquina (residencial). Ctrl+C para cerrar."

# -N: sin shell remota | -R bind:port (sin destino) = SOCKS5 dinámico reverse
# ExitOnForwardFailure: aborta si no logra enlazar el puerto
# ServerAliveInterval/ClientAliveInterval + autoreconexión en bucle
while true; do
  ssh -N \
      -o ExitOnForwardFailure=yes \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o StrictHostKeyChecking=accept-new \
      "${KEY_ARG[@]}" \
      -R "${BIND_ADDR}:${BIND_PORT}" \
      "${VPS_USER}@${VPS_HOST}" || true
  echo "[túnel caído; reintentando en 5s...]" >&2
  sleep 5
done
