FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine

COPY docker-nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/dist /usr/share/nginx/html

EXPOSE 80
