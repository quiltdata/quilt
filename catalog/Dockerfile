FROM nginx:1.17.5
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

# Set up nginx
COPY nginx-web.conf /etc/nginx/conf.d/default.conf

# Copy pre-built catalog assets to nginx
RUN rm -rf /usr/share/nginx/html
COPY build /usr/share/nginx/html

# Copy config file
COPY config.json.tmpl config.json.tmpl

# Substitute environment variables into config.js before starting nginx.
# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD envsubst < config.json.tmpl > /usr/share/nginx/html/config.json && exec nginx -g 'daemon off;'
