FROM amazonlinux:2023.9.20250929.0
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

# Upgrade and install dependencies
# gettext is required by envsubst
RUN dnf -y upgrade && dnf -y install gettext nginx && dnf -y clean all

# Make logs show up in Docker output
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

# Set up nginx
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-web.conf /etc/nginx/conf.d/default.conf

ARG NGINX_STATIC_DIR=/usr/share/nginx/html
# Copy pre-built catalog assets to nginx
RUN rm -rf $NGINX_STATIC_DIR
COPY build $NGINX_STATIC_DIR

# Copy config file
COPY config.json.tmpl config.json.tmpl

RUN ln -s /tmp/config.json $NGINX_STATIC_DIR/config.json && \
    ln -s /tmp/config.js $NGINX_STATIC_DIR/config.js

# Use SIGQUIT for a "graceful" shutdown
STOPSIGNAL SIGQUIT

# Substitute environment variables into config.json and generate config.js based on that before starting nginx.
# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD envsubst < config.json.tmpl > /tmp/config.json \
    && echo "window.QUILT_CATALOG_CONFIG = `cat /tmp/config.json`" > /tmp/config.js \
    && exec nginx -g 'daemon off;'
