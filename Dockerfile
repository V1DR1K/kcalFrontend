FROM node:24-alpine AS build
ARG GIT_HASH=unknown
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN GIT_HASH=${GIT_HASH} npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
