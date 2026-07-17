# Worker de navegador (Hetzner). Imagen oficial de Playwright: incluye Chromium
# y todas las librerías del sistema. Mantener el tag alineado con la versión de
# `playwright` en package.json (1.59.1).
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

# Instalar dependencias con el lockfile de la raíz (reuso de src/ y del Prisma
# Client generado). Se instalan también devDeps porque el worker corre con tsx.
COPY package.json package-lock.json ./
RUN npm ci

# Generar el Prisma Client dentro de la imagen.
COPY prisma ./prisma
RUN npx prisma generate

# Código compartido + worker (el alias @/ se resuelve a ../src vía tsconfig).
COPY tsconfig.json ./
COPY src ./src
COPY worker ./worker

ENV NODE_ENV=production
ENV WORKER_HEALTH_PORT=3100
EXPOSE 3100

WORKDIR /app/worker
CMD ["npm", "run", "start"]
