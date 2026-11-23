# Multi-stage build for web frontend
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install

COPY . .
# Must match the namespace the graph was built with (backend MOVIELENS_NAMESPACE).
ARG VITE_GRAPH_NAMESPACE
ENV VITE_GRAPH_NAMESPACE=$VITE_GRAPH_NAMESPACE
RUN bun run build

# Production static web server
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

