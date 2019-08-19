FROM ubuntu:16.04
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    gettext \
    libssl-dev \
    build-essential \
    libpng-dev
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

EXPOSE 3000

RUN mkdir /opt/app
WORKDIR /opt/app

# Install dependencies
COPY package.json .
COPY internals internals
RUN npm install

# Install the app
COPY . .
RUN npm run build
CMD npm start
COPY config.json.tmpl config.json.tmpl

# Set up nginx
COPY nginx-web.conf /etc/nginx/sites-available/default
RUN rm -rf /usr/share/nginx/html
RUN cp -r /opt/app/build/ /usr/share/nginx/html/

# Substitute environment variables into config.js before starting nginx.
# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD envsubst < config.json.tmpl > /usr/share/nginx/html/config.json && exec nginx -g 'daemon off;'
