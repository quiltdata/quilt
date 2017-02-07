FROM nginx:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

COPY nginx-s3.conf /etc/nginx/conf.d/
RUN rm /etc/nginx/conf.d/default.conf

RUN mkdir /var/www
RUN mkdir /var/www/s3
RUN chown -R nginx /var/www/s3
