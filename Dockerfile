FROM ubuntu:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update -y
RUN apt-get install -y python3 python3-dev python3-pip build-essential

# Create Quilt user
RUN useradd -s /bin/bash -m quilt

# Setup uwsgi
COPY uwsgi.ini /etc/uwsgi.ini

# Install the dependencies
COPY requirements.txt /usr/src/quilt-server/
RUN pip3 install -r /usr/src/quilt-server/requirements.txt

# Install the Flask app
# Do this as the last step to maximize caching.
COPY quilt_server /usr/src/quilt-server/quilt_server
COPY migrations /usr/src/quilt-server/migrations
COPY setup.py MANIFEST.in /usr/src/quilt-server/
WORKDIR /usr/src/quilt-server/
RUN pip3 install /usr/src/quilt-server/

# Needed to run `flask db ...`
ENV FLASK_APP=quilt_server

# Download Flask app config
COPY config-entrypoint.py /config-entrypoint.py
ENTRYPOINT ["/config-entrypoint.py"]

EXPOSE 9000

CMD ["uwsgi", "--ini", "/etc/uwsgi.ini"]
