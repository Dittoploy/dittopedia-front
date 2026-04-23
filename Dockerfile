# ---- Dependencies ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* bun.lockb* ./
RUN bun install --no-save

# ---- Build ----
FROM oven/bun:1 AS builder
WORKDIR /app

# Déclaration de l'argument de build
ARG NEXT_PUBLIC_API_URL
# Injection dans l'environnement pour Next.js (Build Time)
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Suppression préventive du cache local
RUN rm -rf .next
RUN bun run build

# ---- Production ----
FROM node:22-alpine AS runner
WORKDIR /app

# Redéclaration pour le serveur Node (Runtime)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Récupération de l'output standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]