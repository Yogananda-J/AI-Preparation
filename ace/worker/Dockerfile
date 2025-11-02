FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN apk add --no-cache docker-cli coreutils \
    && (npm ci || yarn --frozen-lockfile || npm i)
COPY src ./src
ENV NODE_ENV=production
CMD ["node","src/index.js"]
