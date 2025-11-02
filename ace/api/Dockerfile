FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci || yarn --frozen-lockfile || npm i
COPY src ./src
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","src/index.js"]
