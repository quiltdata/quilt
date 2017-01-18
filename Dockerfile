FROM ubuntu:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io
RUN apt-get update -y
RUN apt-get install -y python3 python3-dev python3-pip build-essential
RUN apt-get install -y git curl vim net-tools nginx
RUN apt-get install -y supervisor
RUN pip3 install uwsgi
RUN mkdir /quilt
COPY . /var/www/quilt
COPY setup.py /var/www/quilt
COPY uwsgi.ini /var/www/quilt
RUN mkdir /var/log/uwsgi

RUN pip3 install -e /var/www/quilt
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8
ENV FLASK_APP=quilt_server
ENV FLASK_DEBUG=1

# Setup Nginx
RUN rm /etc/nginx/sites-enabled/default
COPY quilt-nginx /etc/nginx/sites-enabled/quilt
RUN echo "daemon off;" >> /etc/nginx/nginx.conf
RUN ln -s /var/www/quilt/quilt.conf /

# Create Quilt user
RUN useradd -s /bin/bash -d /var/www/quilt quilt
RUN chown quilt /var/www/quilt -R
RUN chown quilt /var/log/uwsgi -R

# Setup Supervisor
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
CMD ["/usr/bin/supervisord"]

