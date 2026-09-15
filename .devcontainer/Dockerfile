FROM mcr.microsoft.com/devcontainers/go:1.26-bookworm

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
