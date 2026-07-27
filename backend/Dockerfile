FROM node:20-alpine

# Нужны для сборки better-sqlite3, если не найдётся готовый пребилд под платформу.
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
EXPOSE 8010

CMD ["node", "src/server.js"]
