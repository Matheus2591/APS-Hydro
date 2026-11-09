FROM node:24-bookworm-slim AS dependencies
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 DB_PATH=/data/server.db BACKUP_DIRECTORY=/data/backups
WORKDIR /app
COPY --from=dependencies /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY data/official ./data/official
COPY scripts/docker-entrypoint.sh /usr/local/bin/hydropulse-entrypoint
RUN mkdir -p /data && chown -R node:node /data /app
RUN chmod +x /usr/local/bin/hydropulse-entrypoint
WORKDIR /app/server
EXPOSE 10000
ENTRYPOINT ["hydropulse-entrypoint"]
CMD ["node", "--import", "tsx", "src/index.ts"]
