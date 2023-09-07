FROM nginx:1.24.0@sha256:82a5b0d6c6ca0bd1fcc4aa1f32ae8a0e78ebed99b8965f5b85960d461adbb828
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
