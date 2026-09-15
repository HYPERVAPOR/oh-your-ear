# syntax=docker/dockerfile:1
FROM node:24.16.0-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-workspace.yaml .npmrc pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /workspace/node_modules /workspace/node_modules
COPY --from=deps /workspace/apps/web/node_modules /workspace/apps/web/node_modules
COPY . .
RUN pnpm --filter @oh-your-ear/web run build

FROM nginx:1.27.5-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
