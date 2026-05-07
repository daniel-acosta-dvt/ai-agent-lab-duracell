# Stage 1: Build the frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY duracell-ai-agent/frontend/package*.json ./
RUN npm install
COPY duracell-ai-agent/frontend/ ./
RUN npm run build

# Stage 2: Setup the backend
FROM node:20-slim
WORKDIR /app
COPY duracell-ai-agent/backend/package*.json ./backend/
RUN npm install --prefix backend
COPY duracell-ai-agent/backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Set environment variables
ENV NODE_ENV=production
ENV API_BACKEND_HOST=0.0.0.0

EXPOSE 8080

CMD ["node", "backend/server.js"]
