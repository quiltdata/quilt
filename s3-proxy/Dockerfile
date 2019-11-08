FROM nginx:1.17.5
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

COPY nginx-s3-proxy.conf /etc/nginx/conf.d/default.conf
COPY run-nginx.sh /root/run-nginx.sh

# Note: use "exec" because otherwise the shell will catch Ctrl-C and other signals.
CMD exec /root/run-nginx.sh
