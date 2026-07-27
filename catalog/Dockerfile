# Build context is the repo root, not catalog/ — the webpack build resolves
# modules from ../shared (see internals/webpack/webpack.base.js).
FROM node:26-trixie-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS build

WORKDIR /src/catalog

# Manifests only, so editing app sources doesn't invalidate `npm ci`.
COPY catalog/package.json catalog/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY shared /src/shared
COPY catalog ./
RUN npm run build

FROM amazonlinux:2023.11.20260406.2
MAINTAINER Quilt Data, Inc. support@quilt.bio

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

# Upgrade and install dependencies
# gettext is required by envsubst
RUN dnf -y upgrade && dnf -y install gettext nginx && dnf -y clean all

# Make logs show up in Docker output
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

# Set up nginx
COPY catalog/nginx.conf /etc/nginx/nginx.conf
COPY catalog/nginx-web.conf /etc/nginx/conf.d/default.conf

ARG NGINX_STATIC_DIR=/usr/share/nginx/html
RUN rm -rf $NGINX_STATIC_DIR
COPY --from=build /src/catalog/build $NGINX_STATIC_DIR

# Copy config file
COPY catalog/config.json.tmpl config.json.tmpl

RUN ln -s /tmp/config.json $NGINX_STATIC_DIR/config.json && \
    ln -s /tmp/config.js $NGINX_STATIC_DIR/config.js

# Use SIGQUIT for a "graceful" shutdown
STOPSIGNAL SIGQUIT

# Substitute environment variables into config.json and generate config.js based on that before starting nginx.
# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD envsubst < config.json.tmpl > /tmp/config.json \
    && echo "window.QUILT_CATALOG_CONFIG = `cat /tmp/config.json`" > /tmp/config.js \
    && exec nginx -g 'daemon off;'
