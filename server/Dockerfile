# 后端（登录 + LLM 代理）镜像
# 用 slim（glibc）而非 alpine：better-sqlite3 官方预编译二进制只覆盖 glibc，
# alpine(musl) 下会退回源码编译，需要额外装 python3/make/g++
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# SQLite 数据目录，运行时挂载数据卷持久化
RUN mkdir -p /app/data
VOLUME /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
