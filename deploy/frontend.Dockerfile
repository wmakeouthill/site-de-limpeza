# Frontend Astro em produção (adapter Node standalone). Quem builda é o deploy/deploy.ps1.
# O Dockerfile da raiz é o de desenvolvimento (astro dev com hot reload).
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vira o `site` (canonical) e o domínio aceito atrás do nginx: ver astro.config.mjs.
ARG PUBLIC_SITE_BASE_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
