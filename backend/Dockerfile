FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

# Don't run the API as root
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
