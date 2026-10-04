FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./
ARG WEB_REF=upgrade/briefcase-v2
RUN npm run build && WEB_REF=$WEB_REF npm run prepare:web && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production WEB_DIST=/app/web
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/web ./web
COPY --chown=node:node package*.json ./
USER node
EXPOSE 5002
CMD ["node", "dist/index.js"]
