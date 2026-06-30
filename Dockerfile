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
