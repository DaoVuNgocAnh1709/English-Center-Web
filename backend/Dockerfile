FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npm run prisma:generate

FROM base AS development
COPY . .
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

FROM base AS builder
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/main.js"]

