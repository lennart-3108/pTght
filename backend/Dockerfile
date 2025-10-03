FROM node:20-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

CMD ["node", "server.js"]
