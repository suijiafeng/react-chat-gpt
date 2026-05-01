# ==========================================
# Stage 1: Build Stage
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Vite 构建期环境变量（docker compose 里传入；默认为纯前端演示模式）
ARG VITE_USE_LOCAL_DATA=true
ARG VITE_WEBUI_BASE_URL=
ARG VITE_APP_NAME=
ENV VITE_USE_LOCAL_DATA=$VITE_USE_LOCAL_DATA \
    VITE_WEBUI_BASE_URL=$VITE_WEBUI_BASE_URL \
    VITE_APP_NAME=$VITE_APP_NAME

# Build the application
RUN npm run build

# ==========================================
# Stage 2: Serve Stage (Production-ready)
# ==========================================
FROM nginx:alpine

# Copy built static files to Nginx public folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config for SPA routing support
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
