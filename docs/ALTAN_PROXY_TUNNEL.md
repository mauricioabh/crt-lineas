# Proxy residencial para Altán RNU (túnel desde la laptop)

## Problema

El portal de Altán (`rnu.altanredes.com`) responde **HTTP 403** a las peticiones que
salen desde la IP del datacenter del VPS (Hetzner). Lo hace un **AWS WAF** por
reputación de ASN: bloquea rangos de hosting/VPN (Hetzner, Cloudflare‑WARP, etc.)
pero **acepta IPs residenciales** (por eso funciona desde tu navegador y desde
Vercel/AWS). No es CAPTCHA ni detección de headless: un `curl` simple desde el VPS
ya recibe 403.

## Solución

El worker enruta **solo los portales de Altán** por un proxy SOCKS5 que sale por una
IP residencial. La fuente de esa IP es **tu laptop**, conectada por un túnel SSH
_reverse_. El resto del scraping sigue saliendo directo por el VPS.

```
Laptop (IP residencial MX)                 VPS (Hetzner)
┌───────────────────────┐   ssh -N -R    ┌────────────────────────────┐
│ ssh client = SOCKS5    │◄──────────────│ sshd escucha 172.28.0.1:1080│
│ egress por tu internet │  172.28.0.1   │ worker (Docker) usa         │
└───────────────────────┘   :1080        │ MONITOR_PROXY_URL           │
        │                                 │  = socks5://172.28.0.1:1080│
        ▼                                 └────────────────────────────┘
   Altán RNU (200)                          (solo patrones altan-*)
```

## Cómo se enciende

1. En el VPS, el worker ya está configurado (`.env.worker`):
   ```
   MONITOR_PROXY_URL=socks5://172.28.0.1:1080
   # MONITOR_PROXY_PATTERN_IDS=altan-rnu,altan-rnu-consulta   # default
   ```
2. En tu laptop, abre el túnel (déjalo corriendo mientras quieras verificar Altán):
   - **Windows**: `pwsh scripts/altan-proxy-tunnel.ps1`
   - **macOS/Linux/Git Bash**: `./scripts/altan-proxy-tunnel.sh`

   Ajusta host/usuario/llave con variables o parámetros si difieren de los
   defaults (VPS `89.167.63.182`, usuario `root`).

3. Dispara la verificación de Altán como siempre. Si el túnel está arriba, sale por
   tu IP residencial y el 403 desaparece. Si el túnel está caído, la verificación de
   Altán fallará por diseño (no cae de vuelta a la IP del datacenter).

## Requisitos en el VPS (ya aplicados)

- `sshd`: `GatewayPorts clientspecified` (`/etc/ssh/sshd_config.d/60-gatewayports.conf`).
- Red Docker fija: `docker-compose.worker.yml` define subnet `172.28.0.0/16`,
  gateway `172.28.0.1`.
- Firewall: `ufw allow from 172.28.0.0/16 to any port 1080 proto tcp`.

## Verificar que el túnel funciona

Con el túnel arriba, desde el VPS:

```bash
# IP de salida a través del túnel (debe ser tu IP residencial, NO Hetzner)
curl -s -x socks5://172.28.0.1:1080 https://api.ipify.org; echo
# Altán a través del túnel (debe ser 200, no 403)
curl -s -o /dev/null -w '%{http_code}\n' -x socks5://172.28.0.1:1080 https://rnu.altanredes.com/
```

## Notas

- Tu IP residencial es dinámica; si cambia, el túnel se **reconecta solo** (el
  cliente sale saliente y el script reintenta). No afecta a Altán porque lo que
  importa es que sea residencial, no la IP exacta.
- Alternativa sin depender de la laptop: un proxy residencial de pago
  (p. ej. DataImpulse ~$1/GB, Decodo ~$4/GB). Se enchufa con el mismo
  `MONITOR_PROXY_URL` (formato `socks5h://user:pass@host:port` o `http://...`).
