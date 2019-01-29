FROM amazonlinux:2.0.20190115
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN yum update -y
RUN yum install -y gcc glibc-devel make
RUN yum install -y curl gettext openssl-devel libpng-devel
RUN amazon-linux-extras install nginx1.12

#RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN curl -sL https://rpm.nodesource.com/setup_8.x | bash -
RUN yum install -y nodejs

RUN mkdir /opt/app
WORKDIR /opt/app

# Install dependencies
COPY package.json .
COPY internals internals
RUN npm install

# Install the app
COPY app app
COPY static static
COPY config.js.tmpl .
RUN npm run build

# Set up nginx
COPY nginx-web.conf /etc/nginx/sites-available/default
RUN rm -rf /usr/share/nginx/html
RUN cp -r /opt/app/build/ /usr/share/nginx/html/

# Substitute environment variables into config.js before starting nginx.
# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD envsubst < config.js.tmpl > /usr/share/nginx/html/config.js && exec nginx -g 'daemon off;'
