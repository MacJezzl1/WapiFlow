# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/dashboard/package*.json ./apps/dashboard/

RUN npm install

COPY . .

RUN npm run build --workspace=@wapiflow/dashboard

# Production stage
FROM nginx:alpine

COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html

COPY ./nginx-dashboard.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
