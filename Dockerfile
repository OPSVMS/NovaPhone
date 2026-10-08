FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# Se compila al arrancar para que las páginas estáticas lean la base de datos del entorno.
CMD ["sh", "-c", "pnpm build && pnpm start -p 3000"]
