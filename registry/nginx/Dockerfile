# This dockerfile is to simplify installation, and should be pushed as quiltdata/nginx.
FROM nginx:latest

MAINTAINER Quilt Data, Inc. contact@quiltdata.io

COPY ./nginx-quilt.conf /etc/nginx/nginx-quilt.template
# Above template populated by these env vars at runtime, unless overridden:
ENV UWSGI_HOST=localhost
ENV UWSGI_PORT=9000
ENV NGINX_PORT=80

CMD /bin/bash -c "envsubst < /etc/nginx/nginx-quilt.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
