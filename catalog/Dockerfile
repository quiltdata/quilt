FROM nginx:1.21.1@sha256:77e8d894dd80c62dafed1ba880954ff707bf0053710aeca2b639258cd6314f2f
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
