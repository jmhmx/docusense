FROM node:20-alpine

# Instalar dependencias necesarias para la compilación de bcrypt
RUN apk add --no-cache python3 make g++ 

WORKDIR /app
COPY package*.json ./

# Instalar dependencias con recreación de binarios nativos
RUN npm install --build-from-source

COPY . .
RUN npm run build

CMD ["node", "dist/main"]