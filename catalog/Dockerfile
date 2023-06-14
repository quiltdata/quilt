FROM nginx:1.24.0@sha256:4163ad4bfd95632013dca65ba9f4762b4c0200973703a3c5be48f37d3715a7d1
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

# Set up nginx
COPY nginx-web.conf /etc/nginx/conf.d/default.conf

# Copy pre-built catalog assets to nginx
RUN rm -rf /usr/share/nginx/html
COPY build /usr/share/nginx/html

# Copy config file
COPY config.json.tmpl config.json.tmpl

# Substitute environment variables into config.json and generate config.js based on that before starting nginx.
# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD envsubst < config.json.tmpl > /usr/share/nginx/html/config.json \
    && echo "window.QUILT_CATALOG_CONFIG = `cat /usr/share/nginx/html/config.json`" > /usr/share/nginx/html/config.js \
    && exec nginx -g 'daemon off;'
