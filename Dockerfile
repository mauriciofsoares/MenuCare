FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci

FROM deps AS api-build
COPY apps/api ./apps/api
RUN npm run prisma:generate --workspace apps/api && npm run build --workspace apps/api

FROM deps AS web-build
COPY apps/web ./apps/web
RUN npm run build --workspace apps/web

FROM node:20-alpine AS api-runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=api-build /app/apps/api/dist ./apps/api/dist

EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]

FROM nginx:1.27-alpine AS web-runtime
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]