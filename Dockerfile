FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install --frozen-lockfile || bun install

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node node_modules/@prisma/engines/scripts/postinstall.js && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
