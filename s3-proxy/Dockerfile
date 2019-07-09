FROM amazonlinux:2.0.20190115
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

RUN amazon-linux-extras install nginx1.12

COPY nginx.conf /etc/nginx/nginx.conf
COPY run-nginx.sh /root/run-nginx.sh

CMD /root/run-nginx.sh
