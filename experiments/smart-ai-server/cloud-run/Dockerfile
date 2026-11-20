FROM node:22-bookworm-slim
WORKDIR /app
COPY experiments/smart-ai-server/ ./experiments/smart-ai-server/
USER node
ENV NODE_ENV=production PORT=8080 SMART_AI_EXPERIMENT_ENABLED=false SMART_AI_REAL_GEMINI_ENABLED=false
EXPOSE 8080
CMD ["node","/app/experiments/smart-ai-server/cloud-run/server.mjs"]
