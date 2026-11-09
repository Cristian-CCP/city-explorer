# syntax=docker/dockerfile:1

# =========================================================
# Etapa 1 (build): prepara los archivos estáticos en /dist
# y valida que existan los archivos esperados.
# =========================================================
FROM alpine:3.20 AS build
WORKDIR /src
COPY index.html ./
COPY css ./css
COPY js ./js
RUN mkdir -p /dist \
 && test -f index.html && test -f css/styles.css && test -f js/app.js \
 && cp -r index.html css js /dist/ \
 && find /dist -type f -exec chmod 0644 {} \; \
 && find /dist -type d -exec chmod 0755 {} \;

# =========================================================
# Etapa 2 (runtime): Nginx sin privilegios (usuario nginx, uid 101)
# =========================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="city-explorer-frontend" \
      org.opencontainers.image.description="Frontend de City Explorer servido por Nginx" \
      org.opencontainers.image.licenses="MIT"

COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/nginx-health > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
