FROM amazonlinux:2.0.20190115
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN yum install -y gettext
RUN amazon-linux-extras install nginx1.12

COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-quilt.conf /etc/nginx/nginx-quilt.template

CMD ["/bin/bash", "-c", "envsubst < /etc/nginx/nginx-quilt.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
