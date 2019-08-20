FROM ubuntu:16.04
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y \
    nginx \
    gettext \
    curl

EXPOSE 3000

RUN mkdir /opt/app
WORKDIR /opt/app

# Set up nginx
COPY nginx-web.conf /etc/nginx/sites-available/default
RUN rm -rf /usr/share/nginx/html

# Copy pre-built catalog assets to nginx
COPY build /usr/share/nginx/html

# Copy config file
COPY config.json.tmpl config.json.tmpl

# Substitute environment variables into config.js before starting nginx.
# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD envsubst < config.json.tmpl > /usr/share/nginx/html/config.json && exec nginx -g 'daemon off;'
