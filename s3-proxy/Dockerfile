FROM ubuntu:18.04
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y \
    nginx \
    gettext \
    curl

COPY nginx-s3-proxy.conf /etc/nginx/sites-available/default
COPY run-nginx.sh /root/run-nginx.sh

# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD exec /root/run-nginx.sh
