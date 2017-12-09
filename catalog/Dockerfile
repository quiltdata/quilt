FROM nginx:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

COPY build /usr/share/nginx/html
COPY config.js.tmpl .
COPY nginx-web.conf /etc/nginx/conf.d/
RUN rm /etc/nginx/conf.d/default.conf

# Substitute environment variables into config.js before starting nginx.
# Note: run "bash" explicitly cause "sh" is causing weird problems.
CMD ["bash", "-c", "envsubst < config.js.tmpl > /usr/share/nginx/html/config.js && nginx -g 'daemon off;'"]
