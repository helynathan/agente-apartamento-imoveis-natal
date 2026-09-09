FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

# O EasyPanel não repassa as variáveis da aba "Ambiente" como build args do Docker,
# e NEXT_PUBLIC_* precisa existir no momento do build (fica embutido no bundle do
# navegador) — por isso o valor vem fixo aqui, não do .env em runtime. Se o domínio
# do realtime mudar, é preciso editar esta linha e fazer novo build.
ENV NEXT_PUBLIC_REALTIME_WS_URL=wss://ws-aptimoveis.nathai.com.br/ws

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl tini bash

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
RUN chmod +x ./scripts/start-all.sh

EXPOSE 3000 4001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./scripts/start-all.sh"]
