FROM alpine:3.20 AS build
WORKDIR /src

COPY index.html ./index.html
COPY css ./css
COPY js ./js

RUN test -s index.html && \
    test -s css/styles.css && \
    test -s js/app.js && \
    mkdir -p /dist/css /dist/js && \
    cp index.html /dist/index.html && \
    cp -r css/. /dist/css/ && \
    cp -r js/. /dist/js/ && \
    chmod -R a+rX /dist

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /dist /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/nginx-health > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
