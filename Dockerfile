FROM node:20-alpine AS base

# Install dependencies for better-sqlite3 native build
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
