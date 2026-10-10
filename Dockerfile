# Override for a registry mirror, e.g. --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:24-bookworm-slim
ARG NODE_IMAGE=node:24-bookworm-slim

# ---- build ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
# Toolchain for better-sqlite3 if no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm ci --registry=$NPM_REGISTRY
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    DATA_DIR=/data \
    TZ=Asia/Shanghai
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini tzdata && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/src/server/migrations.ts /app/src/server/seed.ts ./src/server/
COPY --from=build --chown=node:node /app/src/server/auth/password.ts ./src/server/auth/
USER node
VOLUME ["/data"]
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
# Migrations run automatically on start (idempotent).
CMD ["sh", "-c", "node --no-warnings scripts/migrate.ts && node dist/server/entry.mjs"]
