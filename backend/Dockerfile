# Stage 1: Build Stage
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para la compilación de bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --build-from-source

COPY . .
RUN npm run build

# Stage 2: Run Stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "dist/main"]
