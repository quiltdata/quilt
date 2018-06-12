FROM ubuntu:16.04
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update -y
RUN apt-get install -y python3 python3-dev python3-pip build-essential
RUN pip3 install uwsgi

# Create Quilt user
RUN useradd -s /bin/bash -m quilt

# Install the dependencies
COPY requirements.txt /usr/src/quilt-server/
RUN pip3 install -r /usr/src/quilt-server/requirements.txt

# Setup uwsgi
COPY uwsgi.ini /etc/uwsgi.ini

# Install the Flask app
# Do this as the last step to maximize caching.
COPY quilt_server /usr/src/quilt-server/quilt_server
COPY setup.py MANIFEST.in /usr/src/quilt-server/
RUN pip3 install /usr/src/quilt-server/

USER quilt
WORKDIR /home/quilt
COPY scripts ./scripts
COPY migrations ./migrations

ENV QUILT_SERVER_CONFIG=prod_config.py

# Needed to run `flask db ...`
ENV FLASK_APP=quilt_server

# Enable colors.
ENV TERM=xterm-256color

# Display the deployment ID in the bash prompt, with pretty colors.
RUN echo 'PS1="\\[\\033[01;31m\\]\${DEPLOYMENT_ID-[No DEPLOYMENT_ID]}\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ "' >> ~/.bashrc

EXPOSE 9000

CMD ["uwsgi", "--ini", "/etc/uwsgi.ini"]
