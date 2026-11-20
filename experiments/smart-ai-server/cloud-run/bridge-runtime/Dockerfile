FROM node:22-bookworm-slim
WORKDIR /app/experiments/smart-ai-server/cloud-run/bridge-runtime
COPY experiments/smart-ai-server/cloud-run/bridge-runtime/package*.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts
COPY experiments/smart-ai-server/ /app/experiments/smart-ai-server/
USER node
ENV NODE_ENV=production PORT=8080 SMART_AI_BRIDGE_ENABLED=false
EXPOSE 8080
CMD ["node","server.mjs"]
