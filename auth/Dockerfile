FROM ubuntu:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update -y
RUN apt-get install -y python3 python3-dev python3-pip build-essential

RUN pip3 install Flask Flask-JSON requests-oauthlib

# Create Quilt user
RUN useradd -s /bin/bash -m quilt
USER quilt
WORKDIR /home/quilt

# Install the Flask Fake-Auth server
COPY authserver.py /home/quilt/

CMD ["/home/quilt/authserver.py"]

