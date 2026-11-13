# Frontend (Astro) em modo dev: no compose src/public/configs entram por bind mount, com hot reload.
# Mudou package.json? Rebuild: docker compose up -d --build frontend
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4321

CMD ["npx", "astro", "dev", "--host", "0.0.0.0", "--port", "4321"]
