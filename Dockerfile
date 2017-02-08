FROM ubuntu:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update -y
RUN apt-get install -y python3 python3-dev python3-pip build-essential
RUN apt-get install -y git curl vim net-tools nginx
RUN apt-get install -y supervisor
RUN pip3 install uwsgi

# Install the requirements from setup.py before copying the server code.
# This is redundant, but it avoids unnecessary image rebuilds
# and speeds up docker build/push/pull significantly.
RUN pip3 install boto3 Flask Flask-JSON Flask-Migrate packaging PyMySQL requests-oauthlib

# Create Quilt user
RUN useradd -s /bin/bash -m quilt

# Setup uwsgi
COPY uwsgi.ini /etc/uwsgi.ini
RUN mkdir /var/log/uwsgi/
RUN chown quilt:quilt /var/log/uwsgi/

# Setup Nginx
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-quilt.conf /etc/nginx/sites-available/quilt
RUN rm /etc/nginx/sites-enabled/default
RUN ln -s /etc/nginx/sites-available/quilt /etc/nginx/sites-enabled/quilt

# Setup Supervisor
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install the Flask app
# Do this as the last step to maximize caching.
COPY quilt_server /usr/src/quilt-server/quilt_server
COPY migrations /usr/src/quilt-server/migrations
COPY setup.py MANIFEST.in /usr/src/quilt-server/
RUN pip3 install /usr/src/quilt-server/

# Needed to run `flask db ...`
ENV FLASK_APP=quilt_server

# Download Flask app config
COPY config-entrypoint.py /config-entrypoint.py
ENTRYPOINT ["/config-entrypoint.py"]

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
